import React from 'react';
import { t, currentLocale, setLocale } from '../../i18n/index.js';
import { dbHelper } from '../../db/index.js';
import { FOLDER_NAME_TO_KEY } from '../../utils/format.js';

export function LanguageRegionModal({ theme, currentRegion, setCurrentRegion, setForceUpdate, onClose, setMinPrice, setMaxPrice }) {
  const handleLanguageChange = async (locale) => {
    await setLocale(locale);

    // Update IndexedDB folder names for 4 default folders
    const folders = await dbHelper.getFolders();
    const translationKeys = ['folder.default.interested', 'folder.default.wishlist', 'folder.default.sale_watch', 'folder.default.owned_list'];

    for (const folder of folders) {
      const key = FOLDER_NAME_TO_KEY[folder.name];
      if (key && translationKeys.includes(key)) {
        const newName = t(key, locale);
        await dbHelper.updateFolder(folder.id, newName);
      }
    }

    setForceUpdate(prev => prev + 1);
  };

  const handleRegionChange = async (region) => {
    setCurrentRegion(region);
    const settings = await dbHelper.loadSettings();
    await dbHelper.saveSettings({ ...settings, region });

    // Reset price range based on new region
    if (region === 'JPY') {
      setMinPrice(100);
      setMaxPrice(3000);
    } else {
      // USD, EUR, GBP
      setMinPrice(1);
      setMaxPrice(50);
    }

    setForceUpdate(prev => prev + 1);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 modal-fade-in" onClick={onClose}>
      <div className={`${theme.cardBg} rounded-2xl max-w-sm w-full flex flex-col ${theme.cardShadow}`} onClick={(e) => e.stopPropagation()}>
        <div className={`flex justify-between items-center px-4 py-3 border-b ${theme.border} h-[46px]`}>
          <h2 className="text-base font-bold">{t('languageRegion.title', currentLocale)}</h2>
          <button
            onClick={onClose}
            className={`p-1 rounded ${theme.modalHover}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Language Section */}
          <div>
            <div className={`text-sm font-medium mb-2 ${theme.text}`}>{t('languageRegion.language', currentLocale)}</div>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => handleLanguageChange('en')}
                className={`py-2 px-4 rounded-lg text-sm transition-all w-full ${
                  currentLocale === 'en'
                    ? 'bg-blue-600 text-white'
                    : `${theme.buttonBg} ${theme.text} hover:opacity-80`
                }`}
              >
                {t('languageRegion.english', currentLocale)}
              </button>
              <button
                onClick={() => handleLanguageChange('ja')}
                className={`py-2 px-4 rounded-lg text-sm transition-all w-full ${
                  currentLocale === 'ja'
                    ? 'bg-blue-600 text-white'
                    : `${theme.buttonBg} ${theme.text} hover:opacity-80`
                }`}
              >
                {t('languageRegion.japanese', currentLocale)}
              </button>
            </div>
          </div>

          {/* Region Section */}
          <div>
            <div className={`text-sm font-medium mb-2 ${theme.text}`}>{t('languageRegion.region', currentLocale)}</div>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => handleRegionChange('USD')}
                className={`py-2 px-4 rounded-lg text-sm transition-all w-full ${
                  currentRegion === 'USD'
                    ? 'bg-blue-600 text-white'
                    : `${theme.buttonBg} ${theme.text} hover:opacity-80`
                }`}
              >
                USD
              </button>
              <button
                onClick={() => handleRegionChange('JPY')}
                className={`py-2 px-4 rounded-lg text-sm transition-all w-full ${
                  currentRegion === 'JPY'
                    ? 'bg-blue-600 text-white'
                    : `${theme.buttonBg} ${theme.text} hover:opacity-80`
                }`}
              >
                JPY
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
