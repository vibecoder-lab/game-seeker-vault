#!/usr/bin/env python3
"""
Backfill-awaiting-release test script

Verifies backfill_awaiting_release_command() (the one-time, manually-run
catch-up for App IDs already present in the catalog snapshot before
--discover started tracking them -- diff_new_appids() never flags these as
"new" regardless of release status):

- App IDs already tracked anywhere (KV/pending/exhausted/rejected) are
  excluded from the backfill target set.
- A checked App ID with total_reviews > 0 gets first_review_seen set and a
  milestone-schedule next_check_due (post-release phase); one with
  total_reviews == 0 stays in the awaiting-release phase (first_review_seen
  still None), ready to join the normal daily budget rotation.
- The command is resumable with no dedicated checkpoint: re-running it after
  a partial run only processes what's still untracked.
- Every check is appended to review_gate_check_log.jsonl with phase='backfill'.
"""

import sys
import json
import shutil
import importlib
from pathlib import Path
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))

import constants

SCRATCH = Path(__file__).parent / '_test_scratch_backfill'
if SCRATCH.exists():
    shutil.rmtree(SCRATCH)
SCRATCH.mkdir(parents=True, exist_ok=True)

constants.STEAM_APPLIST_SNAPSHOT_FILE = str(SCRATCH / 'snapshot.json')
constants.PENDING_REVIEW_CANDIDATES_FILE = str(SCRATCH / 'pending_review_candidates.json')
constants.EXHAUSTED_REVIEW_CANDIDATES_FILE = str(SCRATCH / 'exhausted_review_candidates.json')
constants.REJECTED_APPIDS_FILE = str(SCRATCH / 'rejected_appids.txt')
constants.REVIEW_GATE_CHECK_LOG_FILE = str(SCRATCH / 'review_gate_check_log.jsonl')
constants.PENDING_NEW_GAMES_DIR = str(SCRATCH / 'pending_new_games')

import steam_catalog
importlib.reload(steam_catalog)
import discover_new_games
importlib.reload(discover_new_games)


class FakeKVHelper:
    def __init__(self, use_kv=True):
        pass

    def get_games_data(self):
        return [{'id': '50'}]  # App ID 50 already in KV


def reset_scratch_state():
    for f in (
        constants.PENDING_REVIEW_CANDIDATES_FILE,
        constants.EXHAUSTED_REVIEW_CANDIDATES_FILE,
        constants.REJECTED_APPIDS_FILE,
        constants.REVIEW_GATE_CHECK_LOG_FILE,
    ):
        p = Path(f)
        if p.exists():
            p.unlink()


def test_already_tracked_appids_excluded_from_backfill():
    print("=" * 60)
    print("Test: App IDs already in KV/pending/exhausted/rejected are excluded")
    print("=" * 60)

    reset_scratch_state()
    snapshot = {str(aid): f"Game {aid}" for aid in range(10, 20)}  # 10 entries: 10..19
    steam_catalog.save_snapshot(snapshot, constants.STEAM_APPLIST_SNAPSHOT_FILE)

    discover_new_games.save_pending_review_candidates({'11': {'name': 'Already pending'}})
    discover_new_games.save_exhausted_review_candidates({'12': {'name': 'Already exhausted'}})
    Path(constants.REJECTED_APPIDS_FILE).parent.mkdir(parents=True, exist_ok=True)
    Path(constants.REJECTED_APPIDS_FILE).write_text('13\n', encoding='utf-8')
    # '50' (not in this snapshot, irrelevant) is "in KV" per FakeKVHelper; '10' is not.

    checked_ids = []

    def fake_review_gate(app_id, session, min_reviews=100, max_retries=3):
        checked_ids.append(app_id)
        return False, 'No user reviews', 0

    with patch.object(discover_new_games, 'KVHelper', FakeKVHelper), \
         patch.object(discover_new_games, 'check_review_gate', fake_review_gate):
        result = discover_new_games.backfill_awaiting_release_command(save_every=100)

    # 10 total in snapshot minus 11 (pending), 12 (exhausted), 13 (rejected) = 7 remain
    assert sorted(checked_ids) == ['10', '14', '15', '16', '17', '18', '19'], \
        f"expected the 7 untracked App IDs to be checked, got {sorted(checked_ids)}"
    assert result['processed'] == 7
    print(f"  Correctly excluded already-tracked App IDs, checked only: {sorted(checked_ids)}: PASS")


def test_classification_by_review_count():
    print("\n" + "=" * 60)
    print("Test: total_reviews>0 -> post-release phase; total_reviews==0 -> awaiting-release")
    print("=" * 60)

    reset_scratch_state()
    snapshot = {'100': 'Released Game', '200': 'Coming Soon Game'}
    steam_catalog.save_snapshot(snapshot, constants.STEAM_APPLIST_SNAPSHOT_FILE)

    def fake_review_gate(app_id, session, min_reviews=100, max_retries=3):
        if app_id == '100':
            return False, 'Mixed', 42  # released, has reviews, but doesn't pass the gate
        return False, 'No user reviews', 0  # still coming soon

    with patch.object(discover_new_games, 'KVHelper', FakeKVHelper), \
         patch.object(discover_new_games, 'check_review_gate', fake_review_gate):
        discover_new_games.backfill_awaiting_release_command(save_every=100)

    pending = discover_new_games.load_pending_review_candidates(constants.PENDING_REVIEW_CANDIDATES_FILE)
    today = datetime.now(timezone.utc).date().isoformat()

    assert pending['100']['first_review_seen'] == today, "released title should get first_review_seen set"
    assert pending['100']['next_check_due'] == (datetime.now(timezone.utc).date() + timedelta(days=3)).isoformat(), \
        "should be on the normal milestone schedule now"
    print("  Title with existing reviews correctly enters post-release milestone tracking: PASS")

    assert pending['200']['first_review_seen'] is None, "still-unreleased title should stay in awaiting-release phase"
    assert pending['200']['next_check_due'] is None
    print("  Title with zero reviews correctly stays in awaiting-release phase: PASS")

    log_path = Path(constants.REVIEW_GATE_CHECK_LOG_FILE)
    assert log_path.exists(), "review_gate_check_log.jsonl should have been written"
    records = [json.loads(line) for line in log_path.read_text(encoding='utf-8').splitlines()]
    assert len(records) == 2 and all(r['phase'] == 'backfill' for r in records), \
        f"expected 2 records tagged phase='backfill', got {records}"
    print("  review_gate_check_log.jsonl correctly tagged phase='backfill': PASS")


def test_resumable_across_interrupted_runs():
    print("\n" + "=" * 60)
    print("Test: re-running the command after a partial run only processes what's left")
    print("=" * 60)

    reset_scratch_state()
    snapshot = {str(aid): f"Game {aid}" for aid in range(1, 6)}  # 5 entries
    steam_catalog.save_snapshot(snapshot, constants.STEAM_APPLIST_SNAPSHOT_FILE)

    call_log = []

    def fake_review_gate(app_id, session, min_reviews=100, max_retries=3):
        call_log.append(app_id)
        return False, 'No user reviews', 0

    with patch.object(discover_new_games, 'KVHelper', FakeKVHelper), \
         patch.object(discover_new_games, 'check_review_gate', fake_review_gate):
        result1 = discover_new_games.backfill_awaiting_release_command(save_every=100)
        assert result1['processed'] == 5
        # Simulate a second, later invocation (e.g. resuming after an
        # earlier interruption) -- nothing should be left to do, and no
        # App ID should be re-checked.
        call_log.clear()
        result2 = discover_new_games.backfill_awaiting_release_command(save_every=100)

    assert result2['processed'] == 0, f"second run should have nothing left to process, got {result2}"
    assert call_log == [], f"second run should not re-check any already-classified App ID, got {call_log}"
    print("  Second invocation correctly finds nothing left to do (already classified): PASS")


if __name__ == '__main__':
    try:
        test_already_tracked_appids_excluded_from_backfill()
        test_classification_by_review_count()
        test_resumable_across_interrupted_runs()

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
