import React from 'react';
import { t, currentLocale } from '../../i18n/index.js';
import { formatDateTime } from '../../utils/format.js';
import { dbHelper } from '../../db/index.js';

export function ImportExportModal({ theme, currentTheme, folders, setFolders, setCollectionMap, onClose }) {
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
            const allCollections = [];

            for (const folder of allFolders) {
              const collections = await dbHelper.getCollectionsByFolder(folder.id);
              allCollections.push(...collections);
            }

            const formatDateForFilename = (timestamp) => {
              const d = new Date(timestamp);
              const yyyy = d.getFullYear();
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const dd = String(d.getDate()).padStart(2, '0');
              return `${yyyy}-${mm}-${dd}`;
            };

            const now = Date.now();
            const settings = await dbHelper.loadSettings();

            const exportData = {
              version: '1.0',
              exportDate: formatDateTime(now),
              settings,
              folders: allFolders.map(f => ({
                name: f.name,
                createdAt: f.createdAt
              })),
              collection: allCollections.map(collection => ({
                folderId: allFolders.find(f => f.id === collection.folderId)?.name,
                gameId: collection.gameId,
                sortOrder: collection.sortOrder,
                createdAt: collection.createdAt
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

            const collections = await dbHelper.getCollectionsByFolder(folder.id);

            const formatDateForFilename = (timestamp) => {
              const d = new Date(timestamp);
              const yyyy = d.getFullYear();
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const dd = String(d.getDate()).padStart(2, '0');
              return `${yyyy}-${mm}-${dd}`;
            };

            const now = Date.now();
            const settings = await dbHelper.loadSettings();

            const exportData = {
              version: '1.0',
              exportDate: formatDateTime(now),
              settings,
              folders: [{
                name: folder.name,
                createdAt: folder.createdAt
              }],
              collection: collections.map(collection => ({
                folderId: folder.name,
                gameId: collection.gameId,
                sortOrder: collection.sortOrder,
                createdAt: collection.createdAt
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

            if (!importData.version || !importData.folders || !importData.collection) {
              alert(t('error.invalidData', currentLocale));
              return;
            }

            // Import settings
            if (importData.settings) {
              await dbHelper.saveSettings(importData.settings);
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

            for (const item of importData.collection) {
              const newFolderId = folderNameToIdMap[item.folderId];
              if (!newFolderId) continue;

              const existing = await dbHelper.getCollectionByGameId(item.gameId);
              if (existing) {
                skippedCount++;
                continue;
              }

              await dbHelper.addCollection(newFolderId, item.gameId, item.sortOrder);
              importedCount++;
            }

            const updatedFolders = await dbHelper.getFolders();
            setFolders(updatedFolders);

            const allCollections = {};
            for (const folder of updatedFolders) {
              const collections = await dbHelper.getCollectionsByFolder(folder.id);
              collections.forEach(collection => {
                allCollections[collection.gameId] = collection;
              });
            }
            setCollectionMap(allCollections);

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
