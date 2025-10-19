#!/usr/bin/env python3
"""
Steam API client for fetching game information
"""

import json
import requests
import time
import random
import logging
import re
from datetime import datetime
from constants import REGIONS, USER_AGENT_STEAM

logger = logging.getLogger(__name__)

class SteamClient:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': USER_AGENT_STEAM
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
                        logger.warning(f"Rate limited (429), retrying after {wait_time}s (attempt {attempt + 1}/{max_retries})")
                        time.sleep(wait_time)
                        continue
                    else:
                        logger.error(f"Rate limited (429), max retries exceeded")
                        return None

                response.raise_for_status()
                return response

            except requests.exceptions.RequestException as e:
                if attempt < max_retries - 1:
                    # Exponential backoff for network errors
                    wait_time = 2 ** (attempt + 1)
                    logger.warning(f"Request error: {e}, retrying after {wait_time}s (attempt {attempt + 1}/{max_retries})")
                    time.sleep(wait_time)
                else:
                    logger.error(f"Request failed after {max_retries} attempts: {e}")
                    return None

        return None

    def get_game_info_from_api(self, app_id, regions=['JP']):
        """Fetch game information from Steam API

        Args:
            app_id: Steam App ID
            regions: List of regions to fetch (e.g., ['JP', 'US', 'UK', 'EU'])
        """
        try:
            # Fetch basic information with first region (English text)
            first_region = regions[0]
            region_config = REGIONS[first_region]
            api_url = f"https://store.steampowered.com/api/appdetails?appids={app_id}&l=english&cc={region_config['steam_cc']}"
            response = self._request_with_retry(api_url)

            if not response:
                logger.warning(f"Failed to fetch API data for app {app_id}")
                return None

            data = response.json()

            if str(app_id) not in data or not data[str(app_id)]['success']:
                logger.warning(f"API data not available for app {app_id}")
                return None

            app_data = data[str(app_id)]['data']

            # Rate limiting protection (wait after fetching basic info)
            time.sleep(random.uniform(1.0, 1.3))

            # Basic information (language-independent)
            title = app_data.get('name', 'Unknown')

            # Japanese support (supported_languages fetched in English)
            jp_support = self._check_japanese_support_from_api(app_data)

            # Genre information (fetched in English)
            genres = self._extract_genres_from_api(app_data)

            # Image URL (internally fetches store page + 1.0~1.5 second wait)
            image_url = self._extract_image_url(app_id, app_data)

            # Release date (convert to YYYY-MM-DD format)
            release_date = self._extract_release_date(app_data)

            # Review score (internally fetches API + 1.0~1.5 second wait)
            review_score = self._extract_review_score(app_id)

            # Platform information
            platforms = self._extract_platforms(app_data)

            # Developer/Publisher information
            developers = self._extract_developers(app_data)
            publishers = self._extract_publishers(app_data)

            # Price information (first region from already fetched app_data, rest from API)
            prices = {}

            # First region price information (from already fetched data)
            first_region_price = self._extract_price_from_api(app_data, region_config['currency'])
            if first_region_price:
                prices[first_region] = first_region_price

            # Fetch remaining regions' price information
            for region in regions[1:]:
                price_data = self._get_region_price(app_id, region)
                if price_data:
                    prices[region] = price_data

            result = {
                'title': title,
                'app_id': app_id,
                'store_url': f"https://store.steampowered.com/app/{app_id}/",
                'supportedLanguages': jp_support,
                'genres': genres,
                'imageUrl': image_url,
                'releaseDate': release_date,
                'platforms': platforms,
                'developers': developers,
                'publishers': publishers,
                'prices': prices
            }

            if review_score:
                result['reviewScore'] = review_score

            return result

        except Exception as e:
            logger.error(f"Error getting API data for app {app_id}: {e}")
            return None

    def _get_region_price(self, app_id, region):
        """Fetch price information for specified region"""
        try:
            region_config = REGIONS.get(region)
            if not region_config:
                logger.warning(f"Unknown region: {region}")
                return None

            api_url = f"https://store.steampowered.com/api/appdetails?appids={app_id}&l=english&cc={region_config['steam_cc']}"
            response = self._request_with_retry(api_url)

            if not response:
                logger.warning(f"Failed to fetch price for region {region}")
                return None

            # Rate limiting protection (wait after API request)
            time.sleep(random.uniform(1.0, 1.3))

            data = response.json()

            if str(app_id) not in data or not data[str(app_id)]['success']:
                return None

            app_data = data[str(app_id)]['data']
            price_info = self._extract_price_from_api(app_data, region_config['currency'])

            return price_info

        except Exception as e:
            logger.error(f"Error getting price for region {region}: {e}")
            return None

    def _extract_price_from_api(self, app_data, currency='JPY'):
        """Extract price information from API (regular price, sale price, discount percent)"""
        price_info = {
            'currency': currency,
            'price': None,
            'salePrice': None,
            'discountPercent': None
        }

        try:
            # Check for free games first
            if app_data.get('is_free', False):
                price_info['price'] = 0
                return price_info

            # Price information
            price_overview = app_data.get('price_overview', {})
            if not price_overview:
                # No price info (possibly DLC or demo)
                return price_info

            # Get prices in cents
            final = price_overview.get('final', 0)  # Current price in cents
            initial = price_overview.get('initial', 0)  # Original price in cents
            discount_percent = price_overview.get('discount_percent', 0)  # Discount percentage

            # Convert cents to currency units (100 cents = 1 unit)
            final_price = final / 100 if final else 0
            initial_price = initial / 100 if initial else 0

            if final_price == 0:
                # Price is 0 (free)
                price_info['price'] = 0
                return price_info

            # Set regular price
            if initial_price > 0:
                # Has initial = regular price is initial
                price_info['price'] = int(initial_price)
            else:
                # initial is 0 = regular price is final
                price_info['price'] = int(final_price)

            # Check if on sale
            if initial_price > final_price and final_price > 0:
                # On sale
                price_info['salePrice'] = int(final_price)
                price_info['discountPercent'] = discount_percent

        except Exception as e:
            logger.error(f"Error extracting price from API: {e}")

        return price_info
    
    def _check_japanese_support_from_api(self, app_data):
        """Get language support from API (returns supported_languages string as-is)"""
        try:
            # Return supported languages information as-is
            supported_languages = app_data.get('supported_languages', '')
            return supported_languages if supported_languages else None

        except Exception as e:
            logger.error(f"Error getting supported languages from API: {e}")
            return None

    def _extract_genres_from_api(self, app_data):
        """Extract genre information from API (keep in English)"""
        try:
            genres = []

            # Get only genres (exclude categories)
            steam_genres = app_data.get('genres', [])
            for genre in steam_genres:
                genre_name = genre.get('description', '')
                if genre_name and genre_name not in genres:
                    genres.append(genre_name)

            return genres if genres else ['Other']

        except Exception as e:
            logger.error(f"Error extracting genres from API: {e}")
            return ['Other']

    def _extract_image_url(self, app_id, app_data):
        """Get image URL (construct capsule_616x353 URL from header_image)"""
        try:
            # Get API's header_image
            header_image = app_data.get('header_image', '')

            if not header_image:
                logger.warning(f"No header_image found for app {app_id}")
                return None

            # Convert header.jpg to capsule_616x353.jpg by URL pattern
            # Example: .../header.jpg?t=123 -> .../capsule_616x353.jpg?t=123
            if '/header.jpg' in header_image:
                capsule_url = header_image.replace('/header.jpg', '/capsule_616x353.jpg')
                logger.info(f"Constructed capsule URL for app {app_id}")
                return capsule_url
            else:
                # If header_image doesn't match expected pattern, use as-is
                logger.warning(f"Unexpected header_image format for app {app_id}, using as-is")
                return header_image

        except Exception as e:
            logger.error(f"Error extracting image URL for app {app_id}: {e}")
            return app_data.get('header_image', None)

    def _extract_platforms(self, app_data):
        """Get platform information"""
        try:
            platforms_data = app_data.get('platforms', {})
            return {
                'windows': platforms_data.get('windows', False),
                'mac': platforms_data.get('mac', False),
                'linux': platforms_data.get('linux', False)
            }
        except Exception as e:
            logger.error(f"Error extracting platforms: {e}")
            return {'windows': False, 'mac': False, 'linux': False}

    def _extract_developers(self, app_data):
        """Get developer information"""
        try:
            return app_data.get('developers', [])
        except Exception as e:
            logger.error(f"Error extracting developers: {e}")
            return []

    def _extract_publishers(self, app_data):
        """Get publisher information"""
        try:
            return app_data.get('publishers', [])
        except Exception as e:
            logger.error(f"Error extracting publishers: {e}")
            return []

    def _extract_release_date(self, app_data):
        """Get release date in YYYY-MM-DD format"""
        try:
            release_data = app_data.get('release_date', {})
            date_str = release_data.get('date', '')

            if not date_str:
                return None

            # Already correct format: "2021-01-28"
            if re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
                return date_str

            # Japanese format: "2022年10月20日"
            jp_match = re.match(r'^(\d{4})年(\d{1,2})月(\d{1,2})日$', date_str)
            if jp_match:
                year, month, day = jp_match.groups()
                return f"{year}-{int(month):02d}-{int(day):02d}"

            # Try English format patterns in order
            # Support all possible formats returned by Steam API
            date_formats = [
                '%d %b, %Y',      # "24 Sep, 2020" ← Current data format
                '%d %B, %Y',      # "24 September, 2020"
                '%b %d, %Y',      # "Sep 24, 2020"
                '%B %d, %Y',      # "September 24, 2020"
            ]

            for fmt in date_formats:
                try:
                    date_obj = datetime.strptime(date_str, fmt)
                    return date_obj.strftime('%Y-%m-%d')
                except ValueError:
                    continue

            # Return original string if cannot parse
            logger.warning(f"Could not parse release date: {date_str}")
            return date_str

        except Exception as e:
            logger.error(f"Error extracting release date: {e}")
            return None

    def _extract_review_score(self, app_id):
        """Get review score"""
        try:
            review_url = f"https://store.steampowered.com/appreviews/{app_id}?json=1"
            response = self._request_with_retry(review_url)

            if not response:
                logger.warning(f"Failed to fetch review score for app {app_id}")
                return None

            # Rate limiting protection (wait after fetching review API)
            time.sleep(random.uniform(1.0, 1.3))

            data = response.json()
            query_summary = data.get('query_summary', {})
            review_score_desc = query_summary.get('review_score_desc')

            return review_score_desc

        except Exception as e:
            logger.warning(f"Could not get review score for app {app_id}: {e}")
            return None

def test_steam_client():
    """Test Steam API client"""
    client = SteamClient()

    test_apps = [
        ('409710', 'BioShock™ Remastered'),
        ('1794680', 'Vampire Survivors'),
        ('620', 'Portal 2')
    ]

    print("=== Steam API Test ===")

    for app_id, expected_title in test_apps:
        print(f"\nTest: {expected_title} (App ID: {app_id})")
        game_info = client.get_game_info_from_api(app_id)

        if game_info:
            print(f"Title: {game_info['title']}")
            print(f"Languages: {game_info['supportedLanguages']}")
            print(f"Prices: {game_info.get('prices')}")
            print(f"Genres: {game_info['genres']}")
        else:
            print("Failed to fetch information")

if __name__ == "__main__":
    test_steam_client()
