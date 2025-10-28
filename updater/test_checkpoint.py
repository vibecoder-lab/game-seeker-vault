#!/usr/bin/env python3
"""
Checkpoint save/load test script
Tests the fixed checkpoint logic
"""

import json
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from game_data_builder import GameDataBuilder

# Mock constants for testing
import constants
original_checkpoint_dir = constants.CHECKPOINT_DIR
constants.CHECKPOINT_DIR = 'updater/test_data/checkpoints'

def create_mock_game(app_id):
    """Create a mock game data"""
    return {
        'id': app_id,
        'title': f'Test Game {app_id}',
        'itadId': f'test-{app_id}',
        'storeUrl': f'https://store.steampowered.com/app/{app_id}/',
        'imageUrl': f'https://cdn.example.com/{app_id}.jpg',
        'deal': {'JP': {'price': 1000, 'regular': 2000, 'cut': 50, 'storeLow': 500}}
    }

def test_checkpoint_save():
    """Test checkpoint saving logic"""
    print("="*60)
    print("Test 1: Checkpoint Save Logic")
    print("="*60)

    # Clean test directory
    test_dir = Path(constants.CHECKPOINT_DIR)
    if test_dir.exists():
        for f in test_dir.glob('*.json'):
            f.unlink()
    test_dir.mkdir(parents=True, exist_ok=True)

    builder = GameDataBuilder(itad_api_key='test')

    # Test 1: Save first 100 games (should create checkpoint_1000.json)
    print("\n[Test 1-1] Save 100 games")
    games_batch_1 = [create_mock_game(i) for i in range(1, 101)]
    checkpoint_file = builder._save_checkpoint(games_batch_1, 100)
    print(f"  Saved to: {checkpoint_file}")

    with open(checkpoint_file, 'r') as f:
        data = json.load(f)
    print(f"  File contains: {len(data)} games")
    assert len(data) == 100, f"Expected 100 games, got {len(data)}"
    assert checkpoint_file.name == 'games_checkpoint_1000.json', f"Wrong filename: {checkpoint_file.name}"
    print("  ✓ PASS")

    # Test 2: Save next 100 games (should append to checkpoint_1000.json)
    print("\n[Test 1-2] Save another 100 games (append)")
    games_batch_2 = [create_mock_game(i) for i in range(101, 201)]
    checkpoint_file = builder._save_checkpoint(games_batch_2, 200)
    print(f"  Saved to: {checkpoint_file}")

    with open(checkpoint_file, 'r') as f:
        data = json.load(f)
    print(f"  File contains: {len(data)} games")
    assert len(data) == 200, f"Expected 200 games, got {len(data)}"
    assert checkpoint_file.name == 'games_checkpoint_1000.json', f"Wrong filename: {checkpoint_file.name}"
    print("  ✓ PASS")

    # Test 3: Save games 201-300 (should append to checkpoint_1000.json)
    print("\n[Test 1-3] Save another 100 games (append)")
    games_batch_3 = [create_mock_game(i) for i in range(201, 301)]
    checkpoint_file = builder._save_checkpoint(games_batch_3, 300)
    print(f"  Saved to: {checkpoint_file}")

    with open(checkpoint_file, 'r') as f:
        data = json.load(f)
    print(f"  File contains: {len(data)} games")
    assert len(data) == 300, f"Expected 300 games, got {len(data)}"
    assert checkpoint_file.name == 'games_checkpoint_1000.json', f"Wrong filename: {checkpoint_file.name}"
    print("  ✓ PASS")

    # Test 4: Save games 901-1000 (should append to checkpoint_1000.json)
    print("\n[Test 1-4] Save games 901-1000 (append)")
    games_batch_10 = [create_mock_game(i) for i in range(901, 1001)]
    checkpoint_file = builder._save_checkpoint(games_batch_10, 1000)
    print(f"  Saved to: {checkpoint_file}")

    with open(checkpoint_file, 'r') as f:
        data = json.load(f)
    print(f"  File contains: {len(data)} games")
    assert len(data) == 400, f"Expected 400 games (300 from before + 100 now), got {len(data)}"
    assert checkpoint_file.name == 'games_checkpoint_1000.json', f"Wrong filename: {checkpoint_file.name}"
    print("  ✓ PASS")

    # Test 5: Save games 1001-1100 (should create NEW checkpoint_2000.json)
    print("\n[Test 1-5] Save games 1001-1100 (new file)")
    games_batch_11 = [create_mock_game(i) for i in range(1001, 1101)]
    checkpoint_file = builder._save_checkpoint(games_batch_11, 1100)
    print(f"  Saved to: {checkpoint_file}")

    with open(checkpoint_file, 'r') as f:
        data = json.load(f)
    print(f"  File contains: {len(data)} games")
    assert len(data) == 100, f"Expected 100 games (new file), got {len(data)}"
    assert checkpoint_file.name == 'games_checkpoint_2000.json', f"Wrong filename: {checkpoint_file.name}"
    print("  ✓ PASS")

    # Verify checkpoint_1000.json wasn't overwritten
    checkpoint_1000 = test_dir / 'games_checkpoint_1000.json'
    with open(checkpoint_1000, 'r') as f:
        data_1000 = json.load(f)
    print(f"\n  Verification: checkpoint_1000.json still has {len(data_1000)} games")
    assert len(data_1000) == 400, f"checkpoint_1000.json was corrupted! Expected 400, got {len(data_1000)}"
    print("  ✓ PASS - checkpoint_1000.json not overwritten")

    print("\n" + "="*60)
    print("All tests PASSED!")
    print("="*60)

if __name__ == '__main__':
    try:
        test_checkpoint_save()
    except AssertionError as e:
        print(f"\n✗ TEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        # Restore original constant
        constants.CHECKPOINT_DIR = original_checkpoint_dir
