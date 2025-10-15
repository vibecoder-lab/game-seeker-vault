import React from 'react';
import { t, currentLocale, translateGenre } from '../../i18n/index.js';
import { truncateByWidth } from '../../utils/format.js';

export function MobileGenreModal({
  theme,
  currentTheme,
  isClosing,
  onClose,
  allGenres,
  selectedGenres,
  setSelectedGenres
}) {
  const longPressTimerRef = React.useRef(null);
  const isLongPressRef = React.useRef(false);
  const touchStartPosRef = React.useRef({ x: 0, y: 0 });

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
    e.preventDefault();
    clearTimeout(longPressTimerRef.current);

    const isLongPress = isLongPressRef.current;
    isLongPressRef.current = false;

    setSelectedGenres(prev => {
      const currentlyIncluded = prev.include.includes(g);
      const currentlyExcluded = prev.exclude.includes(g);

      if (isLongPress) {
        // Long press: toggle exclude
        if (currentlyExcluded) {
          return { ...prev, exclude: prev.exclude.filter(x => x !== g) };
        } else {
          return {
            include: prev.include.filter(x => x !== g),
            exclude: [...prev.exclude, g]
          };
        }
      } else {
        // Normal tap: if excluded, remove from exclude (don't add to include)
        if (currentlyExcluded) {
          return { ...prev, exclude: prev.exclude.filter(x => x !== g) };
        } else if (currentlyIncluded) {
          return { ...prev, include: prev.include.filter(x => x !== g) };
        } else {
          return { ...prev, include: [...prev.include, g] };
        }
      }
    });
  };

  const handleTouchCancel = () => {
    clearTimeout(longPressTimerRef.current);
    isLongPressRef.current = false;
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
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
        style={{maxHeight: '80vh', overflowY: 'auto'}}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">{t('filter.genreAndFeature', currentLocale)}</h3>
          <button onClick={onClose} className="p-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div>
          <div className="text-sm font-semibold mb-2">{t('filter.genre', currentLocale)}</div>
          <div className="grid grid-cols-2 gap-2">
            {allGenres.genres.map((g) => {
              const translatedGenre = translateGenre(g, currentLocale);
              const displayName = truncateByWidth(translatedGenre, 15);
              const isIncluded = selectedGenres.include.includes(g);
              const isExcluded = selectedGenres.exclude.includes(g);

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
                      <svg className={`w-4 h-4 ${theme.saleText}`} viewBox="0 0 16 16" fill="currentColor">
                        <path d="M2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2zm3.354 4.646L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 1 1 .708-.708z"/>
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
                  <span className={`truncate ${isExcluded ? theme.saleText : ''}`}>
                    {displayName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {allGenres.otherTags.length > 0 && (
          <div>
            <div className="text-sm font-semibold mb-2">{t('filter.feature', currentLocale)}</div>
            <div className="grid grid-cols-2 gap-2">
              {allGenres.otherTags.map((g) => {
                const translatedGenre = translateGenre(g, currentLocale);
                const displayName = truncateByWidth(translatedGenre, 15);
                const isIncluded = selectedGenres.include.includes(g);
                const isExcluded = selectedGenres.exclude.includes(g);

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
                        <svg className={`w-4 h-4 ${theme.saleText}`} viewBox="0 0 16 16" fill="currentColor">
                          <path d="M2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2zm3.354 4.646L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 1 1 .708-.708z"/>
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
                    <span className={`truncate ${isExcluded ? theme.saleText : ''}`}>
                      {displayName}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className={`text-xs ${theme.subText} p-3 rounded-lg ${theme.border} border`}>
          <p>{t('filter.genreHelp', currentLocale)}</p>
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
