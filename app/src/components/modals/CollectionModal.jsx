import React from 'react';
import { t, currentLocale, formatPrice } from '../../i18n/index.js';
import { yen, formatDateTime, truncateByWidth, normalizeGenres, checkJapaneseSupport, cleanLanguageText, translateReviewScore, formatReleaseDate, getLocalizedFolderName } from '../../utils/format.js';
import { steamCapsuleUrl, linkFor } from '../../utils/steam.js';
import { dbHelper } from '../../db/index.js';
import { VideoModal } from './VideoModal.jsx';

export function CollectionModal({ theme, currentTheme, folders, setFolders, selectedFolderId, setSelectedFolderId, onClose, games, collectionMap, setCollectionMap, settings, targetFolderId, setTargetFolderId }) {
        const TRASH_FOLDER_ID = '__TRASH__';
        const [collectionGames, setCollectionGames] = React.useState([]);
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
        const [showVideoModal, setShowVideoModal] = React.useState(false);
        const [videoModalClosing, setVideoModalClosing] = React.useState(false);
        const [selectedGameForVideo, setSelectedGameForVideo] = React.useState(null);
        const hoveredGameRef = React.useRef(null);
        const detailPanelRef = React.useRef(null);
        const modalRef = React.useRef(null);

        const filteredFavoriteGames = React.useMemo(() => {
          const gamesMap = {};
          games.forEach(g => gamesMap[g.id] = g);
          return collectionGames.filter(game => {
            const gameData = gamesMap[game.gameId];
            if (!gameData) return false;

            if (filterOnlySale && !(gameData.salePriceYen != null && gameData.salePriceYen < gameData.priceYenResolved)) return false;
            if (filterJapanese && checkJapaneseSupport(gameData.supportedLanguages) !== t('language.supported', currentLocale)) return false;
            if (filterOverwhelming && gameData.reviewScore !== 'Overwhelmingly Positive') return false;
            if (searchQuery && !gameData.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;

            return true;
          });
        }, [collectionGames, games, filterOnlySale, filterJapanese, filterOverwhelming, searchQuery]);

        const handleClose = () => {
          setIsClosing(true);
          setTimeout(() => {
            onClose();
            setIsClosing(false);
          }, 100);
        };

        const handleVideoModalClose = () => {
          setVideoModalClosing(true);
          setTimeout(() => {
            setShowVideoModal(false);
            setSelectedGameForVideo(null);
            setVideoModalClosing(false);
          }, 100);
        };

        const handleGameClick = (e, gameData) => {
          if (e.shiftKey && shiftPressed) {
            e.preventDefault();
            e.stopPropagation();
            setVideoModalClosing(false);
            setSelectedGameForVideo(gameData);
            setShowVideoModal(true);
          }
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
              const collections = await dbHelper.getCollectionsByFolder(folder.id);
              const hasSale = collections.some(collection => {
                if (collection.deleted) return false;
                const game = gamesMap[collection.gameId];
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
              let collections;
              if (selectedFolderId === TRASH_FOLDER_ID) {
                collections = await dbHelper.getDeletedCollections();
              } else {
                collections = await dbHelper.getCollectionsByFolder(selectedFolderId);
                collections = collections.filter(collection => !collection.deleted);
              }
              const gamesMap = {};
              games.forEach(g => gamesMap[g.id] = g);
              const enrichedCollections = collections.map(collection => ({
                ...collection,
                gameTitle: gamesMap[collection.gameId]?.title || '',
                normalPrice: gamesMap[collection.gameId]?.priceYenResolved || 0,
                salePrice: gamesMap[collection.gameId]?.salePriceYen
              }));
              enrichedCollections.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
              setCollectionGames(enrichedCollections);
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
          const gamesInFolder = await dbHelper.getCollectionsByFolder(folderId);
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
          await dbHelper.updateCollectionFolder(favoriteId, newFolderId);
          const movedGame = collectionGames.find(f => f.id === favoriteId);
          setCollectionGames(collectionGames.filter(f => f.id !== favoriteId));

          // Update sale status
          if (movedGame) {
            const gamesMap = {};
            games.forEach(g => gamesMap[g.id] = g);
            const game = gamesMap[movedGame.gameId];
            const hasSale = game?.salePriceYen != null && game.salePriceYen < game.priceYenResolved;

            // Recalculate sale status of source folder
            const oldFolderCollections = await dbHelper.getCollectionsByFolder(selectedFolderId);
            const oldFolderHasSale = oldFolderCollections.some(collection => {
              if (collection.deleted) return false;
              const g = gamesMap[collection.gameId];
              return g?.salePriceYen != null && g.salePriceYen < g.priceYenResolved;
            });

            // Update sale status of destination folder
            const newFolderCollections = await dbHelper.getCollectionsByFolder(newFolderId);
            const newFolderHasSale = newFolderCollections.some(collection => {
              if (collection.deleted) return false;
              const g = gamesMap[collection.gameId];
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
          const updatedGames = [...collectionGames];
          const targetIndex = updatedGames.findIndex(f => f.id === favoriteId);
          if (targetIndex === -1) return;

          const [movedGame] = updatedGames.splice(targetIndex, 1);
          updatedGames.splice(newOrder, 0, movedGame);

          for (let i = 0; i < updatedGames.length; i++) {
            await dbHelper.updateCollectionOrder(updatedGames[i].id, i + 1);
            updatedGames[i].sortOrder = i + 1;
          }

          setCollectionGames(updatedGames);
          setShowOrderMenuForGame(null);
        };

        const handleDeleteGame = async (favoriteId) => {
          const deletedGame = collectionGames.find(f => f.id === favoriteId);
          await dbHelper.deleteCollection(favoriteId);
          setCollectionGames(collectionGames.filter(f => f.id !== favoriteId));

          // Remove from collectionMap
          if (deletedGame) {
            setCollectionMap(prev => {
              const newMap = { ...prev };
              delete newMap[deletedGame.gameId];
              return newMap;
            });
          }

          // Update sale status
          const gamesMap = {};
          games.forEach(g => gamesMap[g.id] = g);
          const folderCollections = await dbHelper.getCollectionsByFolder(selectedFolderId);
          const folderHasSale = folderCollections.some(collection => {
            const g = gamesMap[collection.gameId];
            return g?.salePriceYen != null && g.salePriceYen < g.priceYenResolved;
          });

          setFolderSaleStatus(prev => ({
            ...prev,
            [selectedFolderId]: folderHasSale
          }));
        };

        return (
          <>
          {showVideoModal && selectedGameForVideo && (
            <VideoModal
              game={selectedGameForVideo}
              theme={theme}
              isClosing={videoModalClosing}
              onClose={handleVideoModalClose}
            />
          )}
          {/* 共通背景 */}
          <div className={`fixed inset-0 z-50 bg-black bg-opacity-50 ${isClosing && !showVideoModal ? 'modal-fade-out' : 'modal-fade-in'}`} onClick={showVideoModal ? undefined : handleClose}></div>

          {/* コレクションモーダルコンテンツ */}
          <div className={`fixed inset-0 z-50 ${showVideoModal ? 'hidden' : ''}`} onClick={handleClose}>
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
                            <span className="flex-1 text-xs min-w-0">{getLocalizedFolderName(folder.name, currentLocale)}</span>
                          </div>
                          <div className="flex items-center gap-1 transition-transform duration-300 group-hover:translate-x-0 translate-x-[60px]">
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingFolderId(folder.id);
                                setEditingFolderName(getLocalizedFolderName(folder.name, currentLocale));
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
                    {selectedFolderId === TRASH_FOLDER_ID ? t('collection.trash', currentLocale) : (getLocalizedFolderName(folders.find(f => f.id === selectedFolderId)?.name, currentLocale) || t('collection.title', currentLocale))}
                  </h2>
                  <div className="flex items-center gap-2 mr-20">
                      <button
                        onClick={async () => {
                          if (collectionGames.length === 0) return;
                          const sorted = [...collectionGames].sort((a, b) => {
                            return a.gameTitle.localeCompare(b.gameTitle, 'ja');
                          });
                          for (let i = 0; i < sorted.length; i++) {
                            await dbHelper.updateCollectionOrder(sorted[i].id, i + 1);
                            sorted[i].sortOrder = i + 1;
                          }
                          setCollectionGames(sorted);
                        }}
                        className={`p-1 rounded ${collectionGames.length === 0 || selectedFolderId === TRASH_FOLDER_ID ? 'opacity-30 cursor-not-allowed' : `${theme.text} ${theme.iconHover}`}`}
                        title={t('collection.sortByName', currentLocale)}
                        disabled={collectionGames.length === 0 || selectedFolderId === TRASH_FOLDER_ID}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M3 3a1 1 0 000 2h11a1 1 0 100-2H3zM3 7a1 1 0 000 2h7a1 1 0 100-2H3zM3 11a1 1 0 100 2h4a1 1 0 100-2H3zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z" />
                        </svg>
                      </button>
                      <button
                        onClick={async () => {
                          if (collectionGames.length === 0) return;
                          const sorted = [...collectionGames].sort((a, b) => {
                            const priceA = a.salePrice != null && a.salePrice < a.normalPrice ? a.salePrice : a.normalPrice;
                            const priceB = b.salePrice != null && b.salePrice < b.normalPrice ? b.salePrice : b.normalPrice;
                            return priceA - priceB;
                          });
                          for (let i = 0; i < sorted.length; i++) {
                            await dbHelper.updateCollectionOrder(sorted[i].id, i + 1);
                            sorted[i].sortOrder = i + 1;
                          }
                          setCollectionGames(sorted);
                        }}
                        className={`p-1 rounded ${collectionGames.length === 0 || selectedFolderId === TRASH_FOLDER_ID ? 'opacity-30 cursor-not-allowed' : `${theme.text} ${theme.iconHover}`}`}
                        title={t('collection.sortByPrice', currentLocale)}
                        disabled={collectionGames.length === 0 || selectedFolderId === TRASH_FOLDER_ID}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button
                        onClick={async () => {
                          if (collectionGames.length === 0) return;
                          if (selectedFolderId === TRASH_FOLDER_ID) {
                            if (confirm(t('confirm.emptyTrash', currentLocale))) {
                              collectionGames.forEach(game => {
                                dbHelper.deleteCollection(game.id);
                                setCollectionMap(prev => {
                                  const newMap = { ...prev };
                                  delete newMap[game.gameId];
                                  return newMap;
                                });
                              });
                              setCollectionGames([]);
                            }
                          } else {
                            if (confirm(t('confirm.moveToTrash', currentLocale))) {
                              for (const game of collectionGames) {
                                await dbHelper.markAsDeleted(game.id);
                                setCollectionMap(prev => ({
                                  ...prev,
                                  [game.gameId]: { ...prev[game.gameId], deleted: true }
                                }));
                              }
                              setCollectionGames([]);
                              setFolderSaleStatus(prev => ({
                                ...prev,
                                [selectedFolderId]: false
                              }));
                            }
                          }
                        }}
                        className={`p-1 rounded ${collectionGames.length === 0 ? 'opacity-30 cursor-not-allowed' : `${theme.text} ${theme.iconHover}`}`}
                        title={selectedFolderId === TRASH_FOLDER_ID ? t('collection.emptyTrash', currentLocale) : t('confirm.moveToTrash', currentLocale)}
                        disabled={collectionGames.length === 0}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {collectionGames.length === 0 ? (
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
                          <a href={linkFor(gameData)} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 pr-2 text-sm pl-6" onClick={(e) => handleGameClick(e, gameData)}>
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
                                  {collectionGames.map((_, index) => (
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
                                      {getLocalizedFolderName(f.name, currentLocale)}
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
                                    setCollectionGames(collectionGames.filter(g => g.id !== game.id));
                                    setCollectionMap(prev => ({
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
                                    setCollectionGames(collectionGames.filter(g => g.id !== game.id));
                                    setCollectionMap(prev => {
                                      const newMap = { ...prev };
                                      delete newMap[game.gameId];
                                      return newMap;
                                    });
                                  } else {
                                    await dbHelper.markAsDeleted(game.id);
                                    // Get sortOrder of deleted game
                                    const deletedSortOrder = game.sortOrder;
                                    // Update sortOrder of remaining games
                                    const updatedGames = collectionGames
                                      .filter(g => g.id !== game.id)
                                      .map(g => {
                                        if (g.sortOrder > deletedSortOrder) {
                                          return { ...g, sortOrder: g.sortOrder - 1 };
                                        }
                                        return g;
                                      });
                                    setCollectionGames(updatedGames);
                                    setCollectionMap(prev => ({
                                      ...prev,
                                      [game.gameId]: { ...prev[game.gameId], deleted: true }
                                    }));
                                  }

                                  // Recalculate folder sale status
                                  const gamesMap = {};
                                  games.forEach(g => gamesMap[g.id] = g);
                                  const remainingCollections = collectionGames.filter(g => g.id !== game.id);
                                  const folderHasSale = remainingCollections.some(collection => {
                                    const g = gamesMap[collection.gameId];
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
                          <text x="12" y="17" fontFamily="Arial, sans-serif" fontSize="8" fontWeight="bold" textAnchor="middle" fill="black">%</text>
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
                          <text x="12" y="15.5" fontFamily="Arial, sans-serif" fontSize="10" fontWeight="bold" textAnchor="middle" fill="black">JP</text>
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
          </>
        );
}
