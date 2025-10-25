import { t, currentLocale } from '../i18n/index.js';
import { translateGenre, translateReview } from '../i18n/index.js';
import { STEAM_TAGS_TO_EXCLUDE } from '../constants/index.js';

// Date format function
export const formatDateTime = (timestamp) => {
  const d = new Date(timestamp);
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
};

// Normalize genres array
export const normalizeGenres = (genres) => {
  if (!Array.isArray(genres)) return [t('genre.other', currentLocale)];
  const gameGenres = genres.filter(genre => !STEAM_TAGS_TO_EXCLUDE.includes(genre));
  const normalizedGenres = gameGenres.map(genre => translateGenre(genre, currentLocale));
  const uniqueGenres = Array.from(new Set(normalizedGenres));
  return uniqueGenres.length > 0 ? uniqueGenres : [t('genre.other', currentLocale)];
};

// Translate review score
export const translateReviewScore = (score) => {
  if (!score) return null;
  return translateReview(score, currentLocale);
};

// Format Steam release date
export const formatReleaseDate = (dateStr) => {
  if (!dateStr || dateStr === '-') return dateStr;

  // Parse Steam format date (DD Mon, YYYY)
  const monthMap = {
    'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
    'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
  };

  const match = dateStr.match(/^(\d{1,2})\s+([A-Za-z]+),\s+(\d{4})/);
  if (match) {
    const [_, day, monthStr, year] = match;
    const month = monthMap[monthStr];
    if (month) {
      return `${year}年${month}月${parseInt(day)}日`;
    }
  }

  // Parse ISO format date (YYYY-MM-DD)
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [_, year, month, day] = isoMatch;
    return `${year}年${parseInt(month)}月${parseInt(day)}日`;
  }

  // Return other formats as-is
  return dateStr;
};

// Check Japanese language support
export const checkJapaneseSupport = (supportedLanguages) => {
  if (!supportedLanguages) return t('language.unknown', currentLocale);
  const lower = supportedLanguages.toLowerCase();
  if (lower.includes('japanese') || lower.includes('日本語')) {
    return t('language.supported', currentLocale);
  }
  return t('language.notSupported', currentLocale);
};

// Clean language text (remove HTML)
export const cleanLanguageText = (text) => {
  if (!text) return '';
  // Remove HTML tags and convert audio markers to text
  return text
    .replace(/<strong>\*<\/strong>/g, t('language.audio', currentLocale))
    .replace(/<br>/g, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

// String cut considering character width (half-width: 1, full-width: 2)
export const truncateByWidth = (text, maxWidth) => {
  let width = 0;
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    // Full-width characters: 2, half-width characters: 1
    const charWidth = char.match(/[^\x01-\x7E\uFF65-\uFF9F]/) ? 2 : 1;
    if (width + charWidth > maxWidth) {
      return result + '...';
    }
    width += charWidth;
    result += char;
  }
  return result;
};

// Format yen price
export const yen = (v) => `¥${(v ?? 0).toLocaleString()}`;

// Get unique array items
export const unique = (arr) => Array.from(new Set(arr));

// Get localized folder name for initial folders
export const getLocalizedFolderName = (folderName, locale) => {
  // Map of initial folder names (both en and ja)
  const initialFolderMap = {
    'Interested List': 'folder.default.interested',
    '気になるリスト': 'folder.default.interested',
    'Wishlist': 'folder.default.wishlist',
    '購入予定リスト': 'folder.default.wishlist',
    'Owned Games': 'folder.default.owned',
    '所有しているゲーム': 'folder.default.owned',
    'Owned List': 'folder.default.owned_list',
    '所有リスト': 'folder.default.owned_list'
  };

  const translationKey = initialFolderMap[folderName];
  if (translationKey) {
    return t(translationKey, locale);
  }
  return folderName;
};
