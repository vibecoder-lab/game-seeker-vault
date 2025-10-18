#!/usr/bin/env python3
"""
Business logic layer for game data construction (async version)

Integrates data from Steam API and ITAD API to build games.json with:
- Differential update logic (compare KV data vs ITAD prices)
- Batch ITAD price fetching (450 items at once)
- Dynamic concurrency control
- Parallel execution of Steam API endpoints
"""

import asyncio
import aiohttp
import difflib
import logging
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from steam_client import SteamClient
from itad_client import ITADClient
from kv_helper import KVHelper
from rate_controller import RateControllerManager
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
    """
    Game data builder with differential updates and dynamic rate control

    Features:
    - Differential update: only fetch Steam data for games with price changes
    - Batch ITAD fetching: retrieve 450 prices in one request
    - Dynamic concurrency: adjust based on 429 errors, RTT, and window usage
    - Parallel execution: 3 Steam endpoints per game executed concurrently
    """

    def __init__(self, itad_api_key: Optional[str] = None):
        """
        Args:
            itad_api_key: ITAD API key (if None, differential updates disabled)
        """
        self.itad_api_key = itad_api_key

        # Initialize rate controller manager
        self.rate_manager = RateControllerManager()

        # Create rate controllers for each host
        # Steam Store API: ~200 req/5min (≈0.67 req/s)
        self.store_controller = self.rate_manager.create_controller(
            host='store',
            target_rps=0.67,
            window_seconds=300,
            window_limit=200
        )

        # ITAD API: dynamic rate limiting based on response headers
        self.itad_controller = self.rate_manager.create_controller(
            host='itad',
            target_rps=1.0,
            window_seconds=60,
            window_limit=100
        )

        # Initialize clients
        self.steam_client = SteamClient(store_rate_controller=self.store_controller)
        self.itad_client = ITADClient(itad_api_key, rate_controller=self.itad_controller) if itad_api_key else None

    def should_exclude(self, title: str) -> bool:
        """Check if title should be excluded from mapping"""
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

    def calculate_score(self, search_title: str, candidate_title: str) -> int:
        """Calculate matching score for title mapping"""
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

    def find_best_match(self, title: str, game_id_list: List[Dict]) -> Optional[Dict]:
        """Find best matching App ID for a title"""
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

        if not candidates:
            return None

        candidates.sort(key=lambda x: x['score'], reverse=True)

        # Check for multiple exact matches
        exact_matches = [c for c in candidates if c['score'] == SCORE_EXACT_MATCH]

        if len(exact_matches) > 1:
            return {'multiple': exact_matches}

        if candidates[0]['score'] >= SCORE_AUTO_ACCEPT_THRESHOLD:
            return {'match': candidates[0]}

        return {'match': candidates[0]}

    async def build_id_map_from_titles(self, session: aiohttp.ClientSession,
                                       title_list_path: str = 'data/refs/game_title_list.txt',
                                       existing_id_map: Optional[List[Dict]] = None) -> Tuple[List[Dict], Dict]:
        """
        Build id-map from game-title-list.txt

        Args:
            session: aiohttp session
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
            async with session.get('https://api.steampowered.com/ISteamApps/GetAppList/v2/') as response:
                response.raise_for_status()
                data = await response.json()
                game_id_list = data.get('applist', {}).get('apps', [])
                logger.info(f"Steam API: Fetched {len(game_id_list)} apps")
        except Exception as e:
            logger.error(f"Failed to fetch app list: {e}")
            return existing_id_map, {'mapped': [], 'failed': []}

        # Check if title list exists
        if not Path(title_list_path).exists():
            logger.error(f"{title_list_path} not found")
            return existing_id_map, {'mapped': [], 'failed': []}

        # Read title list
        with open(title_list_path, 'r', encoding='utf-8') as f:
            title_list = [line.strip() for line in f if line.strip()]

        if not title_list:
            logger.warning("game-title-list.txt is empty")
            return existing_id_map, {'mapped': [], 'failed': []}

        logger.info(f"Starting auto-mapping")
        logger.info(f"game-title-list.txt: {len(title_list)} titles")

        existing_ids = {item['id'] for item in existing_id_map}
        mapped = []
        failed = []
        skipped_existing = []
        skipped_multiple = []

        for title in title_list:
            logger.info(f"Processing title: {title}")

            match_result = self.find_best_match(title, game_id_list)

            if match_result is None:
                failed.append(title)
                logger.warning(f"  ✗ Mapping failed: No candidates found")
                continue

            if 'multiple' in match_result:
                multiple_matches = match_result['multiple']
                logger.warning(f"  ✗ Multiple exact matches found for '{title}':")
                for m in multiple_matches:
                    logger.warning(f"    - App ID: {m['appid']}, Name: {m['name']}")
                skipped_multiple.append({
                    'title': title,
                    'matches': [{'appid': m['appid'], 'name': m['name']} for m in multiple_matches]
                })
                continue

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
                itad_id = await self.itad_client.get_itad_id_from_steam_appid(session, app_id)
                if itad_id:
                    logger.info(f"  ✓ ITAD ID fetch success: {itad_id}")
                else:
                    logger.warning(f"  ✗ ITAD ID fetch failed (App ID: {app_id})")

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

        logger.info(f"Auto-mapping result: Success {len(mapped)} items, Failed {len(failed)} items, "
                   f"Skipped (existing): {len(skipped_existing)} items, Skipped (multiple): {len(skipped_multiple)} items")

        return existing_id_map, {
            'mapped': mapped,
            'failed': failed,
            'skipped_existing': skipped_existing,
            'skipped_multiple': skipped_multiple
        }

    async def _fetch_single_game_data(self, session: aiohttp.ClientSession, app_id: str,
                                      regions: List[str], itad_data: Optional[int]) -> Optional[Dict]:
        """
        Fetch data for a single game (Steam API*3)

        Args:
            session: aiohttp session
            app_id: Steam App ID
            regions: Region list
            itad_data: ITAD historical low price (already fetched from batch request)

        Returns:
            dict: Game data, or error dict
        """
        try:
            logger.info(f"Fetching full data for App ID: {app_id}...")

            # Fetch Steam data (3 endpoints in parallel)
            steam_data = await self.steam_client.get_game_info_from_api(session, app_id, regions=regions)

            if not steam_data:
                logger.error(f"  ✗ Steam API fetch failed, skipped (App ID: {app_id})")
                return {'app_id': app_id, 'error': 'Steam API fetch failed'}

            # Build game data
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
                'imageUrl': steam_data.get('imageUrl', '-'),
                'releaseDate': steam_data.get('releaseDate', '-'),
                'reviewScore': steam_data.get('reviewScore', '-')
            }

            # Add ITAD data (from batch request)
            if itad_data:
                new_game['lowest'] = {'JP': itad_data}
            else:
                new_game['lowest'] = {'JP': '-'}

            logger.info(f"  ✓ Success (App ID: {app_id})")
            return new_game

        except Exception as e:
            logger.error(f"Error processing app {app_id}: {e}")
            return {'app_id': app_id, 'error': str(e)}

    async def _build_game_from_cached_basic(self, session: aiohttp.ClientSession, app_id: str,
                                            steam_basic: Dict, itad_price: Optional[int],
                                            itad_id: Optional[str]) -> Optional[Dict]:
        """
        Build full game data from cached basic info + image + review

        Args:
            session: aiohttp session
            app_id: Steam App ID
            steam_basic: Cached basic API response (from _get_basic_info)
            itad_price: ITAD historical low price
            itad_id: ITAD game ID

        Returns:
            dict: Complete game data, or error dict
        """
        try:
            # Parallel fetch: image + review
            tasks = [
                self.steam_client._extract_image_url(session, app_id, steam_basic['raw_data']),
                self.steam_client._extract_review_score(session, app_id)
            ]

            results = await asyncio.gather(*tasks, return_exceptions=True)
            image_url = results[0] if not isinstance(results[0], Exception) else None
            review_score = results[1] if not isinstance(results[1], Exception) else None

            # Build game data
            game_data = {
                'id': app_id,
                'title': steam_basic['title'],
                'englishTitle': steam_basic['title'],
                'genres': steam_basic['genres'],
                'supportedLanguages': steam_basic['supportedLanguages'],
                'storeUrl': f"https://store.steampowered.com/app/{app_id}/",
                'platforms': steam_basic['platforms'],
                'developers': steam_basic['developers'],
                'publishers': steam_basic['publishers'],
                'prices': steam_basic['prices'],
                'imageUrl': image_url,
                'releaseDate': steam_basic['releaseDate'],
                'reviewScore': review_score
            }

            # Add ITAD data
            if itad_price:
                game_data['lowest'] = {'JP': itad_price}
            else:
                game_data['lowest'] = {'JP': '-'}

            if itad_id:
                game_data['itadId'] = itad_id

            return game_data

        except Exception as e:
            logger.error(f"Error building game data for {app_id}: {e}")
            return {'app_id': app_id, 'error': str(e)}

    async def rebuild_games_data(self, new_only: bool = False, regions: Optional[List[str]] = None,
                                 kv_helper: Optional[KVHelper] = None) -> Dict:
        """
        Build games.json with differential updates

        Differential update flow (normal mode):
        1. Get games-data from KV (450 items)
        2. Fetch ITAD prices in batch (450 items)
        3. Compare KV price vs ITAD price for each game
        4. If different: fetch Steam API*3, reuse ITAD data from batch
        5. Rebuild full games-data (450 items) and save to KV

        --new-only mode: add new titles only, no differential update

        Args:
            new_only: If True, add new titles only (no diff check)
            regions: List of regions to fetch prices for
            kv_helper: KVHelper instance

        Returns:
            dict: Processing result
        """
        if regions is None:
            regions = ['JP']

        if kv_helper is None:
            kv_helper = KVHelper()

        mapping_result = None
        id_map = []

        if new_only:
            # Mode A: Add new titles only (no differential update)
            logger.info("=== Processing Mode: Add new titles only (--new-only) ===")

            id_map = kv_helper.get_id_map()
            logger.info(f"Existing id-map: {len(id_map)} items")

            script_dir = Path(__file__).parent
            title_list_path = script_dir / 'data' / 'refs' / 'game_title_list.txt'

            async with aiohttp.ClientSession() as session:
                id_map, mapping_result = await self.build_id_map_from_titles(
                    session=session,
                    title_list_path=str(title_list_path),
                    existing_id_map=id_map
                )

            logger.info("id-map updated (not saved to KV yet)")

            if mapping_result and mapping_result.get('mapped'):
                new_ids = [item['appid'] for item in mapping_result['mapped']]
                logger.info(f"New IDs: {len(new_ids)} items")
            else:
                new_ids = []
                logger.info("No new IDs")

            existing_games = kv_helper.get_games_data()
            logger.info(f"Existing games-data: {len(existing_games)} items")

            target_ids = new_ids
            id_map_dict = {item['id']: item.get('itadId') for item in id_map}

            # For new games, fetch ITAD data if available
            itad_price_map = {}
            if self.itad_client and len(new_ids) > 0:
                new_itad_ids = [id_map_dict.get(app_id) for app_id in new_ids if id_map_dict.get(app_id)]
                if new_itad_ids:
                    async with aiohttp.ClientSession() as session:
                        itad_price_map = await self.itad_client.get_batch_prices(session, new_itad_ids, region='JP')

            rebuilt_games = []
            failed_games = []

            async with aiohttp.ClientSession(headers=self.steam_client.headers) as session:
                # Build task list for parallel execution
                tasks = []
                for app_id in target_ids:
                    itad_id = id_map_dict.get(app_id)
                    itad_price = itad_price_map.get(itad_id) if itad_id else None
                    tasks.append(self._fetch_single_game_data(session, app_id, regions, itad_price))

                # Execute all tasks in parallel
                results = await asyncio.gather(*tasks, return_exceptions=True)

                # Process results
                for i, game_data in enumerate(results):
                    if game_data is None or isinstance(game_data, Exception):
                        continue
                    elif 'error' in game_data:
                        failed_games.append({'app_id': game_data['app_id'], 'reason': game_data['error']})
                    else:
                        # Add itadId if exists
                        app_id = target_ids[i]
                        itad_id = id_map_dict.get(app_id)
                        if itad_id:
                            game_data['itadId'] = itad_id
                        rebuilt_games.append(game_data)

            # Merge with existing games
            logger.info("Merging existing data with new data...")
            existing_ids = {game['id'] for game in existing_games}
            newly_added_games = []

            final_games = existing_games.copy()
            for new_game in rebuilt_games:
                if new_game['id'] not in existing_ids:
                    final_games.append(new_game)
                    newly_added_games.append({
                        'id': new_game['id'],
                        'title': new_game['title']
                    })
                else:
                    logger.info(f"  → Skipped (already exists: App ID {new_game['id']})")

            logger.info(f"Merge result: Existing {len(existing_games)} items + New {len(newly_added_games)} items = Total {len(final_games)} items")
            rebuilt_games = final_games

        else:
            # Mode B: Differential update (Steam current price trigger)
            logger.info("=== Processing Mode: Differential update (daily batch) ===")

            id_map = kv_helper.get_id_map()
            logger.info(f"Existing id-map: {len(id_map)} items")

            # Get existing games-data from KV
            existing_games = kv_helper.get_games_data()
            logger.info(f"Existing games-data: {len(existing_games)} items")

            # Build lookup dicts
            id_map_dict = {item['id']: item.get('itadId') for item in id_map}
            existing_games_dict = {game['id']: game for game in existing_games}
            all_app_ids = list(id_map_dict.keys())

            # Phase 1: Fetch all games' basic info (prices) from Steam API
            logger.info(f"Phase 1: Fetching basic info for all {len(all_app_ids)} games...")
            steam_data_cache = {}
            games_to_update = []
            games_no_change = []

            async with aiohttp.ClientSession(headers=self.steam_client.headers) as session:
                # Parallel fetch all basic info
                tasks = [
                    self.steam_client._get_basic_info(session, app_id, region='JP')
                    for app_id in all_app_ids
                ]
                results = await asyncio.gather(*tasks, return_exceptions=True)

                # Differential check based on current price
                for i, steam_data in enumerate(results):
                    app_id = all_app_ids[i]

                    if steam_data is None or isinstance(steam_data, Exception):
                        logger.warning(f"Failed to fetch basic info for App ID {app_id}")
                        games_no_change.append(app_id)
                        continue

                    steam_data_cache[app_id] = steam_data
                    existing_game = existing_games_dict.get(app_id)

                    if not existing_game:
                        games_no_change.append(app_id)
                        continue

                    # Extract current price from Steam API
                    steam_prices_jp = steam_data.get('prices', {}).get('JP', {})
                    steam_sale_price = steam_prices_jp.get('salePrice')
                    steam_regular_price = steam_prices_jp.get('price')
                    steam_current_price = steam_sale_price if steam_sale_price is not None else steam_regular_price

                    # Extract current price from KV
                    kv_prices_jp = existing_game.get('prices', {}).get('JP', {})
                    kv_sale_price = kv_prices_jp.get('salePrice')
                    kv_regular_price = kv_prices_jp.get('price')
                    kv_current_price = kv_sale_price if kv_sale_price is not None else kv_regular_price

                    # Compare current prices
                    if steam_current_price != kv_current_price:
                        logger.info(f"Price difference detected for App ID {app_id}: KV={kv_current_price}, Steam={steam_current_price}")
                        itad_id = id_map_dict.get(app_id)
                        games_to_update.append((app_id, itad_id))
                    else:
                        games_no_change.append(app_id)

            logger.info(f"Games with price differences: {len(games_to_update)} items")
            logger.info(f"Games without changes: {len(games_no_change)} items")

            # Phase 2-1: Fetch ITAD lowest prices for games with differences only
            itad_price_map = {}
            if self.itad_client and len(games_to_update) > 0:
                update_itad_ids = [itad_id for app_id, itad_id in games_to_update if itad_id]
                if update_itad_ids:
                    logger.info(f"Phase 2-1: Fetching ITAD lowest prices for {len(update_itad_ids)} games...")
                    async with aiohttp.ClientSession() as session:
                        itad_price_map = await self.itad_client.get_batch_prices(session, update_itad_ids, region='JP')
                    logger.info(f"ITAD batch fetch completed: {len(itad_price_map)} items")

            # Phase 2-2: Build game data
            logger.info("Phase 2-2: Building game data...")
            failed_games = []

            # Build dict for games with price differences
            updated_games_dict = {}
            if len(games_to_update) > 0:
                async with aiohttp.ClientSession(headers=self.steam_client.headers) as session:
                    tasks = []
                    for app_id, itad_id in games_to_update:
                        steam_basic = steam_data_cache.get(app_id)
                        if not steam_basic:
                            continue
                        itad_price = itad_price_map.get(itad_id) if itad_id else None
                        tasks.append(
                            self._build_game_from_cached_basic(session, app_id, steam_basic, itad_price, itad_id)
                        )

                    results = await asyncio.gather(*tasks, return_exceptions=True)

                    for game_data in results:
                        if game_data is None or isinstance(game_data, Exception):
                            continue
                        elif 'error' in game_data:
                            failed_games.append({'app_id': game_data['app_id'], 'reason': game_data['error']})
                        else:
                            updated_games_dict[game_data['id']] = game_data

            # Rebuild full games-data in original order
            logger.info("Rebuilding full games-data...")
            rebuilt_games = []
            for game in existing_games:
                app_id = game['id']
                if app_id in updated_games_dict:
                    # Use updated data for games with price changes
                    rebuilt_games.append(updated_games_dict[app_id])
                else:
                    # Use existing data for games without changes
                    rebuilt_games.append(game)

            logger.info(f"Rebuilt games-data: {len(rebuilt_games)} items (updated: {len(updated_games_dict)})")
            newly_added_games = []

        # Print rate controller stats
        self.rate_manager.print_all_stats()

        return {
            'rebuilt_games': rebuilt_games,
            'failed_games': failed_games,
            'missing_data': [],
            'mapping_result': mapping_result,
            'id_map': id_map,
            'newly_added_games': newly_added_games
        }
