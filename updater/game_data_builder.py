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
        """Find best matching App ID

        Returns:
            dict or None: Match result with keys:
                - 'match': single candidate dict if unique match found
                - 'multiple': list of candidates if multiple exact matches found
                - None if no match found
        """
        candidates = []

        # Collect all candidates - check entire list
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

        if not candidates:
            return None

        # Sort by score
        candidates.sort(key=lambda x: x['score'], reverse=True)

        # Check for multiple exact matches (score 100)
        exact_matches = [c for c in candidates if c['score'] == SCORE_EXACT_MATCH]

        if len(exact_matches) > 1:
            # Multiple exact matches found - ambiguous
            return {'multiple': exact_matches}

        # Single best match
        if candidates[0]['score'] >= SCORE_AUTO_ACCEPT_THRESHOLD:
            return {'match': candidates[0]}

        # For scores between CANDIDATE_THRESHOLD and AUTO_ACCEPT_THRESHOLD,
        # automatically select highest score (non-interactive)
        return {'match': candidates[0]}

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
        skipped_existing = []
        skipped_multiple = []

        for title in title_list:
            logger.info(f"Processing title: {title}")

            # Find best match
            match_result = self.find_best_match(title, game_id_list)

            if match_result is None:
                # No match found
                failed.append(title)
                logger.warning(f"  ✗ Mapping failed: No candidates found")
                continue

            if 'multiple' in match_result:
                # Multiple exact matches found - ambiguous
                multiple_matches = match_result['multiple']
                logger.warning(f"  ✗ Multiple exact matches found for '{title}':")
                for m in multiple_matches:
                    logger.warning(f"    - App ID: {m['appid']}, Name: {m['name']}")
                skipped_multiple.append({
                    'title': title,
                    'matches': [{'appid': m['appid'], 'name': m['name']} for m in multiple_matches]
                })
                continue

            # Single match found
            match = match_result['match']
            app_id = str(match['appid'])

            if app_id in existing_ids:
                logger.info(f"  → Skipped (already exists: App ID {app_id})")
                skipped_existing.append({
                    'title': title,
                    'appid': app_id,
                    'name': match['name']
                })
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

        logger.info(f"Auto-mapping result: Success {len(mapped)} items, Failed {len(failed)} items, Skipped (existing): {len(skipped_existing)} items, Skipped (multiple): {len(skipped_multiple)} items")

        return existing_id_map, {
            'mapped': mapped,
            'failed': failed,
            'skipped_existing': skipped_existing,
            'skipped_multiple': skipped_multiple
        }

    def _build_game_data_from_steam(self, app_id, steam_data, itad_id=None, itad_deal=None, tags=None):
        """Build game data structure from Steam API data

        Args:
            app_id: Steam App ID
            steam_data: Data from Steam API
            itad_id: ITAD ID (optional)
            itad_deal: ITAD deal data dict with currency keys (e.g., {'JPY': {price, regular, cut, storeLow}})
            tags: List of tags (optional, will be truncated to top 3)

        Returns:
            dict: Game data structure
        """
        # Extract top 3 tags
        top_tags = tags[:3] if tags and isinstance(tags, list) else []

        game = {
            'id': app_id,
            'title': steam_data['title'],
            'englishTitle': steam_data['title'],
            'genres': steam_data['genres'],
            'supportedLanguages': steam_data['supportedLanguages'],
            'storeUrl': steam_data['store_url'],
            'platforms': steam_data['platforms'],
            'developers': steam_data.get('developers', []),
            'publishers': steam_data.get('publishers', []),
            'imageUrl': steam_data.get('imageUrl', '-'),
            'releaseDate': steam_data.get('releaseDate', '-'),
            'reviewScore': steam_data.get('reviewScore', '-'),
            'tags': top_tags
        }

        # Add ITAD data if available
        if itad_id:
            game['itadId'] = itad_id
            if itad_deal is not None:
                game['deal'] = itad_deal
            else:
                game['deal'] = {'JPY': {'price': '-', 'regular': '-', 'cut': 0, 'storeLow': '-'}}
        else:
            game['deal'] = {'JPY': {'price': '-', 'regular': '-', 'cut': 0, 'storeLow': '-'}}

        return game

    def _rebuild_differential_update(self, kv_helper):
        """Mode B: Differential update (daily batch)

        Args:
            kv_helper: KVHelper instance

        Returns:
            dict: Processing result
        """
        logger.info("=== Processing Mode: Differential update (daily batch) ===")

        # 1. Get existing id-map
        id_map = kv_helper.get_id_map()
        logger.info(f"Existing id-map: {len(id_map)} items")

        # 2. Get existing games-data from KV
        existing_games = kv_helper.get_games_data()
        logger.info(f"Existing games-data: {len(existing_games)} items")

        # Phase 1: Fetch ITAD deal data for all games and compare prices
        logger.info("Phase 1: Fetching ITAD deal data for all games...")
        all_app_ids = [item['id'] for item in id_map]
        id_map_dict = {item['id']: item.get('itadId') for item in id_map}
        existing_games_dict = {game['id']: game for game in existing_games}

        # Identify games with noItadData flag (need Steam API comparison)
        games_with_no_itad_flag = set()
        for game in existing_games:
            deal = game.get('deal', {}).get('JPY', {})
            if deal.get('noItadData'):
                games_with_no_itad_flag.add(game['id'])

        # Fetch ITAD deals in batch (200 items per request) - only for games without noItadData flag
        itad_enabled_ids = [item.get('itadId') for item in id_map if item.get('itadId') and item['id'] not in games_with_no_itad_flag]
        itad_deal_map = {}
        if itad_enabled_ids and self.itad_client:
            logger.info(f"  → Fetching ITAD deals for {len(itad_enabled_ids)} games (excluding {len(games_with_no_itad_flag)} noItadData games)...")
            itad_deal_map = self.itad_client.get_batch_deals(itad_enabled_ids, region='JP')
            logger.info(f"  → ITAD batch fetch complete: {len(itad_deal_map)} deals retrieved")

            # Check if ITAD API failed completely (0 deals retrieved)
            if len(itad_deal_map) == 0 and len(itad_enabled_ids) > 0:
                logger.error("ITAD API failed to retrieve any deal data. Aborting differential update.")
                raise Exception("ITAD API batch fetch returned 0 results")

        games_to_update = []
        games_no_change = []
        games_without_itad = []  # Track games without ITAD data
        games_needing_steam_comparison = []  # Games with noItadData flag that need Steam API comparison

        # Compare ITAD deal data with KV data
        for i, app_id in enumerate(all_app_ids, 1):
            existing_game = existing_games_dict.get(app_id)
            if not existing_game:
                logger.warning(f"  ✗ App ID {app_id} exists in id-map but not in games-data, skipping...")
                continue

            # Check if this game has noItadData flag
            kv_deal = existing_game.get('deal', {}).get('JPY', {})
            has_no_itad_flag = kv_deal.get('noItadData', False)

            if has_no_itad_flag:
                # This game needs Steam API comparison (will be done in Phase 1.5)
                games_needing_steam_comparison.append(app_id)
                games_without_itad.append(app_id)
                continue

            itad_id = id_map_dict.get(app_id)
            if not itad_id:
                logger.warning(f"  ✗ No ITAD ID for App ID {app_id}, will fetch from Steam API only")
                games_to_update.append((app_id, None))
                games_without_itad.append(app_id)
                continue

            itad_deal = itad_deal_map.get(itad_id)
            if not itad_deal:
                logger.warning(f"  ✗ No ITAD deal data for ITAD ID {itad_id} (App ID: {app_id}), will fetch from Steam API only")
                games_to_update.append((app_id, itad_id))
                games_without_itad.append(app_id)
                continue

            # Check if ITAD deal has no JPY/Steam data (all values are '-')
            if itad_deal.get('price') == '-' and itad_deal.get('regular') == '-':
                logger.warning(f"  ✗ ITAD has no JPY/Steam data for ITAD ID {itad_id} (App ID: {app_id}), will fetch from Steam API only")
                games_to_update.append((app_id, itad_id))
                games_without_itad.append(app_id)
                continue

            # Extract KV deal data
            kv_price = kv_deal.get('price')
            kv_cut = kv_deal.get('cut', 0)

            # Extract ITAD deal data
            itad_price = itad_deal.get('price')
            itad_cut = itad_deal.get('cut', 0)

            # Compare price and cut
            if itad_price != kv_price or itad_cut != kv_cut:
                logger.info(f"[{i}/{len(all_app_ids)}] Price/cut difference detected for App ID {app_id}: KV(price={kv_price}, cut={kv_cut}), ITAD(price={itad_price}, cut={itad_cut})")
                games_to_update.append((app_id, itad_id))
            else:
                games_no_change.append(app_id)

        logger.info(f"Phase 1 complete: {len(games_to_update)} games to update via ITAD comparison, {len(games_needing_steam_comparison)} games need Steam API comparison, {len(games_no_change)} games unchanged")

        # Phase 1.5: For games with noItadData flag, fetch Steam API and compare
        if games_needing_steam_comparison:
            logger.info(f"Phase 1.5: Comparing Steam API data for {len(games_needing_steam_comparison)} noItadData games...")
            for i, app_id in enumerate(games_needing_steam_comparison, 1):
                logger.info(f"[{i}/{len(games_needing_steam_comparison)}] Fetching Steam data for App ID: {app_id}...")

                # Fetch Steam Basic API
                basic_data = self.steam_client.get_game_info_from_api(app_id, regions=['JP'])
                if not basic_data:
                    logger.warning(f"  ✗ Failed to fetch Steam data for App ID {app_id}, keeping existing data")
                    games_no_change.append(app_id)
                    continue

                # Extract Steam prices
                steam_prices = basic_data.get('prices', {}).get('JP', {})
                steam_regular = steam_prices.get('price', 0)
                steam_sale = steam_prices.get('salePrice')
                steam_current = steam_sale if steam_sale is not None else steam_regular

                # Extract KV prices
                existing_game = existing_games_dict.get(app_id)
                kv_deal = existing_game.get('deal', {}).get('JPY', {})
                kv_price = kv_deal.get('price')

                # Compare
                if steam_current != kv_price:
                    logger.info(f"  → Price difference detected: KV={kv_price}, Steam={steam_current}")
                    itad_id = id_map_dict.get(app_id)
                    games_to_update.append((app_id, itad_id))
                else:
                    games_no_change.append(app_id)

            logger.info(f"Phase 1.5 complete: {len([g for g in games_to_update if g[0] in games_needing_steam_comparison])} noItadData games need update")

        if games_without_itad:
            logger.warning(f"  ⚠ Games without ITAD data (total): {games_without_itad}")

        # Phase 2: Build game data
        logger.info("Phase 2: Building game data...")
        rebuilt_games = []
        failed_games = []
        missing_data = []
        games_with_image_fallback = []  # Track games using fallback image (not capsule_616x353)

        # For games without changes: copy KV data as-is
        logger.info(f"  → Copying {len(games_no_change)} unchanged games from KV...")
        for app_id in games_no_change:
            existing_game = existing_games_dict.get(app_id)
            if existing_game:
                rebuilt_games.append(existing_game)

        # For games with changes: fetch Steam Basic API + Review API
        logger.info(f"  → Fetching Steam data for {len(games_to_update)} changed games...")
        for i, (app_id, itad_id) in enumerate(games_to_update, 1):
            logger.info(f"[{i}/{len(games_to_update)}] Fetching Steam data for App ID: {app_id}...")

            # Fetch Steam Basic API (includes price, genres, languages, etc.)
            basic_data = self.steam_client.get_game_info_from_api(app_id, regions=['JP'])
            if not basic_data:
                logger.warning(f"  ✗ Failed to fetch Steam data for App ID {app_id}")
                failed_games.append({'app_id': app_id, 'reason': 'Failed to fetch Steam data'})
                continue

            # Get ITAD deal data from Phase 1 cache, or construct from Steam data
            itad_deal = itad_deal_map.get(itad_id) if itad_id else None

            # Check if ITAD deal has no JPY/Steam data (all values are '-')
            if itad_deal and itad_deal.get('price') == '-' and itad_deal.get('regular') == '-':
                logger.info(f"  → ITAD has no JPY/Steam data, will construct from Steam API")
                itad_deal = None  # Treat as no ITAD data

            if itad_deal:
                itad_deal_dict = {'JPY': itad_deal}
            else:
                # No ITAD data: construct deal structure from Steam API data
                steam_prices = basic_data.get('prices', {}).get('JP', {})
                regular_price = steam_prices.get('price', 0)
                sale_price = steam_prices.get('salePrice')

                if sale_price is not None and sale_price < regular_price:
                    price = sale_price
                    cut = int(((regular_price - sale_price) / regular_price) * 100) if regular_price > 0 else 0
                else:
                    price = regular_price
                    cut = 0

                steam_deal = {
                    'price': price,
                    'regular': regular_price,
                    'cut': cut,
                    'storeLow': '-',  # Unknown without ITAD
                    'noItadData': True  # Flag for games without ITAD data
                }
                itad_deal_dict = {'JPY': steam_deal}
                logger.info(f"  → Constructed deal from Steam API (no ITAD): price={price}, regular={regular_price}, cut={cut}")

            # Fetch tags from ITAD if available
            tags = []
            if itad_id and self.itad_client:
                tags = self.itad_client.get_game_tags(itad_id)
                logger.debug(f"  → Fetched {len(tags)} tags from ITAD for App ID {app_id}")

            # Build game data using common method
            new_game = self._build_game_data_from_steam(app_id, basic_data, itad_id, itad_deal_dict, tags)

            # Check if image URL conversion failed (using fallback)
            # If imageUrl doesn't contain 'capsule_616x353', it's using fallback
            image_url = new_game.get('imageUrl', '')
            if image_url and image_url != '-' and 'capsule_616x353' not in image_url:
                games_with_image_fallback.append(app_id)

            rebuilt_games.append(new_game)
            logger.info(f"  ✓ Updated successfully (App ID: {app_id})")

        logger.info(f"Phase 2 complete: {len(rebuilt_games)} total games ({len(games_no_change)} unchanged + {len(games_to_update) - len(failed_games)} updated)")

        if games_with_image_fallback:
            logger.warning(f"  ⚠ Games using fallback image (not capsule_616x353): {len(games_with_image_fallback)} games")
            logger.warning(f"  App IDs: {games_with_image_fallback}")

        return {
            'rebuilt_games': rebuilt_games,
            'failed_games': failed_games,
            'missing_data': missing_data,
            'mapping_result': None,
            'id_map': id_map,
            'newly_added_games': [],
            'games_without_itad': games_without_itad,
            'games_with_image_fallback': games_with_image_fallback
        }

    def _rebuild_new_only(self, regions, kv_helper):
        """Mode A: Add new titles + fetch data only for new additions

        Args:
            regions: List of regions to fetch prices for
            kv_helper: KVHelper instance

        Returns:
            dict: Processing result
        """
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

        # 3. Don't save id-map yet - will save after successful games-data update
        logger.info("id-map updated (not saved to KV yet)")

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
        logger.info(f"ITAD API Key: {'Available' if self.itad_api_key else 'Not available (use existing data for historical lows)'}")
        logger.info(f"Fetch regions: {', '.join(regions)}")
        logger.info(f"Target ID count: {len(target_ids)} items")

        # Convert id_map to dict for fast lookup
        id_map_dict = {item['id']: item.get('itadId') for item in id_map}

        rebuilt_games = []
        failed_games = []
        missing_data = []
        games_without_itad = []
        games_with_image_fallback = []

        # Batch fetch ITAD deal data for new games
        new_itad_ids = [id_map_dict.get(app_id) for app_id in target_ids if id_map_dict.get(app_id)]
        itad_deal_map = {}
        if new_itad_ids and self.itad_client:
            logger.info(f"Fetching ITAD deals for {len(new_itad_ids)} new games...")
            itad_deal_map = self.itad_client.get_batch_deals(new_itad_ids, region='JP')
            logger.info(f"ITAD batch fetch complete: {len(itad_deal_map)} deals retrieved")

            # Check if ITAD API failed completely (0 deals retrieved)
            if len(itad_deal_map) == 0 and len(new_itad_ids) > 0:
                logger.error("ITAD API failed to retrieve any deal data. Aborting new-only update.")
                raise Exception("ITAD API batch fetch returned 0 results")

        # Process new IDs
        for i, app_id in enumerate(target_ids, 1):
            logger.info(f"[{i}/{len(target_ids)}] Processing App ID: {app_id}...")

            # Fetch latest data from Steam API (Basic + Review)
            steam_data = self.steam_client.get_game_info_from_api(app_id, regions=['JP'])

            if not steam_data:
                logger.error(f"  ✗ Steam API fetch failed, skipped (App ID: {app_id})")
                failed_games.append({'app_id': app_id, 'reason': 'Steam API fetch failed'})
                continue

            # Get ITAD ID and deal data, or construct from Steam data
            itad_id = id_map_dict.get(app_id)
            itad_deal = itad_deal_map.get(itad_id) if itad_id else None

            # Check if ITAD deal has no JPY/Steam data (all values are '-')
            if itad_deal and itad_deal.get('price') == '-' and itad_deal.get('regular') == '-':
                logger.warning(f"  ✗ ITAD has no JPY/Steam data for App ID {app_id}, will construct from Steam API")
                itad_deal = None  # Treat as no ITAD data

            if itad_deal:
                itad_deal_dict = {'JPY': itad_deal}
            else:
                # No ITAD data: construct deal structure from Steam API data
                steam_prices = steam_data.get('prices', {}).get('JP', {})
                regular_price = steam_prices.get('price', 0)
                sale_price = steam_prices.get('salePrice')

                if sale_price is not None and sale_price < regular_price:
                    price = sale_price
                    cut = int(((regular_price - sale_price) / regular_price) * 100) if regular_price > 0 else 0
                else:
                    price = regular_price
                    cut = 0

                steam_deal = {
                    'price': price,
                    'regular': regular_price,
                    'cut': cut,
                    'storeLow': '-',
                    'noItadData': True  # Flag for games without ITAD data
                }
                itad_deal_dict = {'JPY': steam_deal}
                games_without_itad.append(app_id)
                logger.info(f"  → Constructed deal from Steam API (no ITAD): price={price}, regular={regular_price}, cut={cut}")

            # Fetch tags from ITAD if available
            tags = []
            if itad_id and self.itad_client:
                tags = self.itad_client.get_game_tags(itad_id)
                logger.debug(f"  → Fetched {len(tags)} tags from ITAD for App ID {app_id}")

            # Build game data using common method
            new_game = self._build_game_data_from_steam(app_id, steam_data, itad_id, itad_deal_dict, tags)

            # Check if image URL conversion failed (using fallback)
            # If imageUrl doesn't contain 'capsule_616x353', it's using fallback
            image_url = new_game.get('imageUrl', '')
            if image_url and image_url != '-' and 'capsule_616x353' not in image_url:
                games_with_image_fallback.append(app_id)

            # Check for missing data
            if steam_data.get('imageUrl') is None:
                missing_data.append({'app_id': app_id, 'missing': 'imageUrl (Steam)'})
                logger.warning(f"  ⚠ Image URL fetch failed (App ID: {app_id})")

            if steam_data.get('releaseDate') is None:
                missing_data.append({'app_id': app_id, 'missing': 'releaseDate (Steam)'})
                logger.warning(f"  ⚠ Release date fetch failed (App ID: {app_id})")

            if steam_data.get('reviewScore') is None:
                missing_data.append({'app_id': app_id, 'missing': 'reviewScore (Steam)'})
                logger.warning(f"  ⚠ Review score fetch failed (App ID: {app_id})")

            if not itad_id:
                missing_data.append({'app_id': app_id, 'missing': 'itadId'})
                logger.warning(f"  ⚠ No ITAD ID (App ID: {app_id})")
            elif not itad_deal:
                missing_data.append({'app_id': app_id, 'missing': 'deal.JPY (ITAD)'})
                logger.warning(f"  ⚠ ITAD deal fetch failed (App ID: {app_id})")

            rebuilt_games.append(new_game)
            logger.info(f"  ✓ Success (App ID: {app_id})")

        # Merge with existing data
        logger.info("Merging existing data with new data...")
        existing_ids = {game['id'] for game in existing_games}

        # Track newly added games
        newly_added_games = []

        # Existing data + new data (skip duplicates)
        final_games = existing_games.copy()
        for new_game in rebuilt_games:
            if new_game['id'] not in existing_ids:
                final_games.append(new_game)
                # Record actually added games
                newly_added_games.append({
                    'id': new_game['id'],
                    'title': new_game['title']
                })
            else:
                logger.info(f"  → Skipped (already exists: App ID {new_game['id']})")

        logger.info(f"Merge result: Existing {len(existing_games)} items + New {len(newly_added_games)} items = Total {len(final_games)} items")
        rebuilt_games = final_games

        # Log games using fallback images
        if games_with_image_fallback:
            logger.warning(f"  ⚠ Games using fallback image (not capsule_616x353): {len(games_with_image_fallback)} games")
            logger.warning(f"  App IDs: {games_with_image_fallback}")

        return {
            'rebuilt_games': rebuilt_games,
            'failed_games': failed_games,
            'missing_data': missing_data,
            'mapping_result': mapping_result,
            'id_map': id_map,
            'newly_added_games': newly_added_games,
            'games_without_itad': games_without_itad,
            'games_with_image_fallback': games_with_image_fallback
        }

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

        # Delegate to appropriate method
        if new_only:
            return self._rebuild_new_only(regions, kv_helper)
        else:
            return self._rebuild_differential_update(kv_helper)
