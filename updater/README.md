# Steam Game Data Updater

Scripts to fetch and update game data from Steam API and ITAD API

## Overview

This tool provides two processing modes:

1. **Full data update** - Fetch latest data for all games (for daily batch processing)
2. **Add new titles + fetch data only for new additions** - Add new games and fetch only their data (for irregular processing)

## Environment Detection

Data source and destination are automatically determined:

1. **With `--kv` option**: Use KV (for local testing)
2. **Github Actions environment**: Automatically use KV (detected by `GITHUB_ACTIONS=true`)
3. **Otherwise**: Use local files (`updater/data/current/`)

## Usage

### Full Data Update (Daily Batch)

Fetch latest data for all games based on existing id-map.

```bash
python3 updater/main.py <ITAD_API_KEY>
```

### Add New Titles + Fetch Data Only for New Additions (Irregular Processing)

1. Read new titles from `game_title_list.txt`
2. Get appid from Steam API, get itadId from ITAD API
3. Update `id-map`
4. Fetch detailed data only for newly added titles
5. Merge with existing data and update `games-data`

```bash
python3 updater/main.py <ITAD_API_KEY> --new-only
```

### Options

#### --regions

Specify regions to fetch prices for (default: JP)

```bash
python3 updater/main.py <ITAD_API_KEY> --regions JP,US,UK,EU
```

#### --kv

Use KV in local environment (for testing)

```bash
# Test KV read/write in local environment
python3 updater/main.py <ITAD_API_KEY> --kv
```

## File Structure

```
updater/
├── main.py                  # CLI entry point
├── game_data_builder.py     # Business logic layer
├── steam_client.py          # Steam API client
├── itad_client.py           # ITAD API client
├── kv_helper.py             # Cloudflare KV operations
├── constants.py             # Shared constants
├── data/
│   ├── current/
│   │   ├── games.json       # Latest game data (local only)
│   │   └── id-map.json      # ID mapping (local only)
│   ├── refs/
│   │   └── game_title_list.txt  # Game titles to add
│   ├── tmp/
│   │   └── games_rebuilt.json   # Temporary output file
│   └── backups/
│       └── games_*.json     # Backup files (local only)
└── log/
    └── rebuild.log          # Execution log
```

## Data Flow

### Full Data Update

```
1. Get id-map from KV/local
2. For each game ID:
   - Fetch basic info from Steam API (appdetails)
   - Fetch additional region prices from Steam API (if multiple regions specified)
   - Fetch review data from Steam API (appreviews)
   - Fetch historical low from ITAD API (if ITAD ID exists)
3. Create games.json
4. Save games-data to KV/local
```

### Add New Titles + Fetch Data Only for New Additions

```
1. Get id-map from KV/local
2. Read game_title_list.txt
3. Get appid from Steam API (GetAppList)
4. Get itadId from ITAD API (lookup)
5. Update id-map and save to KV/local
6. Get existing games-data from KV/local
7. For each new game ID:
   - Fetch basic info from Steam API (appdetails)
   - Fetch additional region prices from Steam API (if multiple regions specified)
   - Fetch review data from Steam API (appreviews)
   - Fetch historical low from ITAD API (if ITAD ID exists)
8. Merge existing data + new data
9. Save games-data to KV/local
```

## Usage in Github Actions

KV is automatically used in Github Actions environment (no environment variable configuration needed).

### Daily Batch (Full Update)

```yaml
- name: Update all games data
  run: |
    cd src/steam
    python3 updater/main.py ${{ secrets.ITAD_API_KEY }}
```

### Irregular Processing (Add New Titles)

```yaml
- name: Add new games and update
  run: |
    cd src/steam
    python3 updater/main.py ${{ secrets.ITAD_API_KEY }} --new-only
```

## KV Operation Commands

### Get id-map

```bash
wrangler kv key get "id-map" --binding=GSV_GAMES --text
```

### Update games-data

```bash
wrangler kv key put "games-data" --binding=GSV_GAMES --path=./updater/data/current/games.json
```

## Log Output

To protect sensitive information, logs only output:

- **App ID (Steam)**
- **ITAD ID**
- **Price information**
- **Error messages**

Sensitive information such as game titles are not output to logs.

## Notes

- When adding new titles to `game_title_list.txt`, write one title per line
- Appropriate wait times are set considering Steam API and ITAD API rate limits
- In local environment, `games.json` and `id-map.json` are output to `updater/data/current/`
- Use `--kv` option to test KV in local environment
