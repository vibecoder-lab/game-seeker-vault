#!/usr/bin/env python3
"""
Steam catalog client (IStoreService/GetAppList) for new-game discovery

Distinct from SteamClient (steam_client.py), which handles per-app detail
fetches (appdetails/appreviews). This module handles the catalog-level
concern: paginating the entire Steam app list and diffing it against a
saved snapshot to detect newly-registered App IDs.
"""

import json
import logging
import time
from pathlib import Path

import requests

from constants import STEAM_APPLIST_URL, STEAM_APPLIST_MAX_RESULTS, STEAM_APPLIST_SNAPSHOT_FILE

logger = logging.getLogger(__name__)


class SteamCatalogClient:
    """Client for Steam's IStoreService/GetAppList catalog endpoint"""

    def __init__(self, api_key):
        self.api_key = api_key
        self.session = requests.Session()

    def fetch_full_catalog(self, include_games=True, include_software=True):
        """Fetch the full Steam catalog, paginating to completion

        Args:
            include_games: Include 'game' type apps (default True)
            include_software: Include 'software'/tool type apps (default True)

        Returns:
            dict: {appid_str: name}
        """
        catalog = {}
        last_appid = 0
        page = 0

        while True:
            params = {
                'key': self.api_key,
                'max_results': STEAM_APPLIST_MAX_RESULTS,
                'include_games': str(include_games).lower(),
                'include_software': str(include_software).lower(),
            }
            if last_appid:
                params['last_appid'] = last_appid

            response = self.session.get(STEAM_APPLIST_URL, params=params, timeout=30)
            response.raise_for_status()
            data = response.json().get('response', {})
            apps = data.get('apps', [])

            if not apps:
                break

            for app in apps:
                catalog[str(app['appid'])] = app.get('name', '')

            last_appid = apps[-1]['appid']
            page += 1
            logger.info(f"  → Fetched catalog page {page} ({len(apps)} apps, total: {len(catalog)})")

            if not data.get('have_more_results'):
                break

            time.sleep(1.0)

        return catalog


def load_snapshot(path=STEAM_APPLIST_SNAPSHOT_FILE):
    """Load the previously saved catalog snapshot

    Returns:
        dict: {appid_str: name}, or {} if no snapshot exists yet (first run)
    """
    snapshot_path = Path(path)
    if not snapshot_path.exists():
        logger.info(f"No existing snapshot found at {path} (first run)")
        return {}

    with open(snapshot_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_snapshot(catalog, path=STEAM_APPLIST_SNAPSHOT_FILE):
    """Save the current catalog as the snapshot for the next run

    Writes atomically (temp file + replace) so a crash mid-write never
    corrupts the snapshot the next run's diff depends on.

    One entry per line (indent=1), not a single compact line: since this
    file is git-tracked specifically for audit purposes ("which App IDs
    were newly added on which day"), a one-line dump would make every git
    diff show the entire multi-MB blob as changed, defeating that purpose.
    Entries are naturally in ascending appid order (matching the API's own
    pagination order), so day-to-day diffs stay small and readable.
    """
    snapshot_path = Path(path)
    snapshot_path.parent.mkdir(parents=True, exist_ok=True)

    tmp_path = snapshot_path.with_suffix(snapshot_path.suffix + '.tmp')
    with open(tmp_path, 'w', encoding='utf-8') as f:
        json.dump(catalog, f, ensure_ascii=False, indent=1)
    tmp_path.replace(snapshot_path)


def diff_new_appids(previous, current):
    """Return entries present in current but not in previous

    This is the entire "new vs changed" distinction: an App ID whose
    metadata merely changed is already present in `previous` and is
    therefore excluded here, deliberately, without consulting Steam's
    if_modified_since semantics.

    Args:
        previous: {appid_str: name} from the last saved snapshot
        current: {appid_str: name} from the current fetch

    Returns:
        dict: {appid_str: name} for newly-appeared App IDs only
    """
    return {aid: name for aid, name in current.items() if aid not in previous}
