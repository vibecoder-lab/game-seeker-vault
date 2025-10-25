import translations from './translations.js';
import { loadSettings, saveSettings } from '../db/settings.js';

// Global locale state
export let currentLocale = 'en';

// Translation helper function
export function t(key, lang = 'en') {
  return translations[lang]?.[key] || translations['en']?.[key] || key;
}

// Format price with currency symbol based on locale
export function formatPrice(price, locale = 'en') {
  if (price === null || price === undefined || price === 0) {
    return t('price.free', locale);
  }

  if (locale === 'ja') {
    return `¥${price.toLocaleString('ja-JP')}`;
  } else {
    // For USD approximation (divide yen by 150)
    const usd = (price / 150).toFixed(2);
    return `$${usd}`;
  }
}

// Format year with suffix based on locale
export function formatYear(year, locale = 'en') {
  const suffix = translations[locale]?.['filter.yearSuffix'] || translations['en']?.['filter.yearSuffix'] || '';
  return String(year) + suffix;
}

// Format date based on locale
export function formatDate(dateString, locale = 'en') {
  if (!dateString) return t('language.unknown', locale);

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    if (locale === 'ja') {
      return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
    } else {
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }
  } catch (e) {
    return dateString;
  }
}

// Set locale and update document
export async function setLocale(locale) {
  currentLocale = locale;
  document.documentElement.lang = locale;

  // Save to settings store
  const settings = await loadSettings();
  await saveSettings({ ...settings, locale });

  // Trigger re-render (will be handled by React state)
  return locale;
}

// Get saved or detected locale
export async function detectLocale() {
  // 1. Check settings store first
  const settings = await loadSettings();
  if (settings.locale && translations[settings.locale]) {
    return settings.locale;
  }

  // 2. Check browser language
  const browserLang = navigator.language.split('-')[0];
  if (translations[browserLang]) {
    return browserLang;
  }

  // 3. Try to detect from API (Cloudflare geo)
  try {
    const response = await fetch('/api/detect-locale');
    if (response.ok) {
      const data = await response.json();
      // Prefer browser lang over geo detection for better accuracy
      if (translations[data.browserLang]) {
        return data.browserLang;
      }
      if (translations[data.suggestedLang]) {
        return data.suggestedLang;
      }
    }
  } catch (e) {
    console.warn('Failed to detect locale from API:', e);
  }

  // 4. Default to English
  return 'en';
}

// Translate genre name
export function translateGenre(genre, locale = 'en') {
  const genreKeyMap = {
    'Action': 'genre.action',
    'Adventure': 'genre.adventure',
    'RPG': 'genre.rpg',
    'Strategy': 'genre.strategy',
    'Simulation': 'genre.simulation',
    'Casual': 'genre.casual',
    'Indie': 'genre.indie',
    'Free To Play': 'genre.freeToPlay',
    'Sports': 'genre.sports',
    'Racing': 'genre.racing',
    'Massively Multiplayer': 'genre.mmo',
    'Early Access': 'genre.earlyAccess',
    'Other': 'genre.other',
    'Utilities': 'genre.utilities',
    'Free': 'genre.free'
  };
  const key = genreKeyMap[genre];
  return key ? t(key, locale) : genre;
}

// Translate review score
export function translateReview(review, locale = 'en') {
  const reviewKeyMap = {
    'Overwhelmingly Positive': 'review.overwhelminglyPositive',
    'Very Positive': 'review.veryPositive',
    'Positive': 'review.positive',
    'Mostly Positive': 'review.mostlyPositive',
    'Mixed': 'review.mixed',
    'Mostly Negative': 'review.mostlyNegative',
    'Negative': 'review.negative',
    'Very Negative': 'review.veryNegative',
    'Overwhelmingly Negative': 'review.overwhelminglyNegative',
    'No user reviews': 'review.noReviews'
  };
  const key = reviewKeyMap[review];
  return key ? t(key, locale) : review;
}
