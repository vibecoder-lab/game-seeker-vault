import React, { useState, useEffect, useRef } from 'react';
import { t, currentLocale, formatPrice, formatYear, translateGenre } from '../../i18n/index.js';
import { truncateByWidth } from '../../utils/format.js';

export function MobileUnifiedModal({
  theme,
  currentTheme,
  isClosing,
  onClose,
  // Filter tab props
  selectedYear,
  setSelectedYear,
  showYearDropdown,
  setShowYearDropdown,
  allYears,
  onlySale,
  setOnlySale,
  selectedReviewScores,
  setSelectedReviewScores,
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
  settings,
  currentRegion,
  // Genre tab props
  allGenres,
  selectedGenres,
  setSelectedGenres,
  allTags,
  selectedTags,
  setSelectedTags,
  searchTitle,
  setSearchTitle,
  // Clear tab props
  onClearFilters,
}) {
  const [activeTab, setActiveTab] = useState('filter');
  const [clearButtonPressed, setClearButtonPressed] = useState(false);

  // Disable page scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // --- Filter tab local state ---
  const [localOnlySale, setLocalOnlySale] = useState(onlySale);
  const [localOnlyJP, setLocalOnlyJP] = useState(onlyJP);
  const [localSelectedReviewScores, setLocalSelectedReviewScores] = useState(selectedReviewScores);
  const [localOnlyMac, setLocalOnlyMac] = useState(onlyMac);
  const [localMinPrice, setLocalMinPrice] = useState(minPrice);
  const [localMaxPrice, setLocalMaxPrice] = useState(maxPrice);
  const [localPriceMode, setLocalPriceMode] = useState(priceMode);
  const [localSortOrder, setLocalSortOrder] = useState(sortOrder);

  // Sync local state with parent
  useEffect(() => { setLocalOnlySale(onlySale); }, [onlySale]);
  useEffect(() => { setLocalOnlyJP(onlyJP); }, [onlyJP]);
  useEffect(() => { setLocalSelectedReviewScores(selectedReviewScores); }, [selectedReviewScores]);
  useEffect(() => { setLocalOnlyMac(onlyMac); }, [onlyMac]);
  useEffect(() => { setLocalMinPrice(minPrice); }, [minPrice]);
  useEffect(() => { setLocalMaxPrice(maxPrice); }, [maxPrice]);
  useEffect(() => { setLocalPriceMode(priceMode); }, [priceMode]);
  useEffect(() => { setLocalSortOrder(sortOrder); }, [sortOrder]);

  // Filter handlers with immediate local update + deferred parent update
  const handleSaleChange = (checked) => {
    setLocalOnlySale(checked);
    React.startTransition(() => setOnlySale(checked));
  };

  const handleJPChange = (checked) => {
    setLocalOnlyJP(checked);
    React.startTransition(() => setOnlyJP(checked));
  };

  const handleReviewScoreToggle = (score) => {
    const newScores = localSelectedReviewScores.includes(score)
      ? localSelectedReviewScores.filter(s => s !== score)
      : [...localSelectedReviewScores, score];
    setLocalSelectedReviewScores(newScores);
    React.startTransition(() => setSelectedReviewScores(newScores));
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

  // Get price slider configuration based on region
  const getPriceSliderConfig = (region, removePriceLimit) => {
    if (region === 'JPY') {
      return {
        min: 0,
        max: removePriceLimit ? 20000 : 3000,
        step: 100
      };
    } else {
      // USD, EUR, GBP
      return {
        min: 0,
        max: removePriceLimit ? 200 : 50,
        step: 1
      };
    }
  };

  // --- Genre tab local state and handlers ---
  const longPressTimerRef = useRef(null);
  const isLongPressRef = useRef(false);
  const touchStartPosRef = useRef({ x: 0, y: 0 });

  const [localSelectedGenres, setLocalSelectedGenres] = useState(selectedGenres);
  const [isTagSectionOpen, setIsTagSectionOpen] = useState(false);

  // Sync local state when parent state changes
  useEffect(() => {
    setLocalSelectedGenres(selectedGenres);
  }, [selectedGenres]);

  const handleTouchStart = () => (e) => {
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    isLongPressRef.current = false;

    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 500);
  };

  const handleTouchMove = (e) => {
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartPosRef.current.y);

    if (deltaX > 10 || deltaY > 10) {
      clearTimeout(longPressTimerRef.current);
      isLongPressRef.current = false;
    }
  };

  const handleTouchEnd = (g) => (e) => {
    clearTimeout(longPressTimerRef.current);

    // Check if touch moved (swipe detection)
    const touch = e.changedTouches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartPosRef.current.y);

    // If moved more than 10px, it's a swipe - don't trigger selection
    if (deltaX > 10 || deltaY > 10) {
      isLongPressRef.current = false;
      return;
    }

    e.preventDefault();

    const isLongPress = isLongPressRef.current;
    isLongPressRef.current = false;

    // Update local state immediately for instant visual feedback
    setLocalSelectedGenres((prev) => {
      const currentlyIncluded = prev.include.includes(g);
      const currentlyExcluded = prev.exclude.includes(g);

      if (isLongPress) {
        // Long press: toggle exclude
        if (currentlyExcluded) {
          return { ...prev, exclude: prev.exclude.filter((x) => x !== g) };
        } else {
          return {
            include: prev.include.filter((x) => x !== g),
            exclude: [...prev.exclude, g],
          };
        }
      } else {
        // Normal tap: if excluded, remove from exclude (don't add to include)
        if (currentlyExcluded) {
          return { ...prev, exclude: prev.exclude.filter((x) => x !== g) };
        } else if (currentlyIncluded) {
          return { ...prev, include: prev.include.filter((x) => x !== g) };
        } else {
          return { ...prev, include: [...prev.include, g] };
        }
      }
    });

    // Update parent state in transition (non-urgent, for actual filtering)
    React.startTransition(() => {
      setSelectedGenres((prev) => {
        const currentlyIncluded = prev.include.includes(g);
        const currentlyExcluded = prev.exclude.includes(g);

        if (isLongPress) {
          // Long press: toggle exclude
          if (currentlyExcluded) {
            return { ...prev, exclude: prev.exclude.filter((x) => x !== g) };
          } else {
            return {
              include: prev.include.filter((x) => x !== g),
              exclude: [...prev.exclude, g],
            };
          }
        } else {
          // Normal tap: if excluded, remove from exclude (don't add to include)
          if (currentlyExcluded) {
            return { ...prev, exclude: prev.exclude.filter((x) => x !== g) };
          } else if (currentlyIncluded) {
            return { ...prev, include: prev.include.filter((x) => x !== g) };
          } else {
            return { ...prev, include: [...prev.include, g] };
          }
        }
      });
    });
  };

  const handleTouchCancel = () => {
    clearTimeout(longPressTimerRef.current);
    isLongPressRef.current = false;
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
  };

  // Handle clear all filters (same as PC version)
  const handleClearAll = () => {
    // Start animation
    setClearButtonPressed(true);
    setTimeout(() => setClearButtonPressed(false), 100);

    // Get price slider configuration
    const priceSliderConfig = getPriceSliderConfig(currentRegion, settings?.removePriceLimit);

    // Reset all filters (same as PC version)
    setOnlySale(false);
    setSelectedReviewScores([]);
    setOnlyJP(false);
    setOnlyMac(false);
    setSelectedGenres({ include: [], exclude: [] });
    setSelectedTags([]);
    setMinPrice(priceSliderConfig.min === 0 ? (currentRegion === 'JPY' ? 100 : 1) : priceSliderConfig.min);
    setMaxPrice(priceSliderConfig.max);
    setPriceMode("current");
    setSortOrder("asc");
    setSelectedYear("all");
    setSearchTitle("");
  };

  return (
    <div
      className={isClosing ? 'modal-fade-out' : 'modal-fade-in'}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)'
      }}
      onClick={onClose}
    >
      <div
        className={`${theme.cardBg} ${theme.text} rounded-t-3xl w-full flex flex-col ${isClosing ? 'bottom-sheet-slide-out' : 'bottom-sheet-slide-in'}`}
        style={{ height: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tabs with Clear button (fixed) */}
        <div className={`flex items-center border-b ${theme.border} px-6 gap-2`}>
          <button
            onClick={() => setActiveTab('filter')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'filter'
                ? `${theme.text} border-b-2 ${currentTheme === 'steam' ? 'border-blue-500' : 'border-current'}`
                : `${theme.subText} hover:${theme.text}`
            }`}
          >
            {t('filter.title', currentLocale)}
          </button>
          <button
            onClick={() => setActiveTab('genre')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'genre'
                ? `${theme.text} border-b-2 ${currentTheme === 'steam' ? 'border-blue-500' : 'border-current'}`
                : `${theme.subText} hover:${theme.text}`
            }`}
          >
            {t('filter.genre', currentLocale)}
          </button>
          <button
            onClick={handleClearAll}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all duration-100 ${theme.cardShadow} hover:scale-105 ${clearButtonPressed ? theme.buttonActive : theme.buttonBg}`}
          >
            {t('filter.clear', currentLocale)}
          </button>
        </div>

        {/* Content (scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'filter' && (
            <>
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
                    <input id="unified-modal-saleOnly" type="checkbox" checked={localOnlySale} onChange={(e)=>handleSaleChange(e.target.checked)} className="h-4 w-4" />
                    <label htmlFor="unified-modal-saleOnly" className="text-sm">{t('filter.onlySale', currentLocale)}</label>
                  </div>
                  {currentLocale === 'ja' && (
                  <div className="flex items-center gap-2">
                    <input id="unified-modal-jpOnly" type="checkbox" checked={localOnlyJP} onChange={(e)=>handleJPChange(e.target.checked)} className="h-4 w-4" />
                    <label htmlFor="unified-modal-jpOnly" className="text-sm">{t('filter.onlyJapanese', currentLocale)}</label>
                  </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input id="unified-modal-macOnly" type="checkbox" checked={localOnlyMac} onChange={(e)=>handleMacChange(e.target.checked)} className="h-4 w-4" />
                    <label htmlFor="unified-modal-macOnly" className="text-sm">{t('filter.onlyMac', currentLocale)}</label>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold mb-2">{t('filter.reviewScore', currentLocale)}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <input id="unified-modal-overwhelminglyPositive" type="checkbox" checked={localSelectedReviewScores.includes('Overwhelmingly Positive')} onChange={()=>handleReviewScoreToggle('Overwhelmingly Positive')} className="h-4 w-4" />
                    <label htmlFor="unified-modal-overwhelminglyPositive" className="text-sm">{t('filter.overwhelminglyPositive', currentLocale)}</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input id="unified-modal-veryPositive" type="checkbox" checked={localSelectedReviewScores.includes('Very Positive')} onChange={()=>handleReviewScoreToggle('Very Positive')} className="h-4 w-4" />
                    <label htmlFor="unified-modal-veryPositive" className="text-sm">{t('filter.veryPositive', currentLocale)}</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input id="unified-modal-positive" type="checkbox" checked={localSelectedReviewScores.includes('Positive')} onChange={()=>handleReviewScoreToggle('Positive')} className="h-4 w-4" />
                    <label htmlFor="unified-modal-positive" className="text-sm">{t('filter.positive', currentLocale)}</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input id="unified-modal-mostlyPositive" type="checkbox" checked={localSelectedReviewScores.includes('Mostly Positive')} onChange={()=>handleReviewScoreToggle('Mostly Positive')} className="h-4 w-4" />
                    <label htmlFor="unified-modal-mostlyPositive" className="text-sm">{t('filter.mostlyPositive', currentLocale)}</label>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold mb-2">{t('filter.price.title', currentLocale)}</div>
                <div className="space-y-2">
                  <div className={`flex items-center justify-between text-sm ${theme.subText}`}>
                    <span>{t('filter.priceMin', currentLocale)} {formatPrice(localMinPrice, currentRegion, currentLocale)}</span>
                    <span>{t('filter.priceMax', currentLocale)} {formatPrice(localMaxPrice, currentRegion, currentLocale)}</span>
                  </div>
                  <input type="range" min={getPriceSliderConfig(currentRegion, settings?.removePriceLimit).min} max={getPriceSliderConfig(currentRegion, settings?.removePriceLimit).max} step={getPriceSliderConfig(currentRegion, settings?.removePriceLimit).step} value={localMinPrice} onChange={(e)=>handleMinPriceChange(Math.min(Number(e.target.value), localMaxPrice))} className={`w-full ${currentTheme==='steam'?'steam-blue':''}`} />
                  <input type="range" min={getPriceSliderConfig(currentRegion, settings?.removePriceLimit).min} max={getPriceSliderConfig(currentRegion, settings?.removePriceLimit).max} step={getPriceSliderConfig(currentRegion, settings?.removePriceLimit).step} value={localMaxPrice} onChange={(e)=>handleMaxPriceChange(Math.max(Number(e.target.value), localMinPrice))} className={`w-full ${currentTheme==='steam'?'steam-blue':''}`} />
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold mb-2">{t('filter.priceMode.title', currentLocale)}</div>
                <div className={`inline-flex flex-wrap rounded-xl ${theme.buttonBg} p-1 gap-1 w-full`}>
                  <button onClick={()=>handlePriceModeChange('current')} className={`px-3 py-1.5 rounded-lg text-sm flex-1 ${localPriceMode==='current'?theme.buttonActive:''}`}>
                    {t('filter.priceCurrent', currentLocale)}
                  </button>
                  <button onClick={()=>handlePriceModeChange('normal')} className={`px-3 py-1.5 rounded-lg text-sm flex-1 ${localPriceMode==='normal'?theme.buttonActive:''}`}>
                    {t('filter.priceNormal', currentLocale)}
                  </button>
                  <button onClick={()=>handlePriceModeChange('lowest')} className={`px-3 py-1.5 rounded-lg text-sm flex-1 ${localPriceMode==='lowest'?theme.buttonActive:''}`}>
                    {t('filter.priceLowest', currentLocale)}
                  </button>
                  <button onClick={()=>handlePriceModeChange('discount')} className={`px-3 py-1.5 rounded-lg text-sm flex-1 ${localPriceMode==='discount'?theme.buttonActive:''}`}>
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
            </>
          )}

          {activeTab === 'genre' && (
            <>
              <div>
                <div className="text-sm font-semibold mb-2">
                  {t('filter.genre', currentLocale)}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {allGenres.genres.map((g) => {
                    const translatedGenre = translateGenre(g, currentLocale);
                    const isIncluded = localSelectedGenres.include.includes(g);
                    const isExcluded = localSelectedGenres.exclude.includes(g);

                    return (
                      <div
                        key={g}
                        className="flex items-center gap-2 text-sm cursor-pointer touch-enabled"
                        onTouchStart={handleTouchStart()}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd(g)}
                        onTouchCancel={handleTouchCancel}
                        onContextMenu={handleContextMenu}
                      >
                        <div className="relative w-4 h-4 flex-shrink-0">
                          {isExcluded ? (
                            <svg
                              className={`w-4 h-4 ${theme.saleText}`}
                              viewBox="0 0 16 16"
                              fill="currentColor"
                            >
                              <path d="M2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2zm3.354 4.646L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 1 1 .708-.708z" />
                            </svg>
                          ) : (
                            <input
                              type="checkbox"
                              checked={isIncluded}
                              onChange={() => handleGenreToggle(g, false)}
                              className="w-4 h-4"
                            />
                          )}
                        </div>
                        <span
                          className={`${isExcluded ? theme.saleText : ''}`}
                        >
                          {translatedGenre}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {allGenres.otherTags.length > 0 && (
                <div>
                  <div className="text-sm font-semibold mb-2">
                    {t('filter.feature', currentLocale)}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {allGenres.otherTags.map((g) => {
                      const translatedGenre = translateGenre(g, currentLocale);
                      const displayName = truncateByWidth(translatedGenre, 15);
                      const isIncluded = localSelectedGenres.include.includes(g);
                      const isExcluded = localSelectedGenres.exclude.includes(g);

                      return (
                        <div
                          key={g}
                          className="flex items-center gap-2 text-sm cursor-pointer touch-enabled"
                          onTouchStart={handleTouchStart()}
                          onTouchMove={handleTouchMove}
                          onTouchEnd={handleTouchEnd(g)}
                          onTouchCancel={handleTouchCancel}
                          onContextMenu={handleContextMenu}
                        >
                          <div className="relative w-4 h-4 flex-shrink-0">
                            {isExcluded ? (
                              <svg
                                className={`w-4 h-4 ${theme.saleText}`}
                                viewBox="0 0 16 16"
                                fill="currentColor"
                              >
                                <path d="M2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2zm3.354 4.646L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 1 1 .708-.708z" />
                              </svg>
                            ) : (
                              <input
                                type="checkbox"
                                checked={isIncluded}
                                readOnly
                                className="w-4 h-4 pointer-events-none"
                              />
                            )}
                          </div>
                          <span
                            className={`truncate ${isExcluded ? theme.saleText : ''}`}
                          >
                            {displayName}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {allTags && allTags.length > 0 && (
                <div className="space-y-2">
                  <div
                    className="flex items-center gap-2 text-sm font-semibold mb-2 cursor-pointer touch-enabled"
                    onClick={() => setIsTagSectionOpen(!isTagSectionOpen)}
                  >
                    <svg
                      className={`w-4 h-4 transition-transform duration-200 ${isTagSectionOpen ? 'rotate-90' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                    <span>{t('filter.tags', currentLocale)}</span>
                  </div>
                  <div
                    className="overflow-hidden transition-all duration-200 ease-in-out"
                    style={{
                      maxHeight: isTagSectionOpen ? '200px' : '0px',
                    }}
                  >
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      <div className="grid grid-cols-2 gap-2">
                        {allTags.map((tag) => {
                          const isSelected = selectedTags.includes(tag);

                          return (
                            <div
                              key={tag}
                              className="flex items-center gap-2 text-sm cursor-pointer touch-enabled"
                              onClick={() => {
                                setSelectedTags((prev) => {
                                  if (prev.includes(tag)) {
                                    return prev.filter((t) => t !== tag);
                                  } else {
                                    return [...prev, tag];
                                  }
                                });
                              }}
                            >
                              <div className="relative w-4 h-4 flex-shrink-0">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  readOnly
                                  className="w-4 h-4 pointer-events-none"
                                />
                              </div>
                              <span className="truncate">{tag}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div
                className={`text-xs ${theme.subText} p-3 rounded-lg ${theme.border} border`}
              >
                <p>{t('filter.genreHelp', currentLocale)}</p>
              </div>
            </>
          )}

        </div>

        {/* Close button at bottom */}
        <div className="p-6 pt-0">
          <button
            onClick={onClose}
            className={`w-full py-3 rounded-lg ${currentTheme === 'steam' ? 'steam-blue-bg text-white' : 'bg-blue-500 text-white'} font-medium`}
          >
            {t('button.close', currentLocale)}
          </button>
        </div>
      </div>
    </div>
  );
}
