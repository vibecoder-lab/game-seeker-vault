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
DEFAULT_REGIONS = ['JP', 'US', 'EU']

# Review score filtering: only allow these scores for new additions
ALLOWED_REVIEW_SCORES = {'Very Positive', 'Overwhelmingly Positive'}

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
CHECKPOINT_INTERVAL = 100

# Steam Web API (IStoreService) - new-game discovery
STEAM_APPLIST_URL = 'https://api.steampowered.com/IStoreService/GetAppList/v1/'
STEAM_APPLIST_MAX_RESULTS = 50000
# Lives outside updater/data/ (which is entirely gitignored) because a
# gitignore'd parent directory can't be selectively un-ignored per file --
# git never descends into it to test the negation patterns.
STEAM_APPLIST_SNAPSHOT_FILE = 'discovery-data/refs/steam_applist_snapshot.json'

# New-game discovery pipeline: pending review outputs and persistent lists
PENDING_NEW_GAMES_DIR = 'discovery-data/pending_new_games'
PENDING_REVIEW_CANDIDATES_FILE = 'discovery-data/refs/pending_review_candidates.json'
# Candidates that passed their final (180-day) milestone check and still
# didn't qualify: moved here out of PENDING_REVIEW_CANDIDATES_FILE so the
# pending list only ever contains candidates still being actively monitored.
EXHAUSTED_REVIEW_CANDIDATES_FILE = 'discovery-data/refs/exhausted_review_candidates.json'
REJECTED_APPIDS_FILE = 'discovery-data/refs/rejected_appids.txt'

# Discovery review gate: minimum total review count required, in addition to
# ALLOWED_REVIEW_SCORES, before a candidate proceeds to the full Steam+ITAD
# fetch. Matches the threshold the manual process (extract_games.py) used to
# enforce (a brand-new release can already show "Very Positive" with very
# few reviews; this bar avoids adding those prematurely). Checked cheaply via
# the free appreviews summary endpoint, before the expensive per-app fetch.
DISCOVERY_MIN_REVIEWS = 100

# Milestone-based re-check schedule for pending candidates, in days since
# first discovered. Rather than hitting the review-gate endpoint every single
# day forever (unbounded cost, and mostly wasted since review counts barely
# move day to day), a pending candidate is only re-checked when it crosses
# one of these milestones. After the last milestone, it is no longer
# automatically re-checked (consistent with this pipeline's scope: it
# watches new releases going forward, it does not try to guarantee 100%
# eventual coverage of every long-tail case).
DISCOVERY_REVIEW_CHECK_MILESTONES_DAYS = [3, 7, 30, 180]

# Discovery pre-filter: suffix/bracket-anchored exclusion (separate from
# EXCLUDE_KEYWORDS, which is unanchored substring matching used only by the
# legacy fuzzy-title-matching path in build_id_map_from_titles)
DISCOVERY_EXCLUDE_SUFFIXES = [
    'Soundtrack', 'OST', 'Original Soundtrack',
    'Demo', 'Playtest', 'Beta Test', 'Tech Demo',
]
