import { DB_NAME, DB_VERSION, FOLDERS_STORE, FAVORITES_STORE, SETTINGS_STORE } from '../constants/index.js';
import { formatDateTime } from '../utils/format.js';

// IndexedDB initialization
export const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(FOLDERS_STORE)) {
        const folderStore = db.createObjectStore(FOLDERS_STORE, { keyPath: 'id', autoIncrement: true });
        folderStore.createIndex('name', 'name', { unique: false });
      }

      if (!db.objectStoreNames.contains(FAVORITES_STORE)) {
        const favStore = db.createObjectStore(FAVORITES_STORE, { keyPath: 'id', autoIncrement: true });
        favStore.createIndex('folderId', 'folderId', { unique: false });
        favStore.createIndex('gameId', 'gameId', { unique: false });
      }

      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
      }
    };
  });
};
