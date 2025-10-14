// Default settings
export const DEFAULT_SETTINGS = {
  removePriceLimit: false,        // Raise price limit to 20,000 yen
  showTotalPrice: false,          // Show total price
  alwaysShowStarIcon: false,      // Always show star icon
  permanentDelete: false,          // Permanently delete without using trash
  theme: 'default',                // 'default' | 'steam'
  useSelectedFolderAsTarget: false, // Use selected folder as target
  keyboardLayout: 'ansi',          // 'ansi' | 'iso'
  useAlternativeKeys: false,       // Z/X instead of C/T
  saveTheme: false,                // Whether to save theme
  settingsVersion: 1
};

// IndexedDB configuration
export const DB_NAME = 'GameSeekerVaultDB';
export const DB_VERSION = 2;
export const FOLDERS_STORE = 'folders';
export const FAVORITES_STORE = 'favorites';
export const SETTINGS_STORE = 'settings';

// Price band representative prices
export const BAND_REPRESENTATIVE_PRICE_YEN = {
  UNDER_5: 600,
  "5_10": 1200,
  "10_15": 1900
};

// Theme configurations
export const THEMES = {
  default: {
    name: 'デフォルト',
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    textSecondary: 'text-gray-500',
    cardBg: 'bg-white',
    cardShadow: 'shadow',
    buttonBg: 'bg-gray-100',
    buttonActive: 'bg-white shadow',
    tagBg: 'bg-gray-100',
    tagText: 'text-gray-700',
    jpBg: 'bg-blue-100',
    jpText: 'text-blue-700',
    subText: 'text-gray-600',
    border: 'border-gray-200',
    saleText: 'text-red-500',
    saleBg: 'bg-red-500',
    lowestText: 'text-blue-600',
    modalHover: 'hover:bg-gray-200',
    folderSelected: 'bg-gray-200',
    folderHover: 'hover:bg-gray-300',
    iconHover: 'hover:bg-gray-900 hover:text-gray-200'
  },
  steam: {
    name: 'Steam',
    bg: 'bg-slate-800',
    text: 'text-slate-200',
    textSecondary: 'text-slate-400',
    cardBg: 'bg-slate-700',
    cardShadow: 'shadow-lg shadow-black/20',
    buttonBg: 'bg-slate-600',
    buttonActive: 'steam-blue-bg shadow text-white',
    tagBg: 'bg-slate-600',
    tagText: 'text-slate-200',
    jpBg: 'steam-blue-bg',
    jpText: 'text-white',
    subText: 'text-slate-300',
    border: 'border-slate-600',
    saleText: 'text-orange-600',
    saleBg: 'bg-orange-600',
    lowestText: 'steam-blue-lighter',
    modalHover: 'hover:bg-slate-500',
    folderSelected: 'bg-slate-600',
    folderHover: 'hover:bg-slate-500',
    iconHover: 'hover:bg-slate-900 hover:text-slate-400'
  }
};

// Steam tags to exclude
export const STEAM_TAGS_TO_EXCLUDE = [];
