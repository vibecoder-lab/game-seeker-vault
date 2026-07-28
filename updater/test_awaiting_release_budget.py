#!/usr/bin/env python3
"""
Awaiting-release budget rotation test script

Verifies the "awaiting release" phase (candidates with zero reviews ever
observed, i.e. first_review_seen still unset -- typically still "coming
soon" on Steam, since App ID registration date is NOT release date) is
bounded by DISCOVERY_AWAITING_RELEASE_DAILY_BUDGET regardless of backlog
size, processed oldest-last_checked-first, and correctly transitions to the
normal milestone schedule (anchored at first_review_seen, not first_seen)
the first time reviews are observed. Also verifies an awaiting-release
candidate that never sees a single review within the 180-day window is
exhausted without spending an API call on it.
"""

import sys
import shutil
import importlib
from pathlib import Path
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))

import constants

SCRATCH = Path(__file__).parent / '_test_scratch_awaiting_release'
if SCRATCH.exists():
    shutil.rmtree(SCRATCH)
SCRATCH.mkdir(parents=True, exist_ok=True)

constants.STEAM_APPLIST_SNAPSHOT_FILE = str(SCRATCH / 'snapshot.json')
constants.PENDING_REVIEW_CANDIDATES_FILE = str(SCRATCH / 'pending_review_candidates.json')
constants.EXHAUSTED_REVIEW_CANDIDATES_FILE = str(SCRATCH / 'exhausted_review_candidates.json')
constants.REJECTED_APPIDS_FILE = str(SCRATCH / 'rejected_appids.txt')
constants.REVIEW_GATE_CHECK_LOG_FILE = str(SCRATCH / 'review_gate_check_log.jsonl')
constants.PENDING_NEW_GAMES_DIR = str(SCRATCH / 'pending_new_games')
constants.DISCOVERY_AWAITING_RELEASE_DAILY_BUDGET = 3  # small, to make the cap easy to exercise

import steam_catalog
importlib.reload(steam_catalog)
import discover_new_games
importlib.reload(discover_new_games)

FAKE_CATALOG = {"10": "Counter-Strike"}


def _iso_days_ago(n):
    return (datetime.now(timezone.utc).date() - timedelta(days=n)).isoformat()


class FakeKVHelper:
    def __init__(self, use_kv=True):
        pass

    def get_games_data(self):
        return []

    def get_id_map(self):
        return []


def fake_catalog_no_new(self, include_games=True, include_software=True):
    return dict(FAKE_CATALOG)  # matches the pre-saved snapshot exactly -> zero new App IDs


def setup_pending(entries):
    discover_new_games.save_pending_review_candidates(entries)
    steam_catalog.save_snapshot(FAKE_CATALOG, constants.STEAM_APPLIST_SNAPSHOT_FILE)


def test_budget_caps_daily_checks_oldest_first():
    print("=" * 60)
    print("Test: awaiting-release phase capped at daily budget, oldest-last_checked-first")
    print("=" * 60)

    entries = {}
    for i in range(7):
        entries[str(1000 + i)] = {
            'name': f'Game {i}',
            'reviewScore': 'No user reviews',
            'totalReviews': 0,
            'game_data': None,
            'first_seen': _iso_days_ago(10),
            'first_review_seen': None,
            'last_checked': f"2026-01-{i + 1:02d}T00:00:00+00:00",  # ascending: entry 0 oldest
            'next_check_due': None,
        }
    setup_pending(entries)

    checked_ids = []

    def fake_review_gate(app_id, session, min_reviews=100, max_retries=3):
        checked_ids.append(app_id)
        return False, 'No user reviews', 0

    with patch.object(steam_catalog.SteamCatalogClient, 'fetch_full_catalog', fake_catalog_no_new), \
         patch.object(discover_new_games, 'KVHelper', FakeKVHelper), \
         patch.object(discover_new_games, 'check_review_gate', fake_review_gate):
        discover_new_games.discover_command(itad_api_key='fake', steam_web_api_key='fake', regions=['JP'])

    assert len(checked_ids) == 3, f"expected exactly 3 (budget) checks, got {len(checked_ids)}: {checked_ids}"
    assert checked_ids == ['1000', '1001', '1002'], f"expected oldest-last_checked-first order, got {checked_ids}"
    print(f"  Checked exactly budget-limited 3 of 7 entries, oldest-first: {checked_ids}: PASS")

    pending_after = discover_new_games.load_pending_review_candidates(constants.PENDING_REVIEW_CANDIDATES_FILE)
    assert len(pending_after) == 7, "all 7 should still be present (3 checked, 4 carried over untouched)"
    for aid in ('1003', '1004', '1005', '1006'):
        assert pending_after[aid]['last_checked'] == entries[aid]['last_checked'], \
            f"{aid} should be untouched (no API call this run)"
    print("  Un-selected entries carried over untouched (last_checked unchanged): PASS")


def test_first_review_observed_starts_milestone_clock():
    print("\n" + "=" * 60)
    print("Test: first nonzero review count sets first_review_seen and switches to milestone schedule")
    print("=" * 60)

    entries = {
        '2000': {
            'name': 'About To Release',
            'reviewScore': 'No user reviews',
            'totalReviews': 0,
            'game_data': None,
            'first_seen': _iso_days_ago(45),  # registered 45 days ago, "coming soon" until now
            'first_review_seen': None,
            'last_checked': _iso_days_ago(7) + 'T00:00:00+00:00',
            'next_check_due': None,
        }
    }
    setup_pending(entries)

    def fake_review_gate(app_id, session, min_reviews=100, max_retries=3):
        return False, 'Mixed', 12  # now has reviews, but not enough to pass the gate yet

    with patch.object(steam_catalog.SteamCatalogClient, 'fetch_full_catalog', fake_catalog_no_new), \
         patch.object(discover_new_games, 'KVHelper', FakeKVHelper), \
         patch.object(discover_new_games, 'check_review_gate', fake_review_gate):
        discover_new_games.discover_command(itad_api_key='fake', steam_web_api_key='fake', regions=['JP'])

    pending_after = discover_new_games.load_pending_review_candidates(constants.PENDING_REVIEW_CANDIDATES_FILE)
    entry = pending_after['2000']
    today = datetime.now(timezone.utc).date().isoformat()
    assert entry['first_review_seen'] == today, f"expected first_review_seen={today}, got {entry['first_review_seen']}"
    expected_next = (datetime.now(timezone.utc).date() + timedelta(days=3)).isoformat()
    assert entry['next_check_due'] == expected_next, (
        f"milestone schedule should now anchor at first_review_seen (today), "
        f"expected next_check_due={expected_next}, got {entry['next_check_due']}"
    )
    print(f"  first_review_seen set to today ({today}), next_check_due switched to milestone schedule ({expected_next}): PASS")


def test_awaiting_release_expires_after_180_days_without_any_api_call():
    print("\n" + "=" * 60)
    print("Test: awaiting-release entry past 180 days with zero reviews is exhausted without an API call")
    print("=" * 60)

    entries = {
        '3000': {
            'name': 'Vaporware?',
            'reviewScore': 'No user reviews',
            'totalReviews': 0,
            'game_data': None,
            'first_seen': _iso_days_ago(200),  # well past the 180-day cutoff
            'first_review_seen': None,
            'last_checked': _iso_days_ago(190) + 'T00:00:00+00:00',
            'next_check_due': None,
        }
    }
    setup_pending(entries)

    checked_ids = []

    def fake_review_gate(app_id, session, min_reviews=100, max_retries=3):
        checked_ids.append(app_id)
        return False, 'No user reviews', 0

    with patch.object(steam_catalog.SteamCatalogClient, 'fetch_full_catalog', fake_catalog_no_new), \
         patch.object(discover_new_games, 'KVHelper', FakeKVHelper), \
         patch.object(discover_new_games, 'check_review_gate', fake_review_gate):
        discover_new_games.discover_command(itad_api_key='fake', steam_web_api_key='fake', regions=['JP'])

    assert checked_ids == [], f"expired awaiting-release entry should not be API-checked, but got {checked_ids}"
    pending_after = discover_new_games.load_pending_review_candidates(constants.PENDING_REVIEW_CANDIDATES_FILE)
    exhausted_after = discover_new_games.load_exhausted_review_candidates(constants.EXHAUSTED_REVIEW_CANDIDATES_FILE)
    assert '3000' not in pending_after, "should have moved out of pending"
    assert '3000' in exhausted_after, "should be in the exhausted archive"
    print("  Moved directly to exhausted archive, no API call spent: PASS")


if __name__ == '__main__':
    try:
        test_budget_caps_daily_checks_oldest_first()
        test_first_review_observed_starts_milestone_clock()
        test_awaiting_release_expires_after_180_days_without_any_api_call()

        print("\n" + "=" * 60)
        print("All tests PASSED!")
        print("=" * 60)
    except AssertionError as e:
        print(f"\nTEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        shutil.rmtree(SCRATCH, ignore_errors=True)
