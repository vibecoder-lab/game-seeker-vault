import React from 'react';
import { t, currentLocale, formatPrice, formatYear } from '../../i18n/index.js';

export function MobileFilterModal({
  theme,
  currentTheme,
  isClosing,
  onClose,
  selectedYear,
  setSelectedYear,
  showYearDropdown,
  setShowYearDropdown,
  allYears,
  onlySale,
  setOnlySale,
  onlyOverwhelming,
  setOnlyOverwhelming,
  onlyJP,
  setOnlyJP,
  onlyMac,
  setOnlyMac,
  minPrice,
  setMinPrice,
  maxPrice,
  setMaxPrice,
  priceMode,
  setPriceMode,
  sortOrder,
  setSortOrder,
  settings
}) {
  return (
    <div className={isClosing ? 'modal-fade-out' : 'modal-fade-in'} style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.5)'
    }} onClick={onClose}>
      <div
        className={`${theme.cardBg} ${theme.text} rounded-t-3xl w-full p-6 space-y-4 ${isClosing ? 'bottom-sheet-slide-out' : 'bottom-sheet-slide-in'}`}
        style={{height: '80vh', overflowY: 'auto'}}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">{t('filter.title', currentLocale)}</h3>
          <button onClick={onClose} className="p-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div>
          <div className="text-sm font-semibold mb-2">{t('filter.period', currentLocale)}</div>
          <div className="relative">
            <button
              onClick={() => setShowYearDropdown(!showYearDropdown)}
              className={`${theme.cardBg} ${theme.text} ${theme.border} border rounded-lg px-3 py-2 text-sm w-full flex items-center justify-between`}
            >
              <span className="flex-1 text-center">{selectedYear === 'all' ? t('filter.allPeriod', currentLocale) : formatYear(selectedYear, currentLocale)}</span>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${showYearDropdown ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            {showYearDropdown && (
              <div className={`absolute top-full z-10 w-full ${theme.cardBg} ${theme.border} border rounded-lg shadow-lg max-h-60 overflow-y-auto mt-1`}>
                <div
                  onClick={() => {
                    setSelectedYear('all');
                    setShowYearDropdown(false);
                  }}
                  className={`px-3 py-2 text-sm text-center cursor-pointer ${theme.modalHover} ${selectedYear === 'all' ? theme.folderSelected : ''}`}
                >
                  {t('filter.allPeriod', currentLocale)}
                </div>
                {allYears.map(year => (
                  <div
                    key={year}
                    onClick={() => {
                      setSelectedYear(year);
                      setShowYearDropdown(false);
                    }}
                    className={`px-3 py-2 text-sm text-center cursor-pointer ${theme.modalHover} ${selectedYear === year ? theme.folderSelected : ''}`}
                  >
                    {formatYear(year, currentLocale)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold mb-2">{t('filter.conditions', currentLocale)}</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <input id="modal-saleOnly" type="checkbox" checked={onlySale} onChange={(e)=>setOnlySale(e.target.checked)} className="h-4 w-4" />
              <label htmlFor="modal-saleOnly" className="text-sm">{t('filter.onlySale', currentLocale)}</label>
            </div>
            <div className="flex items-center gap-2">
              <input id="modal-overwhelmingOnly" type="checkbox" checked={onlyOverwhelming} onChange={(e)=>setOnlyOverwhelming(e.target.checked)} className="h-4 w-4" />
              <label htmlFor="modal-overwhelmingOnly" className="text-sm">{t('filter.onlyOverwhelming', currentLocale)}</label>
            </div>
            <div className="flex items-center gap-2">
              <input id="modal-jpOnly" type="checkbox" checked={onlyJP} onChange={(e)=>setOnlyJP(e.target.checked)} className="h-4 w-4" />
              <label htmlFor="modal-jpOnly" className="text-sm">{t('filter.onlyJapanese', currentLocale)}</label>
            </div>
            <div className="flex items-center gap-2">
              <input id="modal-macOnly" type="checkbox" checked={onlyMac} onChange={(e)=>setOnlyMac(e.target.checked)} className="h-4 w-4" />
              <label htmlFor="modal-macOnly" className="text-sm">{t('filter.onlyMac', currentLocale)}</label>
            </div>
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold mb-2">{t('filter.price.title', currentLocale)}</div>
          <div className="space-y-2">
            <div className={`flex items-center justify-between text-sm ${theme.subText}`}>
              <span>{t('filter.priceMin', currentLocale)} {formatPrice(minPrice, currentLocale)}</span>
              <span>{t('filter.priceMax', currentLocale)} {formatPrice(maxPrice, currentLocale)}</span>
            </div>
            <input type="range" min={0} max={settings?.removePriceLimit ? 20000 : 3000} step={100} value={minPrice} onChange={(e)=>setMinPrice(Math.min(Number(e.target.value), maxPrice))} className={`w-full ${currentTheme==='steam'?'steam-blue':''}`} />
            <input type="range" min={0} max={settings?.removePriceLimit ? 20000 : 3000} step={100} value={maxPrice} onChange={(e)=>setMaxPrice(Math.max(Number(e.target.value), minPrice))} className={`w-full ${currentTheme==='steam'?'steam-blue':''}`} />
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold mb-2">{t('filter.priceMode.title', currentLocale)}</div>
          <div className={`inline-flex flex-wrap rounded-xl ${theme.buttonBg} p-1 gap-1 w-full`}>
            <button onClick={()=>setPriceMode('current')} className={`px-3 py-1.5 rounded-lg text-xs flex-1 ${priceMode==='current'?theme.buttonActive:''}`}>
              {t('filter.priceCurrent', currentLocale)}
            </button>
            <button onClick={()=>setPriceMode('normal')} className={`px-3 py-1.5 rounded-lg text-xs flex-1 ${priceMode==='normal'?theme.buttonActive:''}`}>
              {t('filter.priceNormal', currentLocale)}
            </button>
            <button onClick={()=>setPriceMode('lowest')} className={`px-3 py-1.5 rounded-lg text-xs flex-1 ${priceMode==='lowest'?theme.buttonActive:''}`}>
              {t('filter.priceLowest', currentLocale)}
            </button>
            <button onClick={()=>setPriceMode('discount')} className={`px-3 py-1.5 rounded-lg text-xs flex-1 ${priceMode==='discount'?theme.buttonActive:''}`}>
              {t('filter.priceDiscount', currentLocale)}
            </button>
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold mb-2">{t('filter.sortOrder', currentLocale)}</div>
          <div className={`inline-flex rounded-xl ${theme.buttonBg} p-1 w-full`}>
            <button onClick={()=>setSortOrder('asc')} className={`px-3 py-1.5 rounded-lg text-sm flex-1 ${sortOrder==='asc'?theme.buttonActive:''}`}>{t('filter.sortAsc', currentLocale)}</button>
            <button onClick={()=>setSortOrder('desc')} className={`px-3 py-1.5 rounded-lg text-sm flex-1 ${sortOrder==='desc'?theme.buttonActive:''}`}>{t('filter.sortDesc', currentLocale)}</button>
          </div>
        </div>

        <button
          onClick={onClose}
          className={`w-full py-3 rounded-lg ${currentTheme === 'steam' ? 'steam-blue-bg text-white' : 'bg-blue-500 text-white'} font-medium`}
        >
          {t('button.close', currentLocale)}
        </button>
      </div>
    </div>
  );
}
