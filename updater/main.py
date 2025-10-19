#!/usr/bin/env python3
"""
Script to rebuild games.json from scratch
Fetches all data from Steam API and IsThereAnyDeal API

Usage:
  python3 updater/main.py [ITAD_API_KEY] [--new-only] [--regions JP,US,UK,EU] [--kv] [--reset-prices]

Options:
  --new-only: Add new titles + fetch data only for new additions
  --regions: Regions to fetch prices for (default: JP)
    Example: --regions JP,US,UK,EU
  --kv: Use KV in local environment (for testing)
  --reset-prices: Reset all prices to 0 in games.json (for testing differential updates)

Environment detection:
  - Github Actions environment: Automatically uses KV
  - Local environment: Uses local files
  - With --kv option: Uses KV even in local environment
"""

import json
import sys
import logging
import os
from pathlib import Path
from game_data_builder import GameDataBuilder
from kv_helper import KVHelper
from constants import DEFAULT_REGIONS

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
log_file = log_dir / 'rebuild.log'

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file, mode='w', encoding='utf-8'),  # Overwrite to file
        logging.StreamHandler()  # Also output to console
    ]
)
logger = logging.getLogger(__name__)


def print_mapping_report(mapping_result):
    """Display mapping result report"""
    if not mapping_result:
        return

    mapped = mapping_result.get('mapped', [])
    failed = mapping_result.get('failed', [])
    skipped_existing = mapping_result.get('skipped_existing', [])
    skipped_multiple = mapping_result.get('skipped_multiple', [])

    print(f"{'='*60}")
    print("Auto-mapping Results")
    print(f"{'='*60}\n")
    print(f"Success: {len(mapped)} items")
    print(f"Skipped (Already exists): {len(skipped_existing)} items")
    print(f"Skipped (Multiple matches): {len(skipped_multiple)} items")
    print(f"Failed: {len(failed)} items")

    if mapped:
        print(f"\n--- Successfully Mapped ({len(mapped)}) ---")
        for item in mapped:
            itad_info = f", ITAD ID: {item['itadId']}" if item.get('itadId') else ", ITAD ID: None"
            print(f"  • {item['name']} (App ID: {item['appid']}, Score: {item['score']}){itad_info}")

    if skipped_existing:
        print(f"\n--- Skipped - Already Exists ({len(skipped_existing)}) ---")
        for item in skipped_existing:
            print(f"  • {item['title']} → {item['name']} (App ID: {item['appid']})")

    if skipped_multiple:
        print(f"\n--- Skipped - Multiple Matches ({len(skipped_multiple)}) ---")
        for item in skipped_multiple:
            print(f"  • {item['title']}")
            for match in item['matches']:
                print(f"    - {match['name']} (App ID: {match['appid']})")

    if failed:
        print(f"\n--- Mapping Failed ({len(failed)}) ---")
        for title in failed:
            print(f"  • {title}")
        print(f"\nNote: Mapping failures won't block KV updates")

    print(f"\n{'='*60}\n")


def print_rebuild_report(result):
    """Display rebuild result report"""
    rebuilt_games = result['rebuilt_games']
    failed_games = result['failed_games']
    missing_data = result['missing_data']
    mapping_result = result.get('mapping_result')
    games_without_itad = result.get('games_without_itad', [])
    games_with_image_fallback = result.get('games_with_image_fallback', [])

    print(f"\n{'='*60}")
    print(f"Data Fetch Results")
    print(f"{'='*60}")
    success_with_itad = len(rebuilt_games) - len(games_without_itad)
    print(f"Success with ITAD data: {success_with_itad} items")
    if games_without_itad:
        print(f"Success without ITAD data (Steam API only): {len(games_without_itad)} items")
        print(f"  App IDs: {games_without_itad}")
    if games_with_image_fallback:
        print(f"Games using fallback image (not capsule_616x353): {len(games_with_image_fallback)} items")
        print(f"  App IDs: {games_with_image_fallback}")
    print(f"Failed: {len(failed_games)} items")

    if failed_games:
        print(f"\n【Data Fetch Failures】")
        for failed in failed_games:
            print(f"  - App ID: {failed['app_id']}, Reason: {failed['reason']}")

    if mapping_result and mapping_result.get('failed'):
        failed_mappings = mapping_result['failed']
        print(f"\n【Mapping Failures】")
        print(f"Failed to map {len(failed_mappings)} titles:")
        for title in failed_mappings:
            print(f"  - {title}")

    if missing_data:
        print(f"\n{'='*60}")
        print(f"【Partial Data Retrieval】")
        print(f"{'='*60}")
        print(f"Games with missing optional data: {len(missing_data)} items\n")
        for item in missing_data:
            print(f"  - App ID: {item['app_id']}")
            print(f"    Missing data: {item['missing']}")
            print()


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

    # Update KV/local if we have data and no data fetch failures
    # Note: Mapping failures don't block KV updates
    should_update = len(rebuilt_games) > 0 and len(failed_games) == 0

    if should_update:
        try:
            # Save id-map first (atomic update with games-data)
            kv_helper.put_id_map(id_map)
            logger.info(f"Saved id-map to KV ({len(id_map)} items)")

            # Save games-data
            kv_helper.put_games_data(rebuilt_games)

            # In local file mode, also create backup
            if kv_helper.is_local_mode():
                input_file = current_dir / 'games.json'
                if input_file.exists():
                    backup_filename = f"games_{datetime.datetime.now():%Y_%m_%d_%H%M%S}.json"
                    backup_file = backups_dir / backup_filename
                    backups_dir.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(input_file, backup_file)
                    print(f"\n{'='*60}")
                    print(f"✓ KV Update Success")
                    print(f"{'='*60}")
                    print(f"Backup created: {backup_file}")
                    print(f"Updated: {input_file}")
                    print(f"Updated games count: {len(rebuilt_games)}")

                    # Display newly added games in --new-only mode
                    if new_only and len(newly_added_games) > 0:
                        print(f"\nNewly Added Games ({len(newly_added_games)}):")
                        for game in newly_added_games:
                            print(f"  • {game['title']} (App ID: {game['id']})")

                    print(f"{'='*60}")
            else:
                print(f"\n{'='*60}")
                print(f"✓ KV Update Success")
                print(f"{'='*60}")
                print(f"Updated games-data to KV")
                print(f"Updated games count: {len(rebuilt_games)}")

                # Display newly added games in --new-only mode
                if new_only and len(newly_added_games) > 0:
                    print(f"\nNewly Added Games ({len(newly_added_games)}):")
                    for game in newly_added_games:
                        print(f"  • {game['title']} (App ID: {game['id']})")

                print(f"{'='*60}")
        except Exception as e:
            print(f"\n{'='*60}")
            print(f"✗ KV Update Failed")
            print(f"{'='*60}")
            print(f"Error: {e}")
            print(f"Temporary file saved: {output_file}")
            print(f"{'='*60}")
    else:
        print(f"\n{'='*60}")
        print(f"✗ KV Update Skipped")
        print(f"{'='*60}")
        if len(failed_games) > 0:
            print(f"Reason: {len(failed_games)} game(s) failed data fetch")
            print(f"Failed App IDs: {', '.join([str(f['app_id']) for f in failed_games])}")
        elif len(rebuilt_games) == 0:
            print(f"Reason: No games to update")
        print(f"Temporary file saved: {output_file}")
        print(f"{'='*60}")


def reset_prices_command(kv_helper):
    """Reset all prices to 1 in games.json"""
    logger.info("=== Reset Prices Mode ===")

    # Get existing games data
    games_data = kv_helper.get_games_data()
    logger.info(f"Loaded {len(games_data)} games from KV/file")

    # Reset all prices to 1
    updated_count = 0
    for game in games_data:
        if 'deal' in game and 'JPY' in game['deal']:
            game['deal']['JPY']['price'] = 1
            updated_count += 1

    # Save back
    kv_helper.put_games_data(games_data)

    print(f"\n{'='*60}")
    print(f"✓ Reset Prices Complete")
    print(f"{'='*60}")
    print(f"Updated {updated_count} games")
    print(f"All deal.JPY.price set to 1")
    print(f"{'='*60}")

    logger.info(f"Reset complete: {updated_count} games updated")


def main():
    """Main entry point"""
    # Parse command line arguments
    itad_key = None
    new_only = False
    use_kv_option = False
    reset_prices = False
    regions = DEFAULT_REGIONS.copy()

    i = 1
    while i < len(sys.argv):
        arg = sys.argv[i]
        if arg == '--new-only':
            new_only = True
        elif arg == '--kv':
            use_kv_option = True
        elif arg == '--reset-prices':
            reset_prices = True
        elif arg == '--regions':
            if i + 1 < len(sys.argv):
                regions = sys.argv[i + 1].split(',')
                i += 1
        else:
            itad_key = arg
        i += 1

    # Ensure directories exist
    current_dir.mkdir(parents=True, exist_ok=True)
    tmp_dir.mkdir(parents=True, exist_ok=True)

    # Determine KV usage
    # 1. With --kv option → Use KV
    # 2. Github Actions environment → Use KV
    # 3. Otherwise → Use local files
    is_github_actions = os.environ.get('GITHUB_ACTIONS') == 'true'
    use_kv = use_kv_option or is_github_actions

    # Initialize KVHelper
    kv_helper = KVHelper(use_kv=use_kv)

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
        kv_helper=kv_helper
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
