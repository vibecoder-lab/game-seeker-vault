#!/usr/bin/env python3
"""
Extract games with score 8+ from review-data_*.json files
"""
import json
from pathlib import Path


def calculate_review_score(positive: int, negative: int) -> int:
    """
    Calculate review score from positive/negative ratio

    Scoring criteria (from claude-research01.md):
    - Score 9: 95%+
    - Score 8: 80-94%
    - Score 7: 70-79%
    - ...
    """
    total = positive + negative
    if total == 0:
        return 0

    ratio = positive / total

    if ratio >= 0.95:
        return 9
    elif ratio >= 0.80:
        return 8
    elif ratio >= 0.70:
        return 7
    elif ratio >= 0.60:
        return 6
    elif ratio >= 0.50:
        return 5
    elif ratio >= 0.40:
        return 4
    elif ratio >= 0.30:
        return 3
    elif ratio >= 0.20:
        return 2
    elif ratio >= 0.10:
        return 1
    else:
        return 0


def main():
    # Input directory
    input_dir = Path("/Volumes/LOGITEC SSD/01_dev/32_steam-game-seeker/data/steamspy-api-data/review-data")

    # Output directory
    output_dir = Path("/Volumes/LOGITEC SSD/01_dev/32_steam-game-seeker/game-seeker-vault/istore-service-data/high-score-games")
    output_dir.mkdir(exist_ok=True)

    total_files_processed = 0
    total_games_found = 0

    # Process review-data_0.json through review-data_86.json
    for i in range(87):
        input_file = input_dir / f"review-data_{i}.json"
        output_file = output_dir / f"score_8_plus_titles_{i}.txt"

        if not input_file.exists():
            print(f"[WARN] {input_file.name} not found, skipping")
            continue

        # Load data
        with open(input_file, 'r') as f:
            games_dict = json.load(f)

        # Extract titles with score 8+ and 100+ total reviews
        high_score_games = []

        for appid, game in games_dict.items():
            positive = game.get('positive', 0)
            negative = game.get('negative', 0)
            total_reviews = positive + negative
            score = calculate_review_score(positive, negative)

            if score >= 8 and total_reviews >= 100:
                title = game.get('name', '')
                if title:
                    high_score_games.append((appid, title))

        # Save to text file (appid + title)
        with open(output_file, 'w', encoding='utf-8') as f:
            for appid, title in high_score_games:
                f.write(f"{appid}\t{title}\n")

        print(f"[SUCCESS] {input_file.name}: {len(high_score_games)} games -> {output_file.name}")
        total_files_processed += 1
        total_games_found += len(high_score_games)

    print(f"[DONE] Processed {total_files_processed} files, found {total_games_found} total games with score >= 8")


if __name__ == '__main__':
    main()
