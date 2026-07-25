#!/usr/bin/env python3
"""
Stage 1 of new-game discovery: fully automated, no KV writes.

Discovers new Steam App IDs (via full-catalog snapshot diffing), applies a
cheap suffix-anchored title pre-filter, then a cheap review-score + minimum
review-count pre-check (mirroring what the manual process's extract_games.py
used to enforce) on a milestone schedule (not every single day -- see
DISCOVERY_REVIEW_CHECK_MILESTONES_DAYS), fetches Steam+ITAD data only for
survivors (reusing GameDataBuilder's existing per-app fetch machinery), and
writes a PR-reviewable artifact. Never writes to KV directly -- see
apply_pending_games.py for the human-approved merge step.
"""

import json
import logging
import random
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import requests

from constants import (
    PENDING_REVIEW_CANDIDATES_FILE,
    EXHAUSTED_REVIEW_CANDIDATES_FILE,
    REJECTED_APPIDS_FILE,
    PENDING_NEW_GAMES_DIR,
    DISCOVERY_MIN_REVIEWS,
    DISCOVERY_REVIEW_CHECK_MILESTONES_DAYS,
    ALLOWED_REVIEW_SCORES,
    USER_AGENT_STEAM,
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
    """Load candidates previously excluded for insufficient review score/count

    Returns:
        dict: {appid_str: {'name', 'reviewScore', 'totalReviews', 'game_data',
            'first_seen' (date str), 'last_checked' (datetime str),
            'next_check_due' (date str, or 'exhausted', or absent/None)}}
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


def load_exhausted_review_candidates(path=EXHAUSTED_REVIEW_CANDIDATES_FILE):
    """Load candidates that passed their final (180-day) milestone check and
    still didn't qualify. Purely an archive -- never automatically
    re-checked; kept separate from the pending list so that list only ever
    contains candidates still being actively monitored."""
    p = Path(path)
    if not p.exists():
        return {}
    with open(p, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_exhausted_review_candidates(exhausted, path=EXHAUSTED_REVIEW_CANDIDATES_FILE):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, 'w', encoding='utf-8') as f:
        json.dump(exhausted, f, ensure_ascii=False, indent=2)


def force_include_command(app_id):
    """Add an App ID to the pending-review list so the next discovery run
    fetches it fresh, regardless of the snapshot/pre-filter having missed
    or excluded it, and regardless of any milestone schedule. Used to rescue
    a wrongly-excluded title (pre-filter false positive, one a reviewer
    wants reconsidered, or one that has since exhausted its milestone
    schedule without qualifying). Also removes it from the exhausted archive
    if present, so it isn't tracked in both places at once."""
    pending = load_pending_review_candidates()
    pending[app_id] = {
        'name': '',
        'reviewScore': None,
        'totalReviews': None,
        'game_data': None,
        'first_seen': None,
        'last_checked': None,
        'next_check_due': None,  # absent/None = due immediately on next run
    }
    save_pending_review_candidates(pending)

    exhausted = load_exhausted_review_candidates()
    if app_id in exhausted:
        del exhausted[app_id]
        save_exhausted_review_candidates(exhausted)

    logger.info(f"Added App ID {app_id} to pending review list; it will be fetched on the next discovery run")


def _is_due(entry, today):
    """Is this pending entry due for a milestone re-check today?

    Absent/None next_check_due means "never scheduled yet" (e.g. freshly
    force-included, or a legacy entry) -> due now. The literal string
    'exhausted' means it's past the final milestone -> no longer
    auto-checked. Otherwise, due once today reaches the stored date.
    """
    next_check_due = entry.get('next_check_due')
    if next_check_due is None:
        return True
    if next_check_due == 'exhausted':
        return False
    return today >= date.fromisoformat(next_check_due)


def _compute_next_check_due(first_seen_date, today, milestones=DISCOVERY_REVIEW_CHECK_MILESTONES_DAYS):
    """Next milestone date (as an ISO string) after `today`, relative to
    first_seen_date, or 'exhausted' if today is already past the last
    milestone."""
    days_elapsed = (today - first_seen_date).days
    for m in milestones:
        if days_elapsed < m:
            return (first_seen_date + timedelta(days=m)).isoformat()
    return 'exhausted'


def check_review_gate(app_id, session, min_reviews=DISCOVERY_MIN_REVIEWS, max_retries=3):
    """Cheap pre-fetch check: does this App ID meet both the review-score
    bucket AND the minimum review count bar?

    Uses the free appreviews summary endpoint (much cheaper than a full
    Steam+ITAD detail fetch), mirroring the same check the manual process
    used to perform via extract_games.py's filter_by_review_score().

    Returns:
        tuple: (passes: bool, review_score: str | None, total_reviews: int)
    """
    url = f"https://store.steampowered.com/appreviews/{app_id}?json=1&purchase_type=all&language=all"

    for attempt in range(max_retries):
        try:
            response = session.get(url, timeout=10)

            if response.status_code == 429:
                if attempt < max_retries - 1:
                    wait_time = 2 ** (attempt + 1)
                    logger.warning(f"Rate limited (429) for App ID {app_id}, retrying after {wait_time}s")
                    time.sleep(wait_time)
                    continue
                logger.error(f"Rate limited (429) for App ID {app_id}, max retries exceeded")
                return False, None, 0

            if response.status_code != 200:
                logger.warning(f"HTTP {response.status_code} for App ID {app_id}")
                return False, None, 0

            data = response.json()
            if data.get('success') != 1:
                return False, None, 0

            query_summary = data.get('query_summary', {})
            review_score = query_summary.get('review_score_desc')
            total_reviews = query_summary.get('total_reviews', 0)

            passes = review_score in ALLOWED_REVIEW_SCORES and total_reviews >= min_reviews
            return passes, review_score, total_reviews

        except requests.exceptions.Timeout:
            if attempt < max_retries - 1:
                time.sleep(1)
                continue
            logger.error(f"Timeout for App ID {app_id}, max retries exceeded")
            return False, None, 0
        except Exception as e:
            logger.error(f"Error checking review gate for App ID {app_id}: {e}")
            return False, None, 0

    return False, None, 0


def _now_iso():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


def discover_command(itad_api_key, steam_web_api_key, regions, seed_only=False):
    """Run Stage 1: discover, pre-filter, review-gate, fetch, and write the PR artifact

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
    today = datetime.now(timezone.utc).date()

    # Split existing pending entries: only ones due for a milestone re-check
    # today get an API call; the rest are carried over untouched. This is
    # what bounds the total cost -- a pending candidate is checked at most a
    # handful of times (DISCOVERY_REVIEW_CHECK_MILESTONES_DAYS), not once
    # per day forever.
    pending_due = {}
    pending_not_due = {}
    for aid, entry in pending.items():
        if aid in rejected_ids or aid in candidates:
            continue  # blocklisted, or superseded by a fresh discovery this run
        if _is_due(entry, today):
            pending_due[aid] = entry
        else:
            pending_not_due[aid] = entry

    if pending_due:
        logger.info(f"{len(pending_due)} pending candidates are due for a milestone re-check today")
    if pending_not_due:
        logger.info(f"{len(pending_not_due)} pending candidates not yet due for re-check, carried over untouched (no API call)")

    target_names = dict(candidates)
    for aid, entry in pending_due.items():
        target_names[aid] = entry.get('name', '')
    target_ids = list(target_names.keys())

    kv_helper = KVHelper(use_kv=True)
    existing_games = kv_helper.get_games_data()
    existing_ids = {g['id'] for g in existing_games}
    dedup_ids = [aid for aid in target_ids if aid not in existing_ids]
    logger.info(f"After dedup against existing KV data: {len(dedup_ids)} App IDs to review-gate check")

    # Fixed filenames (not timestamped): each discovery run opens its own PR
    # branch, so there's no collision risk, and it keeps the PR workflow's
    # body-path argument deterministic.
    output_dir = Path(PENDING_NEW_GAMES_DIR)
    candidates_file = output_dir / 'candidates.json'
    summary_file = output_dir / 'pr_summary.md'

    if not dedup_ids:
        # Nothing due for a check this run. Persist pending_not_due as-is
        # (drops anything that got rejected or was superseded) and leave the
        # PR artifact untouched -- see the no-PR-noise reasoning below.
        new_pending = dict(pending_not_due)
        save_pending_review_candidates(new_pending)
        logger.info(f"No candidates due for review-gate check this run; {len(new_pending)} still pending, PR artifact left untouched")
        return {'passed': 0, 'pending': len(new_pending), 'pre_filter_excluded': len(pre_filter_excluded)}

    # Cheap review-score + minimum-review-count pre-check, BEFORE the
    # expensive Steam+ITAD full fetch. A game only proceeds to the full
    # fetch once it has both an allowed score bucket and enough reviews;
    # otherwise it goes (or stays) in the pending-review list, scheduled for
    # its next milestone re-check.
    session = requests.Session()
    session.headers.update({'User-Agent': USER_AGENT_STEAM})

    review_ready_ids = []
    review_gate_pending = {}
    for idx, aid in enumerate(dedup_ids, 1):
        passes, score, total_reviews = check_review_gate(aid, session)
        logger.info(f"[{idx}/{len(dedup_ids)}] Review gate for App ID {aid}: score={score}, reviews={total_reviews}, passes={passes}")
        if passes:
            review_ready_ids.append(aid)
        else:
            existing_entry = pending.get(aid, {})
            first_seen_str = existing_entry.get('first_seen')
            first_seen_date = date.fromisoformat(first_seen_str) if first_seen_str else today
            review_gate_pending[aid] = {
                'name': target_names.get(aid, ''),
                'reviewScore': score,
                'totalReviews': total_reviews,
                'game_data': existing_entry.get('game_data'),
                'first_seen': first_seen_date.isoformat(),
                'last_checked': _now_iso(),
                'next_check_due': _compute_next_check_due(first_seen_date, today),
            }
        if idx < len(dedup_ids):
            time.sleep(random.uniform(1.0, 1.5))

    logger.info(f"Review gate: {len(review_ready_ids)} ready for full fetch, {len(review_gate_pending)} still short on score/reviews")

    passed_games = []
    post_fetch_excluded = []

    if review_ready_ids:
        builder = GameDataBuilder(itad_api_key=itad_api_key)
        id_map, mapping_result = builder.build_id_map_from_appids(review_ready_ids, kv_helper.get_id_map())

        if len(review_ready_ids) >= 1000:
            result = builder._process_batch_mode(review_ready_ids, regions, kv_helper, id_map, mapping_result, existing_games=[])
        else:
            result = builder._process_normal_mode(review_ready_ids, regions, kv_helper, id_map, mapping_result, existing_games=[])

        passed_games = result['rebuilt_games']
        post_fetch_excluded = result.get('excluded_games', [])

    passed_ids = {g['id'] for g in passed_games}

    # Rebuild the pending list: start from the untouched carryovers, add
    # today's review-gate failures (with their updated milestone schedule),
    # add the rare post-fetch safety-net exclusions, and finally carry over
    # anything else from the old list that isn't now blocklisted or passed
    # (shouldn't normally happen, but keeps state consistent).
    new_pending = dict(pending_not_due)
    for aid, entry in review_gate_pending.items():
        if aid in rejected_ids:
            continue
        new_pending[aid] = entry
    for item in post_fetch_excluded:
        aid = item['app_id']
        if aid in rejected_ids:
            continue
        existing_entry = pending.get(aid, {})
        first_seen_str = existing_entry.get('first_seen')
        first_seen_date = date.fromisoformat(first_seen_str) if first_seen_str else today
        new_pending[aid] = {
            'name': item.get('title', target_names.get(aid, '')),
            'reviewScore': item.get('reviewScore'),
            'totalReviews': None,
            'game_data': item.get('game_data'),
            'first_seen': first_seen_date.isoformat(),
            'last_checked': _now_iso(),
            'next_check_due': _compute_next_check_due(first_seen_date, today),
        }
    for aid, entry in pending.items():
        if aid not in new_pending and aid not in rejected_ids and aid not in passed_ids:
            new_pending[aid] = entry

    # Move anything that just hit 'exhausted' (failed its final, 180-day
    # milestone check) out of the pending list and into the separate
    # exhausted archive -- the pending list should only ever contain
    # candidates still being actively monitored.
    newly_exhausted = {aid: entry for aid, entry in new_pending.items() if entry.get('next_check_due') == 'exhausted'}
    if newly_exhausted:
        new_pending = {aid: entry for aid, entry in new_pending.items() if aid not in newly_exhausted}
        exhausted = load_exhausted_review_candidates()
        exhausted.update(newly_exhausted)
        save_exhausted_review_candidates(exhausted)
        logger.info(f"{len(newly_exhausted)} candidates exhausted their milestone schedule and moved to the exhausted archive")

    # pending_review_candidates.json is committed directly to main every run
    # regardless (see discover-new-games.yml) -- this is deliberate bookkeeping
    # the human never needs to look at day-to-day.
    save_pending_review_candidates(new_pending)

    logger.info(f"Discovery complete: {len(passed_games)} passed, {len(new_pending)} pending review, {len(pre_filter_excluded)} pre-filter excluded")

    if not passed_games:
        # Same reasoning as the early-return above: nothing actionable, so
        # don't touch the PR artifact files and let create-pull-request no-op.
        logger.info("Nothing passed this run; leaving PR artifact untouched")
        return {'passed': 0, 'pending': len(new_pending), 'pre_filter_excluded': len(pre_filter_excluded)}

    output_dir.mkdir(parents=True, exist_ok=True)
    with open(candidates_file, 'w', encoding='utf-8') as f:
        json.dump(passed_games, f, ensure_ascii=False, indent=2)

    _write_pr_summary(passed_games, list(new_pending.values()), pre_filter_excluded, summary_file)

    return {
        'passed': len(passed_games),
        'pending': len(new_pending),
        'pre_filter_excluded': len(pre_filter_excluded),
        'candidates_file': str(candidates_file),
    }


def _write_pr_summary(passed_games, pending_entries, pre_filter_excluded, summary_path):
    """Write the human-facing PR summary markdown

    Shows passed, pending (insufficient review score and/or count, with
    their next scheduled milestone check), and pre-filter-excluded
    candidates, so a reviewer can catch both false positives (non-games that
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
        f"{len(pending_entries)} are pending (review score and/or review count not yet sufficient; "
        f"re-checked automatically on a milestone schedule). "
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

    lines.append("### Pending — review score/count not yet sufficient (re-checked on a milestone schedule, NOT added)\n")
    if pending_entries:
        lines.append("| Title | Review Score | Total Reviews | Next Check |")
        lines.append("|---|---|---|---|")
        for item in pending_entries:
            reviews = item.get('totalReviews')
            next_check = item.get('next_check_due', '-')
            lines.append(f"| {item.get('name', '-')} | {item.get('reviewScore', '-')} | {reviews if reviews is not None else '-'} | {next_check or '-'} |")
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
        "`candidates.json` in this PR before merging. To permanently block an App ID from ever being "
        "suggested again, add it to `updater/data/refs/rejected_appids.txt` in the same commit. To "
        "rescue a wrongly-excluded title from the Pending or pre-filter tables (e.g. a legitimate "
        "game caught by the suffix heuristic), run `python updater/main.py --force-include <appid>` "
        "before the next scheduled run; it will be fetched fresh and re-evaluated on the next "
        "discovery run.\n"
    )

    with open(summary_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
