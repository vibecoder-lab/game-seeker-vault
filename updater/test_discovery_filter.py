#!/usr/bin/env python3
"""
is_leaked_non_game_title() regression test script

Cases below are the exact titles used to empirically verify the suffix/
bracket-anchored filter design during the new-game discovery investigation:
9 legitimate titles that a naive substring match would wrongly exclude, and
10 real demo/soundtrack titles that leaked into IStoreService/GetAppList's
include_games=true results in a live sample.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from game_data_builder import is_leaked_non_game_title

# Legitimate titles containing filter keywords as substrings/whole words,
# but not as a demo/soundtrack suffix -- must NOT be excluded
LEGITIMATE_TITLES = [
    "The Testament of Sherlock Holmes",
    "Contest of Heroes",
    "Protest Simulator",
    "Music Man Adventures",
    "Demolition Derby",
    "Democracy 4",
    "Kingdom Come: Deliverance",
    "Expansion of Rome",
    "Beta Colony",
]

# Real titles observed leaking into IStoreService/GetAppList's
# include_games=true results -- must be excluded
LEAKED_NON_GAME_TITLES = [
    "Atooms to Moolecules Demo",
    "Rail Adventures - VR Tech Demo",
    "Multiplayer FPS Demo",
    "the jester's revenge (Demo)",
    "Final Crash Demo",
    "MetaWare High School (Demo)",
    "Sinless + OST",
    "SteamWorld Quest: Hand of Gilgamech - Soundtrack",
    "Up on the Rooftop Soundtrack",
]

# Known accepted gap: keyword not at the very end of the title.
# Not included in the pass/fail assertions below -- documented as a known
# residual miss that the PR review step is the backstop for.
KNOWN_MISSED_LEAK = "We Happy Few - Soundtrack and Digital Goods Bundle"


def test_legitimate_titles_are_kept():
    print("=" * 60)
    print("Test 1: Legitimate titles must NOT be excluded")
    print("=" * 60)

    for title in LEGITIMATE_TITLES:
        result = is_leaked_non_game_title(title)
        print(f"  {'EXCLUDED (FAIL)' if result else 'kept (OK)      '} | {title}")
        assert not result, f"False positive: '{title}' was wrongly excluded"

    print("  PASS")


def test_leaked_titles_are_excluded():
    print("\n" + "=" * 60)
    print("Test 2: Real leaked demo/soundtrack titles must be excluded")
    print("=" * 60)

    for title in LEAKED_NON_GAME_TITLES:
        result = is_leaked_non_game_title(title)
        print(f"  {'excluded (OK)   ' if result else 'KEPT (FAIL)     '} | {title}")
        assert result, f"False negative: '{title}' was not excluded"

    print("  PASS")


def test_known_gap_is_documented():
    print("\n" + "=" * 60)
    print("Test 3: Known residual gap (documented, not a regression)")
    print("=" * 60)

    result = is_leaked_non_game_title(KNOWN_MISSED_LEAK)
    print(f"  {'excluded' if result else 'kept (expected - known gap)'} | {KNOWN_MISSED_LEAK}")
    # Deliberately no assertion: this title is a known, accepted miss.
    # If a future change happens to catch it too, that's a welcome bonus,
    # not a requirement.


if __name__ == '__main__':
    try:
        test_legitimate_titles_are_kept()
        test_leaked_titles_are_excluded()
        test_known_gap_is_documented()

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
