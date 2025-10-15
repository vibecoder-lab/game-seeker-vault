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
  // Local state for immediate visual feedback
  const [localOnlySale, setLocalOnlySale] = React.useState(onlySale);
  const [localOnlyJP, setLocalOnlyJP] = React.useState(onlyJP);
  const [localOnlyOverwhelming, setLocalOnlyOverwhelming] = React.useState(onlyOverwhelming);
  const [localOnlyMac, setLocalOnlyMac] = React.useState(onlyMac);
  const [localMinPrice, setLocalMinPrice] = React.useState(minPrice);
  const [localMaxPrice, setLocalMaxPrice] = React.useState(maxPrice);
  const [localPriceMode, setLocalPriceMode] = React.useState(priceMode);
  const [localSortOrder, setLocalSortOrder] = React.useState(sortOrder);

  // Sync local state with parent
  React.useEffect(() => { setLocalOnlySale(onlySale); }, [onlySale]);
  React.useEffect(() => { setLocalOnlyJP(onlyJP); }, [onlyJP]);
  React.useEffect(() => { setLocalOnlyOverwhelming(onlyOverwhelming); }, [onlyOverwhelming]);
  React.useEffect(() => { setLocalOnlyMac(onlyMac); }, [onlyMac]);
  React.useEffect(() => { setLocalMinPrice(minPrice); }, [minPrice]);
  React.useEffect(() => { setLocalMaxPrice(maxPrice); }, [maxPrice]);
  React.useEffect(() => { setLocalPriceMode(priceMode); }, [priceMode]);
  React.useEffect(() => { setLocalSortOrder(sortOrder); }, [sortOrder]);

  // Handlers with immediate local update + deferred parent update
  const handleSaleChange = (checked) => {
    setLocalOnlySale(checked);
    React.startTransition(() => setOnlySale(checked));
  };

  const handleJPChange = (checked) => {
    setLocalOnlyJP(checked);
    React.startTransition(() => setOnlyJP(checked));
  };

  const handleOverwhelmingChange = (checked) => {
    setLocalOnlyOverwhelming(checked);
    React.startTransition(() => setOnlyOverwhelming(checked));
  };

  const handleMacChange = (checked) => {
    setLocalOnlyMac(checked);
    React.startTransition(() => setOnlyMac(checked));
  };

  const handleMinPriceChange = (value) => {
    setLocalMinPrice(value);
    React.startTransition(() => setMinPrice(value));
  };

  const handleMaxPriceChange = (value) => {
    setLocalMaxPrice(value);
    React.startTransition(() => setMaxPrice(value));
  };

  const handlePriceModeChange = (mode) => {
    setLocalPriceMode(mode);
    React.startTransition(() => setPriceMode(mode));
  };

  const handleSortOrderChange = (order) => {
    setLocalSortOrder(order);
    React.startTransition(() => setSortOrder(order));
  };

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
              <input id="modal-saleOnly" type="checkbox" checked={localOnlySale} onChange={(e)=>handleSaleChange(e.target.checked)} className="h-4 w-4" />
              <label htmlFor="modal-saleOnly" className="text-sm">{t('filter.onlySale', currentLocale)}</label>
            </div>
            <div className="flex items-center gap-2">
              <input id="modal-overwhelmingOnly" type="checkbox" checked={localOnlyOverwhelming} onChange={(e)=>handleOverwhelmingChange(e.target.checked)} className="h-4 w-4" />
              <label htmlFor="modal-overwhelmingOnly" className="text-sm">{t('filter.onlyOverwhelming', currentLocale)}</label>
            </div>
            <div className="flex items-center gap-2">
              <input id="modal-jpOnly" type="checkbox" checked={localOnlyJP} onChange={(e)=>handleJPChange(e.target.checked)} className="h-4 w-4" />
              <label htmlFor="modal-jpOnly" className="text-sm">{t('filter.onlyJapanese', currentLocale)}</label>
            </div>
            <div className="flex items-center gap-2">
              <input id="modal-macOnly" type="checkbox" checked={localOnlyMac} onChange={(e)=>handleMacChange(e.target.checked)} className="h-4 w-4" />
              <label htmlFor="modal-macOnly" className="text-sm">{t('filter.onlyMac', currentLocale)}</label>
            </div>
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold mb-2">{t('filter.price.title', currentLocale)}</div>
          <div className="space-y-2">
            <div className={`flex items-center justify-between text-sm ${theme.subText}`}>
              <span>{t('filter.priceMin', currentLocale)} {formatPrice(localMinPrice, currentLocale)}</span>
              <span>{t('filter.priceMax', currentLocale)} {formatPrice(localMaxPrice, currentLocale)}</span>
            </div>
            <input type="range" min={0} max={settings?.removePriceLimit ? 20000 : 3000} step={100} value={localMinPrice} onChange={(e)=>handleMinPriceChange(Math.min(Number(e.target.value), localMaxPrice))} className={`w-full ${currentTheme==='steam'?'steam-blue':''}`} />
            <input type="range" min={0} max={settings?.removePriceLimit ? 20000 : 3000} step={100} value={localMaxPrice} onChange={(e)=>handleMaxPriceChange(Math.max(Number(e.target.value), localMinPrice))} className={`w-full ${currentTheme==='steam'?'steam-blue':''}`} />
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold mb-2">{t('filter.priceMode.title', currentLocale)}</div>
          <div className={`inline-flex flex-wrap rounded-xl ${theme.buttonBg} p-1 gap-1 w-full`}>
            <button onClick={()=>handlePriceModeChange('current')} className={`px-3 py-1.5 rounded-lg text-xs flex-1 ${localPriceMode==='current'?theme.buttonActive:''}`}>
              {t('filter.priceCurrent', currentLocale)}
            </button>
            <button onClick={()=>handlePriceModeChange('normal')} className={`px-3 py-1.5 rounded-lg text-xs flex-1 ${localPriceMode==='normal'?theme.buttonActive:''}`}>
              {t('filter.priceNormal', currentLocale)}
            </button>
            <button onClick={()=>handlePriceModeChange('lowest')} className={`px-3 py-1.5 rounded-lg text-xs flex-1 ${localPriceMode==='lowest'?theme.buttonActive:''}`}>
              {t('filter.priceLowest', currentLocale)}
            </button>
            <button onClick={()=>handlePriceModeChange('discount')} className={`px-3 py-1.5 rounded-lg text-xs flex-1 ${localPriceMode==='discount'?theme.buttonActive:''}`}>
              {t('filter.priceDiscount', currentLocale)}
            </button>
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold mb-2">{t('filter.sortOrder', currentLocale)}</div>
          <div className={`inline-flex rounded-xl ${theme.buttonBg} p-1 w-full`}>
            <button onClick={()=>handleSortOrderChange('asc')} className={`px-3 py-1.5 rounded-lg text-sm flex-1 ${localSortOrder==='asc'?theme.buttonActive:''}`}>{t('filter.sortAsc', currentLocale)}</button>
            <button onClick={()=>handleSortOrderChange('desc')} className={`px-3 py-1.5 rounded-lg text-sm flex-1 ${localSortOrder==='desc'?theme.buttonActive:''}`}>{t('filter.sortDesc', currentLocale)}</button>
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
