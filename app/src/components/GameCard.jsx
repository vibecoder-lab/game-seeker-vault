import React from 'react';
import ReactDOM from 'react-dom';
import { t, currentLocale, formatPrice, formatDate } from '../i18n/index.js';
import { normalizeGenres, formatReleaseDate, checkJapaneseSupport, cleanLanguageText, translateReviewScore, yen } from '../utils/format.js';
import { steamCapsuleUrl, linkFor } from '../utils/steam.js';

function GameCardComponent({ g, theme, priceMode, collectionData, onToggleFavorite, onShowVideoModal, settings, locale, currentRegion, folders, onAddToFolder, onSaveUIState, forceDetailOpen, onCloseForceDetail }) {
  const [isHovered, setIsHovered] = React.useState(false);
  const [shiftPressed, setShiftPressed] = React.useState(false);
  const [starButtonHovered, setStarButtonHovered] = React.useState(false);
  const [playButtonHovered, setPlayButtonHovered] = React.useState(false);
  const [starClicked, setStarClicked] = React.useState(null);
  const [sparkles, setSparkles] = React.useState([]);
  const [isSticky, setIsSticky] = React.useState(false);
  const [showDetailModal, setShowDetailModal] = React.useState(false);
  const [showFolderDropdown, setShowFolderDropdown] = React.useState(false);
  const [dropdownPosition, setDropdownPosition] = React.useState({ x: 0, y: 0 });
  const cardRef = React.useRef(null);
  const detailRef = React.useRef(null);
  const longPressTimer = React.useRef(null);
  const dropdownRef = React.useRef(null);
  const starButtonRef = React.useRef(null);
  const cap = steamCapsuleUrl(g);
  const genres = g.genres?.length ? normalizeGenres(g.genres) : ['(genre unknown)'];
  const isFavorite = collectionData && !collectionData.deleted;

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Shift' && isHovered) {
        setShiftPressed(true);
      }
    };
    const handleKeyUp = (e) => {
      if (e.key === 'Shift') {
        setShiftPressed(false);
      }
    };
    const handleWheel = (e) => {
      if (e.shiftKey && shiftPressed && detailRef.current) {
        e.preventDefault();
        e.stopPropagation();
        const scrollAmount = e.deltaY || e.deltaX;
        detailRef.current.scrollTop += scrollAmount;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const cardElement = cardRef.current;
    if (cardElement) {
      cardElement.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (cardElement) {
        cardElement.removeEventListener('wheel', handleWheel);
      }
    };
  }, [isHovered, shiftPressed]);

  // Mobile sticky behavior: show full image when card is in upper 1/4 of screen
  React.useEffect(() => {
    // Only apply on mobile devices
    const isMobile = window.innerWidth < 768;
    if (!isMobile || !cardRef.current || !settings?.enableScrollAnimation) return;

    const handleScroll = () => {
      if (!cardRef.current) return;

      const rect = cardRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const threshold = viewportHeight / 4; // 1/4 from top

      // Show full image when card top is above the 1/4 line and card is visible
      const isVisible = rect.top < viewportHeight && rect.bottom > 0;
      setIsSticky(rect.top < threshold && isVisible);
    };

    // Initial check
    handleScroll();

    // Listen to scroll events
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [settings?.enableScrollAnimation]);

  const handleStarClick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const wasAlreadyFavorite = isFavorite;

    // Quick registration mode (only for non-favorited items)
    if (settings?.enableQuickRegister && !wasAlreadyFavorite) {
      // Save mouse position
      const clickX = e.nativeEvent.clientX;
      const clickY = e.nativeEvent.clientY;

      // Play full registration animation
      setStarClicked(true);

      // Generate random sparkles
      const rainbowColors = ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#4b0082', '#9400d3'];
      const particleCount = Math.floor(Math.random() * 9) + 8; // 8-16 particles
      const angles = [];

      // Generate unique random angles
      while (angles.length < particleCount) {
        const angle = Math.random() * 360;
        // Check if angle is unique (not within 10 degrees of existing angles)
        if (!angles.some(existingAngle => Math.abs(existingAngle - angle) < 10)) {
          angles.push(angle);
        }
      }

      const newSparkles = angles.map((angle, i) => ({
        id: Date.now() + i,
        angle: angle,
        color: rainbowColors[Math.floor(Math.random() * rainbowColors.length)],
        distance: Math.random() * 30 + 40, // 40-70px random distance
      }));
      setSparkles(newSparkles);
      setTimeout(() => setSparkles([]), 600);

      // After animation completes, show dropdown
      setTimeout(() => {
        // Reset star to normal size
        setStarClicked(null);

        // Show dropdown slightly offset from mouse position
        setDropdownPosition({ x: clickX - 80, y: clickY - 20 });
        setShowFolderDropdown(true);
      }, 400);
      return;
    }

    // Normal toggle mode
    setStarClicked(!wasAlreadyFavorite);

    if (!wasAlreadyFavorite) {
      // Generate random sparkles
      const rainbowColors = ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#4b0082', '#9400d3'];
      const particleCount = Math.floor(Math.random() * 9) + 8; // 8-16 particles
      const angles = [];

      // Generate unique random angles
      while (angles.length < particleCount) {
        const angle = Math.random() * 360;
        // Check if angle is unique (not within 10 degrees of existing angles)
        if (!angles.some(existingAngle => Math.abs(existingAngle - angle) < 10)) {
          angles.push(angle);
        }
      }

      const newSparkles = angles.map((angle, i) => ({
        id: Date.now() + i,
        angle: angle,
        color: rainbowColors[Math.floor(Math.random() * rainbowColors.length)],
        distance: Math.random() * 30 + 40, // 40-70px random distance
      }));
      setSparkles(newSparkles);
      setTimeout(() => setSparkles([]), 600);
    }

    setTimeout(() => setStarClicked(null), wasAlreadyFavorite ? 300 : 400);
    onToggleFavorite(g);
  };

  const handleFolderSelect = async (folderId) => {
    setShowFolderDropdown(false);
    await onAddToFolder(g, folderId);
    // Keep star expanded and colored after registration
    setStarClicked(null);
  };

  const handleDropdownHoverOut = async () => {
    // Close dropdown
    setShowFolderDropdown(false);
    setIsDropdownHovered(false); // Remove hover state

    // Unregister from favorites
    if (collectionData && !collectionData.deleted) {
      await onToggleFavorite(g.appid);
    }

    // Play reverse star animation
    setStarClicked(false);
    setTimeout(() => {
      setStarClicked(null);
      setSparkles([]);
    }, 300);
  };

  // Handle click outside dropdown
  React.useEffect(() => {
    if (!showFolderDropdown) return;

    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        handleDropdownHoverOut();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFolderDropdown]);

  // Mobile long-press handlers
  const handleTouchStart = (e) => {
    const isMobile = window.innerWidth < 768;
    if (!isMobile) return;

    longPressTimer.current = setTimeout(() => {
      setShowDetailModal(true);
      // Scroll card to center of viewport
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        const cardCenter = rect.top + rect.height / 2;
        const viewportCenter = window.innerHeight / 2;
        const scrollOffset = cardCenter - viewportCenter;
        window.scrollBy({ top: scrollOffset, behavior: 'smooth' });
      }
    }, 500); // 500ms long press
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchMove = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      setShowDetailModal(false);
    }
  };

  const handleCardClick = (e) => {
    if (showDetailModal) {
      e.preventDefault();
      return;
    }

    // Shift + Click opens video modal (prevent browser's default "open in new window")
    if (e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      onShowVideoModal(g);
    } else {
      // Normal click - save UI state before navigating to Steam (only for in-page navigation)
      if (onSaveUIState && settings.useInPageNavigation) {
        onSaveUIState();
      }
    }
  };

        return (
          <>
          {showDetailModal && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              onClick={handleBackdropClick}
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
            />
          )}
          <div key={g.id} className="relative group" data-game-id={g.id}>
            {/* Hover band (PC only): both buttons live on top of this band so a
                click that misses either one lands on the (inert) band instead
                of the underlying card link, preventing accidental navigation
                to the Steam store page. Visibility is driven by the pure-CSS
                `group-hover` pseudo-class (matching how the buttons' own
                opacity already worked), NOT by the `isHovered` React state --
                using `isHovered` here caused a feedback loop: the band (a
                sibling of the `<a>`, stacked on top of it) would intercept
                the pointer as soon as it became interactive, which the
                browser reads as "left the `<a>`", flipping `isHovered` back
                off, which removed the band again, letting the `<a>` reclaim
                the pointer and flip `isHovered` back on -- an infinite loop
                visible as rapid cursor/hover flicker. `group-hover` doesn't
                have this problem because it's evaluated against the `.group`
                ancestor, which stays hovered regardless of which of its
                descendants is the actual pointer target. */}
            <div className="absolute top-0 right-0 h-full w-20 z-20 hidden md:flex
                              pointer-events-none group-hover:pointer-events-auto
                              flex-col items-center justify-between py-2">
            <div className="relative">
              <button
                ref={starButtonRef}
                onClick={handleStarClick}
                onMouseEnter={() => setStarButtonHovered(true)}
                onMouseLeave={() => setStarButtonHovered(false)}
                className={`star-button p-4 ${settings?.alwaysShowStarIcon ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                style={{
                  '--gradient-id': `url(#rainbow-gradient-${g.id})`,
                  transform: starClicked === true ? 'scale(2)' :
                             starClicked === false ? 'scale(0.5)' :
                             starButtonHovered ? 'scale(1.1)' :
                             'scale(1)',
                  transition: starClicked === true ? 'transform 400ms ease, opacity 300ms ease' :
                             starClicked === false ? 'transform 300ms ease, opacity 300ms ease' :
                             'transform 300ms ease, opacity 300ms ease'
                }}
                title={isFavorite ? t('card.removeFromFavorites', currentLocale) : t('card.addToFavorites', currentLocale)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" strokeWidth="1.5">
                  <defs>
                    <linearGradient id={`rainbow-gradient-${g.id}`} x1="0%" y1="0%" x2="600%" y2="0%">
                      <stop offset="0%" style={{stopColor: 'red'}} />
                      <stop offset="12.5%" style={{stopColor: 'orange'}} />
                      <stop offset="25%" style={{stopColor: 'yellow'}} />
                      <stop offset="37.5%" style={{stopColor: 'green'}} />
                      <stop offset="50%" style={{stopColor: 'cyan'}} />
                      <stop offset="62.5%" style={{stopColor: 'blue'}} />
                      <stop offset="75%" style={{stopColor: 'indigo'}} />
                      <stop offset="87.5%" style={{stopColor: 'violet'}} />
                      <stop offset="100%" style={{stopColor: 'red'}} />
                      <animateTransform
                        attributeName="gradientTransform"
                        type="translate"
                        values="0 0; -3 0; 0 0"
                        dur="2s"
                        repeatCount="indefinite"
                        calcMode="spline"
                        keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
                      />
                    </linearGradient>
                  </defs>
                  <path
                    className="star-path"
                    strokeLinejoin="miter"
                    d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                    fill={isFavorite ? '#facc15' : 'none'}
                    stroke='#facc15'
                    style={{transition: 'fill 0.3s ease, stroke 0.3s ease'}}
                  />
                </svg>
              </button>
              {sparkles.map((sparkle) => (
                <div
                  key={sparkle.id}
                  className="absolute top-1/2 left-1/2 pointer-events-none"
                  style={{
                    '--sparkle-angle': `${sparkle.angle}deg`,
                    '--sparkle-distance': `${sparkle.distance}px`,
                    animation: 'sparkle-fade 600ms ease-out forwards',
                  }}
                >
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill={sparkle.color}>
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                  </svg>
                </div>
              ))}
            </div>

            {/* Play Button (bottom of hover band) */}
            {g.movies && g.movies.length > 0 && (
              <div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onShowVideoModal(g);
                  }}
                  onMouseEnter={() => setPlayButtonHovered(true)}
                  onMouseLeave={() => setPlayButtonHovered(false)}
                  className="play-button p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    '--play-gradient-id': `url(#green-gradient-${g.id})`,
                    transform: playButtonHovered ? 'scale(1.1)' : 'scale(1)',
                    transition: 'transform 300ms ease, opacity 300ms ease'
                  }}
                  title={t('card.playVideo', currentLocale)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" strokeWidth="1.5">
                    <defs>
                      <linearGradient id={`green-gradient-${g.id}`} x1="0%" y1="0%" x2="400%" y2="0%">
                        <stop offset="0%" style={{stopColor: '#16a34a'}} />
                        <stop offset="25%" style={{stopColor: '#22c55e'}} />
                        <stop offset="50%" style={{stopColor: '#84cc16'}} />
                        <stop offset="75%" style={{stopColor: '#22c55e'}} />
                        <stop offset="100%" style={{stopColor: '#16a34a'}} />
                        <animateTransform
                          attributeName="gradientTransform"
                          type="translate"
                          values="0 0; -2 0; 0 0"
                          dur="2s"
                          repeatCount="indefinite"
                          calcMode="spline"
                          keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
                        />
                      </linearGradient>
                    </defs>
                    <path
                      className="play-path"
                      d="M8 5v14l11-7z"
                      fill="#84cc16"
                      stroke="#84cc16"
                    />
                  </svg>
                </button>
              </div>
            )}
            </div>

            <a href={linkFor(g, settings.navigateToReviews)}
               target={settings.useInPageNavigation ? undefined : "_blank"}
               ref={cardRef}
               className={`block rounded-2xl ${theme.cardShadow} overflow-hidden ${showDetailModal ? 'relative z-50' : ''}`}
               style={{
                 WebkitTouchCallout: 'none',
                 WebkitUserSelect: 'none'
               }}
               onMouseEnter={(e) => {
                 setIsHovered(true);
                 setShiftPressed(e.shiftKey);
                 // Remove focus from search input to enable shortcuts
                 if (document.activeElement && document.activeElement.tagName === 'INPUT') {
                   document.activeElement.blur();
                 }
               }}
               onMouseMove={(e) => {
                 setShiftPressed(e.shiftKey);
               }}
               onMouseLeave={() => {
                 setIsHovered(false);
                 setShiftPressed(false);
                 onCloseForceDetail?.();
               }}
               onTouchStart={handleTouchStart}
               onTouchEnd={handleTouchEnd}
               onTouchMove={handleTouchMove}
               onClick={handleCardClick}
               onContextMenu={(e) => {
                 const isMobile = window.innerWidth < 768;
                 if (isMobile) {
                   e.preventDefault();
                 }
               }}>
            <div className="flex h-[234px] relative overflow-hidden">
              <div className="absolute inset-0">
                <img
                  src={cap}
                  alt={`${g.title} cover`}
                  loading="lazy"
                  decoding="async"
                  className="absolute h-full object-cover block transition-all duration-300 ease-in-out"
                  style={{
                    width: '616px',
                    left: (isHovered || isSticky) ? '50%' : 'calc(100% - 110px)',
                    transform: 'translateX(-50%)'
                  }}
                />
                <div ref={detailRef} className={`absolute inset-0 ${theme.cardBg} ${theme.text} p-4 overflow-y-auto z-20 transition-transform duration-300 ease-in-out`}
                     style={{
                       transform: (isHovered && shiftPressed) || showDetailModal || forceDetailOpen ? 'translateX(0)' : 'translateX(calc(-100% - 2px))',
                       touchAction: showDetailModal ? 'pan-y' : 'auto'
                     }}
                     onTouchStart={(e) => {
                       if (showDetailModal) {
                         e.stopPropagation();
                       }
                     }}
                     onTouchMove={(e) => {
                       if (showDetailModal) {
                         e.stopPropagation();
                       }
                     }}
                     onTouchEnd={(e) => {
                       if (showDetailModal) {
                         e.stopPropagation();
                       }
                     }}>
                  <div className={`mb-2 pb-2 border-b ${theme.border}`}>
                    <div className="text-sm">{g.title}</div>
                  </div>
                  <div className="flex gap-6 text-xs">
                    <div className="flex-1 flex flex-col gap-1">
                      <div>
                        <div>{t('card.genre', currentLocale)}:</div>
                        <div>{genres.join('、')}</div>
                        <div className="mt-1"></div>
                      </div>
                      {g.tags && g.tags.length > 0 && (
                        <div>
                          <div>{t('card.tags', currentLocale)}:</div>
                          <div>{g.tags.join('、')}</div>
                          <div className="mt-1"></div>
                        </div>
                      )}
                      <div>{t('price.regular', currentLocale)}: {formatPrice(g.regularPrice, currentRegion, currentLocale)}</div>
                      {g.salePrice != null && (
                        <div className={theme.saleText}>
                          {t('price.sale', currentLocale)}: {formatPrice(g.salePrice, currentRegion, currentLocale)}
                          {g.discountPercent && ` (-${g.discountPercent}%)`}
                        </div>
                      )}
                      <div>{t('price.lowest', currentLocale)}: {g.lowestPrice ? formatPrice(g.lowestPrice, currentRegion, currentLocale) : t('price.unknown', currentLocale)}</div>
                      {g.reviewScore && (
                        <>
                          <div className="mt-1"></div>
                          <div>{t('card.overallRating', currentLocale)}: {translateReviewScore(g.reviewScore)}</div>
                        </>
                      )}
                      {g.releaseDate && (
                        <>
                          <div className="mt-1"></div>
                          <div>{t('card.releaseDate', currentLocale)}: {formatDate(g.releaseDate, currentLocale)}</div>
                        </>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col gap-1">
                      {g.platforms && (
                        <>
                          <div>
                            <div>{t('card.platforms', currentLocale)}:</div>
                            <div>
                              {[
                                g.platforms.windows && 'Windows',
                                g.platforms.mac && 'macOS',
                                g.platforms.linux && 'Linux'
                              ].filter(Boolean).join('、')}
                            </div>
                          </div>
                          <div className="mt-1"></div>
                        </>
                      )}
                      {currentLocale === 'ja' && (g.supportedLanguages || g.jp !== undefined) && (
                        <div>{t('card.japanese', currentLocale)}: {g.supportedLanguages ? checkJapaneseSupport(g.supportedLanguages) : (g.jp ? t('language.supported', currentLocale) : t('language.notSupported', currentLocale))}</div>
                      )}
                      {g.supportedLanguages && (
                        <div>
                          <div>{t('card.languages', currentLocale)}:</div>
                          <div>{cleanLanguageText(g.supportedLanguages)}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className={`w-[calc(100%-200px)] md:flex-1 p-4 flex flex-col relative z-10 transition-transform duration-300 ease-in-out ${theme.cardBg}`}
                   style={{transform: (isHovered || isSticky) ? 'translateX(-100%)' : 'translateX(0)'}}>
                <h3 className={`font-semibold text-base leading-tight pr-2 mb-2 overflow-hidden text-ellipsis ${theme.text}`}
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      wordBreak: 'break-word'
                    }}>
                  {g.title}
                </h3>
                {genres.slice(0, 3).map((tag) => (
                  <span key={tag} className={`text-[11px] ${theme.tagBg} ${theme.tagText} px-2 py-1 rounded-full whitespace-nowrap w-fit max-w-full overflow-hidden text-ellipsis block mb-1`}>{tag}</span>
                ))}
                {genres.length > 3 && (
                  <span className={`text-[11px] ${theme.tagBg} ${theme.tagText} px-2 py-1 rounded-full whitespace-nowrap w-fit`}>…</span>
                )}
                <div className="mt-auto space-y-0.5">
                  <div className="flex items-end justify-between text-sm gap-2">
                    <div className="flex-1">
                      {g.salePrice != null ? (
                        <>
                          <div className="text-[11px] line-through text-gray-400 leading-tight">{formatPrice(g.regularPrice, currentRegion, currentLocale)}</div>
                          <div className={`font-medium flex items-center gap-2 leading-tight ${g.salePrice === 0 ? 'text-green-500' : theme.saleText}`}>
                            {formatPrice(g.salePrice, currentRegion, currentLocale)}
                            {g.discountPercent && g.salePrice > 0 && (
                              <span className={`text-[11px] ${theme.saleBg} text-white px-1.5 py-0.5 rounded`}>
                                -{g.discountPercent}%
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className={`font-medium leading-tight ${g.regularPrice === 0 ? 'text-green-500' : theme.text}`}>
                          {formatPrice(g.regularPrice, currentRegion, currentLocale)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className={`text-[11px] ${theme.lowestText}`}>
                      {g.lowestPrice && g.lowestPrice !== '-' ? `${formatPrice(g.lowestPrice, currentRegion, currentLocale)}(${t('price.lowest', currentLocale)})` : t('price.unknown', currentLocale)}
                    </div>
                    {currentLocale === 'ja' && checkJapaneseSupport(g.supportedLanguages) === t('language.supported', currentLocale) && (
                      <div className={`hidden md:block text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap ${theme.tagBg} ${theme.tagText}`}>
                        {t('card.japanese', currentLocale)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="w-[200px] md:w-[220px] h-full relative z-0"></div>
            </div>
          </a>

          </div>

          {/* Folder dropdown for quick registration - Portal to body */}
          {showFolderDropdown && folders && ReactDOM.createPortal(
            <div
              ref={dropdownRef}
              className={`fixed z-50 ${theme.cardBg} ${theme.cardShadow} rounded-lg overflow-hidden min-w-[160px]`}
              style={{
                left: `${dropdownPosition.x}px`,
                top: `${dropdownPosition.y}px`
              }}
              onMouseLeave={handleDropdownHoverOut}
            >
              <div className={`${theme.text} max-h-[200px] overflow-y-auto`} style={{ overscrollBehavior: "contain" }}>
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleFolderSelect(folder.id);
                    }}
                    className={`block w-full text-left px-4 py-2 text-sm whitespace-nowrap ${theme.modalHover}`}
                  >
                    {folder.name}
                  </button>
                ))}
              </div>
            </div>,
            document.body
          )}
          </>
        );
}

// Memoize GameCard to prevent unnecessary re-renders
// Only re-render when props actually change
export const GameCard = React.memo(GameCardComponent);

