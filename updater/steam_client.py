#!/usr/bin/env python3
"""
Steam API client for fetching game information (async version)

Fetches data from three Steam Store API endpoints per game:
1. appdetails - Basic game information, pricing, metadata
2. Store page - Image URL extraction via scraping
3. appreviews - Review scores

All requests use host-based rate limiting (store.steampowered.com).
"""

import asyncio
import aiohttp
import logging
import re
from datetime import datetime
from typing import Optional, Dict, List
from constants import REGIONS, USER_AGENT_STEAM
from rate_controller import RateController

logger = logging.getLogger(__name__)


class SteamClient:
    """
    Async Steam API client with parallel endpoint execution

    Features:
    - Parallel execution of 3 endpoints per game (appdetails, store page, appreviews)
    - Host-based rate limiting for store.steampowered.com (~200 req/5min)
    - HTTP 429/403 handling with backoff
    - Token-based permission for each request
    """

    def __init__(self, store_rate_controller: Optional[RateController] = None):
        """
        Args:
            store_rate_controller: Rate controller for store.steampowered.com
        """
        self.store_rate_controller = store_rate_controller
        self.headers = {'User-Agent': USER_AGENT_STEAM}

    async def _request_with_retry(self, session: aiohttp.ClientSession, url: str,
                                   max_retries: int = 3, method: str = 'get',
                                   **kwargs) -> Optional[aiohttp.ClientResponse]:
        """
        HTTP request with exponential backoff retry

        Each request acquires a token from rate controller before execution.

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
                if self.store_rate_controller:
                    async with self.store_rate_controller.permit():
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
                    if self.store_rate_controller:
                        await self.store_rate_controller.report_http_error(429, retry_after_seconds)

                    if attempt < max_retries - 1:
                        # Exponential backoff
                        wait_time = 2 ** (attempt + 1)
                        if retry_after_seconds:
                            wait_time = max(wait_time, retry_after_seconds)
                        logger.warning(f"Steam: Rate limited (429), retrying after {wait_time}s (attempt {attempt + 1}/{max_retries})")
                        await asyncio.sleep(wait_time)
                        continue
                    else:
                        logger.error(f"Steam: Rate limited (429), max retries exceeded")
                        return None

                # HTTP 403 (Forbidden) check
                if response.status == 403:
                    if self.store_rate_controller:
                        await self.store_rate_controller.report_http_error(403)
                    logger.error(f"Steam: Access forbidden (403): {url}")
                    return None

                response.raise_for_status()
                return response

            except aiohttp.ClientError as e:
                if attempt < max_retries - 1:
                    wait_time = 2 ** (attempt + 1)
                    logger.warning(f"Steam: Request error: {e}, retrying after {wait_time}s (attempt {attempt + 1}/{max_retries})")
                    await asyncio.sleep(wait_time)
                else:
                    logger.error(f"Steam: Request failed after {max_retries} attempts: {e}")
                    return None

        return None

    async def _get_basic_info(self, session: aiohttp.ClientSession, app_id: str,
                              region: str = 'JP') -> Optional[Dict]:
        """
        Fetch basic information from /appdetails endpoint only (for differential update)

        Args:
            session: aiohttp session
            app_id: Steam App ID
            region: Region code (default: 'JP')

        Returns:
            dict: Basic game info with prices, title, genres, etc., or None if fetch fails
        """
        if region not in REGIONS:
            logger.warning(f"Steam: Unknown region: {region}")
            return None

        region_config = REGIONS[region]
        api_url = f"https://store.steampowered.com/api/appdetails?appids={app_id}&l=english&cc={region_config['steam_cc']}"

        try:
            response = await self._request_with_retry(session, api_url)
            if not response:
                return None

            data = await response.json()

            if str(app_id) not in data or not data[str(app_id)]['success']:
                return None

            app_data = data[str(app_id)]['data']

            # Extract basic information
            price_data = self._extract_price_from_api(app_data, region_config['currency'])

            return {
                'title': app_data.get('name', 'Unknown'),
                'genres': self._extract_genres_from_api(app_data),
                'supportedLanguages': app_data.get('supported_languages', ''),
                'platforms': self._extract_platforms(app_data),
                'developers': self._extract_developers(app_data),
                'publishers': self._extract_publishers(app_data),
                'releaseDate': self._extract_release_date(app_data),
                'japaneseSupport': self._check_japanese_support_from_api(app_data),
                'prices': {region: price_data} if price_data else {},
                'raw_data': app_data  # Keep for later image URL extraction
            }

        except Exception as e:
            logger.error(f"Steam: Error getting basic info for app {app_id}: {e}")
            return None

    async def get_game_info_from_api(self, session: aiohttp.ClientSession, app_id: str,
                                     regions: List[str] = None) -> Optional[Dict]:
        """
        Fetch game information from Steam API (parallel execution of 3 endpoints)

        Args:
            session: aiohttp session
            app_id: Steam App ID
            regions: List of regions to fetch (e.g., ['JP', 'US', 'UK', 'EU'])

        Returns:
            dict: Game information, or None if fetch fails
        """
        if regions is None:
            regions = ['JP']

        try:
            # Fetch basic information with first region (English text)
            first_region = regions[0]
            region_config = REGIONS[first_region]
            api_url = f"https://store.steampowered.com/api/appdetails?appids={app_id}&l=english&cc={region_config['steam_cc']}"

            response = await self._request_with_retry(session, api_url)

            if not response:
                logger.warning(f"Steam: Failed to fetch API data for app {app_id}")
                return None

            data = await response.json()

            if str(app_id) not in data or not data[str(app_id)]['success']:
                logger.warning(f"Steam: API data not available for app {app_id}")
                return None

            app_data = data[str(app_id)]['data']

            # Extract basic information (synchronous operations)
            title = app_data.get('name', 'Unknown')
            jp_support = self._check_japanese_support_from_api(app_data)
            genres = self._extract_genres_from_api(app_data)
            release_date = self._extract_release_date(app_data)
            platforms = self._extract_platforms(app_data)
            developers = self._extract_developers(app_data)
            publishers = self._extract_publishers(app_data)

            # Prepare parallel tasks for additional data fetching
            tasks = []

            # Task 1: Image URL (store page scraping)
            tasks.append(self._extract_image_url(session, app_id, app_data))

            # Task 2: Review score
            tasks.append(self._extract_review_score(session, app_id))

            # Task 3+: Additional region prices
            for region in regions[1:]:
                tasks.append(self._get_region_price(session, app_id, region))

            # Execute all tasks in parallel
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Parse results
            image_url = results[0] if not isinstance(results[0], Exception) else None
            review_score = results[1] if not isinstance(results[1], Exception) else None
            additional_prices = results[2:]

            # Build prices dict
            prices = {}

            # First region price (from already fetched app_data)
            first_region_price = self._extract_price_from_api(app_data, region_config['currency'])
            if first_region_price:
                prices[first_region] = first_region_price

            # Additional region prices
            for i, region in enumerate(regions[1:]):
                price_data = additional_prices[i]
                if price_data and not isinstance(price_data, Exception):
                    prices[region] = price_data

            # Build result
            result = {
                'title': title,
                'app_id': app_id,
                'store_url': f"https://store.steampowered.com/app/{app_id}/",
                'supportedLanguages': jp_support,
                'genres': genres,
                'imageUrl': image_url if image_url else '-',
                'releaseDate': release_date if release_date else '-',
                'platforms': platforms,
                'developers': developers,
                'publishers': publishers,
                'prices': prices
            }

            if review_score:
                result['reviewScore'] = review_score
            else:
                result['reviewScore'] = '-'

            return result

        except Exception as e:
            logger.error(f"Steam: Error getting API data for app {app_id}: {e}")
            return None

    async def _get_region_price(self, session: aiohttp.ClientSession, app_id: str,
                                region: str) -> Optional[Dict]:
        """Fetch price information for specified region"""
        try:
            region_config = REGIONS.get(region)
            if not region_config:
                logger.warning(f"Steam: Unknown region: {region}")
                return None

            api_url = f"https://store.steampowered.com/api/appdetails?appids={app_id}&l=english&cc={region_config['steam_cc']}"
            response = await self._request_with_retry(session, api_url)

            if not response:
                logger.warning(f"Steam: Failed to fetch price for region {region}")
                return None

            data = await response.json()

            if str(app_id) not in data or not data[str(app_id)]['success']:
                return None

            app_data = data[str(app_id)]['data']
            price_info = self._extract_price_from_api(app_data, region_config['currency'])

            return price_info

        except Exception as e:
            logger.error(f"Steam: Error getting price for region {region}: {e}")
            return None

    def _extract_price_from_api(self, app_data: Dict, currency: str = 'JPY') -> Optional[Dict]:
        """Extract price information from API response"""
        price_info = {
            'currency': currency,
            'price': None,
            'salePrice': None,
            'discountPercent': None
        }

        try:
            # Check if free
            if app_data.get('is_free', False):
                price_info['price'] = 0
                return price_info

            # Price information
            price_overview = app_data.get('price_overview', {})
            if not price_overview:
                return price_info

            final = price_overview.get('final', 0)
            initial = price_overview.get('initial', 0)
            discount_percent = price_overview.get('discount_percent', 0)

            final_price = final / 100 if final else 0
            initial_price = initial / 100 if initial else 0

            if final_price == 0:
                price_info['price'] = 0
                return price_info

            if initial_price > 0:
                price_info['price'] = int(initial_price)
            else:
                price_info['price'] = int(final_price)

            if initial_price > final_price and final_price > 0:
                price_info['salePrice'] = int(final_price)
                price_info['discountPercent'] = discount_percent

        except Exception as e:
            logger.error(f"Steam: Error extracting price from API: {e}")

        return price_info

    def _check_japanese_support_from_api(self, app_data: Dict) -> Optional[str]:
        """Extract language support information from API"""
        try:
            supported_languages = app_data.get('supported_languages', '')
            return supported_languages if supported_languages else None
        except Exception as e:
            logger.error(f"Steam: Error getting supported languages from API: {e}")
            return None

    def _extract_genres_from_api(self, app_data: Dict) -> List[str]:
        """Extract genre information from API"""
        try:
            genres = []
            steam_genres = app_data.get('genres', [])
            for genre in steam_genres:
                genre_name = genre.get('description', '')
                if genre_name and genre_name not in genres:
                    genres.append(genre_name)
            return genres if genres else ['Other']
        except Exception as e:
            logger.error(f"Steam: Error extracting genres from API: {e}")
            return ['Other']

    async def _extract_image_url(self, session: aiohttp.ClientSession, app_id: str,
                                 app_data: Dict) -> Optional[str]:
        """Extract image URL from store page (via scraping)"""
        try:
            header_image = app_data.get('header_image', '')
            store_url = f"https://store.steampowered.com/app/{app_id}/"

            response = await self._request_with_retry(session, store_url)

            if not response:
                logger.warning(f"Steam: Failed to fetch store page for app {app_id}")
                return header_image if header_image else None

            html = await response.text()

            # Extract capsule_616x353.jpg URL
            pattern = r'https://[^"\']*?/apps/' + str(app_id) + r'/[^"\']*?capsule_616x353\.jpg[^"\']*'
            matches = re.findall(pattern, html)

            if matches:
                return matches[0]
            elif header_image:
                logger.warning(f"Steam: capsule_616x353 not found for app {app_id}, using header_image")
                return header_image
            else:
                logger.warning(f"Steam: No image URL found for app {app_id}")
                return None

        except Exception as e:
            logger.error(f"Steam: Error extracting image URL for app {app_id}: {e}")
            return app_data.get('header_image', None)

    def _extract_platforms(self, app_data: Dict) -> Dict[str, bool]:
        """Extract platform information"""
        try:
            platforms_data = app_data.get('platforms', {})
            return {
                'windows': platforms_data.get('windows', False),
                'mac': platforms_data.get('mac', False),
                'linux': platforms_data.get('linux', False)
            }
        except Exception as e:
            logger.error(f"Steam: Error extracting platforms: {e}")
            return {'windows': False, 'mac': False, 'linux': False}

    def _extract_developers(self, app_data: Dict) -> List[str]:
        """Extract developer information"""
        try:
            return app_data.get('developers', [])
        except Exception as e:
            logger.error(f"Steam: Error extracting developers: {e}")
            return []

    def _extract_publishers(self, app_data: Dict) -> List[str]:
        """Extract publisher information"""
        try:
            return app_data.get('publishers', [])
        except Exception as e:
            logger.error(f"Steam: Error extracting publishers: {e}")
            return []

    def _extract_release_date(self, app_data: Dict) -> Optional[str]:
        """Extract release date in YYYY-MM-DD format"""
        try:
            release_data = app_data.get('release_date', {})
            date_str = release_data.get('date', '')

            if not date_str:
                return None

            # Already in correct format
            if re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
                return date_str

            # Japanese format
            jp_match = re.match(r'^(\d{4})年(\d{1,2})月(\d{1,2})日$', date_str)
            if jp_match:
                year, month, day = jp_match.groups()
                return f"{year}-{int(month):02d}-{int(day):02d}"

            # English formats
            date_formats = [
                '%d %b, %Y',
                '%d %B, %Y',
                '%b %d, %Y',
                '%B %d, %Y',
            ]

            for fmt in date_formats:
                try:
                    date_obj = datetime.strptime(date_str, fmt)
                    return date_obj.strftime('%Y-%m-%d')
                except ValueError:
                    continue

            logger.warning(f"Steam: Could not parse release date: {date_str}")
            return date_str

        except Exception as e:
            logger.error(f"Steam: Error extracting release date: {e}")
            return None

    async def _extract_review_score(self, session: aiohttp.ClientSession,
                                    app_id: str) -> Optional[str]:
        """Extract review score from appreviews API"""
        try:
            review_url = f"https://store.steampowered.com/appreviews/{app_id}?json=1"
            response = await self._request_with_retry(session, review_url)

            if not response:
                logger.warning(f"Steam: Failed to fetch review score for app {app_id}")
                return None

            data = await response.json()
            query_summary = data.get('query_summary', {})
            review_score_desc = query_summary.get('review_score_desc')

            return review_score_desc

        except Exception as e:
            logger.warning(f"Steam: Could not get review score for app {app_id}: {e}")
            return None


async def test_steam_client():
    """Test Steam API client"""
    from rate_controller import RateControllerManager

    # Create rate controller
    manager = RateControllerManager()
    store_controller = manager.create_controller(
        host='store',
        target_rps=0.67,
        window_seconds=300,
        window_limit=200
    )

    client = SteamClient(store_rate_controller=store_controller)

    test_apps = [
        ('409710', 'BioShock™ Remastered'),
        ('1794680', 'Vampire Survivors'),
        ('620', 'Portal 2')
    ]

    print("=== Steam API Test (Async) ===")

    async with aiohttp.ClientSession(headers=client.headers) as session:
        for app_id, expected_title in test_apps:
            print(f"\nTest: {expected_title} (App ID: {app_id})")
            game_info = await client.get_game_info_from_api(session, app_id)

            if game_info:
                print(f"Title: {game_info['title']}")
                print(f"Languages: {game_info['supportedLanguages']}")
                print(f"Prices: {game_info.get('prices')}")
                print(f"Genres: {game_info['genres']}")
            else:
                print("Failed to fetch information")

    # Print stats
    manager.print_all_stats()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(test_steam_client())
