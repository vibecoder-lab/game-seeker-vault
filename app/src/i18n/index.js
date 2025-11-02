import translations from './translations.js';
import { loadSettings } from '../db/settings.js';

// Global locale state
export let currentLocale = 'en';

// Initialize locale without saving (for app initialization)
export function initLocale(locale) {
  currentLocale = locale;
  document.documentElement.lang = locale;
}

// Translation helper function
export function t(key, lang = 'en') {
  return translations[lang]?.[key] || translations['en']?.[key] || key;
}

// Format price with currency symbol based on region
export function formatPrice(price, region = 'USD', locale = 'en') {
  if (price === null || price === undefined || price === 0) {
    return t('price.free', locale);
  }

  switch (region) {
    case 'JPY':
      return `¥${price.toLocaleString('ja-JP')}`;
    case 'USD':
      return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'EUR':
      return `€${price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'GBP':
      return `£${price.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    default:
      return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

// Set locale and update document (without saving)
export function setLocale(locale) {
  currentLocale = locale;
  document.documentElement.lang = locale;
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

// Get saved or detected region
export async function detectRegion() {
  // 1. Check settings store first
  const settings = await loadSettings();
  if (settings.region && ['USD', 'JPY', 'EUR', 'GBP'].includes(settings.region)) {
    return settings.region;
  }

  // 2. Try to detect from API (Cloudflare geo)
  try {
    const response = await fetch('/api/detect-locale');
    if (response.ok) {
      const data = await response.json();
      // Map country to region
      const countryCode = data.country || '';
      if (countryCode === 'JP') return 'JPY';
      if (['GB', 'UK'].includes(countryCode)) return 'GBP';
      if (['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'PT', 'FI', 'IE', 'GR'].includes(countryCode)) return 'EUR';
    }
  } catch (e) {
    console.warn('Failed to detect region from API:', e);
  }

  // 3. Default to USD
  return 'USD';
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
    'Free': 'genre.free',
    'Audio Production': 'genre.audioProduction',
    'Animation & Modeling': 'genre.animationModeling',
    'Design & Illustration': 'genre.designIllustration',
    'Education': 'genre.education',
    'Game Development': 'genre.gameDevelopment',
    'Gore': 'genre.gore',
    'Photo Editing': 'genre.photoEditing',
    'Video Production': 'genre.videoProduction',
    'Web Publishing': 'genre.webPublishing'
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
