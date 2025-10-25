import { DB_NAME } from '../constants/index.js';
import { initDB } from './init.js';
import { addFolder, getFolders, updateFolder, deleteFolder } from './folders.js';
import { addCollection, getCollectionsByFolder, getCollectionByGameId, updateCollectionFolder, deleteCollection, updateCollectionOrder, markAsDeleted, restoreFromTrash, getDeletedCollections } from './collection.js';
import { loadSettings, saveSettings, resetSettings } from './settings.js';

// Delete all data
async function deleteAllData() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      console.warn('Database deletion blocked');
      reject(new Error('Database deletion blocked'));
    };
  });
}

// Export dbHelper object for backward compatibility
export const dbHelper = {
  deleteAllData,
  addFolder,
  getFolders,
  updateFolder,
  deleteFolder,
  addCollection,
  getCollectionsByFolder,
  getCollectionByGameId,
  updateCollectionFolder,
  deleteCollection,
  updateCollectionOrder,
  markAsDeleted,
  restoreFromTrash,
  getDeletedCollections,
  loadSettings,
  saveSettings,
  resetSettings
};

// Also export initDB for direct use
export { initDB };
