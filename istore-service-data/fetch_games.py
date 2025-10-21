#!/usr/bin/env python3
"""
Fetch games-only list from IStoreService/GetAppList/v1 API

Usage:
    python fetch_games.py <API_KEY> [output_file]

Arguments:
    API_KEY: Steam Web API Key (get from https://steamcommunity.com/dev/apikey)
    output_file: Output JSON file path (default: games.json)
"""

import sys
import json
import requests
import time


def fetch_games_only_list(api_key):
    """Fetch games-only list from IStoreService/GetAppList/v1 API

    This API returns only games by default (no DLC, software, videos, hardware).

    Args:
        api_key: Steam Web API Key

    Returns:
        List of dicts with keys: appid, name, last_modified, price_change_number
    """
    url = "https://api.steampowered.com/IStoreService/GetAppList/v1/"
    games = []
    last_appid = 0
    page = 0

    print("Fetching games-only list from IStoreService API...")
    start_time = time.time()

    while True:
        params = {
            'key': api_key,
            'max_results': 50000,  # Maximum 50,000 per page
        }

        if last_appid > 0:
            params['last_appid'] = last_appid

        try:
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()

            apps = data.get('response', {}).get('apps', [])

            if not apps:
                print(f"No more apps returned. Stopping pagination.")
                break

            games.extend(apps)
            last_appid = apps[-1]['appid']
            page += 1

            elapsed = time.time() - start_time
            print(f"Page {page}: Fetched {len(apps)} games, total: {len(games):,}, last_appid: {last_appid}, elapsed: {elapsed:.1f}s")

            # Rate limiting (be polite to Steam API)
            time.sleep(1.0)

        except requests.exceptions.RequestException as e:
            print(f"Error: {e}")
            return None

    total_time = time.time() - start_time
    print(f"\n✅ Successfully fetched {len(games):,} games in {total_time:.1f}s ({total_time/60:.1f} minutes)")

    return games


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    api_key = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else 'istore-games-raw.json'

    # Fetch games
    games = fetch_games_only_list(api_key)

    if not games:
        print("❌ Failed to fetch games")
        sys.exit(1)

    # Save to JSON
    print(f"\nSaving to {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(games, f, indent=2, ensure_ascii=False)

    print(f"✅ Saved {len(games):,} games to {output_file}")

    # Show summary
    print(f"\nSummary:")
    print(f"  Total games: {len(games):,}")
    print(f"  First game: {games[0]['appid']} - {games[0]['name']}")
    print(f"  Last game: {games[-1]['appid']} - {games[-1]['name']}")


if __name__ == '__main__':
    main()
