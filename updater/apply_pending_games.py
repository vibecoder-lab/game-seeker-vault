#!/usr/bin/env python3
"""
Stage 2 of new-game discovery: applies a human-approved candidates file to KV.

Invoked only by the PR-merge-triggered workflow (apply-new-games.yml).
Does no fetching -- only a KV read, merge, and write.
"""

import json
import logging
from pathlib import Path

from kv_helper import KVHelper

logger = logging.getLogger(__name__)


def apply_command(pending_file_path, kv_helper=None):
    """Merge an approved candidates file into production KV

    Critically, re-reads existing_games fresh at call time rather than
    reusing anything from Stage 1: the PR may have sat unmerged for days,
    during which the daily differential-update job may have changed prices
    on existing games. Using a stale snapshot here would silently revert
    those changes. candidates_file only ever contains brand-new game
    records (ids that were not in KV as of Stage 1 time), so this never
    overwrites an existing entry -- it only appends genuinely-still-new ones.

    Args:
        pending_file_path: Path to a candidates_*.json file produced by discover_command
        kv_helper: Optional KVHelper instance (mainly for testing); defaults to a
            new KVHelper(use_kv=True)

    Returns:
        dict: {'applied': int, 'skipped_already_existing': list[str]}
    """
    with open(pending_file_path, 'r', encoding='utf-8') as f:
        candidates = json.load(f)

    if kv_helper is None:
        kv_helper = KVHelper(use_kv=True)

    existing_games = kv_helper.get_games_data()
    existing_ids = {g['id'] for g in existing_games}

    new_games = [g for g in candidates if g['id'] not in existing_ids]
    skipped = [g['id'] for g in candidates if g['id'] in existing_ids]

    if skipped:
        logger.info(f"Skipping {len(skipped)} candidates already present in KV: {skipped}")

    if not new_games:
        logger.info("No new games to apply (all candidates already exist in KV)")
        return {'applied': 0, 'skipped_already_existing': skipped}

    merged = existing_games + new_games
    kv_helper.put_games_data(merged, preserve_timestamp=True)

    logger.info(f"Applied {len(new_games)} new games to KV")

    return {'applied': len(new_games), 'skipped_already_existing': skipped}
