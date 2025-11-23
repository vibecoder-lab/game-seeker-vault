#!/usr/bin/env python3
"""
Helper for Cloudflare Workers KV operations
Performs KV read/write using wrangler CLI
"""

import json
import subprocess
import logging
import os
from pathlib import Path
from constants import KV_BINDING_NAME, TEMP_DIR, TEMP_ID_MAP_FILE, TEMP_GAMES_FILE

logger = logging.getLogger(__name__)


class KVHelper:
    """Cloudflare Workers KV operation class"""

    def __init__(self, binding=KV_BINDING_NAME, use_kv=False):
        """
        Args:
            binding: KV binding name
            use_kv: If True use KV, if False use local files
        """
        self.binding = binding
        self.use_kv = use_kv

        # Get Namespace ID only when using KV
        if use_kv:
            # Get from environment variable, or auto-fetch using wrangler command
            self.namespace_id = os.environ.get('KV_NAMESPACE_ID')
            if not self.namespace_id:
                self.namespace_id = self._get_namespace_id_from_wrangler(binding)
                if not self.namespace_id:
                    raise ValueError(f"Namespace ID not found for binding: {binding}")
        else:
            self.namespace_id = None

    def _get_namespace_id_from_wrangler(self, binding):
        """Get Namespace ID from wrangler CLI"""
        try:
            logger.info(f"Fetching Namespace ID from wrangler (binding: {binding})...")
            result = subprocess.run(
                ['wrangler', 'kv', 'namespace', 'list'],
                capture_output=True,
                text=True,
                check=True
            )
            namespaces = json.loads(result.stdout)
            for ns in namespaces:
                if ns.get('title') == binding:
                    namespace_id = ns.get('id')
                    logger.info("Namespace ID fetch success")
                    return namespace_id
            logger.error(f"Namespace for binding '{binding}' not found")
            return None
        except subprocess.CalledProcessError as e:
            logger.error(f"wrangler execution error: {e.stderr}")
            return None
        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing error: {e}")
            return None

    def is_local_mode(self):
        """Check if in local file mode"""
        return not self.use_kv

    def get_id_map(self):
        """Get id-map extracted from games-data

        Returns:
            list: id-map list [{"id": "xxx", "itadId": "yyy"}, ...]
        """
        logger.info("Extracting id-map from games-data...")
        games = self.get_games_data()
        id_map = [{"id": game["id"], "itadId": game.get("itadId")} for game in games]
        logger.info(f"Extracted id-map: {len(id_map)} items")
        return id_map


    def get_games_data(self, local_file_path='updater/data/current/games.json'):
        """Get games-data

        Args:
            local_file_path: File path for local mode

        Returns:
            list: games data list
        """
        if self.is_local_mode():
            # Local file mode: read from basic and details files
            file_path = Path(local_file_path)
            basic_file_path = file_path.parent / f"{file_path.stem}-basic{file_path.suffix}"
            details_file_path = file_path.parent / f"{file_path.stem}-details{file_path.suffix}"

            # Try to read from basic and details files first
            if basic_file_path.exists() and details_file_path.exists():
                logger.info(f"Local file mode: Reading games-data from {basic_file_path} and {details_file_path}")
                with open(basic_file_path, 'r', encoding='utf-8') as f:
                    basic_data = json.load(f)
                with open(details_file_path, 'r', encoding='utf-8') as f:
                    details_data = json.load(f)

                # Extract games from basic data
                basic_games = basic_data.get('games', []) if isinstance(basic_data, dict) else basic_data

                # Merge basic and details
                merged_games = []
                for game in basic_games:
                    game_id = game.get('id')
                    details = details_data.get(game_id, {}) if isinstance(details_data, dict) else {}
                    merged_game = {**game, **details}
                    merged_games.append(merged_game)

                logger.info(f"Local file mode: Merged {len(merged_games)} games from basic and details files")
                return merged_games
            # Fallback to old games.json for backward compatibility
            elif file_path.exists():
                logger.info(f"Local file mode: Reading games-data from {local_file_path} (fallback)")
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    # Support new structure with meta block
                    if isinstance(data, dict) and 'games' in data:
                        return data['games']
                    # Backward compatibility: return entire data if old structure
                    return data
            else:
                logger.warning(f"Local file mode: No games data files found. Returning empty list")
                return []
        else:
            # KV mode: fetch from games-basic and games-details
            try:
                logger.info(f"KV mode: Fetching games-basic from KV...")
                basic_result = subprocess.run(
                    ['wrangler', 'kv', 'key', 'get', 'games-basic', f'--namespace-id={self.namespace_id}', '--remote'],
                    capture_output=True,
                    text=True,
                    check=True
                )
                basic_data = json.loads(basic_result.stdout)
                basic_games = basic_data.get('games', []) if isinstance(basic_data, dict) else basic_data
                logger.info(f"KV mode: Fetched {len(basic_games)} games from games-basic")

                logger.info(f"KV mode: Fetching games-details from KV...")
                details_result = subprocess.run(
                    ['wrangler', 'kv', 'key', 'get', 'games-details', f'--namespace-id={self.namespace_id}', '--remote'],
                    capture_output=True,
                    text=True,
                    check=True
                )
                details_data = json.loads(details_result.stdout)
                logger.info(f"KV mode: Fetched {len(details_data)} game details from games-details")

                # Merge basic and details
                merged_games = []
                for game in basic_games:
                    game_id = game.get('id')
                    details = details_data.get(game_id, {}) if isinstance(details_data, dict) else {}
                    merged_game = {**game, **details}
                    merged_games.append(merged_game)

                logger.info(f"KV mode: Merged {len(merged_games)} games from basic and details")
                return merged_games
            except subprocess.CalledProcessError as e:
                logger.error(f"KV fetch error: {e.stderr}")
                return []
            except json.JSONDecodeError as e:
                logger.error(f"JSON parsing error: {e}")
                return []

    def put_games_data(self, games_data, local_file_path='updater/data/current/games.json', preserve_timestamp=False):
        """Save games-data

        Args:
            games_data: games data list to save
            local_file_path: File path for local mode
            preserve_timestamp: If True, preserve existing last_updated timestamp (for append mode)
        """
        import datetime
        import uuid

        # Determine last_updated timestamp
        if preserve_timestamp:
            # Preserve existing timestamp from current data
            file_path = Path(local_file_path)
            existing_timestamp = None
            try:
                if self.is_local_mode():
                    # Local mode: read from basic file
                    basic_file_path = file_path.parent / f"{file_path.stem}-basic{file_path.suffix}"
                    if basic_file_path.exists():
                        with open(basic_file_path, 'r', encoding='utf-8') as f:
                            raw_data = json.load(f)
                        if isinstance(raw_data, dict) and 'meta' in raw_data:
                            existing_timestamp = raw_data['meta'].get('last_updated')
                else:
                    # KV mode: fetch from games-basic
                    result = subprocess.run(
                        ['wrangler', 'kv', 'key', 'get', 'games-basic', f'--namespace-id={self.namespace_id}', '--remote'],
                        capture_output=True,
                        text=True,
                        check=True
                    )
                    raw_data = json.loads(result.stdout)
                    if isinstance(raw_data, dict) and 'meta' in raw_data:
                        existing_timestamp = raw_data['meta'].get('last_updated')
            except Exception as e:
                logger.warning(f"Failed to get existing timestamp: {e}")

            last_updated = existing_timestamp if existing_timestamp else datetime.datetime.now(datetime.UTC).replace(tzinfo=None).isoformat(timespec="seconds") + "Z"
            logger.info(f"Preserving existing timestamp: {last_updated}")
        else:
            # Create new timestamp
            last_updated = datetime.datetime.now(datetime.UTC).replace(tzinfo=None).isoformat(timespec="seconds") + "Z"
            logger.info(f"Creating new timestamp: {last_updated}")

        # Create meta block
        meta = {
            "last_updated": last_updated,
            "data_version": "2.0.0",
            "source": {
                "steam": True,
                "itad": True
            },
            "build_id": str(uuid.uuid4()),
            "record_count": len(games_data)
        }

        # Split data into basic and details
        basic_games = []
        details_games = {}

        for game in games_data:
            # Basic info (for filtering and list display)
            basic_info = {
                "id": game.get("id"),
                "title": game.get("title"),
                "storeUrl": game.get("storeUrl"),
                "imageUrl": game.get("imageUrl"),
                "deal": game.get("deal"),
                "genres": game.get("genres"),
                "tags": game.get("tags"),
                "reviewScore": game.get("reviewScore"),
                "releaseDate": game.get("releaseDate"),
                "platforms": game.get("platforms")
            }
            basic_games.append(basic_info)

            # Detail info (for modal display)
            detail_info = {
                "movies": game.get("movies"),
                "developers": game.get("developers"),
                "publishers": game.get("publishers"),
                "supportedLanguages": game.get("supportedLanguages"),
                "itadId": game.get("itadId")
            }
            details_games[game.get("id")] = detail_info

        # Create output data structures
        basic_output = {
            "meta": meta,
            "games": basic_games
        }

        details_output = details_games

        # Save basic data to local file
        file_path = Path(local_file_path)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        basic_file_path = file_path.parent / f"{file_path.stem}-basic{file_path.suffix}"
        with open(basic_file_path, 'w', encoding='utf-8') as f:
            json.dump(basic_output, f, ensure_ascii=False, indent=2)
        logger.info(f"Saved basic games-data to {basic_file_path} ({len(basic_games)} items)")

        # Save details data to local file
        details_file_path = file_path.parent / f"{file_path.stem}-details{file_path.suffix}"
        with open(details_file_path, 'w', encoding='utf-8') as f:
            json.dump(details_output, f, ensure_ascii=False, indent=2)
        logger.info(f"Saved details games-data to {details_file_path} ({len(details_games)} items)")

        # Also save combined data for backward compatibility
        combined_output = {
            "meta": meta,
            "games": games_data
        }
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(combined_output, f, ensure_ascii=False, indent=2)
        logger.info(f"Saved combined games-data to {local_file_path} ({len(games_data)} items)")

        # In KV mode, save both basic and details to KV
        if not self.is_local_mode():
            try:
                # Save basic data to KV
                temp_basic_file = Path(TEMP_DIR) / 'temp_games_basic.json'
                with open(temp_basic_file, 'w', encoding='utf-8') as f:
                    json.dump(basic_output, f, ensure_ascii=False, indent=2)

                logger.info(f"KV mode: Saving basic games to KV... ({len(basic_games)} items)")
                subprocess.run(
                    ['wrangler', 'kv', 'key', 'put', 'games-basic', f'--namespace-id={self.namespace_id}', f'--path={temp_basic_file}', '--remote'],
                    check=True,
                    capture_output=True,
                    text=True
                )
                logger.info(f"KV mode: Saved basic games to KV")
                temp_basic_file.unlink()

                # Save details data to KV
                temp_details_file = Path(TEMP_DIR) / 'temp_games_details.json'
                with open(temp_details_file, 'w', encoding='utf-8') as f:
                    json.dump(details_output, f, ensure_ascii=False, indent=2)

                logger.info(f"KV mode: Saving details games to KV... ({len(details_games)} items)")
                subprocess.run(
                    ['wrangler', 'kv', 'key', 'put', 'games-details', f'--namespace-id={self.namespace_id}', f'--path={temp_details_file}', '--remote'],
                    check=True,
                    capture_output=True,
                    text=True
                )
                logger.info(f"KV mode: Saved details games to KV")
                temp_details_file.unlink()

            except subprocess.CalledProcessError as e:
                logger.error(f"KV save error: {e.stderr}")
                raise
