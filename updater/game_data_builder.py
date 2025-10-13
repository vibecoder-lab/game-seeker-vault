#!/usr/bin/env python3
"""
Business logic layer for game data construction
Integrates data from Steam API and ITAD API to build games.json
"""

import json
import time
import random
import difflib
import logging
import requests
from pathlib import Path
from steam_client import SteamClient
from itad_client import ITADClient
from kv_helper import KVHelper
from constants import (
    EXCLUDE_KEYWORDS,
    KEEP_EDITIONS,
    SCORE_EXACT_MATCH,
    SCORE_PARTIAL_MATCH_BASE,
    SCORE_SIMILARITY_MULTIPLIER,
    SCORE_AUTO_ACCEPT_THRESHOLD,
    SCORE_CANDIDATE_THRESHOLD
)

logger = logging.getLogger(__name__)


class GameDataBuilder:
    """Game data construction class"""

    def __init__(self, itad_api_key=None):
        """
        Args:
            itad_api_key: ITAD API key (if None, use existing data)
        """
        self.steam_client = SteamClient()
        self.itad_client = ITADClient(itad_api_key) if itad_api_key else None
        self.itad_api_key = itad_api_key

    def should_exclude(self, title):
        """Check if title should be excluded"""
        title_upper = title.upper()

        # Keep certain editions
        for keep in KEEP_EDITIONS:
            if keep.upper() in title_upper:
                return False

        # Exclude certain keywords
        for exclude in EXCLUDE_KEYWORDS:
            if exclude.upper() in title_upper:
                return True

        return False

    def calculate_score(self, search_title, candidate_title):
        """Calculate matching score"""
        search_lower = search_title.lower().strip()
        candidate_lower = candidate_title.lower().strip()

        # Exact match
        if search_lower == candidate_lower:
            return SCORE_EXACT_MATCH

        # Partial match
        if search_lower in candidate_lower:
            length_diff = abs(len(candidate_lower) - len(search_lower))
            return max(0, SCORE_PARTIAL_MATCH_BASE - length_diff)

        # Similarity match
        similarity = difflib.SequenceMatcher(None, search_lower, candidate_lower).ratio()
        return int(similarity * SCORE_SIMILARITY_MULTIPLIER)

    def find_best_match(self, title, game_id_list):
        """Find best matching App ID"""
        candidates = []

        for app in game_id_list:
            app_name = app.get('name', '')
            app_id = app.get('appid')

            if not app_name or not app_id:
                continue

            if self.should_exclude(app_name):
                continue

            score = self.calculate_score(title, app_name)

            if score >= SCORE_CANDIDATE_THRESHOLD:
                candidates.append({
                    'appid': app_id,
                    'name': app_name,
                    'score': score
                })

        candidates.sort(key=lambda x: x['score'], reverse=True)

        if not candidates:
            return None

        # Auto-accept if score is high enough
        if candidates[0]['score'] >= SCORE_AUTO_ACCEPT_THRESHOLD:
            return candidates[0]

        # For scores between CANDIDATE_THRESHOLD and AUTO_ACCEPT_THRESHOLD,
        # automatically select highest score (non-interactive)
        return candidates[0]

    def build_id_map_from_titles(self, title_list_path='data/refs/game_title_list.txt', existing_id_map=None):
        """Build id-map from game-title-list.txt

        Args:
            title_list_path: Path to title list file
            existing_id_map: Existing id-map (list format)

        Returns:
            tuple: (updated id_map, mapping result)
        """
        if existing_id_map is None:
            existing_id_map = []

        # Fetch App ID list from Steam Web API
        try:
            logger.info("Fetching App ID list from Steam Web API...")
            response = requests.get(
                'https://api.steampowered.com/ISteamApps/GetAppList/v2/',
                timeout=30
            )
            response.raise_for_status()
            data = response.json()
            game_id_list = data.get('applist', {}).get('apps', [])
            logger.info(f"Steam API: Fetched {len(game_id_list)} apps")
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to fetch app list: {e}")
            return existing_id_map, {'mapped': [], 'failed': []}

        # Check if title_list_path exists
        if not Path(title_list_path).exists():
            logger.error(f"{title_list_path} not found")
            return existing_id_map, {'mapped': [], 'failed': []}

        # Read game-title-list.txt
        with open(title_list_path, 'r', encoding='utf-8') as f:
            title_list = [line.strip() for line in f if line.strip()]

        if not title_list:
            logger.warning("game-title-list.txt is empty")
            return existing_id_map, {'mapped': [], 'failed': []}

        logger.info(f"Starting auto-mapping")
        logger.info(f"game-title-list.txt: {len(title_list)} titles")

        # Set of existing IDs
        existing_ids = {item['id'] for item in existing_id_map}
        mapped = []
        failed = []

        for title in title_list:
            logger.info(f"Processing title count: {len(title_list)}")

            # Find best match
            match = self.find_best_match(title, game_id_list)

            if match:
                app_id = str(match['appid'])

                if app_id in existing_ids:
                    logger.info(f"  → Skipped (already exists: App ID {app_id})")
                    continue

                # Get ITAD ID
                itad_id = None
                if self.itad_client:
                    logger.info(f"  → Fetching ITAD ID (App ID: {app_id})...")
                    itad_id = self.itad_client.get_itad_id_from_steam_appid(app_id)
                    if itad_id:
                        logger.info(f"  ✓ ITAD ID fetch success: {itad_id}")
                    else:
                        logger.warning(f"  ✗ ITAD ID fetch failed (App ID: {app_id})")

                # Add to id-map
                new_entry = {'id': app_id}
                if itad_id:
                    new_entry['itadId'] = itad_id

                existing_id_map.append(new_entry)
                existing_ids.add(app_id)

                mapped.append({
                    'appid': app_id,
                    'name': match['name'],
                    'score': match['score'],
                    'itadId': itad_id
                })

                logger.info(f"  ✓ Mapping success: App ID {app_id}, Score: {match['score']}")
            else:
                failed.append(title)
                logger.warning(f"  ✗ Mapping failed: No candidates found")

        logger.info(f"Auto-mapping result: Success {len(mapped)} items, Failed {len(failed)} items")

        return existing_id_map, {'mapped': mapped, 'failed': failed}

    def rebuild_games_data(self, new_only=False, regions=None, kv_helper=None):
        """Build games.json

        Args:
            new_only: If True, add new titles + fetch data only for new additions
            regions: List of regions to fetch prices for (e.g., ['JP', 'US', 'UK', 'EU'])
            kv_helper: KVHelper instance

        Returns:
            dict: Processing result (rebuilt_games, failed_games, missing_data, mapping_result, id_map)
        """
        if regions is None:
            regions = ['JP']

        if kv_helper is None:
            kv_helper = KVHelper()

        mapping_result = None
        id_map = []

        # Determine mode
        if new_only:
            # Mode A: Add new titles + fetch data only for new additions
            logger.info("=== Processing Mode: Add new titles + fetch data only for new additions ===")

            # 1. Get existing id-map
            id_map = kv_helper.get_id_map()
            logger.info(f"Existing id-map: {len(id_map)} items")

            # 2. Map new titles from game_title_list.txt
            script_dir = Path(__file__).parent
            title_list_path = script_dir / 'data' / 'refs' / 'game_title_list.txt'
            id_map, mapping_result = self.build_id_map_from_titles(
                title_list_path=str(title_list_path),
                existing_id_map=id_map
            )

            # 3. Save id-map
            kv_helper.put_id_map(id_map)

            # 4. Get newly added IDs
            if mapping_result and mapping_result.get('mapped'):
                new_ids = [item['appid'] for item in mapping_result['mapped']]
                logger.info(f"New IDs: {len(new_ids)} items")
            else:
                new_ids = []
                logger.info("No new IDs")

            # 5. Get existing games-data
            existing_games = kv_helper.get_games_data()
            logger.info(f"Existing games-data: {len(existing_games)} items")

            # 6. Fetch detailed data only for new IDs
            target_ids = new_ids
        else:
            # Mode B: Full data update
            logger.info("=== Processing Mode: Full data update ===")

            # 1. Get existing id-map
            id_map = kv_helper.get_id_map()
            logger.info(f"Existing id-map: {len(id_map)} items")

            # 2. Target all IDs
            target_ids = [item['id'] for item in id_map]
            existing_games = []

        logger.info(f"ITAD API Key: {'Available' if self.itad_api_key else 'Not available (use existing data for historical lows)'}")
        logger.info(f"Fetch regions: {', '.join(regions)}")
        logger.info(f"Target ID count: {len(target_ids)} items")

        # Convert id_map to dict for fast lookup
        id_map_dict = {item['id']: item.get('itadId') for item in id_map}

        rebuilt_games = []
        failed_games = []
        missing_data = []

        for i, app_id in enumerate(target_ids, 1):
            logger.info(f"[{i}/{len(target_ids)}] Processing App ID: {app_id}...")

            # Fetch latest data from Steam API
            steam_data = self.steam_client.get_game_info_from_api(app_id, regions=regions)

            if not steam_data:
                logger.error(f"  ✗ Steam API fetch failed, skipped (App ID: {app_id})")
                failed_games.append({'app_id': app_id, 'reason': 'Steam API fetch failed'})
                time.sleep(1)
                continue

            # Build new game data
            new_game = {
                'id': app_id,
                'title': steam_data['title'],
                'englishTitle': steam_data['title'],
                'genres': steam_data['genres'],
                'supportedLanguages': steam_data['supportedLanguages'],
                'storeUrl': steam_data['store_url'],
                'platforms': steam_data['platforms'],
                'developers': steam_data.get('developers', []),
                'publishers': steam_data.get('publishers', []),
                'prices': steam_data['prices'],
            }

            # Image URL
            if steam_data.get('imageUrl'):
                new_game['imageUrl'] = steam_data['imageUrl']
            else:
                new_game['imageUrl'] = '-'
                missing_data.append({'app_id': app_id, 'missing': 'imageUrl (Steam)'})
                logger.warning(f"  ⚠ Image URL fetch failed (App ID: {app_id})")

            # Release date
            if steam_data.get('releaseDate'):
                new_game['releaseDate'] = steam_data['releaseDate']
            else:
                new_game['releaseDate'] = '-'
                missing_data.append({'app_id': app_id, 'missing': 'releaseDate (Steam)'})
                logger.warning(f"  ⚠ Release date fetch failed (App ID: {app_id})")

            # Review score
            if steam_data.get('reviewScore'):
                new_game['reviewScore'] = steam_data['reviewScore']
            else:
                new_game['reviewScore'] = '-'
                missing_data.append({'app_id': app_id, 'missing': 'reviewScore (Steam)'})
                logger.warning(f"  ⚠ Review score fetch failed (App ID: {app_id})")

            # Get ITAD ID
            itad_id = id_map_dict.get(app_id)

            if itad_id:
                new_game['itadId'] = itad_id

                # Fetch historical low from ITAD API
                if self.itad_client:
                    lowest_prices = {}
                    for region in regions:
                        logger.info(f"  → Fetching ITAD historical low ({region})...")
                        historical_low = self.itad_client.get_historical_low(itad_id, region=region)
                        if historical_low:
                            lowest_prices[region] = historical_low
                            logger.info(f"  ✓ ITAD historical low ({region}): {historical_low}")
                        else:
                            lowest_prices[region] = '-'
                            logger.warning(f"  ⚠ ITAD historical low fetch failed ({region}) (App ID: {app_id})")
                            missing_data.append({'app_id': app_id, 'missing': f'lowest.{region} (ITAD)'})

                        # Rate limiting protection
                        if region != regions[-1]:
                            time.sleep(random.uniform(1.0, 1.5))

                    new_game['lowest'] = lowest_prices
                else:
                    # No ITAD API key
                    lowest_prices = {region: '-' for region in regions}
                    new_game['lowest'] = lowest_prices
                    logger.warning(f"  ⚠ No ITAD API key (App ID: {app_id})")
            else:
                # No ITAD ID
                lowest_prices = {region: '-' for region in regions}
                new_game['lowest'] = lowest_prices
                logger.warning(f"  ⚠ No ITAD ID (App ID: {app_id})")

            rebuilt_games.append(new_game)
            price_info = ', '.join([f"{r}: {p.get('currency', 'N/A')} {p.get('price', 0)}" for r, p in steam_data['prices'].items()])
            logger.info(f"  ✓ Success (App ID: {app_id}) - {price_info}")

            # Rate limiting protection
            time.sleep(random.uniform(1.0, 1.5))

        # In new_only mode, merge with existing data
        if new_only:
            logger.info("Merging existing data with new data...")
            existing_ids = {game['id'] for game in existing_games}
            new_game_ids = {game['id'] for game in rebuilt_games}

            # Existing data + new data (skip duplicates)
            final_games = existing_games.copy()
            for new_game in rebuilt_games:
                if new_game['id'] not in existing_ids:
                    final_games.append(new_game)
                else:
                    logger.info(f"  → Skipped (already exists: App ID {new_game['id']})")

            logger.info(f"Merge result: Existing {len(existing_games)} items + New {len(rebuilt_games)} items = Total {len(final_games)} items")
            rebuilt_games = final_games

        return {
            'rebuilt_games': rebuilt_games,
            'failed_games': failed_games,
            'missing_data': missing_data,
            'mapping_result': mapping_result,
            'id_map': id_map
        }
