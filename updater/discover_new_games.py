#!/usr/bin/env python3
"""
Stage 1 of new-game discovery: fully automated, no KV writes.

Discovers new Steam App IDs (via full-catalog snapshot diffing), applies a
cheap suffix-anchored title pre-filter, fetches Steam+ITAD data for
survivors (reusing GameDataBuilder's existing per-app fetch machinery), and
writes a PR-reviewable artifact. Never writes to KV directly -- see
apply_pending_games.py for the human-approved merge step.
"""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from constants import (
    PENDING_REVIEW_CANDIDATES_FILE,
    REJECTED_APPIDS_FILE,
    PENDING_NEW_GAMES_DIR,
)
from steam_catalog import SteamCatalogClient, load_snapshot, save_snapshot, diff_new_appids
from game_data_builder import GameDataBuilder, is_leaked_non_game_title
from kv_helper import KVHelper

logger = logging.getLogger(__name__)


def load_rejected_appids(path=REJECTED_APPIDS_FILE):
    """Load the human-curated permanent blocklist (one App ID per line)"""
    p = Path(path)
    if not p.exists():
        return set()
    with open(p, 'r', encoding='utf-8') as f:
        return {line.strip() for line in f if line.strip()}


def load_pending_review_candidates(path=PENDING_REVIEW_CANDIDATES_FILE):
    """Load candidates previously excluded for insufficient review score

    Returns:
        dict: {appid_str: {'name':, 'reviewScore':, 'game_data':, 'last_checked':}}
    """
    p = Path(path)
    if not p.exists():
        return {}
    with open(p, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_pending_review_candidates(pending, path=PENDING_REVIEW_CANDIDATES_FILE):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, 'w', encoding='utf-8') as f:
        json.dump(pending, f, ensure_ascii=False, indent=2)


def force_include_command(app_id):
    """Add an App ID to the pending-review list so the next discovery run
    fetches it fresh, regardless of the snapshot/pre-filter having missed
    or excluded it. Used to rescue a wrongly-excluded title (pre-filter
    false positive, or one a reviewer wants reconsidered)."""
    pending = load_pending_review_candidates()
    pending[app_id] = {
        'name': '',
        'reviewScore': None,
        'game_data': None,
        'last_checked': None,
    }
    save_pending_review_candidates(pending)
    logger.info(f"Added App ID {app_id} to pending review list; it will be fetched on the next discovery run")


def discover_command(itad_api_key, steam_web_api_key, regions, seed_only=False):
    """Run Stage 1: discover, pre-filter, fetch, and write the PR artifact

    Args:
        itad_api_key: ITAD API key
        steam_web_api_key: Steam Web API key (for IStoreService/GetAppList)
        regions: List of region codes to fetch prices for
        seed_only: If True, only fetch the catalog and save the snapshot,
            then exit. Used once, before the daily schedule is enabled, so
            the very first run doesn't treat the entire ~190k-entry catalog
            as "new".

    Returns:
        dict: summary of the run (counts + output file path), or None if seed_only
    """
    logger.info("=== New Game Discovery (Stage 1) ===")

    catalog_client = SteamCatalogClient(steam_web_api_key)
    logger.info("Fetching full Steam catalog (games + software)...")
    catalog = catalog_client.fetch_full_catalog(include_games=True, include_software=True)
    logger.info(f"Fetched {len(catalog)} apps from Steam catalog")

    previous_snapshot = load_snapshot()
    new_appid_map = diff_new_appids(previous_snapshot, catalog)
    logger.info(f"Diff against previous snapshot ({len(previous_snapshot)} apps): {len(new_appid_map)} new App IDs")

    # Always persist the snapshot, regardless of downstream filtering, so a
    # title excluded today is never re-flagged as "new" tomorrow.
    save_snapshot(catalog)

    if seed_only:
        logger.info("Seed-only mode: snapshot saved, exiting without further processing")
        return None

    rejected_ids = load_rejected_appids()
    if rejected_ids:
        logger.info(f"Loaded {len(rejected_ids)} permanently rejected App IDs")

    pre_filter_excluded = []
    candidates = {}
    for appid, name in new_appid_map.items():
        if appid in rejected_ids:
            continue
        if is_leaked_non_game_title(name):
            pre_filter_excluded.append({'app_id': appid, 'title': name})
            continue
        candidates[appid] = name

    logger.info(f"After suffix-filter and blocklist: {len(candidates)} new candidates ({len(pre_filter_excluded)} excluded pre-fetch)")

    pending = load_pending_review_candidates()
    pending_retry = {aid: entry for aid, entry in pending.items() if aid not in rejected_ids and aid not in candidates}
    if pending_retry:
        logger.info(f"Re-checking {len(pending_retry)} pending review candidates from prior runs")

    target_names = dict(candidates)
    for aid, entry in pending_retry.items():
        target_names[aid] = entry.get('name', '')
    target_ids = list(target_names.keys())

    kv_helper = KVHelper(use_kv=True)
    existing_games = kv_helper.get_games_data()
    existing_ids = {g['id'] for g in existing_games}
    candidate_ids = [aid for aid in target_ids if aid not in existing_ids]
    logger.info(f"After dedup against existing KV data: {len(candidate_ids)} App IDs to fetch")

    # Fixed filenames (not timestamped): each discovery run opens its own PR
    # branch, so there's no collision risk, and it keeps the PR workflow's
    # body-path argument deterministic.
    output_dir = Path(PENDING_NEW_GAMES_DIR)
    candidates_file = output_dir / 'candidates.json'
    summary_file = output_dir / 'pr_summary.md'

    if not candidate_ids:
        logger.info("No candidates to fetch this run")
        _write_pr_summary([], [], pre_filter_excluded, pending, summary_file)
        return {'passed': 0, 'pending': len(pending), 'pre_filter_excluded': len(pre_filter_excluded)}

    builder = GameDataBuilder(itad_api_key=itad_api_key)
    id_map, mapping_result = builder.build_id_map_from_appids(candidate_ids, kv_helper.get_id_map())

    if len(candidate_ids) >= 1000:
        result = builder._process_batch_mode(candidate_ids, regions, kv_helper, id_map, mapping_result, existing_games=[])
    else:
        result = builder._process_normal_mode(candidate_ids, regions, kv_helper, id_map, mapping_result, existing_games=[])

    passed_games = result['rebuilt_games']
    passed_ids = {g['id'] for g in passed_games}
    excluded_games = result.get('excluded_games', [])

    # Rebuild the pending list: drop anything that passed or is now
    # blocklisted, add/refresh anything still short on reviews, carry over
    # anything untouched by this run.
    new_pending = {}
    for item in excluded_games:
        aid = item['app_id']
        if aid in rejected_ids:
            continue
        new_pending[aid] = {
            'name': item.get('title', target_names.get(aid, '')),
            'reviewScore': item.get('reviewScore'),
            'game_data': item.get('game_data'),
            'last_checked': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        }
    for aid, entry in pending.items():
        if aid not in new_pending and aid not in rejected_ids and aid not in passed_ids:
            new_pending[aid] = entry

    save_pending_review_candidates(new_pending)

    output_dir.mkdir(parents=True, exist_ok=True)
    with open(candidates_file, 'w', encoding='utf-8') as f:
        json.dump(passed_games, f, ensure_ascii=False, indent=2)

    _write_pr_summary(passed_games, excluded_games, pre_filter_excluded, new_pending, summary_file)

    logger.info(f"Discovery complete: {len(passed_games)} passed, {len(new_pending)} pending review, {len(pre_filter_excluded)} pre-filter excluded")

    return {
        'passed': len(passed_games),
        'pending': len(new_pending),
        'pre_filter_excluded': len(pre_filter_excluded),
        'candidates_file': str(candidates_file),
    }


def _write_pr_summary(passed_games, excluded_games, pre_filter_excluded, pending, summary_path):
    """Write the human-facing PR summary markdown

    Shows passed, review-score-excluded (pending), and pre-filter-excluded
    candidates so a reviewer can catch both false positives (non-games that
    slipped into 'passed') and false negatives (legitimate games wrongly
    filtered out).
    """
    summary_path = Path(summary_path)
    summary_path.parent.mkdir(parents=True, exist_ok=True)

    lines = []
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    lines.append(f"## New Game Candidates — {today}\n")
    lines.append(
        f"{len(passed_games)} passed all filters and will be added to KV on merge. "
        f"{len(excluded_games)} are pending (review score not yet high enough this run). "
        f"{len(pre_filter_excluded)} were excluded before fetch (demo/soundtrack suffix heuristic).\n"
    )

    lines.append("### Passed (will be added to KV on merge)\n")
    if passed_games:
        lines.append("| AppID | Title | Review Score | Genres | Store |")
        lines.append("|---|---|---|---|---|")
        for g in passed_games:
            genres = ', '.join(g.get('genres', []) or [])
            store_url = g.get('storeUrl', '')
            lines.append(f"| {g.get('id')} | {g.get('title')} | {g.get('reviewScore', '-')} | {genres} | [link]({store_url}) |")
    else:
        lines.append("_None this run._")
    lines.append("")

    lines.append("### Pending — review score not yet high enough (re-checked automatically each run, NOT added)\n")
    if excluded_games:
        lines.append("| AppID | Title | Review Score |")
        lines.append("|---|---|---|")
        for item in excluded_games:
            lines.append(f"| {item.get('app_id')} | {item.get('title')} | {item.get('reviewScore', '-')} |")
    else:
        lines.append("_None this run._")
    lines.append("")

    lines.append("### Excluded by pre-filter — demo/soundtrack suffix heuristic (never fetched)\n")
    if pre_filter_excluded:
        lines.append("| AppID | Title |")
        lines.append("|---|---|")
        for item in pre_filter_excluded:
            lines.append(f"| {item.get('app_id')} | {item.get('title')} |")
    else:
        lines.append("_None this run._")
    lines.append("")

    lines.append(
        "**Reviewer checklist**: scan the \"Passed\" table above for any demo/soundtrack/tool-like "
        "titles that slipped through the suffix filter (known gap: mid-title occurrences like "
        "\"X - Soundtrack and Bonus Content\" won't be caught). To reject an entry, remove it from "
        "the corresponding `candidates_*.json` in this PR before merging. To permanently block an "
        "App ID from ever being suggested again, add it to `updater/data/refs/rejected_appids.txt` "
        "in the same commit. To rescue a wrongly-excluded title from the Pending or pre-filter "
        "tables (e.g. a legitimate game caught by the suffix heuristic), run "
        "`python updater/main.py --discover --force-include <appid>` before the next scheduled "
        "run; it will be fetched fresh and re-evaluated on the next discovery run.\n"
    )

    with open(summary_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
