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

// Import components
import { CollectionModal } from './components/modals/CollectionModal.jsx'
import { ImportExportModal } from './components/modals/ImportExportModal.jsx'
import { GameCard } from './components/GameCard.jsx'
import { HelpModal } from './components/modals/HelpModal.jsx'
import { SettingsModal } from './components/modals/SettingsModal.jsx'
import { MobileFilterModal } from './components/modals/MobileFilterModal.jsx'
import { MobileGenreModal } from './components/modals/MobileGenreModal.jsx'
import { Header } from './components/Header.jsx'

      function SteamPriceFilter({ initialData = null }) {
        const [rawGames, setRawGames] = React.useState(initialData ?? []);
        const [metaData, setMetaData] = React.useState(null);
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
        const [showCollectionModal, setShowCollectionModal] = React.useState(false);
        const [shiftPressedForDelete, setShiftPressedForDelete] = React.useState(false);
        const [isHoveringDeleteButton, setIsHoveringDeleteButton] = React.useState(false);
        const [showImportExportModal, setShowImportExportModal] = React.useState(false);
        const [showHelpModal, setShowHelpModal] = React.useState(false);
        const [showSettingsModal, setShowSettingsModal] = React.useState(false);
        const [settings, setSettings] = React.useState(DEFAULT_SETTINGS);
        const [folders, setFolders] = React.useState([]);
        const [selectedFolderId, setSelectedFolderId] = React.useState(null);
        const [collectionMap, setCollectionMap] = React.useState({});
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
              setShowCollectionModal(prev => !prev);
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
              // Support new structure with meta block
              const games = (data && typeof data === 'object' && 'games' in data) ? data.games : (Array.isArray(data) ? data : []);
              const meta = (data && typeof data === 'object' && 'meta' in data) ? data.meta : null;
              setRawGames(games);
              setMetaData(meta);
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
            setCollectionMap(allFavorites);
          })();
        }, [folders]);

        const handleToggleFavorite = async (game) => {
          const existing = await dbHelper.getFavoriteByGameId(game.id);
          if (existing) {
            if (existing.deleted) {
              // Restore if deletion flag is set
              await dbHelper.restoreFromTrash(existing.id);
              setCollectionMap(prev => ({
                ...prev,
                [game.id]: { ...existing, deleted: false }
              }));
            } else {
              // Physical deletion if deletion flag is not set
              await dbHelper.deleteFavorite(existing.id);
              setCollectionMap(prev => {
                const newMap = { ...prev };
                delete newMap[game.id];
                return newMap;
              });
            }
          } else {
            const targetFolder = folders.find(f => f.id === targetFolderId) || folders[0];
            if (targetFolder) {
              const newFavId = await dbHelper.addFavorite(targetFolder.id, game.id);
              // Add to collectionMap
              setCollectionMap(prev => ({
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
          const lowestJP = g.lowest?.JP !== undefined ? g.lowest.JP : (g.lowestYen || '-');
          const lowest = lowestJP;

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

        // Filter handlers with startTransition for better responsiveness
        const handleFilterChange = (setter) => (value) => {
          React.startTransition(() => setter(value));
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

        // Defer the rendering of game list to improve filter checkbox responsiveness
        const deferredSorted = React.useDeferredValue(sorted);

        return (
          <>
            {/* Mobile: Filter Modal (Bottom Sheet) */}
            {showMobileFilterModal && (
              <MobileFilterModal
                theme={theme}
                currentTheme={currentTheme}
                isClosing={isClosingFilterModal}
                onClose={handleCloseMobileFilterModal}
                selectedYear={selectedYear}
                setSelectedYear={setSelectedYear}
                showYearDropdown={showYearDropdown}
                setShowYearDropdown={setShowYearDropdown}
                allYears={allYears}
                onlySale={onlySale}
                setOnlySale={setOnlySale}
                onlyOverwhelming={onlyOverwhelming}
                setOnlyOverwhelming={setOnlyOverwhelming}
                onlyJP={onlyJP}
                setOnlyJP={setOnlyJP}
                onlyMac={onlyMac}
                setOnlyMac={setOnlyMac}
                minPrice={minPrice}
                setMinPrice={setMinPrice}
                maxPrice={maxPrice}
                setMaxPrice={setMaxPrice}
                priceMode={priceMode}
                setPriceMode={setPriceMode}
                sortOrder={sortOrder}
                setSortOrder={setSortOrder}
                settings={settings}
              />
            )}

            {/* Mobile: Genre Modal (Bottom Sheet) */}
            {showMobileGenreModal && (
              <MobileGenreModal
                theme={theme}
                currentTheme={currentTheme}
                isClosing={isClosingGenreModal}
                onClose={handleCloseMobileGenreModal}
                allGenres={allGenres}
                selectedGenres={selectedGenres}
                setSelectedGenres={setSelectedGenres}
              />
            )}

          <div className={`min-h-screen ${theme.bg} ${theme.text} transition-colors duration-100`}>
            <Header
              theme={theme}
              currentTheme={currentTheme}
              setCurrentTheme={setCurrentTheme}
              isScrolled={isScrolled}
              showMobileFilterModal={showMobileFilterModal}
              setShowMobileFilterModal={setShowMobileFilterModal}
              handleCloseMobileFilterModal={handleCloseMobileFilterModal}
              showMobileGenreModal={showMobileGenreModal}
              setShowMobileGenreModal={setShowMobileGenreModal}
              handleCloseMobileGenreModal={handleCloseMobileGenreModal}
              showHelpModal={showHelpModal}
              setShowHelpModal={setShowHelpModal}
              folders={folders}
              targetFolderId={targetFolderId}
              setTargetFolderId={setTargetFolderId}
              showFolderDropdown={showFolderDropdown}
              setShowFolderDropdown={setShowFolderDropdown}
              shiftPressedForDelete={shiftPressedForDelete}
              isHoveringDeleteButton={isHoveringDeleteButton}
              setIsHoveringDeleteButton={setIsHoveringDeleteButton}
              setFolders={setFolders}
              setCollectionMap={setCollectionMap}
              setSelectedFolderId={setSelectedFolderId}
              showCollectionModal={showCollectionModal}
              setShowCollectionModal={setShowCollectionModal}
              showImportExportModal={showImportExportModal}
              setShowImportExportModal={setShowImportExportModal}
              showSettingsModal={showSettingsModal}
              setShowSettingsModal={setShowSettingsModal}
              setForceUpdate={setForceUpdate}
              settings={settings}
              setSettings={setSettings}
            />

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
                        onClick={() => handleFilterChange(setOnlySale)(!onlySale)}
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
                        onClick={() => handleFilterChange(setOnlyOverwhelming)(!onlyOverwhelming)}
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
                        onClick={() => handleFilterChange(setOnlyJP)(!onlyJP)}
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
                        onClick={() => handleFilterChange(setOnlyMac)(!onlyMac)}
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

                          React.startTransition(() => {
                            setSelectedGenres(prev => {
                              const currentlyIncluded = prev.include.includes(g);
                              const currentlyExcluded = prev.exclude.includes(g);

                              if (isShiftClick) {
                                // Shift+click: toggle exclude
                                if (currentlyExcluded) {
                                  return { ...prev, exclude: prev.exclude.filter(x => x !== g) };
                                } else {
                                  return {
                                    include: prev.include.filter(x => x !== g),
                                    exclude: [...prev.exclude, g]
                                  };
                                }
                              } else {
                                // Normal click: if excluded, remove from exclude (don't add to include)
                                if (currentlyExcluded) {
                                  return { ...prev, exclude: prev.exclude.filter(x => x !== g) };
                                } else if (currentlyIncluded) {
                                  return { ...prev, include: prev.include.filter(x => x !== g) };
                                } else {
                                  return { ...prev, include: [...prev.include, g] };
                                }
                              }
                            });
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
                      <input id="saleOnly" type="checkbox" checked={onlySale} onChange={(e)=>handleFilterChange(setOnlySale)(e.target.checked)} className="h-4 w-4 flex-shrink-0" />
                      <label htmlFor="saleOnly" className="text-sm whitespace-nowrap">{t('filter.onlySale', currentLocale)}</label>
                    </div>
                    <div className="flex items-center gap-1">
                      <input id="overwhelmingOnly" type="checkbox" checked={onlyOverwhelming} onChange={(e)=>handleFilterChange(setOnlyOverwhelming)(e.target.checked)} className="h-4 w-4 flex-shrink-0" />
                      <label htmlFor="overwhelmingOnly" className="text-sm whitespace-nowrap">{t('filter.onlyOverwhelming', currentLocale)}</label>
                    </div>
                    <div className="flex items-center gap-1">
                      <input id="jpOnly" type="checkbox" checked={onlyJP} onChange={(e)=>handleFilterChange(setOnlyJP)(e.target.checked)} className="h-4 w-4 flex-shrink-0" />
                      <label htmlFor="jpOnly" className="text-sm whitespace-nowrap">{t('filter.onlyJapanese', currentLocale)}</label>
                    </div>
                    <div className="flex items-center gap-1">
                      <input id="macOnly" type="checkbox" checked={onlyMac} onChange={(e)=>handleFilterChange(setOnlyMac)(e.target.checked)} className="h-4 w-4 flex-shrink-0" />
                      <label htmlFor="macOnly" className="text-sm whitespace-nowrap">{t('filter.onlyMac', currentLocale)}</label>
                    </div>
                  </div>

                  <div className="text-sm font-semibold">{t('filter.price.title', currentLocale)}</div>
                    <div className="mt-2 space-y-2">
                      <div className={`flex items-center justify-between text-sm ${theme.subText}`}>
                        <span>{t('filter.priceMin', currentLocale)} {formatPrice(minPrice, currentLocale)}</span>
                        <span>{t('filter.priceMax', currentLocale)} {formatPrice(maxPrice, currentLocale)}</span>
                      </div>
                      <input type="range" min={0} max={settings?.removePriceLimit ? 20000 : 3000} step={100} value={minPrice} onChange={(e)=>handleFilterChange(setMinPrice)(Math.min(Number(e.target.value), maxPrice))} className={`w-full ${currentTheme==='steam'?'steam-blue':''}`} />
                      <input type="range" min={0} max={settings?.removePriceLimit ? 20000 : 3000} step={100} value={maxPrice} onChange={(e)=>handleFilterChange(setMaxPrice)(Math.max(Number(e.target.value), minPrice))} className={`w-full ${currentTheme==='steam'?'steam-blue':''}`} />
                      <div className="mt-4 space-y-3">
                        <div>
                          <div className="text-sm font-semibold">{t('filter.priceMode.title', currentLocale)}</div>
                          <div className={`mt-2 inline-flex flex-wrap rounded-xl ${theme.buttonBg} p-1 gap-1`}>
                            <button onClick={()=>handleFilterChange(setPriceMode)('current')} className={`px-3 py-1 rounded-lg text-sm ${priceMode==='current'?theme.buttonActive:''}`}>
                              {t('filter.priceCurrent', currentLocale)}
                            </button>
                            <button onClick={()=>handleFilterChange(setPriceMode)('normal')} className={`px-3 py-1 rounded-lg text-sm ${priceMode==='normal'?theme.buttonActive:''}`}>
                              {t('filter.priceNormal', currentLocale)}
                            </button>
                            <button onClick={()=>handleFilterChange(setPriceMode)('lowest')} className={`px-3 py-1 rounded-lg text-sm ${priceMode==='lowest'?theme.buttonActive:''}`}>
                              {t('filter.priceLowest', currentLocale)}
                            </button>
                            <button onClick={()=>handleFilterChange(setPriceMode)('discount')} className={`px-3 py-1 rounded-lg text-sm ${priceMode==='discount'?theme.buttonActive:''}`}>
                              {t('filter.priceDiscount', currentLocale)}
                            </button>
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-semibold">{t('filter.sortOrder', currentLocale)}</div>
                          <div className={`mt-2 inline-flex rounded-xl ${theme.buttonBg} p-1`}>
                            <button onClick={()=>handleFilterChange(setSortOrder)('asc')} className={`px-3 py-1 rounded-lg text-sm ${sortOrder==='asc'?theme.buttonActive:''}`}>{t('filter.sortAsc', currentLocale)}</button>
                            <button onClick={()=>handleFilterChange(setSortOrder)('desc')} className={`px-3 py-1 rounded-lg text-sm ${sortOrder==='desc'?theme.buttonActive:''}`}>{t('filter.sortDesc', currentLocale)}</button>
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

                        React.startTransition(() => {
                          setSelectedGenres(prev => {
                            const currentlyIncluded = prev.include.includes(g);
                            const currentlyExcluded = prev.exclude.includes(g);

                            if (isShiftClick) {
                              // Shift+click: toggle exclude
                              if (currentlyExcluded) {
                                return { ...prev, exclude: prev.exclude.filter(x => x !== g) };
                              } else {
                                return {
                                  include: prev.include.filter(x => x !== g),
                                  exclude: [...prev.exclude, g]
                                };
                              }
                            } else {
                              // Normal click: if excluded, remove from exclude (don't add to include)
                              if (currentlyExcluded) {
                                return { ...prev, exclude: prev.exclude.filter(x => x !== g) };
                              } else if (currentlyIncluded) {
                                return { ...prev, include: prev.include.filter(x => x !== g) };
                              } else {
                                return { ...prev, include: [...prev.include, g] };
                              }
                            }
                          });
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

                            React.startTransition(() => {
                              setSelectedGenres(prev => {
                                const currentlyIncluded = prev.include.includes(g);
                                const currentlyExcluded = prev.exclude.includes(g);

                                if (isShiftClick) {
                                  // Shift+click: toggle exclude
                                  if (currentlyExcluded) {
                                    return { ...prev, exclude: prev.exclude.filter(x => x !== g) };
                                  } else {
                                    return {
                                      include: prev.include.filter(x => x !== g),
                                      exclude: [...prev.exclude, g]
                                    };
                                  }
                                } else {
                                  // Normal click: if excluded, remove from exclude (don't add to include)
                                  if (currentlyExcluded) {
                                    return { ...prev, exclude: prev.exclude.filter(x => x !== g) };
                                  } else if (currentlyIncluded) {
                                    return { ...prev, include: prev.include.filter(x => x !== g) };
                                  } else {
                                    return { ...prev, include: [...prev.include, g] };
                                  }
                                }
                              });
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

              <div className={`mb-4 text-sm ${theme.subText} flex items-center justify-between`}>
                <span>{t('search.resultsCount', currentLocale).replace('{count}', deferredSorted.length)}</span>
                {metaData?.last_updated && (
                  <span className="text-xs opacity-70">
                    Updated: {new Date(metaData.last_updated).toLocaleString(currentLocale === 'ja' ? 'ja-JP' : 'en-US', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false
                    })}
                  </span>
                )}
              </div>

              <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {!loading && deferredSorted.length === 0 && (<div className={`text-sm ${theme.subText}`}>{t('search.noResults', currentLocale)}</div>)}
                {deferredSorted.map((g) => (
                  <GameCard key={g.id} g={g} theme={theme} priceMode={priceMode} favoriteData={collectionMap[g.id]} onToggleFavorite={handleToggleFavorite} settings={settings} />
                ))}
              </section>
            </div>

            {showCollectionModal && (
              <CollectionModal
                theme={theme}
                currentTheme={currentTheme}
                folders={folders}
                setFolders={setFolders}
                selectedFolderId={selectedFolderId}
                setSelectedFolderId={setSelectedFolderId}
                onClose={() => setShowCollectionModal(false)}
                games={games}
                collectionMap={collectionMap}
                setCollectionMap={setCollectionMap}
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
                setCollectionMap={setCollectionMap}
                onClose={() => setShowImportExportModal(false)}
              />
            )}

            {showHelpModal && (
              <HelpModal
                theme={theme}
                currentTheme={currentTheme}
                isClosing={isClosingHelpModal}
                onClose={handleCloseHelpModal}
              />
            )}

            {showSettingsModal && (
              <SettingsModal
                theme={theme}
                currentTheme={currentTheme}
                settings={settings}
                setSettings={setSettings}
                onClose={() => setShowSettingsModal(false)}
              />
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
            <footer className={`fixed bottom-0 left-0 right-0 z-20 ${theme.bg} px-6 py-2 transition-all duration-300 ${isScrolled ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'}`}>
              <div className="max-w-7xl mx-auto">
                {/* Mobile buttons */}
                <div className="md:hidden flex items-center justify-center gap-2 mb-2">
                  {/* Theme toggle button */}
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

                  {/* Language toggle button */}
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

                  {/* Settings button */}
                  <button
                    onClick={() => setShowSettingsModal(true)}
                    className={`p-2 rounded-lg ${theme.cardShadow} hover:scale-110 transition-all relative ${showSettingsModal ? (currentTheme === 'steam' ? 'steam-blue-bg text-white' : `${theme.text}`) : `${theme.buttonBg}`}`}
                    style={showSettingsModal && currentTheme !== 'steam' ? {backgroundColor: 'currentColor', transition: 'background-color 0.1s ease, color 0.1s ease'} : {transition: 'background-color 0.1s ease, color 0.1s ease'}}
                    title={t('header.settings.tooltip', currentLocale)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-colors duration-100" viewBox="0 0 24 24" fill="currentColor" style={showSettingsModal && currentTheme !== 'steam' ? {color: theme.buttonBg.includes('bg-gray-100') ? '#f3f4f6' : '#475569'} : {}}>
                      <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.923-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clipRule="evenodd" />
                    </svg>
                  </button>

                  {/* Help button */}
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

                  {/* Genre/Feature button */}
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

                  {/* Filter button */}
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
                </div>

                {/* Footer text */}
                <div className="text-center">
                  <p className={`text-[9px] sm:text-xs ${theme.textSecondary}`}>
                    <span className="sm:hidden">Data from Steam & IsThereAnyDeal. Not affiliated.</span>
                    <span className="hidden sm:inline">Powered by Steam Web API and IsThereAnyDeal API. Not affiliated with Valve or IsThereAnyDeal.</span>
                  </p>
                </div>
              </div>
            </footer>
          </div>
          </>
        );
      }

function App() {
  return <SteamPriceFilter />
}

export default App

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
