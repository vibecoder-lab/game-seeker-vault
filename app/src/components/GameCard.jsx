import React from 'react';
import { t, currentLocale, formatPrice, formatDate } from '../i18n/index.js';
import { normalizeGenres, formatReleaseDate, checkJapaneseSupport, cleanLanguageText, translateReviewScore, yen } from '../utils/format.js';
import { steamCapsuleUrl, linkFor } from '../utils/steam.js';

function GameCardComponent({ g, theme, priceMode, favoriteData, onToggleFavorite, settings, locale }) {
  const [isHovered, setIsHovered] = React.useState(false);
  const [shiftPressed, setShiftPressed] = React.useState(false);
  const [starHovered, setStarHovered] = React.useState(false);
  const [starButtonHovered, setStarButtonHovered] = React.useState(false);
  const [starClicked, setStarClicked] = React.useState(null);
  const [sparkles, setSparkles] = React.useState([]);
  const cardRef = React.useRef(null);
  const detailRef = React.useRef(null);
  const cap = steamCapsuleUrl(g);
  const genres = g.genres?.length ? normalizeGenres(g.genres) : ['(genre unknown)'];
  const isFavorite = favoriteData && !favoriteData.deleted;

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

  const handleStarClick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const wasAlreadyFavorite = isFavorite;
    setStarClicked(!wasAlreadyFavorite);

    if (!wasAlreadyFavorite) {
      const newSparkles = Array.from({ length: 8 }, (_, i) => ({
        id: Date.now() + i,
        angle: (360 / 8) * i,
      }));
      setSparkles(newSparkles);
      setTimeout(() => setSparkles([]), 600);
    }

    setTimeout(() => setStarClicked(null), wasAlreadyFavorite ? 300 : 400);
    onToggleFavorite(g);
  };

        return (
          <div key={g.id} className="relative group">
            <div className="absolute top-2 right-2 z-20 hidden md:block">
              <button
                onClick={handleStarClick}
                onMouseEnter={() => {
                  setStarHovered(true);
                  setStarButtonHovered(true);
                }}
                onMouseLeave={() => {
                  setStarHovered(false);
                  setStarButtonHovered(false);
                }}
                className={`p-2 ${settings?.alwaysShowStarIcon ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                style={{
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
                    strokeLinejoin="miter"
                    d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                    fill={starHovered ? `url(#rainbow-gradient-${g.id})` : (isFavorite ? '#facc15' : 'none')}
                    stroke={starHovered ? `url(#rainbow-gradient-${g.id})` : '#facc15'}
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
                    animation: 'sparkle-fade 600ms ease-out forwards',
                  }}
                >
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="#facc15">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                  </svg>
                </div>
              ))}
            </div>
            <a href={linkFor(g)} target="_blank" rel="noreferrer noopener"
               ref={cardRef}
               className={`block rounded-2xl ${theme.cardShadow} overflow-hidden`}
               onMouseEnter={(e) => {
                 setIsHovered(true);
                 setShiftPressed(e.shiftKey);
               }}
               onMouseMove={(e) => {
                 setShiftPressed(e.shiftKey);
               }}
               onMouseLeave={() => {
                 setIsHovered(false);
                 setShiftPressed(false);
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
                    left: isHovered ? '50%' : 'calc(100% - 110px)',
                    transform: 'translateX(-50%)'
                  }}
                />
                <div ref={detailRef} className={`absolute inset-0 ${theme.cardBg} ${theme.text} p-4 overflow-y-auto z-20 transition-transform duration-300 ease-in-out`}
                     style={{transform: (isHovered && shiftPressed) ? 'translateX(0)' : 'translateX(-100%)'}}>
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
                      <div>{t('price.regular', currentLocale)}: {formatPrice(g.priceYenResolved, currentLocale)}</div>
                      {g.salePriceYen && (
                        <div className={theme.saleText}>
                          {t('price.sale', currentLocale)}: {formatPrice(g.salePriceYen, currentLocale)}
                          {g.discountPercent && ` (-${g.discountPercent}%)`}
                        </div>
                      )}
                      <div>{t('price.lowest', currentLocale)}: {g.lowestYenResolved ? formatPrice(g.lowestYenResolved, currentLocale) : t('price.unknown', currentLocale)}</div>
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
                      {(g.supportedLanguages || g.jp !== undefined) && (
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

              <div className={`flex-1 p-4 flex flex-col relative z-10 transition-transform duration-300 ease-in-out ${theme.cardBg}`}
                   style={{transform: isHovered ? 'translateX(-100%)' : 'translateX(0)'}}>
                <h3 className={`font-semibold text-base leading-tight pr-2 ${theme.text}`}>
                  {(() => {
                    const spaceCount = (g.title.match(/[ 　]/g) || []).length;
                    if (spaceCount >= 4) {
                      return g.title.length > 26 ? g.title.substring(0, 26) + '…' : g.title;
                    } else if (spaceCount >= 3) {
                      return g.title.length > 21 ? g.title.substring(0, 21) + '…' : g.title;
                    } else {
                      return g.title.length > 30 ? g.title.substring(0, 30) + '…' : g.title;
                    }
                  })()}
                </h3>
                <div className="mt-2 flex flex-col gap-1">
                  {genres.slice(0, 3).map((tag) => (
                    <span key={tag} className={`text-[11px] ${theme.tagBg} ${theme.tagText} px-2 py-1 rounded-full whitespace-nowrap w-fit`}>{tag}</span>
                  ))}
                  {genres.length > 3 && (
                    <span className={`text-[11px] ${theme.tagBg} ${theme.tagText} px-2 py-1 rounded-full whitespace-nowrap w-fit`}>…</span>
                  )}
                </div>
                <div className="mt-auto space-y-0.5">
                  <div className="flex items-end justify-between text-sm gap-2">
                    <div className="flex-1">
                      {g.salePriceYen ? (
                        <>
                          <div className="text-[11px] line-through text-gray-400 leading-tight">{formatPrice(g.priceYenResolved, currentLocale)}</div>
                          <div className={`font-medium flex items-center gap-2 leading-tight ${g.salePriceYen === 0 ? 'text-green-500' : theme.saleText}`}>
                            {formatPrice(g.salePriceYen, currentLocale)}
                            {g.discountPercent && (
                              <span className={`text-[11px] ${theme.saleBg} text-white px-1.5 py-0.5 rounded`}>
                                -{g.discountPercent}%
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className={`font-medium leading-tight ${g.priceYenResolved === 0 ? 'text-green-500' : theme.text}`}>
                          {formatPrice(g.priceYenResolved, currentLocale)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className={`text-[11px] ${theme.lowestText}`}>
                      {g.lowestYenResolved && g.lowestYenResolved !== '-' ? `${formatPrice(g.lowestYenResolved, currentLocale)}(${t('price.lowest', currentLocale)})` : t('price.unknown', currentLocale)}
                    </div>
                    {checkJapaneseSupport(g.supportedLanguages) === t('language.supported', currentLocale) && (
                      <div className={`text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap ${theme.jpBg} ${theme.jpText}`}>
                        {t('card.japanese', currentLocale)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="w-[220px] h-full relative z-0"></div>
            </div>
          </a>
          </div>
        );
}

// Memoize GameCard to prevent unnecessary re-renders
// Only re-render when props actually change
export const GameCard = React.memo(GameCardComponent, (prevProps, nextProps) => {
  // Custom comparison for better performance
  return (
    prevProps.g.id === nextProps.g.id &&
    prevProps.priceMode === nextProps.priceMode &&
    prevProps.theme === nextProps.theme &&
    prevProps.favoriteData?.folderId === nextProps.favoriteData?.folderId &&
    prevProps.favoriteData?.deleted === nextProps.favoriteData?.deleted &&
    prevProps.settings === nextProps.settings &&
    prevProps.locale === nextProps.locale
  );
});

