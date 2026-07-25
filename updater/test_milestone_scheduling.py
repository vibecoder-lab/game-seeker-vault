#!/usr/bin/env python3
"""
Milestone-based review re-check scheduling test script

Verifies _is_due()/_compute_next_check_due() correctly implement the
3/7/30/180-day milestone schedule for pending review candidates: a
candidate is only re-checked on those specific milestone days (not every
day), and stops being auto-checked entirely once it's past the last
milestone (an accepted, deliberate limitation -- see
DISCOVERY_REVIEW_CHECK_MILESTONES_DAYS in constants.py).
"""

import sys
from pathlib import Path
from datetime import date, timedelta

sys.path.insert(0, str(Path(__file__).parent))

from discover_new_games import _is_due, _compute_next_check_due
from constants import DISCOVERY_REVIEW_CHECK_MILESTONES_DAYS

FIRST_SEEN = date(2026, 1, 1)


def test_milestone_progression():
    print("=" * 60)
    print("Test: milestone progression (3 -> 7 -> 30 -> 180 -> exhausted)")
    print("=" * 60)

    assert DISCOVERY_REVIEW_CHECK_MILESTONES_DAYS == [3, 7, 30, 180], \
        f"test assumes the default milestone schedule, got {DISCOVERY_REVIEW_CHECK_MILESTONES_DAYS}"

    # Day 0: freshly discovered, first check fails
    next_due = _compute_next_check_due(FIRST_SEEN, FIRST_SEEN)
    assert next_due == (FIRST_SEEN + timedelta(days=3)).isoformat()
    print("  Day 0 -> scheduled for day 3: PASS")

    # Days 1-2: not due yet
    for offset in (1, 2):
        today = FIRST_SEEN + timedelta(days=offset)
        assert not _is_due({'next_check_due': next_due}, today), f"should not be due at day {offset}"
    print("  Days 1-2 -> not due: PASS")

    # Day 3: due; fails again -> scheduled for day 7
    today = FIRST_SEEN + timedelta(days=3)
    assert _is_due({'next_check_due': next_due}, today)
    next_due = _compute_next_check_due(FIRST_SEEN, today)
    assert next_due == (FIRST_SEEN + timedelta(days=7)).isoformat()
    print("  Day 3 -> due, fails -> scheduled for day 7: PASS")

    # Day 7: due; fails again -> scheduled for day 30
    today = FIRST_SEEN + timedelta(days=7)
    assert _is_due({'next_check_due': next_due}, today)
    next_due = _compute_next_check_due(FIRST_SEEN, today)
    assert next_due == (FIRST_SEEN + timedelta(days=30)).isoformat()
    print("  Day 7 -> due, fails -> scheduled for day 30: PASS")

    # Day 30: due; fails again -> scheduled for day 180
    today = FIRST_SEEN + timedelta(days=30)
    assert _is_due({'next_check_due': next_due}, today)
    next_due = _compute_next_check_due(FIRST_SEEN, today)
    assert next_due == (FIRST_SEEN + timedelta(days=180)).isoformat()
    print("  Day 30 -> due, fails -> scheduled for day 180: PASS")

    # Day 180: due; fails again -> exhausted, no more auto-checks
    today = FIRST_SEEN + timedelta(days=180)
    assert _is_due({'next_check_due': next_due}, today)
    next_due = _compute_next_check_due(FIRST_SEEN, today)
    assert next_due == 'exhausted'
    print("  Day 180 -> due, fails -> exhausted: PASS")

    # Once exhausted, never due again -- even 5 years later. This is the
    # deliberate, accepted long-tail limitation (see constants.py comment).
    far_future = FIRST_SEEN + timedelta(days=365 * 5)
    assert not _is_due({'next_check_due': 'exhausted'}, far_future)
    print("  5 years later, exhausted entry still not due: PASS (accepted limitation)")

    print("  PASS")


def test_unscheduled_entries_are_due_immediately():
    print("\n" + "=" * 60)
    print("Test: entries with no schedule yet (force-include, legacy) are due now")
    print("=" * 60)

    assert _is_due({}, FIRST_SEEN)
    assert _is_due({'next_check_due': None}, FIRST_SEEN)
    print("  PASS")


if __name__ == '__main__':
    try:
        test_milestone_progression()
        test_unscheduled_entries_are_due_immediately()

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
