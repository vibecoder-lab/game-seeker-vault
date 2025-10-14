import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

// Import i18n
import { t, currentLocale, setLocale, detectLocale, formatPrice, formatYear, formatDate, translateGenre, translateReview } from './i18n/index.js'

// Import constants
import { DEFAULT_SETTINGS, DB_NAME, DB_VERSION, FOLDERS_STORE, FAVORITES_STORE, SETTINGS_STORE, BAND_REPRESENTATIVE_PRICE_YEN, THEMES, STEAM_TAGS_TO_EXCLUDE } from './constants/index.js'
import { GENRE_MAPPING } from './constants/genres.js'
import { REVIEW_SCORE_MAPPING } from './constants/reviews.js'

// Import utilities
import { formatDateTime, normalizeGenres, translateReviewScore, formatReleaseDate, checkJapaneseSupport, cleanLanguageText, truncateByWidth, yen, unique } from './utils/format.js'
import { linkFor, appIdFromUrl, steamCapsuleUrl } from './utils/steam.js'

// Import database
import { dbHelper, initDB } from './db/index.js'

      function GameCard({ g, theme, priceMode, favoriteData, onToggleFavorite, settings }) {
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
          setStarClicked(!wasAlreadyFavorite); // true for adding, false for removing

          if (!wasAlreadyFavorite) {
            // On registration: scatter stars effect
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
                className={`p-2 transition-all ${settings?.alwaysShowStarIcon ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                style={{
                  transform: starClicked === true ? 'scale(2)' :
                             starClicked === false ? 'scale(0.5)' :
                             starButtonHovered ? 'scale(1.1)' :
                             'scale(1)',
                  transitionDuration: starClicked === true ? '400ms' :
                                     starClicked === false ? '300ms' :
                                     '300ms'
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

      function SteamPriceFilter({ initialData = null }) {
        const [rawGames, setRawGames] = React.useState(initialData ?? []);
        const [loading, setLoading] = React.useState(!initialData);
        const [selectedGenres, setSelectedGenres] = React.useState({ include: [], exclude: [] });
        const [onlyJP, setOnlyJP] = React.useState(false);
        const [onlySale, setOnlySale] = React.useState(false);
        const [onlyOverwhelming, setOnlyOverwhelming] = React.useState(false);
        const [onlyMac, setOnlyMac] = React.useState(false);
        const [selectedYear, setSelectedYear] = React.useState('all');
        const [showYearDropdown, setShowYearDropdown] = React.useState(false);
        const [searchTitle, setSearchTitle] = React.useState('');
        const [minPrice, setMinPrice] = React.useState(100);
        const [maxPrice, setMaxPrice] = React.useState(2000);
        const [priceMode, setPriceMode] = React.useState('current');
        const [sortOrder, setSortOrder] = React.useState('asc');
        const [currentTheme, setCurrentTheme] = React.useState('default');
        const [showScrollTop, setShowScrollTop] = React.useState(false);
        const [isScrolled, setIsScrolled] = React.useState(false);
        const [showMobileFilterModal, setShowMobileFilterModal] = React.useState(false);
        const [showMobileGenreModal, setShowMobileGenreModal] = React.useState(false);
        const [isClosingFilterModal, setIsClosingFilterModal] = React.useState(false);
        const [isClosingGenreModal, setIsClosingGenreModal] = React.useState(false);
        const [isClosingHelpModal, setIsClosingHelpModal] = React.useState(false);
        const [showFavoritesModal, setShowFavoritesModal] = React.useState(false);
        const [shiftPressedForDelete, setShiftPressedForDelete] = React.useState(false);
        const [isHoveringDeleteButton, setIsHoveringDeleteButton] = React.useState(false);
        const [showImportExportModal, setShowImportExportModal] = React.useState(false);
        const [showHelpModal, setShowHelpModal] = React.useState(false);
        const [helpActiveTab, setHelpActiveTab] = React.useState('disclaimer');
        const [showSettingsModal, setShowSettingsModal] = React.useState(false);
        const [settings, setSettings] = React.useState(DEFAULT_SETTINGS);
        const [folders, setFolders] = React.useState([]);
        const [selectedFolderId, setSelectedFolderId] = React.useState(null);
        const [favoritesMap, setFavoritesMap] = React.useState({});
        const [targetFolderId, setTargetFolderId] = React.useState(null);
        const [showFolderDropdown, setShowFolderDropdown] = React.useState(false);
        const [clearButtonPressed, setClearButtonPressed] = React.useState(false);
        const [forceUpdate, setForceUpdate] = React.useState(0);
        const theme = THEMES[currentTheme];

        React.useEffect(() => {
          const handleScroll = () => {
            setShowScrollTop(window.scrollY > 300);
            setIsScrolled(window.scrollY > 0);
          };
          window.addEventListener('scroll', handleScroll);
          return () => window.removeEventListener('scroll', handleScroll);
        }, []);

        React.useEffect(() => {
          let shiftCPressed = false;
          let shiftTPressed = false;

          const handleKeyDown = (e) => {
            if (e.key === 'Shift') {
              setShiftPressedForDelete(true);
            }

            // Disable in input fields
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
              return;
            }

            // Collection modal open/close
            // ANSI: Shift+C / Shift+? (Slash)
            // ISO (JIS): Shift+| (IntlBackslash)
            // Alternative key: Shift+Z
            let collectionKeys = [];
            if (settings?.useAlternativeKeys) {
              collectionKeys = ['KeyZ'];
              if (settings?.keyboardLayout === 'iso') {
                collectionKeys.push('IntlBackslash');  // Shift+Z / Shift+|
              } else {
                collectionKeys.push('Slash');    // Shift+Z / Shift+?
              }
            } else {
              if (settings?.keyboardLayout === 'iso') {
                collectionKeys = ['IntlBackslash'];    // Shift+| only
              } else {
                collectionKeys = ['KeyC', 'Slash']; // Shift+C / Shift+?
              }
            }
            if (e.shiftKey && collectionKeys.includes(e.code) && !shiftCPressed) {
              e.preventDefault();
              shiftCPressed = true;
              setShowFavoritesModal(prev => !prev);
              return;
            }

            // Scroll to page top
            // ANSI: Shift+T / Shift+> (Period)
            // ISO (JIS): Shift+? (Slash)
            // Alternative key: Shift+X
            let scrollTopKeys = [];
            if (settings?.useAlternativeKeys) {
              scrollTopKeys = ['KeyX'];
              if (settings?.keyboardLayout === 'iso') {
                scrollTopKeys.push('Slash');     // Shift+X / Shift+?
              } else {
                scrollTopKeys.push('Period');    // Shift+X / Shift+>
              }
            } else {
              if (settings?.keyboardLayout === 'iso') {
                scrollTopKeys = ['Slash'];       // Shift+? only
              } else {
                scrollTopKeys = ['KeyT', 'Period']; // Shift+T / Shift+>
              }
            }
            if (e.shiftKey && scrollTopKeys.includes(e.code) && !shiftTPressed) {
              e.preventDefault();
              shiftTPressed = true;
              window.scrollTo({ top: 0, behavior: 'smooth' });
              return;
            }
          };

          const handleKeyUp = (e) => {
            if (e.key === 'Shift') {
              setShiftPressedForDelete(false);
            }
            // Reset flag for collection modal (C/Z, /, IntlBackslash)
            if (e.code === 'KeyC' || e.code === 'KeyZ' || e.code === 'Slash' || e.code === 'IntlBackslash') {
              shiftCPressed = false;
            }
            // Reset flag for page top (T/X, ., /, IntlRo)
            if (e.code === 'KeyT' || e.code === 'KeyX' || e.code === 'Period' || e.code === 'Slash' || e.code === 'IntlRo') {
              shiftTPressed = false;
            }
          };

          window.addEventListener('keydown', handleKeyDown);
          window.addEventListener('keyup', handleKeyUp);
          return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
          };
        }, [settings?.useAlternativeKeys, settings?.keyboardLayout]);

        React.useEffect(() => {
          if (initialData) return;
          (async () => {
            try {
              setLoading(true);
              // Auto-detect data source: localhost/127.0.0.1 = local, otherwise = production
              const isLocal =
                window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname === '';
              const url = isLocal
                ? '../../updater/data/current/games.json'
                : '/api/games-data';
              const res = await fetch(url, { cache: 'no-store' });
              const data = await res.json();
              setRawGames(Array.isArray(data) ? data : []);
            } catch (e) { setRawGames([]); } finally { setLoading(false); }
          })();
        }, [initialData]);

        // Load settings
        React.useEffect(() => {
          (async () => {
            // Initialize locale
            const detected = await detectLocale();
            setLocale(detected);
            setForceUpdate(prev => prev + 1);

            const loadedSettings = await dbHelper.loadSettings();
            setSettings(loadedSettings);
            // Restore saved theme only when saveTheme is true
            if (loadedSettings.saveTheme && loadedSettings.theme) {
              setCurrentTheme(loadedSettings.theme);
            } else {
              setCurrentTheme('default');
            }
          })();
        }, []);

        // Update document title when locale changes
        React.useEffect(() => {
          document.title = t('page.title', currentLocale);
        }, [forceUpdate]);

        // Initialize folders and favorites
        React.useEffect(() => {
          (async () => {
            const existingFolders = await dbHelper.getFolders();
            if (existingFolders.length === 0) {
              // Detect locale first for folder initialization
              const locale = await detectLocale();
              const defaultFolderId = await dbHelper.addFolder(t('folder.default.interested', locale));
              const folder2Id = await dbHelper.addFolder(t('folder.default.wishlist', locale));
              const folder3Id = await dbHelper.addFolder(t('folder.default.owned', locale));
              setFolders([
                { id: defaultFolderId, name: t('folder.default.interested', locale), createdAt: formatDateTime(Date.now()) },
                { id: folder2Id, name: t('folder.default.wishlist', locale), createdAt: formatDateTime(Date.now()) },
                { id: folder3Id, name: t('folder.default.owned', locale), createdAt: formatDateTime(Date.now()) }
              ]);
              setSelectedFolderId(defaultFolderId);
              setTargetFolderId(defaultFolderId);
            } else {
              // Convert date format of existing data (YY-MM-DD → YYYY-MM-DD)
              const db = await initDB();

              // Convert folder dates
              const folderTx = db.transaction('folders', 'readwrite');
              const folderStore = folderTx.objectStore('folders');
              for (const folder of existingFolders) {
                if (folder.createdAt && folder.createdAt.match(/^\d{2}-\d{2}-\d{2}/)) {
                  const parts = folder.createdAt.split(' ');
                  const dateParts = parts[0].split('-');
                  const year = parseInt(dateParts[0]);
                  const fullYear = year < 50 ? 2000 + year : 1900 + year;
                  folder.createdAt = `${fullYear}-${dateParts[1]}-${dateParts[2]}${parts[1] ? ' ' + parts[1] : ''}`;
                  await new Promise((resolve, reject) => {
                    const request = folderStore.put(folder);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                  });
                }
              }

              // Convert favorite dates
              const favTx = db.transaction('favorites', 'readwrite');
              const favStore = favTx.objectStore('favorites');
              const allFavs = await new Promise((resolve, reject) => {
                const request = favStore.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
              });

              for (const fav of allFavs) {
                if (fav.createdAt && fav.createdAt.match(/^\d{2}-\d{2}-\d{2}/)) {
                  const parts = fav.createdAt.split(' ');
                  const dateParts = parts[0].split('-');
                  const year = parseInt(dateParts[0]);
                  const fullYear = year < 50 ? 2000 + year : 1900 + year;
                  fav.createdAt = `${fullYear}-${dateParts[1]}-${dateParts[2]}${parts[1] ? ' ' + parts[1] : ''}`;
                  await new Promise((resolve, reject) => {
                    const request = favStore.put(fav);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                  });
                }
              }

              db.close();

              // Translate folder names if they are translation keys
              const locale = currentLocale || 'en';
              const translatedFolders = existingFolders.map(folder => {
                // Check if folder name is a translation key
                if (folder.name === 'folder.default.interested' || folder.name.includes('folder.default.interested')) {
                  return { ...folder, name: t('folder.default.interested', locale) };
                } else if (folder.name === 'folder.default.wishlist' || folder.name.includes('folder.default.wishlist')) {
                  return { ...folder, name: t('folder.default.wishlist', locale) };
                } else if (folder.name === 'folder.default.owned' || folder.name.includes('folder.default.owned')) {
                  return { ...folder, name: t('folder.default.owned', locale) };
                }
                return folder;
              });

              // Update folder names in database if they were translation keys
              for (const folder of translatedFolders) {
                const original = existingFolders.find(f => f.id === folder.id);
                if (original && original.name !== folder.name) {
                  await dbHelper.updateFolder(folder.id, folder.name);
                }
              }

              setFolders(translatedFolders);
              setSelectedFolderId(translatedFolders[0].id);
              setTargetFolderId(translatedFolders[0].id);
            }
          })();
        }, []);

        // Update favorites map
        React.useEffect(() => {
          (async () => {
            const allFavorites = {};
            for (const folder of folders) {
              const favs = await dbHelper.getFavoritesByFolder(folder.id);
              favs.forEach(fav => {
                allFavorites[fav.gameId] = fav;
              });
            }
            setFavoritesMap(allFavorites);
          })();
        }, [folders]);

        const handleToggleFavorite = async (game) => {
          const existing = await dbHelper.getFavoriteByGameId(game.id);
          if (existing) {
            if (existing.deleted) {
              // Restore if deletion flag is set
              await dbHelper.restoreFromTrash(existing.id);
              setFavoritesMap(prev => ({
                ...prev,
                [game.id]: { ...existing, deleted: false }
              }));
            } else {
              // Physical deletion if deletion flag is not set
              await dbHelper.deleteFavorite(existing.id);
              setFavoritesMap(prev => {
                const newMap = { ...prev };
                delete newMap[game.id];
                return newMap;
              });
            }
          } else {
            const targetFolder = folders.find(f => f.id === targetFolderId) || folders[0];
            if (targetFolder) {
              const newFavId = await dbHelper.addFavorite(targetFolder.id, game.id);
              // Add to favoritesMap
              setFavoritesMap(prev => ({
                ...prev,
                [game.id]: { id: newFavId, folderId: targetFolder.id, gameId: game.id, deleted: false }
              }));
            }
          }
        };

        const games = React.useMemo(() => (rawGames || []).map((g) => {
          // New data structure (prices.JP)
          const normal = g.prices?.JP?.price || 0;
          const salePrice = g.prices?.JP?.salePrice || null;
          const discountPercent = g.prices?.JP?.discountPercent || null;

          // Lowest price: prioritize new format (lowest.JP), check old format (lowestYen) for backward compatibility
          const lowestJP = g.lowest?.JP !== undefined && g.lowest?.JP !== '-' ? g.lowest.JP : (g.lowestYen || null);
          // If lowest price is unavailable, prioritize sale price, otherwise use normal price
          const lowest = lowestJP || salePrice || normal;

          const genres = Array.isArray(g.genres) ? g.genres : [];

          return {
            ...g,
            priceYenResolved: normal,
            salePriceYen: salePrice,
            discountPercent: discountPercent,
            lowestYenResolved: lowest,
            genres
          };
        }), [rawGames]);

        const allGenres = React.useMemo(() => {
          const allTags = unique(games.flatMap((g) => g.genres)).sort((a,b)=>a.localeCompare(b));

          // Separate genres and other tags
          const nonGenreTags = ['Casual', 'Early Access', 'Indie', 'Free To Play'];
          const genres = allTags.filter(tag => !nonGenreTags.includes(tag));
          const otherTags = allTags.filter(tag => nonGenreTags.includes(tag));

          return { genres, otherTags };
        }, [games]);

        const allYears = React.useMemo(() => {
          const years = games
            .map(g => {
              if (!g.releaseDate) return null;
              // For YYYY-MM-DD format
              if (g.releaseDate.includes('-')) {
                return g.releaseDate.split('-')[0];
              }
              // For "DD MMM, YYYY" format (e.g., "20 Oct, 2022")
              const match = g.releaseDate.match(/\d{4}$/);
              return match ? match[0] : null;
            })
            .filter(y => y !== null && y !== '' && !isNaN(y));
          return unique(years).sort((a, b) => b - a);
        }, [games]);

        const filtered = React.useMemo(() => {
          return games.filter((g) => {
            const matchesJP = onlyJP ? checkJapaneseSupport(g.supportedLanguages) === t('language.supported', currentLocale) : true;
            const matchesSale = onlySale ? g.salePriceYen : true;
            const matchesOverwhelming = onlyOverwhelming ? g.reviewScore === 'Overwhelmingly Positive' : true;
            const matchesMac = onlyMac ? g.platforms?.mac === true : true;

            // Genre filter: consider include and exclude
            const matchesGenre = (() => {
              const hasInclude = selectedGenres.include.length > 0;
              const hasExclude = selectedGenres.exclude.length > 0;

              if (!hasInclude && !hasExclude) return true;

              const includeMatch = hasInclude ? selectedGenres.include.every((sel) => g.genres?.includes(sel)) : true;
              const excludeMatch = hasExclude ? !selectedGenres.exclude.some((sel) => g.genres?.includes(sel)) : true;

              return includeMatch && excludeMatch;
            })();

            const matchesYear = selectedYear === 'all' ? true : (() => {
              if (!g.releaseDate) return false;
              // YYYY-MM-DD format
              if (g.releaseDate.includes('-')) {
                return g.releaseDate.startsWith(selectedYear);
              }
              // "DD MMM, YYYY" format
              return g.releaseDate.endsWith(selectedYear);
            })();
            const matchesTitle = searchTitle ? g.title?.toLowerCase().includes(searchTitle.toLowerCase()) : true;
            // Current price (sale price if on sale, otherwise normal price)
            const currentPrice = g.salePriceYen || g.priceYenResolved;
            const inRange = currentPrice >= minPrice && currentPrice <= maxPrice;
            return matchesJP && matchesSale && matchesOverwhelming && matchesMac && matchesGenre && matchesYear && matchesTitle && inRange;
          });
        }, [games, onlyJP, onlySale, onlyOverwhelming, onlyMac, selectedGenres, selectedYear, searchTitle, minPrice, maxPrice]);

        const priceOf = React.useCallback((g) => {
          if (priceMode === 'current') {
            // Current price (sale price if available, otherwise normal price)
            return g.salePriceYen != null && g.salePriceYen < g.priceYenResolved ? g.salePriceYen : g.priceYenResolved;
          } else if (priceMode === 'normal') {
            // Normal price
            return g.priceYenResolved;
          } else if (priceMode === 'lowest') {
            // Lowest price
            return g.lowestYenResolved;
          } else if (priceMode === 'discount') {
            // Discount rate
            return g.discountPercent || 0;
          }
          return 0;
        }, [priceMode]);

        const handleCloseMobileFilterModal = () => {
          setIsClosingFilterModal(true);
          setTimeout(() => {
            setShowMobileFilterModal(false);
            setIsClosingFilterModal(false);
          }, 100);
        };

        const handleCloseMobileGenreModal = () => {
          setIsClosingGenreModal(true);
          setTimeout(() => {
            setShowMobileGenreModal(false);
            setIsClosingGenreModal(false);
          }, 100);
        };

        const handleCloseHelpModal = () => {
          setIsClosingHelpModal(true);
          setTimeout(() => {
            setShowHelpModal(false);
            setIsClosingHelpModal(false);
          }, 100);
        };

        const sorted = React.useMemo(() => {
          const arr = [...filtered];
          arr.sort((a,b) => {
            const priceA = priceOf(a);
            const priceB = priceOf(b);

            // Primary sort: compare by selected price mode
            const primaryDiff = priceA - priceB;

            // If primary sort values are equal, secondary sort by current price
            if (primaryDiff === 0) {
              const currentPriceA = a.salePriceYen != null && a.salePriceYen < a.priceYenResolved ? a.salePriceYen : a.priceYenResolved;
              const currentPriceB = b.salePriceYen != null && b.salePriceYen < b.priceYenResolved ? b.salePriceYen : b.priceYenResolved;
              return (currentPriceA - currentPriceB) * (sortOrder === 'asc' ? 1 : -1);
            }

            return primaryDiff * (sortOrder === 'asc' ? 1 : -1);
          });
          return arr;
        }, [filtered, priceOf, sortOrder]);

        return (
          <>
            {/* Mobile: Filter Modal (Bottom Sheet) */}
            {showMobileFilterModal && (
              <div className={isClosingFilterModal ? 'modal-fade-out' : 'modal-fade-in'} style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 9999,
                display: 'flex',
                alignItems: 'flex-end',
                backgroundColor: 'rgba(0,0,0,0.5)'
              }} onClick={handleCloseMobileFilterModal}>
                <div
                  className={`${theme.cardBg} ${theme.text} rounded-t-3xl w-full p-6 space-y-4 ${isClosingFilterModal ? 'bottom-sheet-slide-out' : 'bottom-sheet-slide-in'}`}
                  style={{height: '80vh', overflowY: 'auto'}}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold">{t('filter.title', currentLocale)}</h3>
                    <button onClick={handleCloseMobileFilterModal} className="p-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>

                  {/* Period */}
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

                  {/* Checkboxes */}
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

                  {/* Price */}
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

                  {/* Sort Target */}
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

                  {/* Sort Order */}
                  <div>
                    <div className="text-sm font-semibold mb-2">{t('filter.sortOrder', currentLocale)}</div>
                    <div className={`inline-flex rounded-xl ${theme.buttonBg} p-1 w-full`}>
                      <button onClick={()=>setSortOrder('asc')} className={`px-3 py-1.5 rounded-lg text-sm flex-1 ${sortOrder==='asc'?theme.buttonActive:''}`}>{t('filter.sortAsc', currentLocale)}</button>
                      <button onClick={()=>setSortOrder('desc')} className={`px-3 py-1.5 rounded-lg text-sm flex-1 ${sortOrder==='desc'?theme.buttonActive:''}`}>{t('filter.sortDesc', currentLocale)}</button>
                    </div>
                  </div>

                  {/* Close Button */}
                  <button
                    onClick={handleCloseMobileFilterModal}
                    className={`w-full py-3 rounded-lg ${currentTheme === 'steam' ? 'steam-blue-bg text-white' : 'bg-blue-500 text-white'} font-medium`}
                  >
                    {t('button.close', currentLocale)}
                  </button>
                </div>
              </div>
            )}

            {/* Mobile: Genre Modal (Bottom Sheet) */}
            {showMobileGenreModal && (
              <div className={isClosingGenreModal ? 'modal-fade-out' : 'modal-fade-in'} style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 9999,
                display: 'flex',
                alignItems: 'flex-end',
                backgroundColor: 'rgba(0,0,0,0.5)'
              }} onClick={handleCloseMobileGenreModal}>
                <div
                  className={`${theme.cardBg} ${theme.text} rounded-t-3xl w-full p-6 space-y-4 ${isClosingGenreModal ? 'bottom-sheet-slide-out' : 'bottom-sheet-slide-in'}`}
                  style={{maxHeight: '80vh', overflowY: 'auto'}}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold">{t('filter.genreAndFeature', currentLocale)}</h3>
                    <button onClick={handleCloseMobileGenreModal} className="p-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>

                  {/* Genre */}
                  <div>
                    <div className="text-sm font-semibold mb-2">{t('filter.genre', currentLocale)}</div>
                    <div className="grid grid-cols-2 gap-2">
                      {allGenres.genres.map((g) => {
                        const translatedGenre = translateGenre(g, currentLocale);
                        const displayName = truncateByWidth(translatedGenre, 15);
                        const isIncluded = selectedGenres.include.includes(g);
                        const isExcluded = selectedGenres.exclude.includes(g);

                        const handleGenreClick = (e) => {
                          e.preventDefault();
                          const isLongPress = e.type === 'contextmenu';

                          setSelectedGenres(prev => {
                            const currentlyIncluded = prev.include.includes(g);
                            const currentlyExcluded = prev.exclude.includes(g);

                            if (isLongPress) {
                              if (currentlyExcluded) {
                                return { ...prev, exclude: prev.exclude.filter(x => x !== g) };
                              } else {
                                return {
                                  include: prev.include.filter(x => x !== g),
                                  exclude: [...prev.exclude, g]
                                };
                              }
                            } else {
                              if (currentlyIncluded) {
                                return { ...prev, include: prev.include.filter(x => x !== g) };
                              } else {
                                return {
                                  exclude: prev.exclude.filter(x => x !== g),
                                  include: [...prev.include, g]
                                };
                              }
                            }
                          });
                        };

                        return (
                          <div key={g} className="flex items-center gap-2 text-sm cursor-pointer select-none" onClick={handleGenreClick} onContextMenu={handleGenreClick}>
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

                  {/* Features */}
                  {allGenres.otherTags.length > 0 && (
                    <div>
                      <div className="text-sm font-semibold mb-2">{t('filter.feature', currentLocale)}</div>
                      <div className="grid grid-cols-2 gap-2">
                        {allGenres.otherTags.map((g) => {
                          const translatedGenre = translateGenre(g, currentLocale);
                          const displayName = truncateByWidth(translatedGenre, 15);
                          const isIncluded = selectedGenres.include.includes(g);
                          const isExcluded = selectedGenres.exclude.includes(g);

                          const handleGenreClick = (e) => {
                            e.preventDefault();
                            const isLongPress = e.type === 'contextmenu';

                            setSelectedGenres(prev => {
                              const currentlyIncluded = prev.include.includes(g);
                              const currentlyExcluded = prev.exclude.includes(g);

                              if (isLongPress) {
                                if (currentlyExcluded) {
                                  return { ...prev, exclude: prev.exclude.filter(x => x !== g) };
                                } else {
                                  return {
                                    include: prev.include.filter(x => x !== g),
                                    exclude: [...prev.exclude, g]
                                  };
                                }
                              } else {
                                if (currentlyIncluded) {
                                  return { ...prev, include: prev.include.filter(x => x !== g) };
                                } else {
                                  return {
                                    exclude: prev.exclude.filter(x => x !== g),
                                    include: [...prev.include, g]
                                  };
                                }
                              }
                            });
                          };

                          return (
                            <div key={g} className="flex items-center gap-2 text-sm cursor-pointer select-none" onClick={handleGenreClick} onContextMenu={handleGenreClick}>
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

                  {/* Description */}
                  <div className={`text-xs ${theme.subText} p-3 rounded-lg ${theme.border} border`}>
                    <p>{t('filter.genreHelp', currentLocale)}</p>
                  </div>

                  {/* Close Button */}
                  <button
                    onClick={handleCloseMobileGenreModal}
                    className={`w-full py-3 rounded-lg ${currentTheme === 'steam' ? 'steam-blue-bg text-white' : 'bg-blue-500 text-white'} font-medium`}
                  >
                    {t('button.close', currentLocale)}
                  </button>
                </div>
              </div>
            )}

          <div className={`min-h-screen ${theme.bg} ${theme.text} transition-colors duration-100`}>
            <header className={`md:fixed top-0 left-0 right-0 z-30 ${theme.bg} px-6 py-4 transition-shadow duration-100 ${isScrolled ? 'md:shadow-md' : ''}`}>
              <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                <div className="flex flex-col md:flex-row md:items-end md:gap-3">
                  <div>
                    <style>{`
                      @keyframes gradient-move {
                        0%   { background-position:   0% 50%; }
                        50%  { background-position: 100% 50%; }
                        100% { background-position:   0% 50%; }
                      }
                      @keyframes shift-x {
                        0%   { background-position:   0% 50%; }
                        50%  { background-position: 100% 50%; }
                        100% { background-position:   0% 50%; }
                      }
                    `}</style>
                    <h1
                      className={`
                        text-xl sm:text-4xl font-extrabold
                        text-transparent bg-clip-text
                        bg-gradient-to-r from-pink-500 via-violet-500 to-sky-500
                        bg-[length:200%_200%]
                        [animation:gradient-move_6s_ease-in-out_infinite]
                        `
                    }>
                      {t('header.title', currentLocale)}
                    </h1>
                  </div>
                </div>

                {/* Mobile: Filter and Genre Buttons */}
                <div className="md:hidden flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (showMobileFilterModal) {
                        handleCloseMobileFilterModal();
                      } else {
                        setShowMobileFilterModal(true);
                      }
                    }}
                    className={`p-2 rounded-lg ${theme.cardShadow} hover:scale-110 transition-all ${showMobileFilterModal ? (currentTheme === 'steam' ? 'steam-blue-bg text-white' : `${theme.text}`) : `${theme.buttonBg}`}`}
                    style={showMobileFilterModal && currentTheme !== 'steam' ? {backgroundColor: 'currentColor', transition: 'background-color 0.1s ease, color 0.1s ease'} : {transition: 'background-color 0.1s ease, color 0.1s ease'}}
                    title={t('filter.title', currentLocale)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-colors duration-100" viewBox="0 0 24 24" fill="currentColor" style={showMobileFilterModal && currentTheme !== 'steam' ? {color: theme.buttonBg.includes('bg-gray-100') ? '#f3f4f6' : '#475569'} : {}}>
                      <path d="M3 3C2.45 3 2 3.45 2 4C2 4.28 2.11 4.53 2.29 4.71L9 11.41V21C9 21.55 9.45 22 10 22C10.28 22 10.53 21.89 10.71 21.71L13.71 18.71C13.89 18.53 14 18.28 14 18V11.41L20.71 4.71C20.89 4.53 21 4.28 21 4C21 3.45 20.55 3 20 3H3Z"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      if (showMobileGenreModal) {
                        handleCloseMobileGenreModal();
                      } else {
                        setShowMobileGenreModal(true);
                      }
                    }}
                    className={`p-2 rounded-lg ${theme.cardShadow} hover:scale-110 transition-all ${showMobileGenreModal ? (currentTheme === 'steam' ? 'steam-blue-bg text-white' : `${theme.text}`) : `${theme.buttonBg}`}`}
                    style={showMobileGenreModal && currentTheme !== 'steam' ? {backgroundColor: 'currentColor', transition: 'background-color 0.1s ease, color 0.1s ease'} : {transition: 'background-color 0.1s ease, color 0.1s ease'}}
                    title={t('filter.genre', currentLocale)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-colors duration-100" viewBox="0 0 24 24" fill="currentColor" style={showMobileGenreModal && currentTheme !== 'steam' ? {color: theme.buttonBg.includes('bg-gray-100') ? '#f3f4f6' : '#475569'} : {}}>
                      <path d="M21.41 11.58L12.41 2.58C12.05 2.22 11.55 2 11 2H4C2.9 2 2 2.9 2 4V11C2 11.55 2.22 12.05 2.59 12.42L11.59 21.42C11.95 21.78 12.45 22 13 22C13.55 22 14.05 21.78 14.41 21.41L21.41 14.41C21.78 14.05 22 13.55 22 13C22 12.45 21.77 11.94 21.41 11.58ZM5.5 7C4.67 7 4 6.33 4 5.5C4 4.67 4.67 4 5.5 4C6.33 4 7 4.67 7 5.5C7 6.33 6.33 7 5.5 7Z"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => setShowHelpModal(true)}
                    className={`p-2 rounded-lg ${theme.cardShadow} hover:scale-110 transition-all relative ${showHelpModal ? (currentTheme === 'steam' ? 'steam-blue-bg text-white' : `${theme.text}`) : `${theme.buttonBg}`}`}
                    style={showHelpModal && currentTheme !== 'steam' ? {backgroundColor: 'currentColor', transition: 'background-color 0.1s ease, color 0.1s ease'} : {transition: 'background-color 0.1s ease, color 0.1s ease'}}
                    title={t('header.help.tooltip', currentLocale)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-colors duration-100" viewBox="0 0 24 24" fill="currentColor" style={showHelpModal && currentTheme !== 'steam' ? {color: theme.buttonBg.includes('bg-gray-100') ? '#f3f4f6' : '#475569'} : {}}>
                      <path d="M11.25 4.533A9.707 9.707 0 006 3a9.735 9.735 0 00-3.25.555.75.75 0 00-.5.707v14.25a.75.75 0 001 .707A8.237 8.237 0 016 18.75c1.995 0 3.823.707 5.25 1.886V4.533zM12.75 20.636A8.214 8.214 0 0118 18.75c.966 0 1.89.166 2.75.47a.75.75 0 001-.708V4.262a.75.75 0 00-.5-.707A9.735 9.735 0 0018 3a9.707 9.707 0 00-5.25 1.533v16.103z" />
                    </svg>
                  </button>
                </div>

                <div className="hidden md:flex items-center gap-3">
                  <div className="relative" onMouseLeave={() => setShowFolderDropdown(false)}>
                    <button
                      onClick={() => setShowFolderDropdown(!showFolderDropdown)}
                      className={`px-3 py-2 rounded-lg ${theme.cardShadow} hover:scale-105 transition-all ${theme.buttonBg} text-sm flex items-center gap-2`}
                      title={t('header.folder.tooltip', currentLocale)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                      </svg>
                      <span className="max-w-[160px] truncate">
                        {folders.find(f => f.id === targetFolderId)?.name || t('header.folder.label', currentLocale)}
                      </span>
                    </button>
                    {showFolderDropdown && (
                      <div className={`absolute top-full left-1/2 -translate-x-1/2 ${theme.cardBg} ${theme.text} ${theme.cardShadow} rounded-lg overflow-hidden z-50 min-w-[160px] max-h-[200px] overflow-y-auto`}>
                        {folders.map(folder => (
                          <button
                            key={folder.id}
                            onClick={() => {
                              setTargetFolderId(folder.id);
                              setShowFolderDropdown(false);
                            }}
                            className={`block w-full text-left px-4 py-2 text-sm whitespace-nowrap ${targetFolderId === folder.id ? theme.folderSelected : theme.modalHover}`}
                          >
                            {folder.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onMouseEnter={() => setIsHoveringDeleteButton(true)}
                    onMouseLeave={() => setIsHoveringDeleteButton(false)}
                    onClick={async () => {
                      if (shiftPressedForDelete && isHoveringDeleteButton) {
                        if (confirm(t('header.collection.deleteConfirm', currentLocale))) {
                          try {
                            await dbHelper.deleteAllData();
                            setFolders([]);
                            setFavoritesMap({});
                            setSelectedFolderId(null);
                            setTargetFolderId(null);
                            window.location.reload();
                          } catch (error) {
                            console.error('Data deletion error:', error);
                            alert(t('header.collection.deleteError', currentLocale));
                          }
                        }
                      } else {
                        setShowFavoritesModal(!showFavoritesModal);
                      }
                    }}
                    className={`p-2 rounded-lg ${theme.cardShadow} hover:scale-110 transition-all relative ${showFavoritesModal ? (currentTheme === 'steam' ? 'steam-blue-bg text-white' : `${theme.text}`) : `${theme.buttonBg}`}`}
                    title={shiftPressedForDelete && isHoveringDeleteButton ? t('header.collection.deleteTooltip', currentLocale) : t('header.collection.tooltip', currentLocale)}
                    style={showFavoritesModal && currentTheme !== 'steam' ? {backgroundColor: 'currentColor', transition: 'background-color 0.1s ease, color 0.1s ease'} : {transition: 'background-color 0.1s ease, color 0.1s ease'}}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-opacity duration-100 ${shiftPressedForDelete && isHoveringDeleteButton ? 'opacity-0' : 'opacity-100'}`} viewBox="0 0 24 24" fill="currentColor" style={showFavoritesModal && currentTheme !== 'steam' ? {color: theme.buttonBg.includes('bg-gray-100') ? '#f3f4f6' : '#475569'} : {}}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                    </svg>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-opacity duration-100 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${shiftPressedForDelete && isHoveringDeleteButton ? 'opacity-100' : 'opacity-0'}`} viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.346-9zm5.48.058a.75.75 0 10-1.498-.058l-.347 9a.75.75 0 001.5.058l.345-9z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setShowImportExportModal(true)}
                    className={`p-2 rounded-lg ${theme.cardShadow} hover:scale-110 transition-all relative ${showImportExportModal ? (currentTheme === 'steam' ? 'steam-blue-bg text-white' : `${theme.text}`) : `${theme.buttonBg}`}`}
                    style={showImportExportModal && currentTheme !== 'steam' ? {backgroundColor: 'currentColor', transition: 'background-color 0.1s ease, color 0.1s ease'} : {transition: 'background-color 0.1s ease, color 0.1s ease'}}
                    title={t('header.importExport.tooltip', currentLocale)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-colors duration-100" viewBox="0 0 24 24" fill="currentColor" style={showImportExportModal && currentTheme !== 'steam' ? {color: theme.buttonBg.includes('bg-gray-100') ? '#f3f4f6' : '#475569'} : {}}>
                      <path d="M11.47 1.72a.75.75 0 011.06 0l3 3a.75.75 0 01-1.06 1.06l-1.72-1.72V7.5h-1.5V4.06L9.53 5.78a.75.75 0 01-1.06-1.06l3-3zM11.25 7.5V15a.75.75 0 001.5 0V7.5h3.75a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9a3 3 0 013-3h3.75z"/>
                      <path d="M12 16.5a.75.75 0 01.75.75v3.44l1.72-1.72a.75.75 0 111.06 1.06l-3 3a.75.75 0 01-1.06 0l-3-3a.75.75 0 111.06-1.06l1.72 1.72V17.25a.75.75 0 01.75-.75z" opacity="0.6"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => setShowHelpModal(true)}
                    className={`p-2 rounded-lg ${theme.cardShadow} hover:scale-110 transition-all relative ${showHelpModal ? (currentTheme === 'steam' ? 'steam-blue-bg text-white' : `${theme.text}`) : `${theme.buttonBg}`}`}
                    style={showHelpModal && currentTheme !== 'steam' ? {backgroundColor: 'currentColor', transition: 'background-color 0.1s ease, color 0.1s ease'} : {transition: 'background-color 0.1s ease, color 0.1s ease'}}
                    title={t('header.help.tooltip', currentLocale)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-colors duration-100" viewBox="0 0 24 24" fill="currentColor" style={showHelpModal && currentTheme !== 'steam' ? {color: theme.buttonBg.includes('bg-gray-100') ? '#f3f4f6' : '#475569'} : {}}>
                      <path d="M11.25 4.533A9.707 9.707 0 006 3a9.735 9.735 0 00-3.25.555.75.75 0 00-.5.707v14.25a.75.75 0 001 .707A8.237 8.237 0 016 18.75c1.995 0 3.823.707 5.25 1.886V4.533zM12.75 20.636A8.214 8.214 0 0118 18.75c.966 0 1.89.166 2.75.47a.75.75 0 001-.708V4.262a.75.75 0 00-.5-.707A9.735 9.735 0 0018 3a9.707 9.707 0 00-5.25 1.533v16.103z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setShowSettingsModal(true)}
                    className={`p-2 rounded-lg ${theme.cardShadow} hover:scale-110 transition-all relative ${showSettingsModal ? (currentTheme === 'steam' ? 'steam-blue-bg text-white' : `${theme.text}`) : `${theme.buttonBg}`}`}
                    style={showSettingsModal && currentTheme !== 'steam' ? {backgroundColor: 'currentColor', transition: 'background-color 0.1s ease, color 0.1s ease'} : {transition: 'background-color 0.1s ease, color 0.1s ease'}}
                    title={t('header.settings.tooltip', currentLocale)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-colors duration-100" viewBox="0 0 24 24" fill="currentColor" style={showSettingsModal && currentTheme !== 'steam' ? {color: theme.buttonBg.includes('bg-gray-100') ? '#f3f4f6' : '#475569'} : {}}>
                      <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.570.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.923-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {/* Language Switcher */}
                  <button
                    onClick={() => {
                      const newLocale = currentLocale === 'en' ? 'ja' : 'en';
                      setLocale(newLocale);
                      setForceUpdate(prev => prev + 1);
                    }}
                    className={`p-2 rounded-lg ${theme.cardShadow} hover:scale-110 transition-all ${theme.buttonBg}`}
                    title={t('header.language.tooltip', currentLocale)}
                  >
                    <div className="w-5 h-5 flex items-center justify-center">
                      <span className="text-sm font-bold leading-none">
                        {currentLocale.toUpperCase()}
                      </span>
                    </div>
                  </button>
                  <div className={`inline-flex rounded-xl ${theme.buttonBg} p-1`}>
                    <button
                      onClick={async ()=>{
                        setCurrentTheme('default');
                        if (settings.saveTheme) {
                          const newSettings = { ...settings, theme: 'default' };
                          setSettings(newSettings);
                          await dbHelper.saveSettings(newSettings);
                        }
                      }}
                      className={`p-2 rounded-lg transition-all duration-100 ${currentTheme==='default'?theme.buttonActive:''}`}
                      title={t('theme.default.tooltip', currentLocale)}
                    >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
                    </svg>
                  </button>
                  <button
                    onClick={async ()=>{
                      setCurrentTheme('steam');
                      if (settings.saveTheme) {
                        const newSettings = { ...settings, theme: 'steam' };
                        setSettings(newSettings);
                        await dbHelper.saveSettings(newSettings);
                      }
                    }}
                    className={`p-2 rounded-lg transition-all duration-100 ${currentTheme==='steam'?theme.buttonActive:''}`}
                    title={t('theme.dark.tooltip', currentLocale)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                    </svg>
                  </button>
                </div>
                </div>
              </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 md:pt-14 pb-8 space-y-6">
              {/* Mobile: Title Search and Filters */}
              <div className="md:hidden space-y-4">
                {/* Title Search */}
                <div className="relative w-full">
                  <input
                    type="text"
                    placeholder={t('search.placeholder', currentLocale)}
                    value={searchTitle}
                    onChange={(e)=>setSearchTitle(e.target.value)}
                    className={`${theme.cardBg} ${theme.text} ${theme.border} border rounded-lg px-3 py-2 pr-10 text-sm w-full focus:outline-none focus:ring-2 ${currentTheme==='steam'?'focus:ring-[#4668FF]':'focus:ring-blue-500'}`}
                  />
                  {searchTitle && (
                    <button
                      onClick={() => setSearchTitle('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      title={t('search.clear', currentLocale)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Filter Checkboxes (Horizontal Scroll) */}
                <div>
                  <div className="overflow-x-auto scrollbar-hide -mx-6 px-6">
                    <div className="flex gap-2 min-w-max pb-2">
                      <button
                        onClick={() => setOnlySale(!onlySale)}
                        className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${
                          onlySale
                            ? currentTheme === 'steam'
                              ? 'steam-blue-bg text-white'
                              : 'bg-blue-500 text-white'
                            : `${theme.tagBg} ${theme.tagText}`
                        }`}
                      >
                        {t('filter.onlySale', currentLocale)}
                      </button>
                      <button
                        onClick={() => setOnlyOverwhelming(!onlyOverwhelming)}
                        className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${
                          onlyOverwhelming
                            ? currentTheme === 'steam'
                              ? 'steam-blue-bg text-white'
                              : 'bg-blue-500 text-white'
                            : `${theme.tagBg} ${theme.tagText}`
                        }`}
                      >
                        {t('filter.onlyOverwhelming', currentLocale)}
                      </button>
                      <button
                        onClick={() => setOnlyJP(!onlyJP)}
                        className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${
                          onlyJP
                            ? currentTheme === 'steam'
                              ? 'steam-blue-bg text-white'
                              : 'bg-blue-500 text-white'
                            : `${theme.tagBg} ${theme.tagText}`
                        }`}
                      >
                        {t('filter.onlyJapanese', currentLocale)}
                      </button>
                      <button
                        onClick={() => setOnlyMac(!onlyMac)}
                        className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${
                          onlyMac
                            ? currentTheme === 'steam'
                              ? 'steam-blue-bg text-white'
                              : 'bg-blue-500 text-white'
                            : `${theme.tagBg} ${theme.tagText}`
                        }`}
                      >
                        {t('filter.onlyMac', currentLocale)}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Genre Filters (Horizontal Scroll) */}
                <div>
                  <div className="overflow-x-auto scrollbar-hide -mx-6 px-6">
                    <div className="flex gap-2 min-w-max pb-2">
                      {allGenres.genres.map((g) => {
                        const translatedGenre = translateGenre(g, currentLocale);
                        const displayName = truncateByWidth(translatedGenre, 20);
                        const isIncluded = selectedGenres.include.includes(g);
                        const isExcluded = selectedGenres.exclude.includes(g);
                        const isChecked = isIncluded || isExcluded;

                        const handleGenreClick = (e) => {
                          e.preventDefault();
                          const isShiftClick = e.shiftKey;

                          setSelectedGenres(prev => {
                            const currentlyIncluded = prev.include.includes(g);
                            const currentlyExcluded = prev.exclude.includes(g);

                            if (isShiftClick) {
                              if (currentlyExcluded) {
                                return { ...prev, exclude: prev.exclude.filter(x => x !== g) };
                              } else {
                                return {
                                  include: prev.include.filter(x => x !== g),
                                  exclude: [...prev.exclude, g]
                                };
                              }
                            } else {
                              if (currentlyIncluded) {
                                return { ...prev, include: prev.include.filter(x => x !== g) };
                              } else {
                                return {
                                  exclude: prev.exclude.filter(x => x !== g),
                                  include: [...prev.include, g]
                                };
                              }
                            }
                          });
                        };

                        return (
                          <button
                            key={g}
                            onClick={handleGenreClick}
                            className={`relative px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${
                              isIncluded
                                ? currentTheme === 'steam'
                                  ? 'steam-blue-bg text-white'
                                  : 'bg-blue-500 text-white'
                                : isExcluded
                                ? `${theme.saleBg} text-white`
                                : `${theme.tagBg} ${theme.tagText}`
                            }`}
                          >
                            {displayName}
                            {isExcluded && (
                              <span className="ml-1">✕</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <style>{`
                .scrollbar-hide::-webkit-scrollbar {
                  display: none;
                }
                .scrollbar-hide {
                  -ms-overflow-style: none;
                  scrollbar-width: none;
                }
              `}</style>

              <section className="hidden md:grid grid-cols-1 md:grid-cols-5 gap-6">
                <div className={`${theme.cardBg} ${theme.cardShadow} rounded-2xl p-4 md:col-span-2 flex flex-col`}>
                  <div className="text-sm font-semibold mb-3">{t('filter.title', currentLocale)}</div>
                  <div className="flex items-center gap-4 flex-wrap mb-6">
                    <div className="flex items-center gap-1">
                      <input id="saleOnly" type="checkbox" checked={onlySale} onChange={(e)=>setOnlySale(e.target.checked)} className="h-4 w-4 flex-shrink-0" />
                      <label htmlFor="saleOnly" className="text-sm whitespace-nowrap">{t('filter.onlySale', currentLocale)}</label>
                    </div>
                    <div className="flex items-center gap-1">
                      <input id="overwhelmingOnly" type="checkbox" checked={onlyOverwhelming} onChange={(e)=>setOnlyOverwhelming(e.target.checked)} className="h-4 w-4 flex-shrink-0" />
                      <label htmlFor="overwhelmingOnly" className="text-sm whitespace-nowrap">{t('filter.onlyOverwhelming', currentLocale)}</label>
                    </div>
                    <div className="flex items-center gap-1">
                      <input id="jpOnly" type="checkbox" checked={onlyJP} onChange={(e)=>setOnlyJP(e.target.checked)} className="h-4 w-4 flex-shrink-0" />
                      <label htmlFor="jpOnly" className="text-sm whitespace-nowrap">{t('filter.onlyJapanese', currentLocale)}</label>
                    </div>
                    <div className="flex items-center gap-1">
                      <input id="macOnly" type="checkbox" checked={onlyMac} onChange={(e)=>setOnlyMac(e.target.checked)} className="h-4 w-4 flex-shrink-0" />
                      <label htmlFor="macOnly" className="text-sm whitespace-nowrap">{t('filter.onlyMac', currentLocale)}</label>
                    </div>
                  </div>

                  <div className="text-sm font-semibold">{t('filter.price.title', currentLocale)}</div>
                    <div className="mt-2 space-y-2">
                      <div className={`flex items-center justify-between text-sm ${theme.subText}`}>
                        <span>{t('filter.priceMin', currentLocale)} {formatPrice(minPrice, currentLocale)}</span>
                        <span>{t('filter.priceMax', currentLocale)} {formatPrice(maxPrice, currentLocale)}</span>
                      </div>
                      <input type="range" min={0} max={settings?.removePriceLimit ? 20000 : 3000} step={100} value={minPrice} onChange={(e)=>setMinPrice(Math.min(Number(e.target.value), maxPrice))} className={`w-full ${currentTheme==='steam'?'steam-blue':''}`} />
                      <input type="range" min={0} max={settings?.removePriceLimit ? 20000 : 3000} step={100} value={maxPrice} onChange={(e)=>setMaxPrice(Math.max(Number(e.target.value), minPrice))} className={`w-full ${currentTheme==='steam'?'steam-blue':''}`} />
                      <div className="mt-4 space-y-3">
                        <div>
                          <div className="text-sm font-semibold">{t('filter.priceMode.title', currentLocale)}</div>
                          <div className={`mt-2 inline-flex flex-wrap rounded-xl ${theme.buttonBg} p-1 gap-1`}>
                            <button onClick={()=>setPriceMode('current')} className={`px-3 py-1 rounded-lg text-sm ${priceMode==='current'?theme.buttonActive:''}`}>
                              {t('filter.priceCurrent', currentLocale)}
                            </button>
                            <button onClick={()=>setPriceMode('normal')} className={`px-3 py-1 rounded-lg text-sm ${priceMode==='normal'?theme.buttonActive:''}`}>
                              {t('filter.priceNormal', currentLocale)}
                            </button>
                            <button onClick={()=>setPriceMode('lowest')} className={`px-3 py-1 rounded-lg text-sm ${priceMode==='lowest'?theme.buttonActive:''}`}>
                              {t('filter.priceLowest', currentLocale)}
                            </button>
                            <button onClick={()=>setPriceMode('discount')} className={`px-3 py-1 rounded-lg text-sm ${priceMode==='discount'?theme.buttonActive:''}`}>
                              {t('filter.priceDiscount', currentLocale)}
                            </button>
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-semibold">{t('filter.sortOrder', currentLocale)}</div>
                          <div className={`mt-2 inline-flex rounded-xl ${theme.buttonBg} p-1`}>
                            <button onClick={()=>setSortOrder('asc')} className={`px-3 py-1 rounded-lg text-sm ${sortOrder==='asc'?theme.buttonActive:''}`}>{t('filter.sortAsc', currentLocale)}</button>
                            <button onClick={()=>setSortOrder('desc')} className={`px-3 py-1 rounded-lg text-sm ${sortOrder==='desc'?theme.buttonActive:''}`}>{t('filter.sortDesc', currentLocale)}</button>
                          </div>
                        </div>
                      </div>
                    </div>
                </div>

                <div className={`${theme.cardBg} ${theme.cardShadow} rounded-2xl p-4 md:col-span-3 flex flex-col`}>
                  <div className="text-sm font-semibold">{t('filter.genre', currentLocale)}</div>
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-6">
                    {allGenres.genres.map((g) => {
                      const translatedGenre = translateGenre(g, currentLocale);
                      const displayName = truncateByWidth(translatedGenre, 20);
                      const isIncluded = selectedGenres.include.includes(g);
                      const isExcluded = selectedGenres.exclude.includes(g);
                      const isChecked = isIncluded || isExcluded;

                      const handleGenreClick = (e) => {
                        e.preventDefault();
                        const isShiftClick = e.shiftKey;

                        setSelectedGenres(prev => {
                          const currentlyIncluded = prev.include.includes(g);
                          const currentlyExcluded = prev.exclude.includes(g);

                          if (isShiftClick) {
                            // Shift+click: exclude mode
                            if (currentlyExcluded) {
                              // Already excluded - remove
                              return { ...prev, exclude: prev.exclude.filter(x => x !== g) };
                            } else {
                              // Exclude from include, or new exclusion
                              return {
                                include: prev.include.filter(x => x !== g),
                                exclude: [...prev.exclude, g]
                              };
                            }
                          } else {
                            // Normal click: include mode
                            if (currentlyIncluded) {
                              // Already included - remove
                              return { ...prev, include: prev.include.filter(x => x !== g) };
                            } else {
                              // Include from exclude, or new inclusion
                              return {
                                include: [...prev.include, g],
                                exclude: prev.exclude.filter(x => x !== g)
                              };
                            }
                          }
                        });
                      };

                      return (
                        <div key={g} className="flex items-center gap-2 text-sm cursor-pointer select-none" onClick={handleGenreClick}>
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
                          <span
                            title={translatedGenre}
                            className={`truncate ${isExcluded ? theme.saleText : ''}`}
                          >
                            {displayName}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {allGenres.otherTags.length > 0 && (
                    <>
                      <div className="text-sm font-semibold">{t('filter.feature', currentLocale)}</div>
                      <div className="mt-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-4">
                        {allGenres.otherTags.map((g) => {
                          const translatedGenre = translateGenre(g, currentLocale);
                          const displayName = truncateByWidth(translatedGenre, 20);
                          const isIncluded = selectedGenres.include.includes(g);
                          const isExcluded = selectedGenres.exclude.includes(g);
                          const isChecked = isIncluded || isExcluded;

                          const handleGenreClick = (e) => {
                            e.preventDefault();
                            const isShiftClick = e.shiftKey;

                            setSelectedGenres(prev => {
                              const currentlyIncluded = prev.include.includes(g);
                              const currentlyExcluded = prev.exclude.includes(g);

                              if (isShiftClick) {
                                // Shift+click: exclude mode
                                if (currentlyExcluded) {
                                  // Already excluded - remove
                                  return { ...prev, exclude: prev.exclude.filter(x => x !== g) };
                                } else {
                                  // Exclude from include, or new exclusion
                                  return {
                                    include: prev.include.filter(x => x !== g),
                                    exclude: [...prev.exclude, g]
                                  };
                                }
                              } else {
                                // Normal click: include mode
                                if (currentlyIncluded) {
                                  // Already included - remove
                                  return { ...prev, include: prev.include.filter(x => x !== g) };
                                } else {
                                  // Include from exclude, or new inclusion
                                  return {
                                    include: [...prev.include, g],
                                    exclude: prev.exclude.filter(x => x !== g)
                                  };
                                }
                              }
                            });
                          };

                          return (
                            <div key={g} className="flex items-center gap-2 text-sm cursor-pointer select-none" onClick={handleGenreClick}>
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
                              <span
                                title={translatedGenre}
                                className={`truncate ${isExcluded ? theme.saleText : ''}`}
                              >
                                {displayName}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  <div className="mt-auto flex items-center gap-2 justify-end">
                    <button
                      onMouseDown={() => {
                        // Start animation
                        setClearButtonPressed(true);
                        setTimeout(() => setClearButtonPressed(false), 100);
                      }}
                      onClick={() => {
                        // Reset all filters
                        setOnlySale(false);
                        setOnlyOverwhelming(false);
                        setOnlyJP(false);
                        setOnlyMac(false);
                        setSelectedGenres({ include: [], exclude: [] });
                        setMinPrice(0);
                        setMaxPrice(settings?.removePriceLimit ? 20000 : 3000);
                        setPriceMode('current');
                        setSortOrder('asc');
                        setSelectedYear('all');
                        setSearchTitle('');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-all duration-100 whitespace-nowrap ${clearButtonPressed ? theme.buttonActive : theme.buttonBg}`}
                      title={t('filter.clearTooltip', currentLocale)}
                    >
                      {t('filter.clear', currentLocale)}
                    </button>
                    <div className="relative w-32" onMouseLeave={() => setShowYearDropdown(false)}>
                      <button
                        onClick={() => setShowYearDropdown(!showYearDropdown)}
                        className={`${theme.cardBg} ${theme.text} ${theme.border} border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 ${currentTheme==='steam'?'focus:ring-[#4668FF]':'focus:ring-blue-500'} w-full flex items-center justify-between`}
                      >
                        <span className="flex-1 text-center">{selectedYear === 'all' ? t('filter.allPeriod', currentLocale) : formatYear(selectedYear, currentLocale)}</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${showYearDropdown ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                      {showYearDropdown && (
                        <div className={`absolute top-full z-50 w-full ${theme.cardBg} ${theme.border} border rounded-lg shadow-lg max-h-60 overflow-y-auto`}>
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
                    <div className="relative w-full md:w-64">
                      <input
                        type="text"
                        placeholder={t('search.placeholder', currentLocale)}
                        value={searchTitle}
                        onChange={(e)=>setSearchTitle(e.target.value)}
                        className={`${theme.cardBg} ${theme.text} ${theme.border} border rounded-lg px-3 py-2 pr-10 text-sm w-full focus:outline-none focus:ring-2 ${currentTheme==='steam'?'focus:ring-[#4668FF]':'focus:ring-blue-500'}`}
                      />
                      {searchTitle && (
                        <button
                          onClick={() => setSearchTitle('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                          title={t('filter.clear', currentLocale)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <div className={`mb-4 text-sm ${theme.subText}`}>
                {t('search.resultsCount', currentLocale).replace('{count}', sorted.length)}
              </div>

              <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {!loading && sorted.length === 0 && (<div className={`text-sm ${theme.subText}`}>{t('search.noResults', currentLocale)}</div>)}
                {sorted.map((g) => (
                  <GameCard key={g.id} g={g} theme={theme} priceMode={priceMode} favoriteData={favoritesMap[g.id]} onToggleFavorite={handleToggleFavorite} settings={settings} />
                ))}
              </section>
            </div>

            {showFavoritesModal && (
              <FavoritesModal
                theme={theme}
                currentTheme={currentTheme}
                folders={folders}
                setFolders={setFolders}
                selectedFolderId={selectedFolderId}
                setSelectedFolderId={setSelectedFolderId}
                onClose={() => setShowFavoritesModal(false)}
                games={games}
                favoritesMap={favoritesMap}
                setFavoritesMap={setFavoritesMap}
                settings={settings}
                targetFolderId={targetFolderId}
                setTargetFolderId={setTargetFolderId}
              />
            )}

            {showImportExportModal && (
              <ImportExportModal
                theme={theme}
                currentTheme={currentTheme}
                folders={folders}
                setFolders={setFolders}
                setFavoritesMap={setFavoritesMap}
                onClose={() => setShowImportExportModal(false)}
              />
            )}

            {showHelpModal && (
              <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 ${isClosingHelpModal ? 'modal-fade-out' : 'modal-fade-in'}`} onClick={handleCloseHelpModal}>
                <div className={`${theme.cardBg} rounded-2xl max-w-2xl w-full h-[80vh] flex flex-col ${theme.cardShadow}`} onClick={(e) => e.stopPropagation()}>
                  <div className={`flex justify-between items-center px-4 py-3 border-b ${theme.border} h-[46px]`}>
                    <h2 className="text-base font-bold">{t('help.title', currentLocale)}</h2>
                    <button
                      onClick={handleCloseHelpModal}
                      className={`p-1 rounded ${theme.modalHover}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>

                  <div className={`flex border-b ${theme.border}`}>
                    <button
                      onClick={() => setHelpActiveTab('disclaimer')}
                      className={`px-6 py-3 font-medium transition-colors ${
                        helpActiveTab === 'disclaimer'
                          ? `${theme.text} border-b-2 ${currentTheme === 'steam' ? 'border-blue-500' : 'border-current'}`
                          : `${theme.subText} hover:${theme.text}`
                      }`}
                    >
                      {t('help.tabDisclaimer', currentLocale)}
                    </button>
                    <button
                      onClick={() => setHelpActiveTab('guide')}
                      className={`px-6 py-3 font-medium transition-colors ${
                        helpActiveTab === 'guide'
                          ? `${theme.text} border-b-2 ${currentTheme === 'steam' ? 'border-blue-500' : 'border-current'}`
                          : `${theme.subText} hover:${theme.text}`
                      }`}
                    >
                      {t('help.tabGuide', currentLocale)}
                    </button>
                  </div>

                  <div className="p-6 overflow-y-auto flex-1">
                    {helpActiveTab === 'disclaimer' ? (
                      <div className="space-y-4">
                        <h3 className="text-lg font-bold">{t('help.disclaimer.title', currentLocale)}</h3>
                        <div className="space-y-3 text-sm">
                          <p>{t('help.disclaimer.intro1', currentLocale)}<br />
                          {t('help.disclaimer.intro2', currentLocale)}</p>

                          <h4 className="font-bold mt-4">{t('help.disclaimer.priceInfo.title', currentLocale)}</h4>
                          <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>{t('help.disclaimer.priceInfo.text1', currentLocale)}</li>
                            <li>{t('help.disclaimer.priceInfo.text2', currentLocale)}</li>
                            <li>{t('help.disclaimer.priceInfo.text3', currentLocale)}</li>
                          </ul>

                          <h4 className="font-bold mt-4">{t('help.disclaimer.dataAccuracy.title', currentLocale)}</h4>
                          <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>{t('help.disclaimer.dataAccuracy.text1', currentLocale)}</li>
                            <li>{t('help.disclaimer.dataAccuracy.text2', currentLocale)}</li>
                            <li>{t('help.disclaimer.dataAccuracy.text3', currentLocale)}</li>
                          </ul>

                          <h4 className="font-bold mt-4">{t('help.disclaimer.liability.title', currentLocale)}</h4>
                          <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>{t('help.disclaimer.liability.text1', currentLocale)}</li>
                            <li>{t('help.disclaimer.liability.text2', currentLocale)}</li>
                            <li>{t('help.disclaimer.liability.text3', currentLocale)}</li>
                          </ul>

                          <h4 className="font-bold mt-4">{t('help.disclaimer.curation.title', currentLocale)}</h4>
                          <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>{t('help.disclaimer.curation.text1', currentLocale)}</li>
                            <li>{t('help.disclaimer.curation.text2', currentLocale)}
                              <ul className="list-disc list-inside space-y-1 ml-6 mt-1">
                                <li>{t('help.disclaimer.curation.reviewType1', currentLocale)}</li>
                                <li>{t('help.disclaimer.curation.reviewType2', currentLocale)}</li>
                                <li>{t('help.disclaimer.curation.reviewType3', currentLocale)}</li>
                                <li>{t('help.disclaimer.curation.reviewType4', currentLocale)}</li>
                              </ul>
                            </li>
                            <li>{t('help.disclaimer.curation.text3', currentLocale)}</li>
                            <li>{t('help.disclaimer.curation.text4', currentLocale)}</li>
                            <li>{t('help.disclaimer.curation.text5', currentLocale)}</li>
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <h3 className="text-lg font-bold">{t('help.guide.title', currentLocale)}</h3>
                        <div className="space-y-3 text-sm">
                          <div className="md:hidden">
                            <h4 className="font-bold">{t('help.guide.basicMobile', currentLocale)}</h4>
                            <ul className="list-disc list-inside space-y-2  ml-4">
                              <li>{t('help.guide.mobile.filter', currentLocale)}</li>
                              <li>{t('help.guide.mobile.genreSelect', currentLocale)}</li>
                              <li>{t('help.guide.mobile.searchConditions', currentLocale)}</li>
                            </ul>
                          </div>
                          <div className="hidden md:block space-y-3">
                            <h4 className="font-bold">{t('help.guide.basic', currentLocale)}</h4>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                              <li>{t('help.guide.basic.text1', currentLocale)}</li>
                              <li>{t('help.guide.basic.text2', currentLocale)}</li>
                              <li>{t('help.guide.basic.text3', currentLocale)}</li>
                              <li>{t('help.guide.basic.text4', currentLocale)}</li>
                            </ul>

                            <h4 className="font-bold mt-4">{t('help.guide.collection', currentLocale)}</h4>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                              <li>{t('help.guide.collection.text1', currentLocale)}</li>
                              <li>{t('help.guide.collection.text2', currentLocale)}</li>
                              <li>{t('help.guide.collection.text3', currentLocale)}</li>
                              <li>{t('help.guide.collection.text4', currentLocale)}</li>
                              <li>{t('help.guide.collection.text5', currentLocale)}
                                <ul className="list-disc list-inside space-y-1 ml-6 mt-1">
                                  <li>{t('help.guide.collection.operation1', currentLocale)}</li>
                                  <li>{t('help.guide.collection.operation2', currentLocale)}</li>
                                  <li>{t('help.guide.collection.operation3', currentLocale)}</li>
                                  <li>{t('help.guide.collection.operation4', currentLocale)}</li>
                                </ul>
                              </li>
                              <li>{t('help.guide.collection.text6', currentLocale)}</li>
                              <li>{t('help.guide.collection.text7', currentLocale)}</li>
                              <li>{t('help.guide.collection.text8', currentLocale)}</li>
                              <li>{t('help.guide.collection.text9', currentLocale)}</li>
                            </ul>

                            <h4 className="font-bold mt-4">{t('help.guide.exportImport.title', currentLocale)}</h4>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                              <li>{t('help.guide.exportImport.text1', currentLocale)}</li>
                              <li>{t('help.guide.exportImport.text2', currentLocale)}</li>
                            </ul>

                            <h4 className="font-bold mt-4">{t('help.guide.basicUsage.title', currentLocale)}</h4>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                              <li>{t('help.guide.basicUsage.text1', currentLocale)}</li>
                              <li>{t('help.guide.basicUsage.text2', currentLocale)}</li>
                            </ul>

                            <h4 className="font-bold mt-4">{t('help.guide.shortcuts.title', currentLocale)}</h4>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                              <li>{t('help.guide.shortcuts.openCollection', currentLocale)}</li>
                              <li>{t('help.guide.shortcuts.scrollToTop', currentLocale)}</li>
                            </ul>

                            <h4 className="font-bold mt-4">{t('help.guide.shiftKey.title', currentLocale)}</h4>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                              <li>{t('help.guide.shiftKey.excludeFilter', currentLocale)}</li>
                              <li>{t('help.guide.shiftKey.deleteAll', currentLocale)}</li>
                              <li>{t('help.guide.shiftKey.cardDetails', currentLocale)}</li>
                              <li>{t('help.guide.shiftKey.gameDetails', currentLocale)}</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {showSettingsModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 modal-fade-in" onClick={() => setShowSettingsModal(false)}>
                <div className={`${theme.cardBg} rounded-2xl max-w-xl w-full max-h-[80vh] flex flex-col ${theme.cardShadow}`} onClick={(e) => e.stopPropagation()}>
                  <div className={`flex justify-between items-center px-4 py-3 border-b ${theme.border} h-[46px]`}>
                    <h2 className="text-base font-bold">{t('settings.title', currentLocale)}</h2>
                    <button
                      onClick={() => setShowSettingsModal(false)}
                      className={`p-1 rounded ${theme.modalHover}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>

                  <div className="p-4 overflow-y-auto flex-1 space-y-3">
                    {/* Remove Price Limit */}
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
                            const newSettings = { ...settings, removePriceLimit: e.target.checked };
                            setSettings(newSettings);
                            await dbHelper.saveSettings(newSettings);
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    {/* Show Total Price */}
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

                    {/* Always Show Star Icon */}
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

                    {/* Permanent Delete */}
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

                    {/* Save Theme */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="text-sm font-medium">{t('settings.saveTheme', currentLocale)}</div>
                        <div className={`text-xs ${theme.subText}`}>{t('settings.saveThemeDesc', currentLocale)}</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={settings.saveTheme}
                          onChange={async (e) => {
                            const newSettings = { ...settings, saveTheme: e.target.checked };
                            if (e.target.checked) {
                              newSettings.theme = currentTheme;
                            }
                            setSettings(newSettings);
                            await dbHelper.saveSettings(newSettings);
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    {/* Use Selected Folder as Target */}
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

                    {/* Keyboard Layout */}
                    {false && (
                    <div>
                      <div className="font-medium mb-3">{t('settings.keyboardLayout', currentLocale)}</div>
                      <div className="flex gap-3">
                        <button
                          onClick={async () => {
                            const newSettings = { ...settings, keyboardLayout: 'ansi' };
                            setSettings(newSettings);
                            await dbHelper.saveSettings(newSettings);
                          }}
                          className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                            settings.keyboardLayout === 'ansi'
                              ? 'border-blue-500 bg-blue-50'
                              : `border-gray-300 ${theme.buttonBg}`
                          }`}
                        >
                          <div className="font-medium">ANSI (US)</div>
                          <div className="text-xs text-gray-500 mt-1">Shift+? / Shift+&gt;</div>
                        </button>
                        <button
                          onClick={async () => {
                            const newSettings = { ...settings, keyboardLayout: 'iso' };
                            setSettings(newSettings);
                            await dbHelper.saveSettings(newSettings);
                          }}
                          className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                            settings.keyboardLayout === 'iso'
                              ? 'border-blue-500 bg-blue-50'
                              : `border-gray-300 ${theme.buttonBg}`
                          }`}
                        >
                          <div className="font-medium">ISO (JIS)</div>
                          <div className="text-xs text-gray-500 mt-1">Standard Japanese Layout</div>
                        </button>
                      </div>
                    </div>
                    )}

                    {/* Alternative Key Bindings */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="text-sm font-medium">{t('settings.alternativeKeys', currentLocale)}</div>
                        <div className={`text-xs ${theme.subText}`}>Shift+C/T → Shift+Z/X</div>
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

                    {/* Danger Zone */}
                    <div className={`border-t ${theme.border} pt-3 mt-1`}>
                      <div className={`text-sm font-medium ${theme.saleText} mb-2`}>{t('settings.resetData', currentLocale)}</div>
                      <button
                        onClick={async () => {
                          if (confirm(t('confirm.deleteAllData', currentLocale))) {
                            try {
                              // Delete IndexedDB
                              await dbHelper.deleteAllData();
                              // Reset settings
                              const resetSettings = await dbHelper.resetSettings();
                              setSettings(resetSettings);
                              // Reload page
                              window.location.reload();
                            } catch (e) {
                              alert(t('error.deleteFailed', currentLocale).replace('{message}', e.message));
                            }
                          }
                        }}
                        className={`w-full py-2 px-3 text-sm ${theme.saleBg} text-white rounded-lg transition-colors`}
                        style={{
                          filter: 'brightness(1)',
                          '&:hover': { filter: 'brightness(0.9)' }
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(0.9)'}
                        onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
                      >
                        {t('settings.resetDataButton', currentLocale)}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className={`fixed bottom-8 right-8 ${theme.cardBg} ${theme.cardShadow} rounded-full p-4 transition-opacity duration-500 hover:opacity-80 ${showScrollTop ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              aria-label={t('button.scrollToTop', currentLocale)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </button>

            {/* Footer */}
            <footer className={`fixed bottom-0 left-0 right-0 z-20 ${theme.bg} px-6 py-[6px] transition-all duration-300 ${isScrolled ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'}`}>
              <div className="max-w-7xl mx-auto text-center">
                <p className={`text-[9px] sm:text-xs ${theme.textSecondary}`}>
                  Powered by Steam Web API and IsThereAnyDeal API. Not affiliated with Valve or IsThereAnyDeal.
                </p>
              </div>
            </footer>
          </div>
          </>
        );
      }

      function FavoritesModal({ theme, currentTheme, folders, setFolders, selectedFolderId, setSelectedFolderId, onClose, games, favoritesMap, setFavoritesMap, settings, targetFolderId, setTargetFolderId }) {
        const TRASH_FOLDER_ID = '__TRASH__';
        const [favoriteGames, setFavoriteGames] = React.useState([]);
        const [isCreatingFolder, setIsCreatingFolder] = React.useState(false);
        const [newFolderName, setNewFolderName] = React.useState('');
        const [editingFolderId, setEditingFolderId] = React.useState(null);
        const [editingFolderName, setEditingFolderName] = React.useState('');
        const [isClosing, setIsClosing] = React.useState(false);
        const [showFolderMenuForGame, setShowFolderMenuForGame] = React.useState(null);
        const [showOrderMenuForGame, setShowOrderMenuForGame] = React.useState(null);
        const [folderSaleStatus, setFolderSaleStatus] = React.useState({});
        const [filterOnlySale, setFilterOnlySale] = React.useState(false);
        const [filterJapanese, setFilterJapanese] = React.useState(false);
        const [filterOverwhelming, setFilterOverwhelming] = React.useState(false);
        const [searchQuery, setSearchQuery] = React.useState('');
        const [hoveredGame, setHoveredGame] = React.useState(null);
        const [shiftPressed, setShiftPressed] = React.useState(false);
        const hoveredGameRef = React.useRef(null);
        const detailPanelRef = React.useRef(null);
        const modalRef = React.useRef(null);

        const filteredFavoriteGames = React.useMemo(() => {
          const gamesMap = {};
          games.forEach(g => gamesMap[g.id] = g);
          return favoriteGames.filter(game => {
            const gameData = gamesMap[game.gameId];
            if (!gameData) return false;

            if (filterOnlySale && !(gameData.salePriceYen != null && gameData.salePriceYen < gameData.priceYenResolved)) return false;
            if (filterJapanese && checkJapaneseSupport(gameData.supportedLanguages) !== t('language.supported', currentLocale)) return false;
            if (filterOverwhelming && gameData.reviewScore !== 'Overwhelmingly Positive') return false;
            if (searchQuery && !gameData.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;

            return true;
          });
        }, [favoriteGames, games, filterOnlySale, filterJapanese, filterOverwhelming, searchQuery]);

        const handleClose = () => {
          setIsClosing(true);
          setTimeout(() => {
            onClose();
            setIsClosing(false);
          }, 100);
        };

        React.useEffect(() => {
          document.body.style.overflow = 'hidden';

          const handleKeyDown = (e) => {
            if (e.key === 'Shift') {
              setShiftPressed(true);
              if (hoveredGameRef.current) {
                setHoveredGame(hoveredGameRef.current);
              }
            }
          };
          const handleKeyUp = (e) => {
            if (e.key === 'Shift') {
              setShiftPressed(false);
              setHoveredGame(null);
            }
          };
          window.addEventListener('keydown', handleKeyDown);
          window.addEventListener('keyup', handleKeyUp);

          return () => {
            document.body.style.overflow = '';
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
          };
        }, []);

        React.useEffect(() => {
          const handleWheel = (e) => {
            if (e.shiftKey && shiftPressed && detailPanelRef.current) {
              const scrollableContent = detailPanelRef.current.querySelector('.overflow-y-auto');
              if (scrollableContent) {
                e.preventDefault();
                e.stopPropagation();
                const scrollAmount = e.deltaY || e.deltaX;
                scrollableContent.scrollTop += scrollAmount;
              }
            }
          };

          const panelElement = detailPanelRef.current;
          if (panelElement) {
            panelElement.addEventListener('wheel', handleWheel, { passive: false });
          }

          return () => {
            if (panelElement) {
              panelElement.removeEventListener('wheel', handleWheel);
            }
          };
        }, [shiftPressed, hoveredGame]);

        React.useEffect(() => {
          (async () => {
            const gamesMap = {};
            games.forEach(g => gamesMap[g.id] = g);
            const status = {};
            for (const folder of folders) {
              const favs = await dbHelper.getFavoritesByFolder(folder.id);
              const hasSale = favs.some(fav => {
                if (fav.deleted) return false;
                const game = gamesMap[fav.gameId];
                return game?.salePriceYen != null && game.salePriceYen < game.priceYenResolved;
              });
              status[folder.id] = hasSale;
            }
            setFolderSaleStatus(status);
          })();
        }, [folders, games]);

        React.useEffect(() => {
          if (selectedFolderId) {
            (async () => {
              let favs;
              if (selectedFolderId === TRASH_FOLDER_ID) {
                favs = await dbHelper.getDeletedFavorites();
              } else {
                favs = await dbHelper.getFavoritesByFolder(selectedFolderId);
                favs = favs.filter(fav => !fav.deleted);
              }
              const gamesMap = {};
              games.forEach(g => gamesMap[g.id] = g);
              const enrichedFavs = favs.map(fav => ({
                ...fav,
                gameTitle: gamesMap[fav.gameId]?.title || '',
                normalPrice: gamesMap[fav.gameId]?.priceYenResolved || 0,
                salePrice: gamesMap[fav.gameId]?.salePriceYen
              }));
              enrichedFavs.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
              setFavoriteGames(enrichedFavs);
            })();
          }
        }, [selectedFolderId, folders, games]);

        // Sync selected folder and target folder when setting is enabled
        React.useEffect(() => {
          if (settings?.useSelectedFolderAsTarget && selectedFolderId && selectedFolderId !== TRASH_FOLDER_ID) {
            setTargetFolderId(selectedFolderId);
          }
        }, [selectedFolderId, settings?.useSelectedFolderAsTarget, setTargetFolderId, TRASH_FOLDER_ID]);

        const handleCreateFolder = async () => {
          if (newFolderName.trim()) {
            const newId = await dbHelper.addFolder(newFolderName.trim());
            setFolders([...folders, { id: newId, name: newFolderName.trim() }]);
          }
          setNewFolderName('');
          setIsCreatingFolder(false);
        };

        const handleRenameFolder = async (folderId) => {
          if (editingFolderName.trim()) {
            await dbHelper.updateFolder(folderId, editingFolderName.trim());
            setFolders(folders.map(f => f.id === folderId ? { ...f, name: editingFolderName.trim() } : f));
            setEditingFolderId(null);
            setEditingFolderName('');
          }
        };

        const handleDeleteFolder = async (folderId) => {
          // Check game count in folder
          const gamesInFolder = await dbHelper.getFavoritesByFolder(folderId);
          const isEmpty = gamesInFolder.length === 0;

          // Show confirmation prompt only if not empty
          if (!isEmpty && !confirm(t('confirm.deleteFolder', currentLocale))) {
            return;
          }

          await dbHelper.deleteFolder(folderId);
          const newFolders = folders.filter(f => f.id !== folderId);
          setFolders(newFolders);
          if (selectedFolderId === folderId && newFolders.length > 0) {
            setSelectedFolderId(newFolders[0].id);
          }
        };

        const handleMoveGame = async (favoriteId, newFolderId) => {
          await dbHelper.updateFavoriteFolder(favoriteId, newFolderId);
          const movedGame = favoriteGames.find(f => f.id === favoriteId);
          setFavoriteGames(favoriteGames.filter(f => f.id !== favoriteId));

          // Update sale status
          if (movedGame) {
            const gamesMap = {};
            games.forEach(g => gamesMap[g.id] = g);
            const game = gamesMap[movedGame.gameId];
            const hasSale = game?.salePriceYen != null && game.salePriceYen < game.priceYenResolved;

            // Recalculate sale status of source folder
            const oldFolderFavs = await dbHelper.getFavoritesByFolder(selectedFolderId);
            const oldFolderHasSale = oldFolderFavs.some(fav => {
              if (fav.deleted) return false;
              const g = gamesMap[fav.gameId];
              return g?.salePriceYen != null && g.salePriceYen < g.priceYenResolved;
            });

            // Update sale status of destination folder
            const newFolderFavs = await dbHelper.getFavoritesByFolder(newFolderId);
            const newFolderHasSale = newFolderFavs.some(fav => {
              if (fav.deleted) return false;
              const g = gamesMap[fav.gameId];
              return g?.salePriceYen != null && g.salePriceYen < g.priceYenResolved;
            });

            setFolderSaleStatus(prev => ({
              ...prev,
              [selectedFolderId]: oldFolderHasSale,
              [newFolderId]: newFolderHasSale
            }));
          }
        };

        const handleChangeOrder = async (favoriteId, newOrder) => {
          const updatedGames = [...favoriteGames];
          const targetIndex = updatedGames.findIndex(f => f.id === favoriteId);
          if (targetIndex === -1) return;

          const [movedGame] = updatedGames.splice(targetIndex, 1);
          updatedGames.splice(newOrder, 0, movedGame);

          for (let i = 0; i < updatedGames.length; i++) {
            await dbHelper.updateFavoriteOrder(updatedGames[i].id, i + 1);
            updatedGames[i].sortOrder = i + 1;
          }

          setFavoriteGames(updatedGames);
          setShowOrderMenuForGame(null);
        };

        const handleDeleteGame = async (favoriteId) => {
          const deletedGame = favoriteGames.find(f => f.id === favoriteId);
          await dbHelper.deleteFavorite(favoriteId);
          setFavoriteGames(favoriteGames.filter(f => f.id !== favoriteId));

          // Remove from favoritesMap
          if (deletedGame) {
            setFavoritesMap(prev => {
              const newMap = { ...prev };
              delete newMap[deletedGame.gameId];
              return newMap;
            });
          }

          // Update sale status
          const gamesMap = {};
          games.forEach(g => gamesMap[g.id] = g);
          const folderFavs = await dbHelper.getFavoritesByFolder(selectedFolderId);
          const folderHasSale = folderFavs.some(fav => {
            const g = gamesMap[fav.gameId];
            return g?.salePriceYen != null && g.salePriceYen < g.priceYenResolved;
          });

          setFolderSaleStatus(prev => ({
            ...prev,
            [selectedFolderId]: folderHasSale
          }));
        };

        return (
          <div className={`fixed inset-0 z-50 bg-black bg-opacity-50 ${isClosing ? 'modal-fade-out' : 'modal-fade-in'}`} onClick={handleClose}>
            <div ref={modalRef} className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${theme.cardBg} ${theme.text} rounded-2xl shadow-2xl w-[90vw] md:w-[75vw] lg:w-[60vw] max-w-[1024px] h-[80vh] flex flex-col overflow-visible relative`} onClick={(e) => e.stopPropagation()}>
              {/* Modal Overlay (When Detail Panel is Visible) */}
              <div className={`absolute inset-0 bg-black rounded-2xl transition-opacity duration-100 pointer-events-none z-[100] ${hoveredGame && shiftPressed ? 'opacity-20' : 'opacity-0'}`}></div>

              <button onClick={handleClose} className={`absolute top-[11px] right-6 z-[110] p-1 rounded ${theme.modalHover}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
              <div className="flex flex-1 overflow-hidden rounded-t-2xl">
              {/* Left Sidebar */}
              <div className={`w-64 ${theme.bg} border-r ${theme.border} flex flex-col rounded-tl-2xl`}>
                <div className={`px-4 py-3 border-b ${theme.border} flex items-center justify-between h-[46px]`}>
                  <h2 className="text-base font-bold">{t('collection.folders', currentLocale)}</h2>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {folders.map(folder => (
                    <div
                      key={folder.id}
                      className={`group flex items-center px-3 py-2 rounded cursor-pointer mb-1 min-h-[36px] overflow-hidden relative ${selectedFolderId === folder.id ? theme.folderSelected : theme.folderHover}`}
                      onClick={() => editingFolderId !== folder.id && setSelectedFolderId(folder.id)}
                    >
                      {editingFolderId === folder.id ? (
                        <input
                          type="text"
                          value={editingFolderName}
                          onChange={(e) => setEditingFolderName(e.target.value)}
                          onBlur={() => handleRenameFolder(folder.id)}
                          onKeyDown={(e) => e.key === 'Enter' && handleRenameFolder(folder.id)}
                          className="flex-1 px-2 py-1 text-sm rounded bg-white dark:bg-gray-800 text-black dark:text-white"
                          autoFocus
                        />
                      ) : (
                        <>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="w-[5px] h-[5px] flex-shrink-0">
                              {folderSaleStatus[folder.id] && (
                                <span className={`block w-full h-full rounded-full ${theme.saleBg}`}></span>
                              )}
                            </span>
                            <span className="flex-1 text-xs min-w-0">{folder.name}</span>
                          </div>
                          <div className="flex items-center gap-1 transition-transform duration-300 group-hover:translate-x-0 translate-x-[60px]">
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingFolderId(folder.id);
                                setEditingFolderName(folder.name);
                              }}
                              className={`p-1 rounded ${theme.text} ${theme.iconHover}`}
                              title={t('button.rename', currentLocale)}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                              </svg>
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (folder.id !== folders[0]?.id) {
                                  await handleDeleteFolder(folder.id);
                                }
                              }}
                              className={`p-1 rounded ${folder.id === folders[0]?.id ? 'opacity-30 cursor-not-allowed' : `${theme.text} ${theme.iconHover}`}`}
                              title={folder.id === folders[0]?.id ? t('collection.deleteFolder', currentLocale) : t('button.delete', currentLocale)}
                              disabled={folder.id === folders[0]?.id}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {isCreatingFolder ? (
                    <div className="p-2">
                      <input
                        type="text"
                        placeholder={t('collection.folderName', currentLocale)}
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onBlur={handleCreateFolder}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                        className="w-full px-2 py-1 text-sm rounded bg-white dark:bg-gray-800 text-black dark:text-white border ${theme.border}"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsCreatingFolder(true)}
                      className={`w-full p-2 text-sm text-left rounded ${theme.folderHover} flex items-center gap-2`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                      {t('collection.newFolder', currentLocale)}
                    </button>
                  )}
                </div>
              </div>

              {/* Right Content Area */}
              <div className="flex-1 flex flex-col">
                <div className={`px-4 py-3 border-b ${theme.border} flex items-center justify-between h-[46px]`}>
                  <h2 className="text-base font-bold">
                    {selectedFolderId === TRASH_FOLDER_ID ? t('collection.trash', currentLocale) : (folders.find(f => f.id === selectedFolderId)?.name || t('collection.title', currentLocale))}
                  </h2>
                  <div className="flex items-center gap-2 mr-20">
                      <button
                        onClick={async () => {
                          if (favoriteGames.length === 0) return;
                          const sorted = [...favoriteGames].sort((a, b) => {
                            return a.gameTitle.localeCompare(b.gameTitle, 'ja');
                          });
                          for (let i = 0; i < sorted.length; i++) {
                            await dbHelper.updateFavoriteOrder(sorted[i].id, i + 1);
                            sorted[i].sortOrder = i + 1;
                          }
                          setFavoriteGames(sorted);
                        }}
                        className={`p-1 rounded ${favoriteGames.length === 0 || selectedFolderId === TRASH_FOLDER_ID ? 'opacity-30 cursor-not-allowed' : `${theme.text} ${theme.iconHover}`}`}
                        title={t('collection.sortByName', currentLocale)}
                        disabled={favoriteGames.length === 0 || selectedFolderId === TRASH_FOLDER_ID}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M3 3a1 1 0 000 2h11a1 1 0 100-2H3zM3 7a1 1 0 000 2h7a1 1 0 100-2H3zM3 11a1 1 0 100 2h4a1 1 0 100-2H3zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z" />
                        </svg>
                      </button>
                      <button
                        onClick={async () => {
                          if (favoriteGames.length === 0) return;
                          const sorted = [...favoriteGames].sort((a, b) => {
                            const priceA = a.salePrice != null && a.salePrice < a.normalPrice ? a.salePrice : a.normalPrice;
                            const priceB = b.salePrice != null && b.salePrice < b.normalPrice ? b.salePrice : b.normalPrice;
                            return priceA - priceB;
                          });
                          for (let i = 0; i < sorted.length; i++) {
                            await dbHelper.updateFavoriteOrder(sorted[i].id, i + 1);
                            sorted[i].sortOrder = i + 1;
                          }
                          setFavoriteGames(sorted);
                        }}
                        className={`p-1 rounded ${favoriteGames.length === 0 || selectedFolderId === TRASH_FOLDER_ID ? 'opacity-30 cursor-not-allowed' : `${theme.text} ${theme.iconHover}`}`}
                        title={t('collection.sortByPrice', currentLocale)}
                        disabled={favoriteGames.length === 0 || selectedFolderId === TRASH_FOLDER_ID}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button
                        onClick={async () => {
                          if (favoriteGames.length === 0) return;
                          if (selectedFolderId === TRASH_FOLDER_ID) {
                            if (confirm(t('confirm.emptyTrash', currentLocale))) {
                              favoriteGames.forEach(game => {
                                dbHelper.deleteFavorite(game.id);
                                setFavoritesMap(prev => {
                                  const newMap = { ...prev };
                                  delete newMap[game.gameId];
                                  return newMap;
                                });
                              });
                              setFavoriteGames([]);
                            }
                          } else {
                            if (confirm(t('confirm.moveToTrash', currentLocale))) {
                              for (const game of favoriteGames) {
                                await dbHelper.markAsDeleted(game.id);
                                setFavoritesMap(prev => ({
                                  ...prev,
                                  [game.gameId]: { ...prev[game.gameId], deleted: true }
                                }));
                              }
                              setFavoriteGames([]);
                              setFolderSaleStatus(prev => ({
                                ...prev,
                                [selectedFolderId]: false
                              }));
                            }
                          }
                        }}
                        className={`p-1 rounded ${favoriteGames.length === 0 ? 'opacity-30 cursor-not-allowed' : `${theme.text} ${theme.iconHover}`}`}
                        title={selectedFolderId === TRASH_FOLDER_ID ? t('collection.emptyTrash', currentLocale) : t('confirm.moveToTrash', currentLocale)}
                        disabled={favoriteGames.length === 0}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {favoriteGames.length === 0 ? (
                    <div className={`text-center ${theme.subText} py-8`}>
                      {selectedFolderId === TRASH_FOLDER_ID ? t('collection.trashEmpty', currentLocale) : t('collection.empty', currentLocale)}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredFavoriteGames.map((game, index) => {
                        const gamesMap = {};
                        games.forEach(g => gamesMap[g.id] = g);
                        const gameData = gamesMap[game.gameId];
                        return (
                        <div key={game.id} className={`group flex items-center p-3 rounded ${theme.buttonBg} ${theme.modalHover} transition-colors min-h-[48px] relative ${(showFolderMenuForGame === game.id || showOrderMenuForGame === game.id) ? 'overflow-visible z-50' : 'overflow-hidden z-0'}`} onMouseEnter={() => { if (showFolderMenuForGame !== game.id) setShowFolderMenuForGame(null); if (showOrderMenuForGame !== game.id) setShowOrderMenuForGame(null); hoveredGameRef.current = gameData; if (shiftPressed) setHoveredGame(gameData); }} onMouseLeave={(e) => { const relatedTarget = e.relatedTarget; const detailPanel = document.querySelector('[data-detail-panel]'); if (relatedTarget !== detailPanel && !detailPanel?.contains(relatedTarget)) { setShowFolderMenuForGame(null); setShowOrderMenuForGame(null); hoveredGameRef.current = null; setHoveredGame(null); } }}>
                          <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center">
                            <span className={`absolute left-[-40px] text-sm font-semibold ${theme.subText} w-[24px] text-right transition-transform duration-300 ${showOrderMenuForGame !== null ? 'translate-x-[40px]' : 'translate-x-0'}`}>{game.sortOrder}</span>
                          </div>
                          <a href={linkFor(gameData)} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 pr-2 text-sm pl-6">
                            {gameData?.title || 'Unknown'}
                          </a>
                          <div className={`flex items-center gap-3 transition-transform duration-300 group-hover:translate-x-0 ${selectedFolderId === TRASH_FOLDER_ID ? 'translate-x-[80px]' : 'translate-x-[120px]'}`}>
                            <div className="text-sm whitespace-nowrap pr-6">
                              {game.salePrice != null && game.salePrice < game.normalPrice ? (
                                <>
                                  <span className={`line-through ${theme.subText}`}>{formatPrice(game.normalPrice, currentLocale)}</span>
                                  <span className={`ml-2 font-bold ${theme.saleText}`}>{formatPrice(game.salePrice, currentLocale)}</span>
                                </>
                              ) : (
                                <span>{formatPrice(game.normalPrice, currentLocale)}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                            {selectedFolderId !== TRASH_FOLDER_ID && (
                            <>
                            <div className="relative">
                              <button
                                onClick={() => {
                                  setShowOrderMenuForGame(showOrderMenuForGame === game.id ? null : game.id);
                                  setShowFolderMenuForGame(null);
                                  if (showOrderMenuForGame !== game.id) {
                                    setFilterOnlySale(false);
                                    setFilterJapanese(false);
                                    setFilterOverwhelming(false);
                                  }
                                }}
                                className={`p-1 rounded ${theme.text} ${theme.iconHover}`}
                                title={t('collection.changeOrder', currentLocale)}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
                                </svg>
                              </button>
                              {showOrderMenuForGame === game.id && (
                                <div className={`absolute left-1/2 -translate-x-1/2 mt-1 ${theme.cardBg} ${theme.text} ${theme.cardShadow} rounded-lg overflow-hidden z-50 min-w-[80px] max-h-[200px] overflow-y-auto`}>
                                  {favoriteGames.map((_, index) => (
                                    <button
                                      key={index}
                                      onClick={() => handleChangeOrder(game.id, index)}
                                      className={`block w-full text-center px-3 py-2 text-sm ${theme.modalHover}`}
                                    >
                                      {index + 1}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="relative">
                              <button
                                onClick={() => {
                                  setShowFolderMenuForGame(showFolderMenuForGame === game.id ? null : game.id);
                                  setShowOrderMenuForGame(null);
                                }}
                                className={`p-1 rounded ${theme.text} ${theme.iconHover}`}
                                title={t('collection.moveToFolder', currentLocale)}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                                </svg>
                              </button>
                              {showFolderMenuForGame === game.id && (
                                <div className={`absolute left-1/2 -translate-x-[60%] mt-1 ${theme.cardBg} ${theme.text} ${theme.cardShadow} rounded-lg overflow-hidden z-50 max-h-[200px] overflow-y-auto`}>
                                  {folders.filter(f => f.id !== selectedFolderId).map(f => (
                                    <button
                                      key={f.id}
                                      onClick={() => {
                                        handleMoveGame(game.id, f.id);
                                        setShowFolderMenuForGame(null);
                                      }}
                                      className={`block w-full text-left px-3 py-2 text-sm ${theme.modalHover} whitespace-nowrap`}
                                    >
                                      {f.name}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            </>
                            )}
                            {selectedFolderId === TRASH_FOLDER_ID ? (
                              <>
                                <button
                                  onClick={async () => {
                                    await dbHelper.restoreFromTrash(game.id);
                                    setFavoriteGames(favoriteGames.filter(g => g.id !== game.id));
                                    setFavoritesMap(prev => ({
                                      ...prev,
                                      [game.gameId]: { ...prev[game.gameId], deleted: false }
                                    }));

                                    // Recalculate sale status of restore destination folder
                                    const gamesMap = {};
                                    games.forEach(g => gamesMap[g.id] = g);
                                    const restoredGame = gamesMap[game.gameId];
                                    const hasSale = restoredGame?.salePriceYen != null && restoredGame.salePriceYen < restoredGame.priceYenResolved;
                                    if (hasSale) {
                                      const targetFolderId = game.folderId;
                                      setFolderSaleStatus(prev => ({
                                        ...prev,
                                        [targetFolderId]: true
                                      }));
                                    }
                                  }}
                                  className={`p-1 rounded ${theme.text} ${theme.iconHover}`}
                                  title={t('collection.restore', currentLocale)}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteGame(game.id)}
                                  className={`p-1 rounded ${theme.text} ${theme.iconHover}`}
                                  title={t('collection.permanentDelete', currentLocale)}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={async () => {
                                  // Permanently delete if enabled in settings, otherwise move to trash
                                  if (settings?.permanentDelete) {
                                    await dbHelper.deleteFavorite(game.id);
                                    setFavoriteGames(favoriteGames.filter(g => g.id !== game.id));
                                    setFavoritesMap(prev => {
                                      const newMap = { ...prev };
                                      delete newMap[game.gameId];
                                      return newMap;
                                    });
                                  } else {
                                    await dbHelper.markAsDeleted(game.id);
                                    // Get sortOrder of deleted game
                                    const deletedSortOrder = game.sortOrder;
                                    // Update sortOrder of remaining games
                                    const updatedGames = favoriteGames
                                      .filter(g => g.id !== game.id)
                                      .map(g => {
                                        if (g.sortOrder > deletedSortOrder) {
                                          return { ...g, sortOrder: g.sortOrder - 1 };
                                        }
                                        return g;
                                      });
                                    setFavoriteGames(updatedGames);
                                    setFavoritesMap(prev => ({
                                      ...prev,
                                      [game.gameId]: { ...prev[game.gameId], deleted: true }
                                    }));
                                  }

                                  // Recalculate folder sale status
                                  const gamesMap = {};
                                  games.forEach(g => gamesMap[g.id] = g);
                                  const remainingFavs = favoriteGames.filter(g => g.id !== game.id);
                                  const folderHasSale = remainingFavs.some(fav => {
                                    const g = gamesMap[fav.gameId];
                                    return g?.salePriceYen != null && g.salePriceYen < g.priceYenResolved;
                                  });
                                  setFolderSaleStatus(prev => ({
                                    ...prev,
                                    [selectedFolderId]: folderHasSale
                                  }));
                                }}
                                className={`p-1 rounded ${theme.text} ${theme.iconHover}`}
                                title={settings?.permanentDelete ? t('collection.permanentDelete', currentLocale) : t('button.delete', currentLocale)}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                              </button>
                            )}
                          </div>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              </div>
              {/* Footer */}
              <div className={`border-t ${theme.border} flex items-center h-[46px] rounded-b-2xl overflow-hidden`}>
                <div className={`w-64 ${theme.bg} border-r ${theme.border} h-full flex items-center px-2`}>
                  <div
                    onClick={() => setSelectedFolderId(TRASH_FOLDER_ID)}
                    className={`w-full p-2 rounded cursor-pointer text-xs ${selectedFolderId === TRASH_FOLDER_ID ? theme.folderSelected : theme.folderHover}`}
                  >
                    {t('collection.trash', currentLocale)}
                  </div>
                </div>
                <div className="flex-1 flex items-center justify-between px-4">
                  <div className="flex items-center gap-3">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={t('collection.searchPlaceholder', currentLocale)}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`px-3 py-1.5 pr-10 rounded-lg text-sm ${theme.cardBg} ${theme.text} border ${theme.border} focus:outline-none focus:ring-2 ${currentTheme==='steam'?'focus:ring-[#4668FF]':'focus:ring-blue-500'}`}
                      style={{width: '200px'}}
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        title={t('filter.clear', currentLocale)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setFilterOnlySale(!filterOnlySale)}
                    className={`p-1 rounded transition-all ${filterOnlySale ? (currentTheme === 'steam' ? 'steam-blue-bg text-white' : `${theme.text}`) : `${theme.text} ${theme.iconHover}`}`}
                    title={t('filter.onlySale', currentLocale)}
                    style={filterOnlySale && currentTheme !== 'steam' ? {backgroundColor: 'currentColor', transition: 'background-color 0.1s ease, color 0.1s ease'} : {transition: 'background-color 0.1s ease, color 0.1s ease'}}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" style={filterOnlySale && currentTheme !== 'steam' ? {color: theme.buttonBg.includes('bg-gray-100') ? '#f3f4f6' : '#475569', transition: 'color 0.1s ease'} : {transition: 'color 0.1s ease'}}>
                      <defs>
                        <mask id="saleMask">
                          <rect x="0" y="0" width="24" height="24" fill="white"/>
                          <text x="12" y="17" font-family="Arial, sans-serif" font-size="8" font-weight="bold" text-anchor="middle" fill="black">%</text>
                        </mask>
                      </defs>
                      <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z" mask="url(#saleMask)"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => setFilterJapanese(!filterJapanese)}
                    className={`p-1 rounded transition-all ${filterJapanese ? (currentTheme === 'steam' ? 'steam-blue-bg text-white' : `${theme.text}`) : `${theme.text} ${theme.iconHover}`}`}
                    title={t('filter.onlyJapanese', currentLocale)}
                    style={filterJapanese && currentTheme !== 'steam' ? {backgroundColor: 'currentColor', transition: 'background-color 0.1s ease, color 0.1s ease'} : {transition: 'background-color 0.1s ease, color 0.1s ease'}}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" style={filterJapanese && currentTheme !== 'steam' ? {color: theme.buttonBg.includes('bg-gray-100') ? '#f3f4f6' : '#475569', transition: 'color 0.1s ease'} : {transition: 'color 0.1s ease'}}>
                      <defs>
                        <mask id="jpMask">
                          <rect x="0" y="0" width="24" height="24" fill="white"/>
                          <text x="12" y="15.5" font-family="Arial, sans-serif" font-size="10" font-weight="bold" text-anchor="middle" fill="black">JP</text>
                        </mask>
                      </defs>
                      <rect x="2" y="4" width="20" height="16" rx="2" fill="currentColor" mask="url(#jpMask)"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => setFilterOverwhelming(!filterOverwhelming)}
                    className={`p-1 rounded transition-all ${filterOverwhelming ? (currentTheme === 'steam' ? 'steam-blue-bg text-white' : `${theme.text}`) : `${theme.text} ${theme.iconHover}`}`}
                    title={t('filter.onlyOverwhelming', currentLocale)}
                    style={filterOverwhelming && currentTheme !== 'steam' ? {backgroundColor: 'currentColor', transition: 'background-color 0.1s ease, color 0.1s ease'} : {transition: 'background-color 0.1s ease, color 0.1s ease'}}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" style={filterOverwhelming && currentTheme !== 'steam' ? {color: theme.buttonBg.includes('bg-gray-100') ? '#f3f4f6' : '#475569', transition: 'color 0.1s ease'} : {transition: 'color 0.1s ease'}}>
                      <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                    </svg>
                  </button>
                  </div>
                  {settings.showTotalPrice && (
                    <div className="text-sm font-bold">
                      {t('misc.total', currentLocale)}: ¥{filteredFavoriteGames.reduce((sum, game) => {
                        const price = game.salePrice != null && game.salePrice < game.normalPrice ? game.salePrice : game.normalPrice;
                        return sum + (price || 0);
                      }, 0).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>

            {/* Detail Panel (Right Side) */}
            {hoveredGame && (
              <div ref={detailPanelRef} data-detail-panel className={`absolute top-1/2 -translate-y-1/2 ${theme.cardBg} ${theme.text} rounded-2xl shadow-2xl w-[400px] h-[80vh] flex flex-col overflow-hidden z-[120] transition-opacity duration-100 ${shiftPressed ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} style={{left: 'calc(100% - 200px)'}} onClick={(e) => e.stopPropagation()} onMouseEnter={() => { if (hoveredGameRef.current) setHoveredGame(hoveredGameRef.current); }} onMouseLeave={() => { hoveredGameRef.current = null; setHoveredGame(null); }}>
                <div className={`p-4 border-b ${theme.border}`}>
                  <h3 className="font-bold text-lg">{hoveredGame.title}</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
                  {hoveredGame.imageUrl && hoveredGame.imageUrl !== '-' && (
                    <img src={hoveredGame.imageUrl} alt={hoveredGame.title} className="w-full rounded" />
                  )}
                  <div>
                    <div className="font-semibold">{t('card.genre', currentLocale)}:</div>
                    <div>{normalizeGenres(hoveredGame.genres).join('、')}</div>
                  </div>
                  <div>
                    <div className="font-semibold">{t('price.regular', currentLocale)}:</div>
                    <div>{formatPrice(hoveredGame.priceYenResolved, currentLocale)}</div>
                  </div>
                  {hoveredGame.salePriceYen && (
                    <div>
                      <div className="font-semibold">{t('price.sale', currentLocale)}:</div>
                      <div className={theme.saleText}>
                        {formatPrice(hoveredGame.salePriceYen, currentLocale)}
                        {hoveredGame.discountPercent && ` (-${hoveredGame.discountPercent}%)`}
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="font-semibold">{t('price.lowest', currentLocale)}:</div>
                    <div>{hoveredGame.lowestYenResolved ? formatPrice(hoveredGame.lowestYenResolved, currentLocale) : '-'}</div>
                  </div>
                  {hoveredGame.reviewScore && (
                    <div>
                      <div className="font-semibold">{t('card.overallRating', currentLocale)}:</div>
                      <div>{translateReviewScore(hoveredGame.reviewScore)}</div>
                    </div>
                  )}
                  {hoveredGame.releaseDate && (
                    <div>
                      <div className="font-semibold">{t('card.releaseDate', currentLocale)}:</div>
                      <div>{formatReleaseDate(hoveredGame.releaseDate)}</div>
                    </div>
                  )}
                  {hoveredGame.platforms && (
                    <div>
                      <div className="font-semibold">{t('card.platforms', currentLocale)}:</div>
                      <div>
                        {[
                          hoveredGame.platforms.windows && 'Windows',
                          hoveredGame.platforms.mac && 'macOS',
                          hoveredGame.platforms.linux && 'Linux'
                        ].filter(Boolean).join('、')}
                      </div>
                    </div>
                  )}
                  {hoveredGame.supportedLanguages && (
                    <div>
                      <div className="font-semibold">{t('card.japanese', currentLocale)}:</div>
                      <div>{checkJapaneseSupport(hoveredGame.supportedLanguages)}</div>
                    </div>
                  )}
                  {hoveredGame.supportedLanguages && (
                    <div>
                      <div className="font-semibold">{t('card.languages', currentLocale)}:</div>
                      <div>{cleanLanguageText(hoveredGame.supportedLanguages)}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
            </div>
          </div>
        );
      }

      function ImportExportModal({ theme, currentTheme, folders, setFolders, setFavoritesMap, onClose }) {
        const [isClosing, setIsClosing] = React.useState(false);
        const [showExportOptions, setShowExportOptions] = React.useState(false);
        const [showFolderSelect, setShowFolderSelect] = React.useState(false);
        const [selectedFolderForExport, setSelectedFolderForExport] = React.useState(null);
        const fileInputRef = React.useRef(null);
        const TRASH_FOLDER_ID = 'trash';

        const handleClose = () => {
          setIsClosing(true);
          setTimeout(() => {
            onClose();
            setIsClosing(false);
          }, 100);
        };

        React.useEffect(() => {
          document.body.style.overflow = 'hidden';
          return () => {
            document.body.style.overflow = '';
          };
        }, []);

        const handleExportAll = async () => {
          try {
            const allFolders = await dbHelper.getFolders();
            const allFavorites = [];

            for (const folder of allFolders) {
              const favs = await dbHelper.getFavoritesByFolder(folder.id);
              allFavorites.push(...favs);
            }

            const formatDateForFilename = (timestamp) => {
              const d = new Date(timestamp);
              const yyyy = d.getFullYear();
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const dd = String(d.getDate()).padStart(2, '0');
              return `${yyyy}-${mm}-${dd}`;
            };

            const now = Date.now();

            const exportData = {
              version: '1.0',
              exportDate: formatDateTime(now),
              folders: allFolders.map(f => ({
                name: f.name,
                createdAt: f.createdAt
              })),
              favorites: allFavorites.map(fav => ({
                folderId: allFolders.find(f => f.id === fav.folderId)?.name,
                gameId: fav.gameId,
                sortOrder: fav.sortOrder,
                createdAt: fav.createdAt
              }))
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `steam-collection-${formatDateForFilename(now)}.json`;
            a.click();
            URL.revokeObjectURL(url);

            alert(t('status.exportedAll', currentLocale));
            handleClose();
          } catch (error) {
            console.error('Export error:', error);
            alert(t('error.exportFailed', currentLocale));
          }
        };

        const handleExportSpecificFolder = async (folder) => {
          try {
            if (!folder) {
              alert(t('error.selectFolder', currentLocale));
              return;
            }

            const favs = await dbHelper.getFavoritesByFolder(folder.id);

            const formatDateForFilename = (timestamp) => {
              const d = new Date(timestamp);
              const yyyy = d.getFullYear();
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const dd = String(d.getDate()).padStart(2, '0');
              return `${yyyy}-${mm}-${dd}`;
            };

            const now = Date.now();

            const exportData = {
              version: '1.0',
              exportDate: formatDateTime(now),
              folders: [{
                name: folder.name,
                createdAt: folder.createdAt
              }],
              favorites: favs.map(fav => ({
                folderId: folder.name,
                gameId: fav.gameId,
                sortOrder: fav.sortOrder,
                createdAt: fav.createdAt
              }))
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `steam-collection-${folder.name}-${formatDateForFilename(now)}.json`;
            a.click();
            URL.revokeObjectURL(url);

            alert(t('status.exportedFolder', currentLocale).replace('{folderName}', folder.name));
            handleClose();
          } catch (error) {
            console.error('Export error:', error);
            alert(t('error.exportFailed', currentLocale));
          }
        };

        const handleImport = async (event) => {
          const file = event.target.files[0];
          if (!file) return;

          try {
            const text = await file.text();
            const importData = JSON.parse(text);

            if (!importData.version || !importData.folders || !importData.favorites) {
              alert(t('error.invalidData', currentLocale));
              return;
            }

            const existingFolders = await dbHelper.getFolders();
            const existingFolderNames = new Set(existingFolders.map(f => f.name));
            const folderNameToIdMap = {};

            for (const folder of importData.folders) {
              if (existingFolderNames.has(folder.name)) {
                const existing = existingFolders.find(f => f.name === folder.name);
                folderNameToIdMap[folder.name] = existing.id;
              } else {
                const newId = await dbHelper.addFolder(folder.name);
                folderNameToIdMap[folder.name] = newId;
              }
            }

            let importedCount = 0;
            let skippedCount = 0;

            for (const fav of importData.favorites) {
              const newFolderId = folderNameToIdMap[fav.folderId];
              if (!newFolderId) continue;

              const existing = await dbHelper.getFavoriteByGameId(fav.gameId);
              if (existing) {
                skippedCount++;
                continue;
              }

              await dbHelper.addFavorite(newFolderId, fav.gameId, fav.sortOrder);
              importedCount++;
            }

            const updatedFolders = await dbHelper.getFolders();
            setFolders(updatedFolders);

            const allFavorites = {};
            for (const folder of updatedFolders) {
              const favs = await dbHelper.getFavoritesByFolder(folder.id);
              favs.forEach(fav => {
                allFavorites[fav.gameId] = fav;
              });
            }
            setFavoritesMap(allFavorites);

            alert(t('status.importComplete', currentLocale).replace('{imported}', importedCount).replace('{skipped}', skippedCount));
            handleClose();
          } catch (error) {
            console.error('Import error:', error);
            alert(t('error.importFailed', currentLocale));
          }
        };

        return (
          <div
            onClick={handleClose}
            className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-100 ${isClosing ? 'modal-fade-out' : 'modal-fade-in'}`}
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`${theme.cardBg} ${theme.text} rounded-2xl shadow-2xl w-[400px] flex flex-col`}
            >
              <div className={`px-4 py-3 border-b ${theme.border} flex items-center justify-between h-[46px]`}>
                <h2 className="text-base font-bold">{t('importExport.title', currentLocale)}</h2>
              </div>
              <div className="p-6">

              {!showExportOptions ? (
                <div className="space-y-3">
                  <button
                    onClick={() => setShowExportOptions(true)}
                    className={`w-full px-4 py-3 rounded-lg ${theme.buttonBg} hover:opacity-80 transition-all text-left flex items-center gap-3`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11.47 1.72a.75.75 0 011.06 0l3 3a.75.75 0 01-1.06 1.06l-1.72-1.72V7.5h-1.5V4.06L9.53 5.78a.75.75 0 01-1.06-1.06l3-3zM11.25 7.5V15a.75.75 0 001.5 0V7.5h3.75a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9a3 3 0 013-3h3.75z"/>
                    </svg>
                    <div>
                      <div className="font-semibold">{t('importExport.export', currentLocale)}</div>
                      <div className="text-sm opacity-70">{t('importExport.exportDesc', currentLocale)}</div>
                    </div>
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full px-4 py-3 rounded-lg ${theme.buttonBg} hover:opacity-80 transition-all text-left flex items-center gap-3`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 16.5a.75.75 0 01-.75-.75v-7.44l-1.72 1.72a.75.75 0 11-1.06-1.06l3-3a.75.75 0 011.06 0l3 3a.75.75 0 11-1.06 1.06l-1.72-1.72V15.75a.75.75 0 01-.75.75z"/>
                      <path d="M3.75 15a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h12a1.5 1.5 0 001.5-1.5V15.75a.75.75 0 011.5 0v2.25a3 3 0 01-3 3h-12a3 3 0 01-3-3V15.75A.75.75 0 013.75 15z"/>
                    </svg>
                    <div>
                      <div className="font-semibold">{t('importExport.import', currentLocale)}</div>
                      <div className="text-sm opacity-70">{t('importExport.importDesc', currentLocale)}</div>
                    </div>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={handleExportAll}
                    className={`w-full px-4 py-3 rounded-lg ${theme.buttonBg} hover:opacity-80 transition-all text-left`}
                  >
                    <div className="font-semibold">{t('importExport.exportAll', currentLocale)}</div>
                    <div className="text-sm opacity-70">{t('importExport.exportAllDesc', currentLocale)}</div>
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setShowFolderSelect(!showFolderSelect)}
                      className={`w-full px-4 py-3 rounded-lg ${theme.buttonBg} hover:opacity-80 transition-all text-left`}
                    >
                      <div className="font-semibold">{t('importExport.exportSpecific', currentLocale)}</div>
                      <div className="text-sm opacity-70">
                        {selectedFolderForExport ? selectedFolderForExport.name : t('importExport.exportSpecificDesc', currentLocale)}
                      </div>
                    </button>
                    {showFolderSelect && (
                      <div className={`absolute top-full left-0 right-0 mt-1 ${theme.cardBg} ${theme.cardShadow} rounded-lg overflow-hidden z-50 max-h-[200px] overflow-y-auto`}>
                        {folders.filter(f => f.id !== TRASH_FOLDER_ID).map(folder => (
                          <button
                            key={folder.id}
                            onClick={() => {
                              setSelectedFolderForExport(folder);
                              setShowFolderSelect(false);
                              handleExportSpecificFolder(folder);
                            }}
                            className={`block w-full text-left px-4 py-2 text-sm ${theme.modalHover}`}
                          >
                            {folder.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setShowExportOptions(false)}
                    className={`w-full px-4 py-2 rounded-lg border ${theme.border} hover:opacity-80 transition-all`}
                  >
                    {t('button.back', currentLocale)}
                  </button>
                </div>
              )}
              </div>
            </div>

          </div>
        );
      }



function App() {
  return <SteamPriceFilter />
}

export default App

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
