// Review score mapping (English to Japanese)
export const REVIEW_SCORE_MAPPING = {
  'Overwhelmingly Positive': '圧倒的に好評',
  'Very Positive': '非常に好評',
  'Positive': '好評',
  'Mostly Positive': 'やや好評',
  'Mixed': '賛否両論',
  'Mostly Negative': 'やや不評',
  'Negative': '不評',
  'Very Negative': '非常に不評',
  'Overwhelmingly Negative': '圧倒的に不評',
  'No user reviews': 'ユーザーレビューなし'
};

// Scores allowed on general listing/browsing surfaces (site curation policy).
// Mirrors the backend's ALLOWED_REVIEW_SCORES in updater/constants.py.
// The Collection feature is intentionally exempt (see main.jsx) since a game
// could only ever be added while it still qualified.
export const ALLOWED_REVIEW_SCORES = ['Very Positive', 'Overwhelmingly Positive'];
