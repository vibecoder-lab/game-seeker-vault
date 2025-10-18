#!/usr/bin/env python3
"""
IsThereAnyDeal API client for fetching historical low prices (async version)

Supports:
- Batch requests for up to 450 games
- Automatic fallback to 100-item chunks on failure
- Rate limiting via RateController
- Retry-After header compliance
"""

import asyncio
import aiohttp
import logging
from typing import Optional, Dict, List
from constants import REGIONS, USER_AGENT_ITAD
from rate_controller import RateController

logger = logging.getLogger(__name__)


class ITADClient:
    """
    Async ITAD API client with batch support and rate control

    Features:
    - Batch price fetching (up to 450 games per request)
    - Automatic chunking on failure (100 items per chunk)
    - Dynamic rate limiting based on response headers
    - HTTP 429/403 handling with backoff
    """

    def __init__(self, api_key: Optional[str] = None, rate_controller: Optional[RateController] = None):
        """
        Args:
            api_key: ITAD API key
            rate_controller: Rate controller for ITAD API
        """
        self.api_key = api_key
        self.rate_controller = rate_controller
        self.headers = {'User-Agent': USER_AGENT_ITAD}

    async def _request_with_retry(self, session: aiohttp.ClientSession, url: str,
                                   max_retries: int = 3, method: str = 'get',
                                   **kwargs) -> Optional[aiohttp.ClientResponse]:
        """
        HTTP request with exponential backoff retry

        Respects Retry-After and rate limit headers from ITAD API.

        Args:
            session: aiohttp session
            url: Request URL
            max_retries: Maximum retry count
            method: HTTP method ('get' or 'post')
            **kwargs: Additional arguments

        Returns:
            Response object, or None if all retries fail
        """
        for attempt in range(max_retries):
            try:
                # Acquire rate limit permission if controller exists
                if self.rate_controller:
                    async with self.rate_controller.permit():
                        if method == 'post':
                            response = await session.post(url, **kwargs)
                        else:
                            response = await session.get(url, **kwargs)
                else:
                    if method == 'post':
                        response = await session.post(url, **kwargs)
                    else:
                        response = await session.get(url, **kwargs)

                # HTTP 429 (Rate Limit) check
                if response.status == 429:
                    retry_after = response.headers.get('Retry-After')
                    retry_after_seconds = int(retry_after) if retry_after else None

                    # Report to rate controller
                    if self.rate_controller:
                        await self.rate_controller.report_http_error(429, retry_after_seconds)

                    if attempt < max_retries - 1:
                        # Exponential backoff
                        wait_time = 2 ** (attempt + 1)
                        if retry_after_seconds:
                            wait_time = max(wait_time, retry_after_seconds)
                        logger.warning(f"ITAD: Rate limited (429), retrying after {wait_time}s (attempt {attempt + 1}/{max_retries})")
                        await asyncio.sleep(wait_time)
                        continue
                    else:
                        logger.error(f"ITAD: Rate limited (429), max retries exceeded")
                        return None

                # HTTP 403 (Forbidden) check
                if response.status == 403:
                    if self.rate_controller:
                        await self.rate_controller.report_http_error(403)
                    logger.error(f"ITAD: Access forbidden (403): {url}")
                    return None

                # Log rate limit info from response headers
                rate_limit_remaining = response.headers.get('X-RateLimit-Remaining')
                rate_limit_reset = response.headers.get('X-RateLimit-Reset')
                if rate_limit_remaining or rate_limit_reset:
                    logger.debug(f"ITAD rate info: remaining={rate_limit_remaining}, reset={rate_limit_reset}")

                response.raise_for_status()
                return response

            except aiohttp.ClientError as e:
                if attempt < max_retries - 1:
                    wait_time = 2 ** (attempt + 1)
                    logger.warning(f"ITAD: Request error: {e}, retrying after {wait_time}s (attempt {attempt + 1}/{max_retries})")
                    await asyncio.sleep(wait_time)
                else:
                    logger.error(f"ITAD: Request failed after {max_retries} attempts: {e}")
                    return None

        return None

    async def get_batch_prices(self, session: aiohttp.ClientSession, itad_ids: List[str],
                               region: str = 'JP', chunk_size: int = 200) -> Dict[str, Optional[int]]:
        """
        Fetch historical low prices for multiple games in batch

        Automatically falls back to chunked requests if batch request fails.

        Args:
            session: aiohttp session
            itad_ids: List of ITAD game IDs
            region: Region code ('JP', 'US', 'UK', 'EU')
            chunk_size: Chunk size for fallback requests (default: 100)

        Returns:
            dict: Mapping of itad_id -> historical_low_price (int or None)
        """
        if not self.api_key:
            logger.warning("ITAD API key not provided")
            return {itad_id: None for itad_id in itad_ids}

        if region not in REGIONS:
            logger.error(f"ITAD: Unknown region: {region}")
            return {itad_id: None for itad_id in itad_ids}

        region_config = REGIONS[region]
        country = region_config['itad_country']
        expected_currency = region_config['currency']

        # Use appropriate request method based on number of IDs
        if len(itad_ids) <= chunk_size:
            # Single request for small batches (≤200 items)
            logger.info(f"ITAD: Fetching prices for {len(itad_ids)} games (single request)")
            result = await self._fetch_prices_batch(session, itad_ids, country, expected_currency)
            return result if result is not None else {}
        else:
            # Multiple chunked requests for large batches (>200 items)
            logger.info(f"ITAD: Fetching prices for {len(itad_ids)} games ({chunk_size}-item chunks)")
            return await self._fetch_prices_chunked(session, itad_ids, country, expected_currency, chunk_size)

    async def _fetch_prices_batch(self, session: aiohttp.ClientSession, itad_ids: List[str],
                                  country: str, expected_currency: str) -> Optional[Dict[str, Optional[int]]]:
        """
        Fetch prices in a single batch request

        Args:
            session: aiohttp session
            itad_ids: List of ITAD game IDs
            country: Country code for pricing
            expected_currency: Expected currency code

        Returns:
            dict: Mapping of itad_id -> price, or None if request fails
        """
        try:
            api_url = f"https://api.isthereanydeal.com/games/prices/v3?key={self.api_key}&country={country}"
            payload = itad_ids

            # Use longer timeout for batch requests
            timeout = aiohttp.ClientTimeout(total=60)

            response = await self._request_with_retry(
                session, api_url, method='post', json=payload, timeout=timeout
            )

            if not response:
                return None

            data = await response.json()

            if not data or len(data) == 0:
                logger.warning(f"ITAD: No data returned for batch request")
                return None

            # Parse results
            result = {}
            for item in data:
                game_id = item.get('id')
                if not game_id:
                    continue

                # Extract Steam-only historical low from deals array
                deals = item.get('deals', [])
                steam_store_low = None

                for deal in deals:
                    shop = deal.get('shop', {})
                    if shop.get('id') == 61:  # Steam shop ID
                        store_low = deal.get('storeLow')
                        if not store_low:  # storeLow is None or empty
                            continue

                        amount = store_low.get('amount')
                        currency = store_low.get('currency', 'USD')

                        if amount:
                            # Currency check (warning only)
                            if currency != expected_currency:
                                logger.warning(f"ITAD: Currency mismatch expected {expected_currency}, got {currency} (ID: {game_id})")

                            steam_store_low = int(amount)
                            break

                result[game_id] = steam_store_low

            return result

        except Exception as e:
            logger.error(f"ITAD: Batch request error: {e}")
            return None

    async def _fetch_prices_chunked(self, session: aiohttp.ClientSession, itad_ids: List[str],
                                    country: str, expected_currency: str, chunk_size: int) -> Dict[str, Optional[int]]:
        """
        Fetch prices in multiple chunked requests

        Args:
            session: aiohttp session
            itad_ids: List of ITAD game IDs
            country: Country code for pricing
            expected_currency: Expected currency code
            chunk_size: Number of items per chunk

        Returns:
            dict: Mapping of itad_id -> price (aggregated from all chunks)
        """
        result = {}
        chunks = [itad_ids[i:i + chunk_size] for i in range(0, len(itad_ids), chunk_size)]

        for i, chunk in enumerate(chunks, 1):
            logger.info(f"ITAD: Fetching chunk {i}/{len(chunks)} ({len(chunk)} items)")

            chunk_result = await self._fetch_prices_batch(session, chunk, country, expected_currency)

            if chunk_result is None:
                logger.error(f"ITAD: Chunk {i}/{len(chunks)} failed, skipping {len(chunk)} games")
                # Mark failed chunk items as None
                for itad_id in chunk:
                    result[itad_id] = None
            else:
                result.update(chunk_result)

        return result

    async def get_historical_low(self, session: aiohttp.ClientSession, itad_id: str,
                                 region: str = 'JP') -> Optional[int]:
        """
        Fetch historical low price for a single game

        Args:
            session: aiohttp session
            itad_id: ITAD game ID
            region: Region code ('JP', 'US', 'UK', 'EU')

        Returns:
            int: Historical low price (integer), None if fetch fails
        """
        prices = await self.get_batch_prices(session, [itad_id], region)
        return prices.get(itad_id)

    async def get_itad_id_from_steam_appid(self, session: aiohttp.ClientSession,
                                           steam_appid: str) -> Optional[str]:
        """
        Get ITAD ID from Steam App ID

        Args:
            session: aiohttp session
            steam_appid: Steam App ID

        Returns:
            str: ITAD ID, or None if not found
        """
        if not self.api_key:
            logger.warning("ITAD API key not provided")
            return None

        try:
            api_url = f"https://api.isthereanydeal.com/games/lookup/v1"
            params = {
                'key': self.api_key,
                'appid': steam_appid
            }

            response = await self._request_with_retry(session, api_url, params=params)

            if not response:
                logger.warning(f"ITAD: Failed to fetch ID for Steam App ID: {steam_appid}")
                return None

            data = await response.json()

            if data and data.get('found'):
                game = data.get('game', {})
                itad_id = game.get('id')
                if itad_id:
                    logger.info(f"ITAD: ID fetch success {steam_appid} -> {itad_id}")
                    return itad_id
                else:
                    logger.warning(f"ITAD: ID not found in response (App ID: {steam_appid})")
                    return None
            else:
                logger.warning(f"ITAD: Game not found (App ID: {steam_appid})")
                return None

        except Exception as e:
            logger.error(f"ITAD: API error (App ID: {steam_appid}): {e}")
            return None


async def test_itad_client():
    """Test ITAD API client with batch support"""
    import sys
    from rate_controller import RateControllerManager

    if len(sys.argv) < 2:
        print("Usage: python itad_client.py <API_KEY>")
        return

    api_key = sys.argv[1]

    # Create rate controller
    manager = RateControllerManager()
    itad_controller = manager.create_controller(
        host='itad',
        target_rps=1.0,
        window_seconds=60,
        window_limit=100
    )

    client = ITADClient(api_key, rate_controller=itad_controller)

    # Test data (from games.json)
    test_ids = [
        '018d937f-58fd-7225-ba95-dfad5f4fb3dd',  # Vampire Survivors
        '018d937f-21e1-728e-86d7-9acb3c59f2bb',  # Portal 2
    ]

    print("=== ITAD API Test (Async, Batch) ===")

    async with aiohttp.ClientSession(headers=client.headers) as session:
        # Test batch request
        print(f"\nTest: Batch request ({len(test_ids)} games)")
        prices = await client.get_batch_prices(session, test_ids)

        for itad_id, price in prices.items():
            if price:
                print(f"  {itad_id}: ¥{price}")
            else:
                print(f"  {itad_id}: No data")

    # Print stats
    manager.print_all_stats()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(test_itad_client())
