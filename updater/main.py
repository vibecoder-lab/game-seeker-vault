#!/usr/bin/env python3
"""
Script to rebuild games.json from scratch
Fetches all data from Steam API and IsThereAnyDeal API

Usage:
  python3 updater/main.py [ITAD_API_KEY] [--append] [--regions JP,US,UK,EU] [--limit N] [--kv] [--reset-prices] [--delete] [--extract] [--refetch SCORES] [--dedupe]

Options:
  --append: Add new titles + fetch data only for new additions
  --regions: Regions to fetch prices for (default: JP)
    Example: --regions JP,US,UK,EU
  --limit: Differential update mode only. Limit the number of games processed for
    ITAD comparison/Steam refetch to the first N games (for testing). Other games
    are kept unchanged. Example: --limit 10
  --kv: Use KV in local environment (for testing)
  --reset-prices: Reset all prices to 1 in games.json (for testing differential updates)
  --delete: Delete games specified in updater/data/refs/delete_appid_list.txt
    - Deletes from local files (games.json, id-map.json)
    - With --kv option: Also deletes from Cloudflare KV (games-data, id-map)
  --extract: Extract games from HTML calendar and filter by review scores
    - Reads HTML from updater/data/refs/*.html (must be only one file)
    - Extracts App IDs and titles
    - Filters by Steam review scores (Very Positive or better)
    - Outputs: raw_game_title_list.txt and pre_game_title_list.txt
  --refetch: Re-fetch review scores for specified score types
    - SCORES: Comma-separated list of review score numbers (0-9) and/or 'others'
    - Score mapping: 9=Overwhelmingly Positive, 8=Very Positive, 7=Positive, 6=Mostly Positive,
                     5=Mixed, 4=Mostly Negative, 3=Negative, 2=Very Negative, 1=Overwhelmingly Negative,
                     0=No user reviews
    - 'others': Invalid review scores not in REVIEW_SCORE_MAPPING
    - Examples:
      --refetch 0,1,2,3,4,5,others  (Re-fetch Mixed or worse + No reviews + invalid data)
      --refetch 6,7,8,9             (Re-fetch Mostly Positive or better)
      --refetch others              (Re-fetch only invalid review scores)
      --refetch 0                   (Re-fetch only No user reviews)
  --dedupe: Remove duplicate games from games-basic.json and games-details.json (local files only)
    - Deduplicates by game id (keeps first occurrence)
    - Updates meta.record_count and trims details to match
    - Creates timestamped backup before overwriting
  --discover: Automated new-game discovery (Stage 1). Diffs the full Steam
    catalog against the last saved snapshot, pre-filters obvious demo/
    soundtrack titles, fetches Steam+ITAD data for survivors, and writes a
    PR-reviewable candidates file. Never writes to KV.
    Usage: python3 updater/main.py <ITAD_API_KEY> --discover <STEAM_WEB_API_KEY> [--regions JP,US,EU]
    --seed-only: Only fetch the catalog and save the snapshot, then exit.
      Run this once before enabling the daily discovery schedule.
    --force-include <appid>: Add an App ID to the pending-review list so the
      next --discover run fetches it fresh (used to rescue a wrongly-excluded
      title). Does not require an ITAD key.
  --backfill-awaiting-release: One-time, manually-run catch-up for App IDs
    that were already present in the catalog snapshot before --discover
    started tracking them (diff_new_appids never flags these as "new",
    regardless of release status). Cheaply review-gate-checks every
    App ID not yet tracked anywhere (games data/pending/exhausted/rejected)
    and classifies it into the pending-review list, same as a normal
    discovery would. Does NOT do the full Steam+ITAD fetch or write to
    KV -- that's left to the next regular --discover run. Deliberately not
    part of the daily schedule (at snapshot scale this can take on the
    order of days); safe to interrupt and re-run to resume. Does not
    require an ITAD key. Local-file mode by default like every other
    command (checks against the local games-basic.json etc.); add --kv to
    check against live KV instead.
  --apply-pending <path>: Apply an approved candidates_*.json file (Stage 2)
    to KV. Invoked by the PR-merge-triggered workflow. Does not require ITAD/
    Steam Web API keys.

Environment detection:
  - Github Actions environment: Automatically uses KV
  - Local environment: Uses local files
  - With --kv option: Uses KV even in local environment
"""

import json
import sys
import logging
import os
import time
import random
import uuid
from pathlib import Path
from datetime import datetime
from game_data_builder import GameDataBuilder
from kv_helper import KVHelper
from constants import DEFAULT_REGIONS, BATCH_LOCK_FILE
from extract_games import extract_command, GameExtractor
from discover_new_games import discover_command, force_include_command, backfill_awaiting_release_command
from apply_pending_games import apply_command

# Log configuration (overwrite mode to rebuild.log)
script_dir = Path(__file__).parent
parent_dir = script_dir.parent

# Directory paths
data_dir = script_dir / 'data'
current_dir = data_dir / 'current'
tmp_dir = data_dir / 'tmp'
backups_dir = data_dir / 'backups'
refs_dir = data_dir / 'refs'
log_dir = script_dir / 'log'

# Create log directory
log_dir.mkdir(parents=True, exist_ok=True)

# Determine log file based on batch processing status
lock_file_path = Path(BATCH_LOCK_FILE)

if lock_file_path.exists():
    # Batch processing resume - append to existing log file
    with open(lock_file_path, 'r', encoding='utf-8') as f:
        session = json.load(f)
    log_file = log_dir / session['log_file']
    log_mode = 'a'
    logger_info = f"Resuming batch processing, logging to: {log_file}"
else:
    # New processing - create timestamped log file
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    log_file = log_dir / f'rebuild_{timestamp}.log'
    log_mode = 'w'
    logger_info = None

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file, mode=log_mode, encoding='utf-8'),
        logging.StreamHandler()  # Also output to console
    ]
)
logger = logging.getLogger(__name__)

# Log resume info if applicable
if logger_info:
    logger.info(logger_info)


def print_mapping_report(mapping_result):
    """Display mapping result report"""
    if not mapping_result:
        return

    mapped = mapping_result.get('mapped', [])
    failed = mapping_result.get('failed', [])
    skipped_existing = mapping_result.get('skipped_existing', [])
    skipped_multiple = mapping_result.get('skipped_multiple', [])

    logger.info(f"{'='*60}")
    logger.info("Auto-mapping Results")
    logger.info(f"{'='*60}\n")
    logger.info(f"Success: {len(mapped)} items")
    logger.info(f"Skipped (Already exists): {len(skipped_existing)} items")
    logger.info(f"Skipped (Multiple matches): {len(skipped_multiple)} items")
    logger.info(f"Failed: {len(failed)} items")

    if mapped:
        logger.info(f"\n--- Successfully Mapped ({len(mapped)}) ---")
        for item in mapped:
            itad_info = f", ITAD ID: {item['itadId']}" if item.get('itadId') else ", ITAD ID: None"
            score_info = f", Score: {item['score']}" if 'score' in item else ""
            logger.info(f"  • {item['name']} (App ID: {item['appid']}{score_info}){itad_info}")

    if skipped_existing:
        logger.info(f"\n--- Skipped - Already Exists ({len(skipped_existing)}) ---")
        for item in skipped_existing:
            logger.info(f"  • {item['title']} → {item['name']} (App ID: {item['appid']})")

    if skipped_multiple:
        logger.info(f"\n--- Skipped - Multiple Matches ({len(skipped_multiple)}) ---")
        for item in skipped_multiple:
            logger.info(f"  • {item['title']}")
            for match in item['matches']:
                logger.info(f"    - {match['name']} (App ID: {match['appid']})")

    if failed:
        logger.info(f"\n--- Mapping Failed ({len(failed)}) ---")
        for title in failed:
            logger.info(f"  • {title}")
        logger.info(f"\nNote: Mapping failures won't block KV updates")

    logger.info(f"\n{'='*60}\n")


def print_rebuild_report(result):
    """Display rebuild result report"""
    rebuilt_games = result['rebuilt_games']
    failed_games = result['failed_games']
    missing_data = result['missing_data']
    mapping_result = result.get('mapping_result')
    games_without_itad = result.get('games_without_itad', [])
    games_with_image_fallback = result.get('games_with_image_fallback', [])

    logger.info(f"\n{'='*60}")
    logger.info(f"Data Fetch Results")
    logger.info(f"{'='*60}")
    success_with_itad = len(rebuilt_games) - len(games_without_itad)
    logger.info(f"Success with ITAD data: {success_with_itad} items")
    if games_without_itad:
        logger.info(f"Success without ITAD data (Steam API only): {len(games_without_itad)} items")
        logger.info(f"  App IDs: {games_without_itad}")
    if games_with_image_fallback:
        logger.info(f"Games using fallback image (not capsule_616x353): {len(games_with_image_fallback)} items")
        logger.info(f"  App IDs: {games_with_image_fallback}")
    logger.info(f"Failed: {len(failed_games)} items")

    if failed_games:
        logger.info(f"\n【Data Fetch Failures】")
        for failed in failed_games:
            logger.info(f"  - App ID: {failed['app_id']}, Reason: {failed['reason']}")

    if mapping_result and mapping_result.get('failed'):
        failed_mappings = mapping_result['failed']
        logger.info(f"\n【Mapping Failures】")
        logger.info(f"Failed to map {len(failed_mappings)} titles:")
        for title in failed_mappings:
            logger.info(f"  - {title}")

    excluded_games = result.get('excluded_games', [])
    if excluded_games:
        logger.info(f"\n{'='*60}")
        logger.info(f"【Excluded by Review Score】")
        logger.info(f"{'='*60}")
        logger.info(f"Excluded: {len(excluded_games)} items\n")
        for item in excluded_games:
            logger.info(f"  - App ID: {item['app_id']}, Score: {item['reviewScore']}, Title: {item['title']}")

    if missing_data:
        logger.info(f"\n{'='*60}")
        logger.info(f"【Partial Data Retrieval】")
        logger.info(f"{'='*60}")
        logger.info(f"Games with missing optional data: {len(missing_data)} items\n")
        for item in missing_data:
            logger.info(f"  - App ID: {item['app_id']}")
            logger.info(f"    Missing data: {item['missing']}")
            logger.info("")


def save_and_backup(rebuilt_games, failed_games, id_map, newly_added_games, new_only, kv_helper):
    """Save rebuilt data and save to KV"""
    import shutil
    import datetime
    from pathlib import Path

    # Save to local file (tmp directory)
    output_file = tmp_dir / 'games_rebuilt.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(rebuilt_games, f, ensure_ascii=False, indent=2)
    logger.info(f"Saved to {output_file}")

    # Update KV/local if we have data
    # Note: Failed games are logged but don't block updates (successful games are still saved)
    should_update = len(rebuilt_games) > 0

    if should_update:
        try:
            # Save games-data
            # In append mode (new_only=True), preserve existing timestamp
            kv_helper.put_games_data(rebuilt_games, preserve_timestamp=new_only)

            # In local file mode, also create backup
            if kv_helper.is_local_mode():
                input_file = current_dir / 'games.json'
                if input_file.exists():
                    backup_filename = f"games_{datetime.datetime.now():%Y_%m_%d_%H%M%S}.json"
                    backup_file = backups_dir / backup_filename
                    backups_dir.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(input_file, backup_file)
                    logger.info(f"\n{'='*60}")
                    logger.info(f"✓ KV Update Success")
                    logger.info(f"{'='*60}")
                    logger.info(f"Backup created: {backup_file}")
                    logger.info(f"Updated: {input_file}")
                    logger.info(f"Updated games count: {len(rebuilt_games)}")

                    # Display newly added games in --new-only mode
                    if new_only and len(newly_added_games) > 0:
                        logger.info(f"\nNewly Added Games ({len(newly_added_games)}):")
                        for game in newly_added_games:
                            logger.info(f"  • {game['title']} (App ID: {game['id']})")

                    # Display failed games summary
                    if len(failed_games) > 0:
                        logger.info(f"\n{'='*60}")
                        logger.info(f"⚠ WARNING: Failed Games Summary")
                        logger.info(f"{'='*60}")
                        logger.info(f"Total failed: {len(failed_games)} game(s)")
                        logger.info(f"\nFailed App IDs:")
                        failed_ids = [str(f['app_id']) for f in failed_games]
                        for i in range(0, len(failed_ids), 10):
                            logger.info(f"  {', '.join(failed_ids[i:i+10])}")
                        logger.info(f"\nDetails:")
                        for failed in failed_games:
                            logger.info(f"  - App ID {failed['app_id']}: {failed['reason']}")

                    logger.info(f"{'='*60}")
            else:
                logger.info(f"\n{'='*60}")
                logger.info(f"✓ KV Update Success")
                logger.info(f"{'='*60}")
                logger.info(f"Updated games-data to KV")
                logger.info(f"Updated games count: {len(rebuilt_games)}")

                # Display newly added games in --new-only mode
                if new_only and len(newly_added_games) > 0:
                    logger.info(f"\nNewly Added Games ({len(newly_added_games)}):")
                    for game in newly_added_games:
                        logger.info(f"  • {game['title']} (App ID: {game['id']})")

                # Display failed games summary
                if len(failed_games) > 0:
                    logger.info(f"\n{'='*60}")
                    logger.info(f"⚠ WARNING: Failed Games Summary")
                    logger.info(f"{'='*60}")
                    logger.info(f"Total failed: {len(failed_games)} game(s)")
                    logger.info(f"\nFailed App IDs:")
                    failed_ids = [str(f['app_id']) for f in failed_games]
                    for i in range(0, len(failed_ids), 10):
                        logger.info(f"  {', '.join(failed_ids[i:i+10])}")
                    logger.info(f"\nDetails:")
                    for failed in failed_games:
                        logger.info(f"  - App ID {failed['app_id']}: {failed['reason']}")

                logger.info(f"{'='*60}")
        except Exception as e:
            logger.info(f"\n{'='*60}")
            logger.info(f"✗ KV Update Failed")
            logger.info(f"{'='*60}")
            logger.info(f"Error: {e}")
            logger.info(f"Temporary file saved: {output_file}")
            logger.info(f"{'='*60}")
    else:
        logger.info(f"\n{'='*60}")
        logger.info(f"✗ KV Update Skipped")
        logger.info(f"{'='*60}")
        if len(failed_games) > 0:
            logger.info(f"Reason: {len(failed_games)} game(s) failed data fetch")
            logger.info(f"Failed App IDs: {', '.join([str(f['app_id']) for f in failed_games])}")
        elif len(rebuilt_games) == 0:
            logger.info(f"Reason: No games to update")
        logger.info(f"Temporary file saved: {output_file}")
        logger.info(f"{'='*60}")


def delete_games_command(kv_helper):
    """Delete games specified in delete_appid_list.txt"""
    logger.info("=== Delete Games Mode ===")

    # Read delete target appids from file
    delete_list_file = refs_dir / 'delete_appid_list.txt'
    if not delete_list_file.exists():
        logger.info(f"\n{'='*60}")
        logger.info(f"✗ Delete Failed")
        logger.info(f"{'='*60}")
        logger.info(f"Error: {delete_list_file} not found")
        logger.info(f"{'='*60}")
        logger.error(f"Delete list file not found: {delete_list_file}")
        return

    # Read appids (supports both "appid" and "appid\ttitle" formats)
    with open(delete_list_file, 'r', encoding='utf-8') as f:
        delete_appids = []
        for line in f:
            line = line.strip()
            if line:
                # Extract appid (first element before tab, or entire line if no tab)
                app_id = line.split('\t')[0] if '\t' in line else line.split()[0] if ' ' in line else line
                delete_appids.append(app_id)

    if not delete_appids:
        logger.info(f"\n{'='*60}")
        logger.info(f"✗ Delete Failed")
        logger.info(f"{'='*60}")
        logger.info(f"Error: No appids found in {delete_list_file}")
        logger.info(f"{'='*60}")
        logger.error(f"No appids found in delete list file")
        return

    logger.info(f"Delete targets: {len(delete_appids)} appids")
    logger.info(f"\nDelete targets ({len(delete_appids)} appids):")
    for appid in delete_appids:
        logger.info(f"  • {appid}")

    # Get existing data
    games_data = kv_helper.get_games_data()
    id_map_data = kv_helper.get_id_map()
    logger.info(f"Loaded {len(games_data)} games and {len(id_map_data)} id-map entries")

    # Delete from games_data
    initial_games_count = len(games_data)
    games_data = [game for game in games_data if game.get('id') not in delete_appids]
    deleted_games_count = initial_games_count - len(games_data)

    # Delete from id_map_data
    initial_map_count = len(id_map_data)
    id_map_data = [entry for entry in id_map_data if entry.get('id') not in delete_appids]
    deleted_map_count = initial_map_count - len(id_map_data)

    # Save back
    kv_helper.put_games_data(games_data)

    logger.info(f"\n{'='*60}")
    logger.info(f"✓ Delete Complete")
    logger.info(f"{'='*60}")
    logger.info(f"Deleted from games-data: {deleted_games_count} games")
    logger.info(f"Deleted from id-map: {deleted_map_count} entries")
    logger.info(f"Remaining games: {len(games_data)}")
    logger.info(f"Remaining id-map entries: {len(id_map_data)}")
    logger.info(f"{'='*60}")

    logger.info(f"Delete complete: {deleted_games_count} games, {deleted_map_count} id-map entries deleted")


def reset_prices_command(kv_helper):
    """Reset all prices to 1 in games.json
    
    Note: Prices are reset to 1 (not 0) to avoid issues with differential update batch.
    Free games already have price=0, so resetting to 0 would make it impossible to detect
    price changes for free games in the update batch.
    """
    logger.info("=== Reset Prices Mode ===")

    # Get existing games data
    games_data = kv_helper.get_games_data()
    logger.info(f"Loaded {len(games_data)} games from KV/file")

    # Reset all prices to 1 (not 0, to distinguish from free games)
    updated_count = 0
    for game in games_data:
        deal = game.get('deal')
        if deal and isinstance(deal, dict):
            # Reset JP price if exists (current format)
            if 'JP' in deal and isinstance(deal['JP'], dict):
                deal['JP']['price'] = 1
                updated_count += 1
            # Reset US price if exists (current format)
            if 'US' in deal and isinstance(deal['US'], dict):
                deal['US']['price'] = 1
            # Also check for old JPY/USD keys (legacy format for backward compatibility)
            if 'JPY' in deal and isinstance(deal['JPY'], dict):
                deal['JPY']['price'] = 1
            if 'USD' in deal and isinstance(deal['USD'], dict):
                deal['USD']['price'] = 1

    # Save back
    kv_helper.put_games_data(games_data)

    logger.info(f"\n{'='*60}")
    logger.info(f"✓ Reset Prices Complete")
    logger.info(f"{'='*60}")
    logger.info(f"Updated {updated_count} games")
    logger.info(f"All deal.JP.price and deal.US.price set to 1")
    logger.info(f"{'='*60}")

    logger.info(f"Reset complete: {updated_count} games updated")


def dedupe_command():
    """Remove duplicate games from games-basic.json, games-details.json and games-movies.json (local files only).

    Deduplicates by game id (keeps first occurrence). Updates meta.record_count
    and trims details/movies to match. Creates timestamped backup before overwriting.
    """
    import shutil
    import datetime

    logger.info("=== Dedupe Mode (remove duplicate games from local JSON) ===")

    basic_file = current_dir / 'games-basic.json'
    details_file = current_dir / 'games-details.json'
    movies_file = current_dir / 'games-movies.json'

    if not basic_file.exists() or not details_file.exists():
        logger.info(f"\n{'='*60}")
        logger.info(f"✗ Dedupe Failed")
        logger.info(f"{'='*60}")
        logger.info(f"Error: Required files not found in {current_dir}")
        if not basic_file.exists():
            logger.info(f"  Missing: {basic_file.name}")
        if not details_file.exists():
            logger.info(f"  Missing: {details_file.name}")
        logger.info(f"{'='*60}")
        return

    with open(basic_file, 'r', encoding='utf-8') as f:
        basic_data = json.load(f)
    with open(details_file, 'r', encoding='utf-8') as f:
        details_data = json.load(f)

    movies_data = None
    if movies_file.exists():
        with open(movies_file, 'r', encoding='utf-8') as f:
            movies_data = json.load(f)

    games = basic_data.get('games', []) if isinstance(basic_data, dict) else basic_data
    if not isinstance(basic_data, dict) or 'meta' not in basic_data:
        logger.info(f"\n{'='*60}")
        logger.info(f"✗ Dedupe Failed")
        logger.info(f"{'='*60}")
        logger.info(f"Error: games-basic.json must have 'meta' and 'games' structure")
        logger.info(f"{'='*60}")
        return

    before_count = len(games)
    seen_ids = set()
    deduplicated = []
    duplicate_ids = []

    for game in games:
        gid = game.get('id')
        if gid is None:
            deduplicated.append(game)
            continue
        if gid in seen_ids:
            duplicate_ids.append(gid)
            continue
        seen_ids.add(gid)
        deduplicated.append(game)

    removed_count = before_count - len(deduplicated)
    if removed_count == 0:
        logger.info(f"\n{'='*60}")
        logger.info(f"✓ Dedupe Complete (no duplicates found)")
        logger.info(f"{'='*60}")
        logger.info(f"Total games: {before_count}")
        logger.info(f"{'='*60}")
        return

    basic_data['games'] = deduplicated
    if 'meta' in basic_data and isinstance(basic_data['meta'], dict):
        basic_data['meta']['record_count'] = len(deduplicated)

    valid_ids = set(deduplicated[i].get('id') for i in range(len(deduplicated)) if deduplicated[i].get('id') is not None)
    details_deduped = {k: v for k, v in details_data.items() if k in valid_ids} if isinstance(details_data, dict) else details_data
    movies_deduped = None
    if isinstance(movies_data, dict):
        movies_deduped = {k: v for k, v in movies_data.items() if k in valid_ids}

    backups_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.datetime.now().strftime('%Y_%m_%d_%H%M%S')
    backup_basic = backups_dir / f"games-basic_{ts}.json"
    backup_details = backups_dir / f"games-details_{ts}.json"
    shutil.copy2(basic_file, backup_basic)
    shutil.copy2(details_file, backup_details)
    backup_names = f"{backup_basic.name}, {backup_details.name}"

    if movies_deduped is not None:
        backup_movies = backups_dir / f"games-movies_{ts}.json"
        shutil.copy2(movies_file, backup_movies)
        backup_names += f", {backup_movies.name}"

    logger.info(f"Backup created: {backup_names}")

    with open(basic_file, 'w', encoding='utf-8') as f:
        json.dump(basic_data, f, ensure_ascii=False, indent=2)
    with open(details_file, 'w', encoding='utf-8') as f:
        json.dump(details_deduped, f, ensure_ascii=False, indent=2)

    updated_files = f"{basic_file.name}, {details_file.name}"
    if movies_deduped is not None:
        with open(movies_file, 'w', encoding='utf-8') as f:
            json.dump(movies_deduped, f, ensure_ascii=False, indent=2)
        updated_files += f", {movies_file.name}"
    else:
        logger.warning(f"  ⚠ {movies_file.name} not found, skipped")

    logger.info(f"\n{'='*60}")
    logger.info(f"✓ Dedupe Complete")
    logger.info(f"{'='*60}")
    logger.info(f"Before: {before_count} games")
    logger.info(f"After: {len(deduplicated)} games")
    logger.info(f"Removed: {removed_count} duplicate(s)")
    if duplicate_ids:
        logger.info(f"Duplicate ID(s): {duplicate_ids}")
    logger.info(f"Updated: {updated_files}")
    logger.info(f"{'='*60}")


def refetch_reviews_command(kv_helper, score_targets):
    """Re-fetch review scores for games with specified score types

    Args:
        kv_helper: KVHelper instance
        score_targets: Comma-separated string of score numbers (1-9) and/or 'others'
    """
    logger.info("=== Re-fetch Review Scores Mode ===")

    # Valid review score mapping (from REVIEW_SCORE_MAPPING)
    VALID_SCORES = {
        'Overwhelmingly Positive',
        'Very Positive',
        'Positive',
        'Mostly Positive',
        'Mixed',
        'Mostly Negative',
        'Negative',
        'Very Negative',
        'Overwhelmingly Negative',
        'No user reviews'
    }

    # Score number to description mapping
    SCORE_NUMBER_TO_DESC = {
        '9': 'Overwhelmingly Positive',
        '8': 'Very Positive',
        '7': 'Positive',
        '6': 'Mostly Positive',
        '5': 'Mixed',
        '4': 'Mostly Negative',
        '3': 'Negative',
        '2': 'Very Negative',
        '1': 'Overwhelmingly Negative',
        '0': 'No user reviews'
    }

    # Parse score targets
    targets = [t.strip() for t in score_targets.split(',')]
    target_scores = set()
    include_others = False

    for target in targets:
        if target == 'others':
            include_others = True
        elif target in SCORE_NUMBER_TO_DESC:
            target_scores.add(SCORE_NUMBER_TO_DESC[target])
        else:
            logger.info(f"\n{'='*60}")
            logger.info(f"✗ Invalid Score Target")
            logger.info(f"{'='*60}")
            logger.info(f"Error: Invalid target '{target}'")
            logger.info(f"Valid targets: 1-9, others")
            logger.info(f"{'='*60}")
            logger.error(f"Invalid score target: {target}")
            return

    logger.info(f"Target scores: {target_scores}")
    logger.info(f"Include others (invalid scores): {include_others}")

    # Get existing games data
    games_data = kv_helper.get_games_data()
    logger.info(f"Loaded {len(games_data)} games from KV/file")

    # Find games to re-fetch
    games_to_refetch = []
    for game in games_data:
        score = game.get('reviewScore')

        # Check if score matches target
        if include_others and (not score or score not in VALID_SCORES):
            games_to_refetch.append(game)
        elif score in target_scores:
            games_to_refetch.append(game)

    if not games_to_refetch:
        logger.info(f"\n{'='*60}")
        logger.info(f"✓ No Games to Re-fetch")
        logger.info(f"{'='*60}")
        logger.info(f"No games found matching the specified criteria")
        logger.info(f"{'='*60}")
        logger.info("No games to re-fetch")
        return

    logger.info(f"\n{'='*60}")
    logger.info(f"Re-fetch Target Games: {len(games_to_refetch)}")
    logger.info(f"{'='*60}")
    logger.info(f"Target score types: {', '.join(target_scores) if target_scores else 'None'}")
    if include_others:
        logger.info(f"Including: Invalid/other scores")
    logger.info(f"\nEstimated time: {len(games_to_refetch) * 1.25 / 60:.1f} minutes")
    logger.info(f"{'='*60}\n")

    logger.info(f"Re-fetching reviews for {len(games_to_refetch)} games")

    # Initialize extractor for get_review_score method
    extractor = GameExtractor(refs_dir)

    # Re-fetch review scores
    updated_games = []
    failed_games = []
    score_changes = []

    for i, game in enumerate(games_to_refetch, 1):
        app_id = game['id']
        title = game['title']
        old_score = game.get('reviewScore', 'None')

        logger.info(f"[{i}/{len(games_to_refetch)}] Re-fetching: {app_id} {title}")
        logger.info(f"[{i}/{len(games_to_refetch)}] {app_id} | {title[:50]}")
        logger.info(f"  Old score: {old_score}")

        # Get new review score
        new_score, total_reviews = extractor.get_review_score(app_id)

        if new_score:
            game['reviewScore'] = new_score
            game['reviewsCount'] = total_reviews
            updated_games.append(app_id)

            if new_score != old_score:
                score_changes.append({
                    'appid': app_id,
                    'title': title,
                    'old_score': old_score,
                    'new_score': new_score,
                    'total_reviews': total_reviews
                })

            logger.info(f"  ✓ New score: {new_score}, {total_reviews} reviews")
            logger.info(f"  New score: {new_score}, {total_reviews} reviews")
        else:
            failed_games.append({
                'appid': app_id,
                'title': title,
                'old_score': old_score
            })
            logger.warning(f"  ✗ Failed to fetch review score")
            logger.info(f"  ✗ Failed to fetch")

        # Rate limiting
        if i < len(games_to_refetch):
            wait_time = random.uniform(1.0, 1.5)
            time.sleep(wait_time)

        logger.info()

    # Save updated data
    if updated_games:
        import shutil
        import datetime

        # Create backup before saving
        if kv_helper.is_local_mode():
            input_file = current_dir / 'games.json'
            if input_file.exists():
                backup_filename = f"games_{datetime.datetime.now():%Y_%m_%d_%H%M%S}.json"
                backup_file = backups_dir / backup_filename
                backups_dir.mkdir(parents=True, exist_ok=True)
                shutil.copy2(input_file, backup_file)
                logger.info(f"Created backup: {backup_file}")

        # Update metadata
        if isinstance(games_data, dict) and 'meta' in games_data:
            # If games_data has meta structure, it's already handled by KVHelper
            pass

        kv_helper.put_games_data(games_data, preserve_timestamp=False)
        logger.info(f"Saved updated games data")

    # Print summary report
    logger.info(f"\n{'='*60}")
    logger.info(f"✓ Re-fetch Complete")
    logger.info(f"{'='*60}")
    logger.info(f"Total processed: {len(games_to_refetch)} games")
    logger.info(f"Successfully updated: {len(updated_games)} games")
    logger.info(f"Failed: {len(failed_games)} games")
    logger.info(f"Score changed: {len(score_changes)} games")

    if score_changes:
        logger.info(f"\n--- Score Changes ({len(score_changes)}) ---")
        for change in score_changes[:20]:  # Show first 20
            logger.info(f"  • {change['appid']} | {change['title'][:40]}")
            logger.info(f"    {change['old_score']} → {change['new_score']} ({change['total_reviews']} reviews)")
        if len(score_changes) > 20:
            logger.info(f"  ... and {len(score_changes) - 20} more")

    if failed_games:
        logger.info(f"\n--- Failed Games ({len(failed_games)}) ---")
        for failed in failed_games[:10]:  # Show first 10
            logger.info(f"  • {failed['appid']} | {failed['title'][:40]} (was: {failed['old_score']})")
        if len(failed_games) > 10:
            logger.info(f"  ... and {len(failed_games) - 10} more")

    logger.info(f"{'='*60}")

    logger.info(f"Re-fetch complete: {len(updated_games)} updated, {len(failed_games)} failed, {len(score_changes)} changed")


def main():
    """Main entry point"""
    # Parse command line arguments
    itad_key = None
    new_only = False
    use_kv_option = False
    reset_prices = False
    delete_mode = False
    extract_mode = False
    refetch_mode = False
    refetch_targets = None
    dedupe_mode = False
    discover_mode = False
    steam_web_api_key = None
    seed_only = False
    force_include_appid = None
    backfill_awaiting_release = False
    apply_pending_path = None
    regions = DEFAULT_REGIONS.copy()
    limit = None

    i = 1
    while i < len(sys.argv):
        arg = sys.argv[i]
        if arg == '--append':
            new_only = True
        elif arg == '--kv':
            use_kv_option = True
        elif arg == '--reset-prices':
            reset_prices = True
        elif arg == '--delete':
            delete_mode = True
        elif arg == '--extract':
            extract_mode = True
        elif arg == '--dedupe':
            dedupe_mode = True
        elif arg == '--discover':
            discover_mode = True
            if i + 1 < len(sys.argv):
                steam_web_api_key = sys.argv[i + 1]
                i += 1
            else:
                logger.info("Error: --discover requires STEAM_WEB_API_KEY argument")
                sys.exit(1)
        elif arg == '--seed-only':
            seed_only = True
        elif arg == '--force-include':
            if i + 1 < len(sys.argv):
                force_include_appid = sys.argv[i + 1]
                i += 1
            else:
                logger.info("Error: --force-include requires an appid argument")
                sys.exit(1)
        elif arg == '--backfill-awaiting-release':
            backfill_awaiting_release = True
        elif arg == '--apply-pending':
            if i + 1 < len(sys.argv):
                apply_pending_path = sys.argv[i + 1]
                i += 1
            else:
                logger.info("Error: --apply-pending requires a file path argument")
                sys.exit(1)
        elif arg == '--refetch':
            refetch_mode = True
            if i + 1 < len(sys.argv):
                refetch_targets = sys.argv[i + 1]
                i += 1
            else:
                logger.info("Error: --refetch requires SCORES argument")
                sys.exit(1)
        elif arg == '--regions':
            if i + 1 < len(sys.argv):
                regions = sys.argv[i + 1].split(',')
                i += 1
        elif arg == '--limit':
            if i + 1 < len(sys.argv):
                limit = int(sys.argv[i + 1])
                i += 1
        else:
            itad_key = arg
        i += 1

    # Ensure directories exist
    current_dir.mkdir(parents=True, exist_ok=True)
    tmp_dir.mkdir(parents=True, exist_ok=True)

    # If dedupe mode, execute and exit (local files only, no KV)
    if dedupe_mode:
        dedupe_command()
        return

    # If force-include mode, execute and exit (local file only, no KV, no ITAD key needed)
    if force_include_appid:
        force_include_command(force_include_appid)
        return

    # If extract mode, execute and exit
    if extract_mode:
        # Use dedicated log file for extract mode
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        extract_log_file = log_dir / f'extract_{timestamp}.log'

        # Reconfigure logging for extract mode
        for handler in logging.root.handlers[:]:
            logging.root.removeHandler(handler)

        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(extract_log_file, mode='w', encoding='utf-8'),
                logging.StreamHandler()
            ]
        )

        logger.info(f"Extract mode: Logging to {extract_log_file}")
        success = extract_command(refs_dir)
        return 0 if success else 1

    # Determine KV usage
    # 1. With --kv option → Use KV
    # 2. Github Actions environment → Use KV
    # 3. Otherwise → Use local files
    is_github_actions = os.environ.get('GITHUB_ACTIONS') == 'true'
    use_kv = use_kv_option or is_github_actions

    # Initialize KVHelper
    kv_helper = KVHelper(use_kv=use_kv)

    # If backfill-awaiting-release mode, execute and exit (cheap review-gate
    # checks + pending-list writes only, no ITAD key, no full Steam+ITAD
    # fetch or KV write). Local-file mode by default, like every other
    # command here -- pass --kv explicitly to check against live KV instead.
    if backfill_awaiting_release:
        backfill_awaiting_release_command(use_kv=use_kv)
        return

    # If discover mode, execute and exit (Stage 1: no KV writes, PR artifact only)
    if discover_mode:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        discover_log_file = log_dir / f'discover_{timestamp}.log'

        for handler in logging.root.handlers[:]:
            logging.root.removeHandler(handler)

        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(discover_log_file, mode='w', encoding='utf-8'),
                logging.StreamHandler()
            ]
        )

        logger.info(f"Discover mode: Logging to {discover_log_file}")
        discover_command(itad_key, steam_web_api_key, regions, seed_only=seed_only)
        return

    # If apply-pending mode, execute and exit (Stage 2: KV write only, no fetching)
    if apply_pending_path:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        apply_log_file = log_dir / f'apply_pending_{timestamp}.log'

        for handler in logging.root.handlers[:]:
            logging.root.removeHandler(handler)

        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(apply_log_file, mode='w', encoding='utf-8'),
                logging.StreamHandler()
            ]
        )

        logger.info(f"Apply-pending mode: Logging to {apply_log_file}")
        apply_command(apply_pending_path, kv_helper=kv_helper)
        return

    # If refetch mode, execute and exit
    if refetch_mode:
        # Use dedicated log file for refetch mode
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        refetch_log_file = log_dir / f'refetch_{timestamp}.log'

        # Reconfigure logging for refetch mode
        for handler in logging.root.handlers[:]:
            logging.root.removeHandler(handler)

        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(refetch_log_file, mode='w', encoding='utf-8'),
                logging.StreamHandler()
            ]
        )

        logger.info(f"Refetch mode: Logging to {refetch_log_file}")
        refetch_reviews_command(kv_helper, refetch_targets)
        return

    # If delete mode, execute and exit
    if delete_mode:
        delete_games_command(kv_helper)
        return

    # If reset-prices mode, execute and exit
    if reset_prices:
        reset_prices_command(kv_helper)
        return

    if use_kv_option:
        logger.info(f"Environment: Local (KV mode - for testing)")
    elif is_github_actions:
        logger.info(f"Environment: Github Actions (KV mode)")
    else:
        logger.info(f"Environment: Local (File mode)")

    # Initialize GameDataBuilder
    builder = GameDataBuilder(itad_api_key=itad_key)

    # Build game data
    result = builder.rebuild_games_data(
        new_only=new_only,
        regions=regions,
        kv_helper=kv_helper,
        limit=limit
    )

    # Display mapping results
    if result.get('mapping_result'):
        print_mapping_report(result['mapping_result'])

    # Display rebuild results
    print_rebuild_report(result)

    # Save
    save_and_backup(
        rebuilt_games=result['rebuilt_games'],
        failed_games=result['failed_games'],
        id_map=result['id_map'],
        newly_added_games=result.get('newly_added_games', []),
        new_only=new_only,
        kv_helper=kv_helper
    )


if __name__ == "__main__":
    main()
