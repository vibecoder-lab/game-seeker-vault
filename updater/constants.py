#!/usr/bin/env python3
"""
Shared constants and configuration for updater scripts
"""

# Region definitions (shared by Steam API and ITAD API)
REGIONS = {
    'JP': {
        'steam_cc': 'jp',
        'itad_country': 'JP',
        'currency': 'JPY'
    },
    'US': {
        'steam_cc': 'us',
        'itad_country': 'US',
        'currency': 'USD'
    },
    'UK': {
        'steam_cc': 'uk',
        'itad_country': 'GB',
        'currency': 'GBP'
    },
    'EU': {
        'steam_cc': 'de',  # Use Germany as EU representative
        'itad_country': 'DE',
        'currency': 'EUR'
    }
}

# Default region for price fetching
DEFAULT_REGIONS = ['JP', 'US']

# Title filtering: exclude keywords
EXCLUDE_KEYWORDS = [
    'Soundtrack', 'OST', 'Original Soundtrack', 'Music',
    'Demo', 'Playtest', 'Beta', 'Test',
    'DLC', 'Expansion', 'Season Pass', 'Content Pack',
    'Artbook', 'Digital Art', 'Art Book',
    'Soundtrack Edition', 'Deluxe Edition', 'Ultimate Edition',
    'Prologue', 'Epilogue', 'Prequel'
]

# Title filtering: keep these editions
KEEP_EDITIONS = [
    'Complete Edition', 'Definitive Edition', 'GOTY',
    'Game of the Year', 'Remastered', 'Enhanced Edition',
    "Director's Cut", 'Special Edition'
]

# Matching score thresholds
SCORE_EXACT_MATCH = 100
SCORE_PARTIAL_MATCH_BASE = 90
SCORE_SIMILARITY_MULTIPLIER = 80
SCORE_AUTO_ACCEPT_THRESHOLD = 80
SCORE_CANDIDATE_THRESHOLD = 60

# HTTP headers
USER_AGENT_STEAM = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
USER_AGENT_ITAD = 'Mozilla/5.0'

# Temporary file paths
TEMP_DIR = '/tmp'
TEMP_ID_MAP_FILE = 'id-map.json'
TEMP_GAMES_FILE = 'games.json'

# KV binding name
KV_BINDING_NAME = 'GSV_GAMES'

# Batch processing
BATCH_DIR = 'updater/data/batch'
CHECKPOINT_DIR = 'updater/data/batch/checkpoints'
PROCESSED_IDS_FILE = 'updater/data/batch/processed_ids.txt'
MAPPING_RESULT_FILE = 'updater/data/batch/mapping_result.txt'
BATCH_LOCK_FILE = 'updater/data/batch/batch_in_progress.lock'
CHECKPOINT_INTERVAL = 1000
