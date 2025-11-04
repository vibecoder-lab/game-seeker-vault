#!/usr/bin/env python3
"""
Extract games from HTML calendar and filter by Steam review scores
"""

import json
import logging
import re
import time
import random
from pathlib import Path
from bs4 import BeautifulSoup
import requests

logger = logging.getLogger(__name__)

USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

class GameExtractor:
    def __init__(self, refs_dir):
        self.refs_dir = Path(refs_dir)
        self.session = requests.Session()
        self.session.headers.update({'User-Agent': USER_AGENT})

    def find_html_file(self):
        """Find HTML file in refs directory"""
        html_files = list(self.refs_dir.glob('*.html'))

        if len(html_files) == 0:
            logger.error(f"No HTML files found in {self.refs_dir}")
            return None
        elif len(html_files) > 1:
            logger.error(f"Multiple HTML files found in {self.refs_dir}: {[f.name for f in html_files]}")
            logger.error("Please keep only one HTML file")
            return None

        logger.info(f"Found HTML file: {html_files[0].name}")
        return html_files[0]

    def extract_games_from_html(self, html_path):
        """Extract App IDs and titles from HTML file

        Returns:
            List of tuples: [(app_id, title), ...]
        """
        logger.info(f"Parsing HTML file: {html_path}")

        with open(html_path, 'r', encoding='utf-8') as f:
            soup = BeautifulSoup(f, 'html.parser')

        games = []
        game_divs = soup.find_all('div', class_='calendar__game')

        logger.info(f"Found {len(game_divs)} game entries in HTML")

        for game_div in game_divs:
            try:
                img = game_div.find('img')
                if not img:
                    continue

                # Extract title from alt attribute
                title = img.get('alt', '').strip()
                if not title:
                    continue

                # Extract App ID from image URL
                # Format: https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3436030/header.jpg
                img_src = img.get('src', '')
                match = re.search(r'/steam/apps/(\d+)/', img_src)
                if not match:
                    logger.warning(f"Could not extract App ID for: {title}")
                    continue

                app_id = match.group(1)
                games.append((app_id, title))

            except Exception as e:
                logger.warning(f"Error parsing game entry: {e}")
                continue

        logger.info(f"Successfully extracted {len(games)} games")
        return games

    def get_review_score(self, app_id):
        """Get review score from Steam Reviews API

        Args:
            app_id: Steam App ID

        Returns:
            tuple: (review_score_desc, total_reviews) or (None, None)
        """
        url = f"https://store.steampowered.com/appreviews/{app_id}?json=1&purchase_type=all&language=all"

        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = self.session.get(url, timeout=10)

                if response.status_code == 429:
                    if attempt < max_retries - 1:
                        wait_time = 2 ** (attempt + 1)
                        logger.warning(f"Rate limited (429) for App ID {app_id}, retrying after {wait_time}s")
                        time.sleep(wait_time)
                        continue
                    else:
                        logger.error(f"Rate limited (429) for App ID {app_id}, max retries exceeded")
                        return None, None

                if response.status_code != 200:
                    logger.warning(f"HTTP {response.status_code} for App ID {app_id}")
                    return None, None

                data = response.json()

                if data.get('success') != 1:
                    logger.warning(f"API returned success=0 for App ID {app_id}")
                    return None, None

                query_summary = data.get('query_summary', {})
                review_score_desc = query_summary.get('review_score_desc')
                total_reviews = query_summary.get('total_reviews', 0)

                if not review_score_desc:
                    logger.warning(f"No review_score_desc for App ID {app_id}")
                    return None, None

                return review_score_desc, total_reviews

            except requests.exceptions.Timeout:
                if attempt < max_retries - 1:
                    logger.warning(f"Timeout for App ID {app_id}, retrying...")
                    time.sleep(1)
                    continue
                else:
                    logger.error(f"Timeout for App ID {app_id}, max retries exceeded")
                    return None, None
            except Exception as e:
                logger.error(f"Error fetching review for App ID {app_id}: {e}")
                return None, None

        return None, None

    def filter_by_review_score(self, games, min_reviews=100):
        """Filter games by review score (Very Positive or better) and minimum review count

        Args:
            games: List of tuples [(app_id, title), ...]
            min_reviews: Minimum number of reviews required (default: 100)

        Returns:
            List of tuples with high review scores
        """
        logger.info(f"Filtering {len(games)} games by review score (Very Positive or better) and min {min_reviews} reviews...")

        target_scores = {'Overwhelmingly Positive', 'Very Positive'}
        filtered_games = []

        for i, (app_id, title) in enumerate(games, 1):
            logger.info(f"[{i}/{len(games)}] Checking: {app_id} {title}")

            review_score, total_reviews = self.get_review_score(app_id)

            if review_score in target_scores and total_reviews >= min_reviews:
                logger.info(f"  ✓ {review_score}, {total_reviews} reviews - Added")
                filtered_games.append((app_id, title))
            else:
                reason = f"{review_score or 'No score'}, {total_reviews} reviews" if total_reviews else (review_score or 'No score')
                logger.info(f"  ✗ {reason} - Skipped")

            # Rate limiting: wait between requests
            if i < len(games):
                wait_time = random.uniform(1.0, 1.5)
                time.sleep(wait_time)

        logger.info(f"Filtered to {len(filtered_games)} games with Very Positive or better and {min_reviews}+ reviews")
        return filtered_games

    def save_games_list(self, games, output_path):
        """Save games list to file

        Args:
            games: List of tuples [(app_id, title), ...]
            output_path: Output file path
        """
        output_path = Path(output_path)

        with open(output_path, 'w', encoding='utf-8') as f:
            for app_id, title in games:
                f.write(f"{app_id}\t{title}\n")

        logger.info(f"Saved {len(games)} games to: {output_path}")


def extract_command(refs_dir):
    """Main extraction command

    Args:
        refs_dir: Path to refs directory
    """
    extractor = GameExtractor(refs_dir)

    # Step 1: Find HTML file
    html_path = extractor.find_html_file()
    if not html_path:
        return False

    # Step 2: Extract games from HTML
    games = extractor.extract_games_from_html(html_path)
    if not games:
        logger.error("No games extracted from HTML")
        return False

    # Save raw list
    raw_output = refs_dir / 'raw_game_title_list.txt'
    extractor.save_games_list(games, raw_output)

    # Step 3: Filter by review score
    filtered_games = extractor.filter_by_review_score(games)

    # Save filtered list
    pre_output = refs_dir / 'pre_game_title_list.txt'
    extractor.save_games_list(filtered_games, pre_output)

    logger.info("=" * 60)
    logger.info("Extraction completed successfully")
    logger.info(f"Total games extracted: {len(games)}")
    logger.info(f"Games with Very Positive or better: {len(filtered_games)}")
    logger.info("=" * 60)

    return True
