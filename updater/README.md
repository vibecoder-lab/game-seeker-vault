# Steam Game Data Updater

Scripts to fetch and update game data from Steam API and ITAD API

## Overview

This tool provides two processing modes:

1. **Differential Update (Daily Batch)** - Compare prices and update only changed games
2. **Append Mode (Add New Titles)** - Add new games and fetch only their data (for irregular processing)

### Batch Processing

For large-scale operations (≥1000 games), batch mode is automatically enabled:

- **Checkpoint System**: Saves progress every 100 games to `updater/data/batch/checkpoints/`
- **Resume Capability**: Can resume from last checkpoint if interrupted
- **Lock File**: `batch_in_progress.lock` indicates active batch processing

## Environment Detection

Data source and destination are automatically determined:

1. **With `--kv` option**: Use KV (for local testing)
2. **Github Actions environment**: Automatically use KV (detected by `GITHUB_ACTIONS=true`)
3. **Otherwise**: Use local files (`updater/data/current/`)

## Usage

### Differential Update (Daily Batch)

Compares current prices with KV/local data and updates only games with price changes.

```bash
python3 updater/main.py <ITAD_API_KEY>
```

**Process:**
1. Fetch ITAD deals for all games in batch (200 items per request)
2. Compare with existing prices in KV/local
3. Update only games with price/discount changes
4. For games with `noItadData` flag, compare against Steam API prices

### Append Mode (Add New Titles)

Add new games from `game_title_list.txt` and fetch only their data.

```bash
python3 updater/main.py <ITAD_API_KEY> --append
```

**Process:**
1. Read new titles from `game_title_list.txt`
2. Match titles against Steam API app list (searches entire list to detect duplicates)
3. Get itadId from ITAD API for matched games
4. Fetch detailed data only for newly matched titles
5. Merge with existing data
6. Update `id-map` and `games-data` atomically (only on success)

**Important Notes:**
- If multiple exact matches are found for a title (e.g., "Prey" matches both App ID 3970 and 480490), the title is skipped and logged
- Titles already in id-map are skipped
- For ≥1000 new games, batch mode activates automatically with checkpoint system
- `id-map` and `games-data` are updated together to prevent inconsistency
- Newly added games are displayed only after successful KV update

### Options

#### --append

Add new titles + fetch data only for new additions (instead of differential update)

```bash
python3 updater/main.py <ITAD_API_KEY> --append
```

#### --regions

Specify regions to fetch prices for (default: JP,US)

```bash
# Fetch prices for Japan and United States (default)
python3 updater/main.py <ITAD_API_KEY>

# Fetch prices for specific regions
python3 updater/main.py <ITAD_API_KEY> --regions JP,US,UK,EU
```

**Supported regions:**
- `JP` - Japan (JPY)
- `US` - United States (USD)
- `UK` - United Kingdom (GBP)
- `EU` - European Union (EUR)

**Notes:**
- Multi-region pricing requires additional Steam API calls (one per region per game)
- Each region's price data is stored separately in the `deal` object (e.g., `deal.JPY`, `deal.USD`)

#### --kv

Use KV in local environment (for testing)

```bash
# Test KV read/write in local environment
python3 updater/main.py <ITAD_API_KEY> --kv
```

#### --delete

Delete games specified in `updater/data/refs/delete_appid_list.txt`

```bash
# Delete from local files
python3 updater/main.py --delete

# Delete from KV
python3 updater/main.py --delete --kv
```

**Format of `delete_appid_list.txt`:**
```
appid
appid<tab>title
appid title
```

**Process:**
1. Reads App IDs from `delete_appid_list.txt`
2. Removes matching games from `games.json` / `games-data`
3. Removes matching entries from `id-map.json` / `id-map`
4. Both files are updated atomically to maintain consistency

#### --reset-prices

Reset all prices to 1 in games.json (for testing differential updates)

```bash
python3 updater/main.py --reset-prices
```

#### --extract

Extract games from HTML calendar and filter by review scores

```bash
python3 updater/main.py --extract
```

**Process:**
1. Reads HTML from `updater/data/refs/*.html` (must be only one file)
2. Extracts App IDs and titles
3. Filters by Steam review scores (Very Positive or better)
4. Outputs: `raw_game_title_list.txt` and `pre_game_title_list.txt`

#### --refetch

Re-fetch review scores for games with specified score types

```bash
# Re-fetch Mixed or worse + No reviews + invalid scores
python3 updater/main.py --refetch 0,1,2,3,4,5,others

# Re-fetch Mostly Positive or better
python3 updater/main.py --refetch 6,7,8,9

# Re-fetch only invalid review scores
python3 updater/main.py --refetch others

# Re-fetch only No user reviews
python3 updater/main.py --refetch 0
```

**Score mapping:**
- `9` - Overwhelmingly Positive
- `8` - Very Positive
- `7` - Positive
- `6` - Mostly Positive
- `5` - Mixed
- `4` - Mostly Negative
- `3` - Negative
- `2` - Very Negative
- `1` - Overwhelmingly Negative
- `0` - No user reviews
- `others` - Invalid review scores not in mapping

## File Structure

```
updater/
├── main.py                  # CLI entry point
├── game_data_builder.py     # Business logic layer
├── steam_client.py          # Steam API client
├── itad_client.py           # ITAD API client
├── kv_helper.py             # Cloudflare KV operations
├── constants.py             # Shared constants
├── extract_games.py         # HTML extraction and review fetching
├── data/
│   ├── current/
│   │   ├── games.json       # Latest game data (local only)
│   │   └── id-map.json      # ID mapping (local only)
│   ├── refs/
│   │   ├── game_title_list.txt     # Game titles to add
│   │   ├── delete_appid_list.txt   # App IDs to delete
│   │   └── *.html                  # HTML calendar for extraction
│   ├── tmp/
│   │   └── games_rebuilt.json   # Temporary output file
│   ├── backups/
│   │   └── games_*.json         # Backup files (local only)
│   └── batch/
│       ├── batch_in_progress.lock      # Lock file for batch processing
│       ├── mapping_result.txt          # Mapping results (for resume)
│       └── checkpoints/
│           └── games_checkpoint_*.json # Checkpoint files (every 100 games)
└── log/
    ├── rebuild_*.log             # Timestamped execution logs
    ├── batch_rebuild.log         # Active batch processing log
    ├── extract_*.log             # Extract mode logs
    └── refetch_*.log             # Refetch mode logs
```

## Data Flow

### Differential Update (Default Mode)

```
1. Get id-map and games-data from KV/local
2. Batch fetch ITAD deals for all games (200 items per request, per region)
   - Skip games with noItadData flag (handled separately)
3. Compare ITAD prices with existing KV/local data for all regions
   - Detect price changes (price or discount percentage)
4. For games with noItadData flag:
   - Fetch Steam API prices
   - Compare with existing data
5. For games with changes detected:
   - Fetch Steam Basic API (includes prices, genres, languages)
   - Fetch Steam Review API
   - Fetch ITAD tags (if ITAD ID exists)
6. For games without changes:
   - Copy existing data as-is
7. Save updated games-data to KV/local
```

### Append Mode (--append)

```
1. Get id-map from KV/local
2. Read game_title_list.txt
3. Match titles against Steam API (GetAppList) - searches entire list
   - Skip if multiple exact matches found (logged with all App IDs)
   - Skip if already exists in id-map
4. Get itadId from ITAD API (lookup) for matched games
5. Auto-detect processing mode:
   - If new games ≥1000: Batch mode (with checkpoints)
   - If new games <1000: Normal mode (in-memory)
6. Get existing games-data from KV/local
7. For each new game ID:
   - Fetch Steam Basic API (includes prices, genres, languages, etc.)
   - Fetch Steam Review API
   - Fetch ITAD deals for all regions (if ITAD ID exists)
   - Fetch ITAD tags (if ITAD ID exists)
   - If ITAD data unavailable: construct deal from Steam API with noItadData flag
8. In batch mode: Save checkpoint every 100 games
9. Merge existing data + new data
10. Save id-map and games-data to KV/local atomically
11. Display newly added games (only on successful update)
```

## Usage in Github Actions

KV is automatically used in Github Actions environment (no environment variable configuration needed).

### Daily Batch (Differential Update)

```yaml
- name: Update game prices (differential)
  run: |
    python3 updater/main.py ${{ secrets.ITAD_API_KEY }}
```

### Add New Titles

```yaml
- name: Add new games and update
  run: |
    python3 updater/main.py ${{ secrets.ITAD_API_KEY }} --append
```

### Delete Games

```yaml
- name: Delete specified games
  run: |
    python3 updater/main.py --delete
```

### Re-fetch Review Scores

```yaml
- name: Re-fetch review scores
  run: |
    python3 updater/main.py --refetch 0,1,2,3,4,5,others
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

Logs include:

- **Mapping results**: Successfully mapped, skipped (existing/multiple matches), and failed titles
- **App IDs and game titles**: For transparency in --append mode
- **Data fetch results**: Success/failure with specific App IDs
- **KV update status**: Success/skipped/failed with reasons
- **Newly added games**: Listed only after successful KV update (--append mode)

## Data Structure Notes

### noItadData Flag

When ITAD data is unavailable for a game, the system falls back to Steam API pricing:

```json
{
  "deal": {
    "JPY": {
      "price": 1480,
      "regular": 1480,
      "cut": 0,
      "storeLow": "-",
      "noItadData": true
    }
  }
}
```

**Characteristics:**
- `storeLow` is always `"-"` (historical low unavailable)
- Tags are not available (ITAD-only feature)
- Price data is constructed from Steam API
- Game is NOT discarded (still included in games.json)

### Checkpoint System (Batch Mode)

When processing ≥1000 games in append mode:

1. **Checkpoint files** saved every 100 games to `updater/data/batch/checkpoints/`
2. **Lock file** (`batch_in_progress.lock`) indicates active batch
3. **Resume capability**: Automatically resumes from last checkpoint if interrupted
4. **Mapping result cache**: `mapping_result.txt` preserves App ID ↔ ITAD ID mappings
5. **Log file**: Renamed to `rebuild_{start}_to_{end}.log` upon completion

**Checkpoint file naming:**
- `games_checkpoint_1000.json` - First 1000 games (or fewer if <1000 processed)
- `games_checkpoint_2000.json` - Next batch
- Files contain only the games processed in that batch

## Notes

- When adding new titles to `game_title_list.txt`, write one title per line (or App ID + title)
- Titles with multiple exact matches (e.g., "Prey") require manual App ID specification
- Appropriate wait times are set considering Steam API and ITAD API rate limits
- In local environment, `games.json` and `id-map.json` are output to `updater/data/current/`
- Use `--kv` option to test KV in local environment
- `id-map` and `games-data` are always updated together to prevent inconsistency
- Batch processing (≥1000 games) automatically enables checkpoint system for resilience
- Checkpoint files are preserved after completion to allow resumption if needed
