#!/usr/bin/env python3
"""
Rate controller for API requests with dynamic concurrency adjustment

Implements host-based rate limiting with:
- Token bucket for RPS control
- Sliding window for periodic limits (e.g., 200 req/5min for Steam Store API)
- Dynamic concurrency adjustment based on Little's Law
- HTTP 429/Retry-After handling with exponential backoff
"""

import asyncio
import time
import logging
import math
from collections import deque
from typing import Dict, Optional, Tuple
from dataclasses import dataclass, field
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)


@dataclass
class HostMetrics:
    """Metrics for a single host"""
    # Request tracking (timestamp-based deques for sliding windows)
    sent_times: deque = field(default_factory=deque)  # ALL sent requests (for window limit)
    success_times: deque = field(default_factory=deque)  # Successful requests only (for metrics)
    error_times: deque = field(default_factory=deque)

    # RTT tracking
    rtt_samples: deque = field(default_factory=deque)  # Recent RTT samples
    ewma_rtt: float = 1.5  # Exponential weighted moving average RTT (seconds)
    base_rtt: Optional[float] = None  # Baseline RTT from warmup

    # Rate limit tracking
    total_requests: int = 0
    http_429_count: int = 0
    http_403_count: int = 0
    network_error_count: int = 0

    # Backoff state
    backoff_multiplier: float = 1.0
    last_backoff_time: float = 0

    # Concurrency control
    current_concurrency: int = 5
    last_concurrency_increase: float = 0
    warmup_completed: bool = False


class RateController:
    """
    Host-based rate controller with dynamic concurrency adjustment

    Key features:
    - Token bucket for target RPS enforcement
    - Sliding window for periodic limits (e.g., 200/5min)
    - Dynamic concurrency based on Little's Law: concurrency = ceil(target_rps * ewma_rtt) + safety_margin
    - Adaptive increase/decrease based on 429 errors, RTT, and window usage
    """

    def __init__(self, host: str, target_rps: float, window_seconds: int,
                 window_limit: int, initial_concurrency: int = 5,
                 warmup_requests: int = 20, ewma_alpha: float = 0.2):
        """
        Args:
            host: Host identifier (e.g., "store", "web", "itad")
            target_rps: Target requests per second (e.g., 0.67 for Store API)
            window_seconds: Sliding window period in seconds (e.g., 300 for 5min)
            window_limit: Maximum requests per window (e.g., 200 for Store API)
            initial_concurrency: Initial concurrency level (default: 5)
            warmup_requests: Number of requests for RTT baseline measurement (default: 20)
            ewma_alpha: EWMA smoothing factor for RTT (default: 0.2)
        """
        self.host = host
        self.target_rps = target_rps
        self.window_seconds = window_seconds
        self.window_limit = window_limit
        self.warmup_requests = warmup_requests
        self.ewma_alpha = ewma_alpha

        # Metrics
        self.metrics = HostMetrics(current_concurrency=initial_concurrency)

        # Token bucket for RPS control (small capacity to prevent burst)
        self.tokens: float = 0.0  # Start with 0 to prevent initial burst
        self.token_capacity: float = 3.0  # Small capacity (1-3) to prevent bursts
        self.last_token_update: float = time.monotonic()

        # Locks for thread safety
        self.lock = asyncio.Lock()
        self.semaphore = asyncio.Semaphore(initial_concurrency)

        # Warmup concurrency (fixed at 3 during warmup)
        self.warmup_concurrency = 3
        self.warmup_semaphore = asyncio.Semaphore(self.warmup_concurrency)

        logger.info(f"[{host}] RateController initialized: target_rps={target_rps}, "
                   f"window={window_seconds}s/{window_limit}req, concurrency={initial_concurrency}")

    async def acquire(self) -> None:
        """
        Acquire permission to send a request

        Enforces:
        1. Token bucket (RPS limit)
        2. Sliding window (ALL sent requests, not just success)
        3. Semaphore (concurrency limit)
        """
        while True:
            async with self.lock:
                now = time.monotonic()

                # Update token bucket (with small capacity to prevent bursts)
                elapsed = now - self.last_token_update
                effective_rps = self.target_rps / self.metrics.backoff_multiplier
                self.tokens = min(self.token_capacity, self.tokens + elapsed * effective_rps)
                self.last_token_update = now

                # Check sliding window limit (use sent_times, not success_times)
                cutoff_time = now - self.window_seconds
                while len(self.metrics.sent_times) > 0 and self.metrics.sent_times[0] < cutoff_time:
                    self.metrics.sent_times.popleft()

                # Check if we can proceed
                if self.tokens >= 1.0 and len(self.metrics.sent_times) < self.window_limit:
                    # Consume token
                    self.tokens -= 1.0
                    self.metrics.total_requests += 1
                    # Record sent time BEFORE sending (reserve the slot)
                    self.metrics.sent_times.append(now)
                    return

                # Calculate wait time
                wait_time = 0
                if self.tokens < 1.0:
                    wait_time = max(wait_time, (1.0 - self.tokens) / effective_rps)

                if len(self.metrics.sent_times) >= self.window_limit:
                    oldest_time = self.metrics.sent_times[0]
                    window_wait = (oldest_time + self.window_seconds) - now
                    if window_wait > 0:
                        wait_time = max(wait_time, window_wait)

            # Wait outside the lock
            if wait_time > 0:
                logger.debug(f"[{self.host}] Waiting {wait_time:.2f}s")
                await asyncio.sleep(wait_time)
            else:
                # Small delay to prevent busy loop
                await asyncio.sleep(0.01)

    @asynccontextmanager
    async def permit(self):
        """
        Context manager for rate-limited request execution

        Usage:
            async with rate_controller.permit():
                response = await session.get(url)
        """
        # Use warmup semaphore if still in warmup phase (don't create new one each time)
        if not self.metrics.warmup_completed:
            semaphore = self.warmup_semaphore
        else:
            semaphore = self.semaphore

        # Semaphore BEFORE acquire to limit concurrent acquire() calls
        async with semaphore:
            await self.acquire()
            request_start = time.time()
            try:
                yield
                # Record success
                request_end = time.time()
                rtt = request_end - request_start
                await self._record_success(rtt)
            except Exception as e:
                # Record error
                await self._record_error()
                raise

    async def _record_success(self, rtt: float) -> None:
        """Record successful request with RTT measurement"""
        async with self.lock:
            now = time.monotonic()
            self.metrics.success_times.append(now)
            self.metrics.rtt_samples.append(rtt)

            # Update EWMA RTT
            self.metrics.ewma_rtt = (self.ewma_alpha * rtt +
                                     (1 - self.ewma_alpha) * self.metrics.ewma_rtt)

            # Warmup phase: establish baseline RTT
            if not self.metrics.warmup_completed:
                if len(self.metrics.rtt_samples) >= self.warmup_requests:
                    sorted_samples = sorted(list(self.metrics.rtt_samples))
                    median_rtt = sorted_samples[len(sorted_samples) // 2]
                    self.metrics.base_rtt = max(0.5, min(3.0, median_rtt))
                    self.metrics.warmup_completed = True
                    logger.info(f"[{self.host}] Warmup completed, base_rtt={self.metrics.base_rtt:.2f}s")

                    # Adjust semaphore to initial concurrency after warmup
                    new_concurrency = self.metrics.current_concurrency
                    self.semaphore = asyncio.Semaphore(new_concurrency)

            # Trim old RTT samples (keep last 100)
            if len(self.metrics.rtt_samples) > 100:
                self.metrics.rtt_samples.popleft()

            # Evaluate concurrency adjustment (time-based, not per-request)
            await self._evaluate_concurrency_adjustment()

    async def _record_error(self) -> None:
        """Record failed request"""
        async with self.lock:
            now = time.monotonic()
            self.metrics.error_times.append(now)
            self.metrics.network_error_count += 1

    async def report_http_error(self, status_code: int, retry_after: Optional[int] = None) -> None:
        """
        Report HTTP error (429, 403, etc.) and apply backoff if needed

        Args:
            status_code: HTTP status code
            retry_after: Retry-After header value in seconds (if present)
        """
        async with self.lock:
            now = time.monotonic()

            if status_code == 429:
                self.metrics.http_429_count += 1

                # Apply backoff: halve concurrency
                old_concurrency = self.metrics.current_concurrency
                self.metrics.current_concurrency = max(1, self.metrics.current_concurrency // 2)
                self.metrics.last_backoff_time = now
                self.metrics.backoff_multiplier = 2.0

                # Update semaphore
                self.semaphore = asyncio.Semaphore(self.metrics.current_concurrency)

                logger.warning(f"[{self.host}] HTTP 429 detected, "
                             f"concurrency: {old_concurrency} → {self.metrics.current_concurrency}")

                # Do NOT hold lock during sleep - release and re-acquire

            elif status_code == 403:
                self.metrics.http_403_count += 1
                logger.error(f"[{self.host}] HTTP 403 - Access forbidden")

        # Wait outside the lock to avoid blocking other tasks
        if status_code == 429:
            if retry_after:
                logger.warning(f"[{self.host}] Waiting for Retry-After: {retry_after}s")
                await asyncio.sleep(retry_after)
            else:
                # Exponential backoff without Retry-After (with jitter)
                import random
                base_backoff = min(60, 5 * (2 ** min(self.metrics.http_429_count - 1, 3)))
                jitter = random.uniform(0, base_backoff * 0.1)
                backoff_time = base_backoff + jitter
                logger.warning(f"[{self.host}] No Retry-After, backing off {backoff_time:.1f}s")
                await asyncio.sleep(backoff_time)

    async def _evaluate_concurrency_adjustment(self) -> None:
        """
        Evaluate and adjust concurrency based on metrics

        Uses:
        - Little's Law: concurrency = ceil(target_rps * ewma_rtt) + safety_margin
        - 2-minute and 5-minute sliding windows for conditions
        - 30-second cooldown between increases
        """
        if not self.metrics.warmup_completed or not self.metrics.base_rtt:
            return

        now = time.monotonic()

        # Calculate window usage based on sent_times (not success_times)
        cutoff_time = now - self.window_seconds
        async with self.lock:
            while len(self.metrics.sent_times) > 0 and self.metrics.sent_times[0] < cutoff_time:
                self.metrics.sent_times.popleft()
            window_usage_rate = len(self.metrics.sent_times) / self.window_limit

        # Calculate p95 RTT
        if len(self.metrics.rtt_samples) >= 20:
            sorted_rtts = sorted(list(self.metrics.rtt_samples))
            p95_index = int(len(sorted_rtts) * 0.95)
            p95_rtt = sorted_rtts[p95_index]
        else:
            p95_rtt = self.metrics.ewma_rtt

        # Determine safety margin (0, 0.5, or 1)
        if window_usage_rate <= 0.7 and p95_rtt <= self.metrics.base_rtt * 1.2:
            safety_margin = 0  # Aggressive
        elif window_usage_rate > 0.9 or p95_rtt > self.metrics.base_rtt * 1.5:
            safety_margin = 1  # Conservative
        else:
            safety_margin = 0.5  # Standard

        # Calculate recommended concurrency using Little's Law
        recommended = math.ceil(self.target_rps * self.metrics.ewma_rtt) + safety_margin
        recommended = max(1, min(10, int(recommended)))  # Clamp between 1 and 10

        # Get metrics for last 2 minutes and 5 minutes
        two_min_ago = now - 120
        five_min_ago = now - 300

        # Count successes and errors in windows
        recent_2min_success = sum(1 for t in self.metrics.success_times if t >= two_min_ago)
        recent_2min_errors = sum(1 for t in self.metrics.error_times if t >= two_min_ago)
        recent_5min_success = sum(1 for t in self.metrics.success_times if t >= five_min_ago)
        recent_5min_errors = sum(1 for t in self.metrics.error_times if t >= five_min_ago)

        # Cooldown check (30 seconds since last increase)
        can_increase = (now - self.metrics.last_concurrency_increase) >= 30

        # Count 429 errors in last 2 minutes
        recent_2min_429 = 0
        if hasattr(self.metrics, 'http_429_times'):
            recent_2min_429 = sum(1 for t in self.metrics.http_429_times if t >= two_min_ago)
        else:
            # Fallback: use total count if no timestamp tracking
            recent_2min_429 = self.metrics.http_429_count if (now - self.metrics.last_backoff_time) < 120 else 0

        # Increase conditions (must satisfy one of the following)
        increase_condition_1 = (
            can_increase and
            recent_2min_429 == 0 and  # No 429 in last 2 minutes (not entire session)
            recent_2min_success > 0 and
            recent_2min_errors == 0 and
            window_usage_rate <= 0.8 and
            p95_rtt <= self.metrics.base_rtt * 1.1
        )

        increase_condition_2 = (
            can_increase and
            recent_5min_success > 0 and
            window_usage_rate <= 0.85 and
            (recent_5min_errors / max(1, recent_5min_success + recent_5min_errors)) < 0.005
        )

        increase_condition_3 = (
            can_increase and
            self.metrics.current_concurrency < recommended - 1
        )

        # Decrease conditions
        decrease_condition_1 = (
            window_usage_rate >= 0.95 and
            p95_rtt >= self.metrics.base_rtt * 1.3
        )

        decrease_condition_2 = (
            recent_5min_success > 0 and
            (recent_5min_errors / max(1, recent_5min_success + recent_5min_errors)) >= 0.01
        )

        # Apply adjustments
        old_concurrency = self.metrics.current_concurrency

        if increase_condition_1 or increase_condition_2 or increase_condition_3:
            self.metrics.current_concurrency = min(10, self.metrics.current_concurrency + 1)
            self.metrics.last_concurrency_increase = now
            self.semaphore = asyncio.Semaphore(self.metrics.current_concurrency)
            logger.info(f"[{self.host}] Concurrency increased: {old_concurrency} → {self.metrics.current_concurrency} "
                       f"(window_usage={window_usage_rate:.2%}, p95_rtt={p95_rtt:.2f}s)")

        elif decrease_condition_1 or decrease_condition_2:
            self.metrics.current_concurrency = max(1, self.metrics.current_concurrency - 1)
            self.semaphore = asyncio.Semaphore(self.metrics.current_concurrency)
            logger.info(f"[{self.host}] Concurrency decreased: {old_concurrency} → {self.metrics.current_concurrency} "
                       f"(window_usage={window_usage_rate:.2%}, error_rate={(recent_5min_errors / max(1, recent_5min_success + recent_5min_errors)):.2%})")

    def get_stats(self) -> Dict:
        """Get current statistics"""
        now = time.time()

        # Clean up old entries
        cutoff_2min = now - 120
        cutoff_5min = now - 300

        recent_2min_success = sum(1 for t in self.metrics.success_times if t >= cutoff_2min)
        recent_5min_success = sum(1 for t in self.metrics.success_times if t >= cutoff_5min)
        recent_2min_errors = sum(1 for t in self.metrics.error_times if t >= cutoff_2min)
        recent_5min_errors = sum(1 for t in self.metrics.error_times if t >= cutoff_5min)

        window_usage = len(self.metrics.success_times) / self.window_limit if self.window_limit > 0 else 0

        # Calculate average RPS (last 5 minutes)
        if recent_5min_success > 0:
            avg_rps = recent_5min_success / 300
        else:
            avg_rps = 0

        return {
            'host': self.host,
            'total_requests': self.metrics.total_requests,
            'success_2min': recent_2min_success,
            'success_5min': recent_5min_success,
            'errors_2min': recent_2min_errors,
            'errors_5min': recent_5min_errors,
            'http_429_count': self.metrics.http_429_count,
            'http_403_count': self.metrics.http_403_count,
            'network_errors': self.metrics.network_error_count,
            'current_concurrency': self.metrics.current_concurrency,
            'window_usage': window_usage,
            'avg_rps': avg_rps,
            'ewma_rtt': self.metrics.ewma_rtt,
            'base_rtt': self.metrics.base_rtt,
            'warmup_completed': self.metrics.warmup_completed
        }

    def print_stats(self) -> None:
        """Print statistics summary"""
        stats = self.get_stats()

        logger.info("=" * 60)
        logger.info(f"Rate Controller Stats: {stats['host']}")
        logger.info("=" * 60)
        logger.info(f"Total requests: {stats['total_requests']}")
        logger.info(f"Success (2min/5min): {stats['success_2min']}/{stats['success_5min']}")
        logger.info(f"Errors (2min/5min): {stats['errors_2min']}/{stats['errors_5min']}")
        logger.info(f"HTTP 429 errors: {stats['http_429_count']}")
        logger.info(f"HTTP 403 errors: {stats['http_403_count']}")
        logger.info(f"Network errors: {stats['network_errors']}")
        logger.info(f"Current concurrency: {stats['current_concurrency']}")
        logger.info(f"Window usage: {stats['window_usage']:.1%}")
        logger.info(f"Average RPS (5min): {stats['avg_rps']:.3f}")
        logger.info(f"EWMA RTT: {stats['ewma_rtt']:.2f}s")
        logger.info(f"Base RTT: {stats['base_rtt']:.2f}s" if stats['base_rtt'] else "Base RTT: (warmup)")
        logger.info(f"Warmup: {'completed' if stats['warmup_completed'] else 'in progress'}")
        logger.info("=" * 60)


class RateControllerManager:
    """
    Manager for multiple host-based rate controllers
    """

    def __init__(self):
        self.controllers: Dict[str, RateController] = {}

    def create_controller(self, host: str, target_rps: float, window_seconds: int,
                         window_limit: int, **kwargs) -> RateController:
        """
        Create a new rate controller for a host

        Args:
            host: Host identifier (e.g., "store", "web", "itad")
            target_rps: Target requests per second
            window_seconds: Sliding window period
            window_limit: Maximum requests per window
            **kwargs: Additional arguments for RateController

        Returns:
            RateController instance
        """
        controller = RateController(host, target_rps, window_seconds, window_limit, **kwargs)
        self.controllers[host] = controller
        return controller

    def get_controller(self, host: str) -> Optional[RateController]:
        """Get controller for a specific host"""
        return self.controllers.get(host)

    def print_all_stats(self) -> None:
        """Print statistics for all controllers"""
        for controller in self.controllers.values():
            controller.print_stats()
