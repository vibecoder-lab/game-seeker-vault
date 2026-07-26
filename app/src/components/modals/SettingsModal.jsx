import React from 'react';
import { t, currentLocale } from '../../i18n/index.js';
import { dbHelper } from '../../db/index.js';

export function SettingsModal({ theme, currentTheme, settings, setSettings, onClose, currentRegion, maxPrice, setMaxPrice, setForceUpdate }) {
  // Disable page scroll when modal is open
  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 modal-fade-in" onClick={onClose}>
      <div className={`${theme.cardBg} rounded-2xl max-w-xl w-full max-h-[80vh] flex flex-col overflow-hidden ${theme.cardShadow}`} onClick={(e) => e.stopPropagation()}>
        <div className={`flex justify-between items-center px-4 py-3 border-b ${theme.border} h-[46px]`}>
          <h2 className="text-base font-bold">{t('settings.title', currentLocale)}</h2>
          <button
            onClick={onClose}
            className={`p-1 rounded ${theme.modalHover}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {/* 1. Remove Price Limit */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <div className="text-sm font-medium">{t('settings.priceLimit', currentLocale)}</div>
              <div className={`text-xs ${theme.subText}`}>{t('settings.priceLimitDesc', currentLocale)}</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={settings.removePriceLimit}
                onChange={async (e) => {
                  const isEnabled = e.target.checked;
                  const newSettings = { ...settings, removePriceLimit: isEnabled };
                  setSettings(newSettings);
                  await dbHelper.saveSettings(newSettings);

                  // Adjust maxPrice if it exceeds new limit
                  if (!isEnabled) {
                    // Price limit enabled: check if maxPrice exceeds the new limit
                    const newLimit = currentRegion === 'JPY' ? 3000 : 50;
                    if (maxPrice > newLimit) {
                      setMaxPrice(newLimit);
                      setForceUpdate(prev => prev + 1);
                    }
                  }
                }}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* 2. Show All Tags */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <div className="text-sm font-medium">{t('settings.showAllTags', currentLocale)}</div>
              <div className={`text-xs ${theme.subText}`}>{t('settings.showAllTagsDesc', currentLocale)}</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={settings.showAllTags}
                onChange={async (e) => {
                  const newSettings = { ...settings, showAllTags: e.target.checked };
                  setSettings(newSettings);
                  await dbHelper.saveSettings(newSettings);
                }}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* 3. Always Show Star Icon (PC only) */}
          {!isMobile && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="text-sm font-medium">{t('settings.alwaysShowStar', currentLocale)}</div>
                <div className={`text-xs ${theme.subText}`}>{t('settings.alwaysShowStarDesc', currentLocale)}</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={settings.alwaysShowStarIcon}
                  onChange={async (e) => {
                    const newSettings = { ...settings, alwaysShowStarIcon: e.target.checked };
                    setSettings(newSettings);
                    await dbHelper.saveSettings(newSettings);
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          )}

          {/* 4. Enable Quick Register (PC only) */}
          {!isMobile && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="text-sm font-medium">{t('settings.enableQuickRegister', currentLocale)}</div>
                <div className={`text-xs ${theme.subText}`}>{t('settings.enableQuickRegisterDesc', currentLocale)}</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={settings.enableQuickRegister}
                  onChange={async (e) => {
                    const newSettings = { ...settings, enableQuickRegister: e.target.checked };
                    setSettings(newSettings);
                    await dbHelper.saveSettings(newSettings);
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          )}

          {/* 5. Hide Owned Titles (PC only) */}
          {!isMobile && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="text-sm font-medium">{t('settings.hideOwnedTitles', currentLocale)}</div>
                <div className={`text-xs ${theme.subText}`}>{t('settings.hideOwnedTitlesDesc', currentLocale)}</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={settings.hideOwnedTitles}
                  onChange={async (e) => {
                    const newSettings = { ...settings, hideOwnedTitles: e.target.checked };
                    setSettings(newSettings);
                    await dbHelper.saveSettings(newSettings);
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          )}

          {/* 6. Permanent Delete (PC only) */}
          {!isMobile && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="text-sm font-medium">{t('settings.permanentDelete', currentLocale)}</div>
                <div className={`text-xs ${theme.subText}`}>{t('settings.permanentDeleteDesc', currentLocale)}</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={settings.permanentDelete}
                  onChange={async (e) => {
                    const newSettings = { ...settings, permanentDelete: e.target.checked };
                    setSettings(newSettings);
                    await dbHelper.saveSettings(newSettings);
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          )}

          {/* 7. Show Total Price (PC only) */}
          {!isMobile && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="text-sm font-medium">{t('settings.showTotalPrice', currentLocale)}</div>
                <div className={`text-xs ${theme.subText}`}>{t('settings.showTotalPriceDesc', currentLocale)}</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={settings.showTotalPrice}
                  onChange={async (e) => {
                    const newSettings = { ...settings, showTotalPrice: e.target.checked };
                    setSettings(newSettings);
                    await dbHelper.saveSettings(newSettings);
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          )}

          {/* 8. Use Selected Folder as Target (PC only) */}
          {!isMobile && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="text-sm font-medium">{t('settings.useSelectedFolder', currentLocale)}</div>
                <div className={`text-xs ${theme.subText}`}>{t('settings.useSelectedFolderDesc', currentLocale)}</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={settings.useSelectedFolderAsTarget}
                  onChange={async (e) => {
                    const newSettings = { ...settings, useSelectedFolderAsTarget: e.target.checked };
                    setSettings(newSettings);
                    await dbHelper.saveSettings(newSettings);
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          )}

          {/* 9. Wheel Click Shows Collection (PC only) */}
          {!isMobile && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="text-sm font-medium">{t('settings.wheelClickShowsCollection', currentLocale)}</div>
                <div className={`text-xs ${theme.subText}`}>{t('settings.wheelClickShowsCollectionDesc', currentLocale)}</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={settings.wheelClickShowsCollection}
                  onChange={async (e) => {
                    const newSettings = { ...settings, wheelClickShowsCollection: e.target.checked };
                    setSettings(newSettings);
                    await dbHelper.saveSettings(newSettings);
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          )}

          {/* 10. Use In-Page Navigation (PC only) */}
          {!isMobile && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="text-sm font-medium">{t('settings.useInPageNavigation', currentLocale)}</div>
                <div className={`text-xs ${theme.subText}`}>{t('settings.useInPageNavigationDesc', currentLocale)}</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={settings.useInPageNavigation}
                  onChange={async (e) => {
                    const newSettings = { ...settings, useInPageNavigation: e.target.checked };
                    setSettings(newSettings);
                    await dbHelper.saveSettings(newSettings);
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          )}

          {/* 11. Navigate to Reviews */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <div className="text-sm font-medium">{t('settings.navigateToReviews', currentLocale)}</div>
              <div className={`text-xs ${theme.subText}`}>{t('settings.navigateToReviewsDesc', currentLocale)}</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={settings.navigateToReviews}
                onChange={async (e) => {
                  const newSettings = { ...settings, navigateToReviews: e.target.checked };
                  setSettings(newSettings);
                  await dbHelper.saveSettings(newSettings);
                }}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* 11. Alternative Key Bindings (PC only) */}
          {!isMobile && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="text-sm font-medium">{t('settings.alternativeKeys', currentLocale)}</div>
                <div className={`text-xs ${theme.subText}`}>{t('settings.alternativeKeysDesc', currentLocale)}</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={settings.useAlternativeKeys}
                  onChange={async (e) => {
                    const newSettings = { ...settings, useAlternativeKeys: e.target.checked };
                    setSettings(newSettings);
                    await dbHelper.saveSettings(newSettings);
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          )}

          {/* Enable Scroll Animation (Mobile only) */}
          {isMobile && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="text-sm font-medium">{t('settings.enableScrollAnimation', currentLocale)}</div>
                <div className={`text-xs ${theme.subText}`}>{t('settings.enableScrollAnimationDesc', currentLocale)}</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={settings.enableScrollAnimation}
                  onChange={async (e) => {
                    const newSettings = { ...settings, enableScrollAnimation: e.target.checked };
                    setSettings(newSettings);
                    await dbHelper.saveSettings(newSettings);
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          )}

          {/* Legacy Right-Click Menu (PC only) */}
          {!isMobile && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="text-sm font-medium">{t('settings.useLegacyRightClick', currentLocale)}</div>
                <div className={`text-xs ${theme.subText}`}>{t('settings.useLegacyRightClickDesc', currentLocale)}</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={settings.useLegacyRightClick}
                  onChange={async (e) => {
                    const newSettings = { ...settings, useLegacyRightClick: e.target.checked };
                    setSettings(newSettings);
                    await dbHelper.saveSettings(newSettings);
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          )}

          {/* Danger Zone */}
          {!isMobile && (
            <div className={`border-t ${theme.border} pt-3 mt-1`}>
              <div className={`text-sm font-medium ${theme.saleText} mb-2`}>{t('settings.resetData', currentLocale)}</div>
              <button
                onClick={async () => {
                  if (confirm(t('confirm.deleteAllData', currentLocale))) {
                    try {
                      await dbHelper.deleteAllData();
                      window.location.reload();
                    } catch (e) {
                      alert(t('error.deleteFailed', currentLocale).replace('{message}', e.message));
                    }
                  }
                }}
                className={`w-full py-2 px-3 text-sm rounded-lg transition-all duration-300 ${theme.buttonBg} ${theme.text} hover:bg-red-500 hover:text-white`}
              >
                {t('settings.resetDataButton', currentLocale)}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
