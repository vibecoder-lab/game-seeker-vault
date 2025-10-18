#!/usr/bin/env python3
"""
IsThereAnyDeal API client for fetching historical low prices
"""

import json
import requests
import logging
import time
import random
import re
from constants import REGIONS, USER_AGENT_ITAD

logger = logging.getLogger(__name__)

class ITADClient:
    def __init__(self, api_key=None):
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': USER_AGENT_ITAD
        })

    def _request_with_retry(self, url, max_retries=3, method='get', **kwargs):
        """Execute HTTP request with exponential backoff retry

        Args:
            url: Request URL
            max_retries: Maximum retry count (default: 3)
            method: HTTP method ('get' or 'post')
            **kwargs: Additional arguments to pass to requests

        Returns:
            Response object, or None if all retries fail
        """
        for attempt in range(max_retries):
            try:
                if method == 'post':
                    response = self.session.post(url, **kwargs)
                else:
                    response = self.session.get(url, **kwargs)

                # Check for rate limiting (429)
                if response.status_code == 429:
                    if attempt < max_retries - 1:
                        # Exponential backoff: 2s -> 4s -> 8s
                        wait_time = 2 ** (attempt + 1)
                        logger.warning(f"ITAD: Rate limited (429), retrying after {wait_time}s (attempt {attempt + 1}/{max_retries})")
                        time.sleep(wait_time)
                        continue
                    else:
                        logger.error(f"ITAD: Rate limited (429), max retries exceeded")
                        return None

                response.raise_for_status()
                return response

            except requests.exceptions.RequestException as e:
                if attempt < max_retries - 1:
                    # Exponential backoff for network errors
                    wait_time = 2 ** (attempt + 1)
                    logger.warning(f"ITAD: Request error: {e}, retrying after {wait_time}s (attempt {attempt + 1}/{max_retries})")
                    time.sleep(wait_time)
                else:
                    logger.error(f"ITAD: Request failed after {max_retries} attempts: {e}")
                    return None

        return None

    def get_batch_prices(self, itad_ids, region='JP'):
        """Fetch historical low prices for multiple games in batch

        Args:
            itad_ids: List of ITAD game IDs (max 200)
            region: Region code ('JP', 'US', 'UK', 'EU')

        Returns:
            dict: Map of {itad_id: price (int)}, excludes games with no Steam historical low
        """
        if not self.api_key:
            logger.warning("ITAD API key not provided")
            return {}

        if region not in REGIONS:
            logger.error(f"ITAD: Unknown region: {region}")
            return {}

        if not itad_ids:
            return {}

        region_config = REGIONS[region]
        country = region_config['itad_country']
        expected_currency = region_config['currency']

        try:
            # Split into chunks of 200
            chunk_size = 200
            all_prices = {}

            for i in range(0, len(itad_ids), chunk_size):
                chunk = itad_ids[i:i + chunk_size]
                logger.info(f"  → Fetching ITAD batch {i//chunk_size + 1} ({len(chunk)} items)...")

                # /games/prices/v3 endpoint (POST request)
                api_url = f"https://api.isthereanydeal.com/games/prices/v3?key={self.api_key}&country={country}"
                payload = chunk

                response = self._request_with_retry(api_url, method='post', json=payload)

                if not response:
                    logger.warning(f"ITAD: Failed to fetch batch prices for region: {region}")
                    continue

                # Rate limiting protection (wait after API request)
                time.sleep(random.uniform(1.0, 1.3))

                data = response.json()

                if not data:
                    logger.warning(f"ITAD: No data returned for batch")
                    continue

                # Process each game in response
                for game_data in data:
                    game_id = game_data.get('id')
                    if not game_id:
                        continue

                    # Fetch Steam-only historical low from deals array
                    deals = game_data.get('deals', [])
                    steam_store_low = None

                    for deal in deals:
                        shop = deal.get('shop', {})
                        if shop.get('id') == 61:  # Steam shop ID
                            store_low = deal.get('storeLow', {})
                            amount = store_low.get('amount')
                            currency = store_low.get('currency', 'USD')

                            if amount:
                                # Currency check (warning only, return data anyway)
                                if currency != expected_currency:
                                    logger.warning(f"ITAD: Currency mismatch expected {expected_currency}, got {currency} (ID: {game_id}, region: {region})")

                                steam_store_low = int(amount)
                                break

                    if steam_store_low:
                        all_prices[game_id] = steam_store_low

            logger.info(f"ITAD: Batch fetch complete ({len(all_prices)}/{len(itad_ids)} games with Steam historical low)")
            return all_prices

        except Exception as e:
            logger.error(f"ITAD: Batch API error (region: {region}): {e}")
            return {}

    def get_historical_low(self, itad_id, region='JP'):
        """Fetch historical low price from IsThereAnyDeal API

        Args:
            itad_id: ITAD game ID
            region: Region code ('JP', 'US', 'UK', 'EU')

        Returns:
            int: Historical low price (integer), None if fetch fails
        """
        if not self.api_key:
            logger.warning("ITAD API key not provided")
            return None

        if region not in REGIONS:
            logger.error(f"ITAD: Unknown region: {region}")
            return None

        region_config = REGIONS[region]
        country = region_config['itad_country']
        expected_currency = region_config['currency']

        try:
            # /games/prices/v3 endpoint (POST request)
            api_url = f"https://api.isthereanydeal.com/games/prices/v3?key={self.api_key}&country={country}"

            # Request body (array of game IDs)
            payload = [itad_id]

            response = self._request_with_retry(api_url, method='post', json=payload)

            if not response:
                logger.warning(f"ITAD: Failed to fetch price for ID: {itad_id}, region: {region}")
                return None

            # Rate limiting protection (wait after API request)
            time.sleep(random.uniform(1.0, 1.3))

            data = response.json()

            if not data or len(data) == 0:
                logger.warning(f"ITAD: No data returned for ID: {itad_id}, region: {region}")
                return None

            game_data = data[0] if isinstance(data, list) else data

            # Fetch Steam-only historical low from deals array
            # Steam shop ID is 61, use storeLow.amount for historical low
            deals = game_data.get('deals', [])
            steam_store_low = None

            for deal in deals:
                shop = deal.get('shop', {})
                if shop.get('id') == 61:  # Steam shop ID
                    store_low = deal.get('storeLow', {})
                    amount = store_low.get('amount')
                    currency = store_low.get('currency', 'USD')

                    if amount:
                        # Currency check (warning only, return data anyway)
                        if currency != expected_currency:
                            logger.warning(f"ITAD: Currency mismatch expected {expected_currency}, got {currency} (ID: {itad_id}, region: {region})")

                        steam_store_low = int(amount)
                        logger.info(f"ITAD: Steam historical low fetch success (ID: {itad_id}, region: {region})")
                        break

            if steam_store_low:
                return steam_store_low
            else:
                logger.warning(f"ITAD: No Steam historical low data (ID: {itad_id}, region: {region})")
                return None

        except Exception as e:
            logger.error(f"ITAD: API error (ID: {itad_id}, region: {region}): {e}")
            return None

    def get_itad_id_from_steam_appid(self, steam_appid):
        """Get ITAD ID from Steam App ID"""
        if not self.api_key:
            logger.warning("ITAD API key not provided")
            return None

        try:
            api_url = f"https://api.isthereanydeal.com/games/lookup/v1"
            params = {
                'key': self.api_key,
                'appid': steam_appid
            }

            response = self._request_with_retry(api_url, params=params)

            if not response:
                logger.warning(f"ITAD: Failed to fetch ID for Steam App ID: {steam_appid}")
                return None

            # Rate limiting protection (wait after API request)
            time.sleep(random.uniform(1.0, 1.3))

            data = response.json()

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

    def get_steam_app_id_from_itad(self, itad_id):
        """Get Steam App ID from ITAD ID (if needed)"""
        if not self.api_key:
            return None

        try:
            api_url = "https://api.isthereanydeal.com/games/info/v2"
            params = {
                'key': self.api_key,
                'id': itad_id
            }

            response = self.session.get(api_url, params=params)
            response.raise_for_status()

            data = response.json()

            if data and 'urls' in data:
                steam_url = data['urls'].get('steam')
                if steam_url:
                    # URLからApp IDを抽出
                    import re
                    match = re.search(r'/app/(\d+)/', steam_url)
                    if match:
                        return match.group(1)

            return None

        except Exception as e:
            logger.error(f"Error getting Steam App ID from ITAD {itad_id}: {e}")
            return None

def test_itad_client():
    """Test ITAD API client"""
    import sys

    if len(sys.argv) < 2:
        print("Usage: python itad_client.py <API_KEY>")
        return

    api_key = sys.argv[1]
    client = ITADClient(api_key)

    # Test data (from games.json)
    test_games = [
        ('018d937f-58fd-7225-ba95-dfad5f4fb3dd', 'Vampire Survivors'),
        ('018d937f-21e1-728e-86d7-9acb3c59f2bb', 'Portal 2'),
    ]

    print("=== ITAD API Test ===")

    for itad_id, title in test_games:
        print(f"\nTest: {title} (ITAD ID: {itad_id})")
        lowest = client.get_historical_low(itad_id)

        if lowest:
            print(f"Historical low: ¥{lowest}")
        else:
            print("Failed to fetch historical low")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    test_itad_client()