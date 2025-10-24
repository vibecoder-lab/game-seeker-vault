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

    def get_id_map(self, local_file_path='updater/data/current/id-map.json'):
        """Get id-map

        Args:
            local_file_path: File path for local mode

        Returns:
            list: id-map list [{"id": "xxx", "itadId": "yyy"}, ...]
        """
        if self.is_local_mode():
            # Local file mode: read from file
            file_path = Path(local_file_path)
            if file_path.exists():
                logger.info(f"Local file mode: Reading id-map from {local_file_path}")
                with open(file_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            else:
                logger.warning(f"Local file mode: {local_file_path} not found. Returning empty list")
                return []
        else:
            # KV mode: fetch from KV
            try:
                logger.info(f"KV mode: Fetching id-map from KV...")
                result = subprocess.run(
                    ['wrangler', 'kv', 'key', 'get', 'id-map', f'--namespace-id={self.namespace_id}', '--remote'],
                    capture_output=True,
                    text=True,
                    check=True
                )
                data = json.loads(result.stdout)
                logger.info(f"KV mode: Fetched id-map from KV ({len(data)} items)")
                return data
            except subprocess.CalledProcessError as e:
                logger.error(f"KV fetch error: {e.stderr}")
                return []
            except json.JSONDecodeError as e:
                logger.error(f"JSON parsing error: {e}")
                return []

    def put_id_map(self, id_map_data, local_file_path='updater/data/current/id-map.json'):
        """Save id-map

        Args:
            id_map_data: id-map list to save
            local_file_path: File path for local mode
        """
        # Always save to local file (for backup and verification)
        file_path = Path(local_file_path)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(id_map_data, f, ensure_ascii=False, indent=2)
        logger.info(f"Saved id-map to {local_file_path} ({len(id_map_data)} items)")

        # In KV mode, also save to KV
        if not self.is_local_mode():
            try:
                # Write to temporary file
                temp_file = Path(TEMP_DIR) / TEMP_ID_MAP_FILE
                with open(temp_file, 'w', encoding='utf-8') as f:
                    json.dump(id_map_data, f, ensure_ascii=False, indent=2)

                logger.info(f"KV mode: Saving id-map to KV... ({len(id_map_data)} items)")
                subprocess.run(
                    ['wrangler', 'kv', 'key', 'put', 'id-map', f'--namespace-id={self.namespace_id}', f'--path={temp_file}', '--remote'],
                    check=True,
                    capture_output=True,
                    text=True
                )
                logger.info(f"KV mode: Saved id-map to KV")

                # Delete temporary file
                temp_file.unlink()
            except subprocess.CalledProcessError as e:
                logger.error(f"KV save error: {e.stderr}")
                raise

    def get_games_data(self, local_file_path='updater/data/current/games.json'):
        """Get games-data

        Args:
            local_file_path: File path for local mode

        Returns:
            list: games data list
        """
        if self.is_local_mode():
            # Local file mode: read from file
            file_path = Path(local_file_path)
            if file_path.exists():
                logger.info(f"Local file mode: Reading games-data from {local_file_path}")
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    # Support new structure with meta block
                    if isinstance(data, dict) and 'games' in data:
                        return data['games']
                    # Backward compatibility: return entire data if old structure
                    return data
            else:
                logger.warning(f"Local file mode: {local_file_path} not found. Returning empty list")
                return []
        else:
            # KV mode: fetch from KV
            try:
                logger.info(f"KV mode: Fetching games-data from KV...")
                result = subprocess.run(
                    ['wrangler', 'kv', 'key', 'get', 'games-data', f'--namespace-id={self.namespace_id}', '--remote'],
                    capture_output=True,
                    text=True,
                    check=True
                )
                data = json.loads(result.stdout)
                # Support new structure with meta block
                if isinstance(data, dict) and 'games' in data:
                    logger.info(f"KV mode: Fetched games-data from KV ({len(data['games'])} items)")
                    return data['games']
                # Backward compatibility: return entire data if old structure
                logger.info(f"KV mode: Fetched games-data from KV ({len(data)} items)")
                return data
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
                    # Local mode: read from file
                    if file_path.exists():
                        with open(file_path, 'r', encoding='utf-8') as f:
                            raw_data = json.load(f)
                        if isinstance(raw_data, dict) and 'meta' in raw_data:
                            existing_timestamp = raw_data['meta'].get('last_updated')
                else:
                    # KV mode: fetch from KV
                    result = subprocess.run(
                        ['wrangler', 'kv', 'key', 'get', 'games-data', f'--namespace-id={self.namespace_id}', '--remote'],
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

        # Add meta block
        output_data = {
            "meta": {
                "last_updated": last_updated,
                "data_version": "1.0.0",
                "source": {
                    "steam": True,
                    "itad": True
                },
                "build_id": str(uuid.uuid4()),
                "record_count": len(games_data)
            },
            "games": games_data
        }

        # Always save to local file (for backup and verification)
        file_path = Path(local_file_path)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        logger.info(f"Saved games-data to {local_file_path} ({len(games_data)} items)")

        # In KV mode, also save to KV
        if not self.is_local_mode():
            try:
                # Write to temporary file
                temp_file = Path(TEMP_DIR) / TEMP_GAMES_FILE
                with open(temp_file, 'w', encoding='utf-8') as f:
                    json.dump(output_data, f, ensure_ascii=False, indent=2)

                logger.info(f"KV mode: Saving games-data to KV... ({len(games_data)} items)")
                subprocess.run(
                    ['wrangler', 'kv', 'key', 'put', 'games-data', f'--namespace-id={self.namespace_id}', f'--path={temp_file}', '--remote'],
                    check=True,
                    capture_output=True,
                    text=True
                )
                logger.info(f"KV mode: Saved games-data to KV")

                # Delete temporary file
                temp_file.unlink()
            except subprocess.CalledProcessError as e:
                logger.error(f"KV save error: {e.stderr}")
                raise
