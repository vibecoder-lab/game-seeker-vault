import { DB_NAME, DB_VERSION, FOLDERS_STORE, COLLECTION_STORE, SETTINGS_STORE, UI_STATE_STORE } from '../constants/index.js';

// Handle database upgrade
const handleUpgrade = (event) => {
  const db = event.target.result;
  const oldVersion = event.oldVersion;

  if (!db.objectStoreNames.contains(FOLDERS_STORE)) {
    const folderStore = db.createObjectStore(FOLDERS_STORE, { keyPath: 'id', autoIncrement: true });
    folderStore.createIndex('name', 'name', { unique: false });
  }

  if (!db.objectStoreNames.contains(COLLECTION_STORE)) {
    const collectionStore = db.createObjectStore(COLLECTION_STORE, { keyPath: 'id', autoIncrement: true });
    collectionStore.createIndex('folderId', 'folderId', { unique: false });
    collectionStore.createIndex('gameId', 'gameId', { unique: false });
  }

  if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
    db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
  }

  // Migration to version 4: Add sortOrder to folders
  if (oldVersion < 4 && db.objectStoreNames.contains(FOLDERS_STORE)) {
    const transaction = event.target.transaction;
    const folderStore = transaction.objectStore(FOLDERS_STORE);

    // Get all folders and add sortOrder
    const getAllRequest = folderStore.getAll();
    getAllRequest.onsuccess = () => {
      const folders = getAllRequest.result;
      folders.forEach((folder, index) => {
        folder.sortOrder = index + 1;
        folderStore.put(folder);
      });
    };
  }

  // Migration to version 5: Add UI state store
  if (oldVersion < 5 && !db.objectStoreNames.contains(UI_STATE_STORE)) {
    db.createObjectStore(UI_STATE_STORE, { keyPath: 'key' });
  }
};

// IndexedDB initialization
export const initDB = (version = null) => {
  return new Promise((resolve, reject) => {
    const request = version ? indexedDB.open(DB_NAME, version) : indexedDB.open(DB_NAME);

    request.onerror = () => {
      reject(request.error);
    };

    request.onsuccess = () => {
      const db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = handleUpgrade;
  });
};
