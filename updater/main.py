#!/usr/bin/env python3
"""
Script to rebuild games.json from scratch
Fetches all data from Steam API and IsThereAnyDeal API

Usage:
  python3 updater/main.py [ITAD_API_KEY] [--new-only] [--regions JP,US,UK,EU] [--kv]

Options:
  --new-only: Add new titles + fetch data only for new additions
  --regions: Regions to fetch prices for (default: JP)
    Example: --regions JP,US,UK,EU
  --kv: Use KV in local environment (for testing)

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

    print(f"{'='*60}")
    print("=== Auto-mapping Results ===")
    print(f"{'='*60}\n")
    print(f"Success: {len(mapped)} items")
    print(f"Failed: {len(failed)} items\n")

    if mapped:
        print("--- Successfully Mapped ---")
        for item in mapped:
            itad_info = f", ITAD ID: {item['itadId']}" if item.get('itadId') else ", ITAD ID: None"
            print(f"  • App ID: {item['appid']}, Score: {item['score']}{itad_info}")

    if failed:
        print(f"\n--- Mapping Failed ---")
        print(f"  {len(failed)} titles could not be mapped")

    print(f"\n{'='*60}\n")


def print_rebuild_report(result):
    """Display rebuild result report"""
    rebuilt_games = result['rebuilt_games']
    failed_games = result['failed_games']
    missing_data = result['missing_data']

    print(f"\n{'='*60}")
    print(f"Rebuild Complete")
    print(f"{'='*60}")
    print(f"Success: {len(rebuilt_games)} items")
    print(f"Failed: {len(failed_games)} items")

    if failed_games:
        print(f"\n【Failed Games】")
        for failed in failed_games:
            print(f"  - App ID: {failed['app_id']}, Reason: {failed['reason']}")

    if missing_data:
        print(f"\n{'='*60}")
        print(f"【Data Retrieval Failures】")
        print(f"{'='*60}")
        print(f"Failed count: {len(missing_data)} items\n")
        for item in missing_data:
            print(f"  - App ID: {item['app_id']}")
            print(f"    Missing data: {item['missing']}")
            print()


def save_and_backup(rebuilt_games, failed_games, kv_helper):
    """Save rebuilt data and save to KV"""
    import shutil
    import datetime
    from pathlib import Path

    # Save to local file (tmp directory)
    output_file = tmp_dir / 'games_rebuilt.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(rebuilt_games, f, ensure_ascii=False, indent=2)
    logger.info(f"Saved to {output_file}")

    # Save to KV/local only on success
    if len(failed_games) == 0 and len(rebuilt_games) > 0:
        try:
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
                    print(f"Backup created: {backup_file}")
                    print(f"✓ Updated {input_file}")
                    print(f"{'='*60}")
            else:
                print(f"\n{'='*60}")
                print(f"✓ Saved games-data to KV")
                print(f"{'='*60}")
        except Exception as e:
            print(f"\n✗ Data save error: {e}")
            print(f"  {output_file} was created successfully")
    else:
        print(f"\n{'='*60}")
        if len(failed_games) > 0:
            print(f"⚠ Data not updated due to failed games")
        else:
            print(f"⚠ Data not updated (no rebuilt games)")
        print(f"  Please check manually: {output_file}")
        print(f"{'='*60}")


def main():
    """Main entry point"""
    # Parse command line arguments
    itad_key = None
    new_only = False
    use_kv_option = False
    regions = DEFAULT_REGIONS.copy()

    i = 1
    while i < len(sys.argv):
        arg = sys.argv[i]
        if arg == '--new-only':
            new_only = True
        elif arg == '--kv':
            use_kv_option = True
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
        kv_helper=kv_helper
    )


if __name__ == "__main__":
    main()
