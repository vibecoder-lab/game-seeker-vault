import { COLLECTION_STORE } from '../constants/index.js';
import { formatDateTime } from '../utils/format.js';
import { initDB } from './init.js';

// Add a collection
export async function addCollection(folderId, gameId, sortOrder = null) {
  const db = await initDB();
  const tx = db.transaction(COLLECTION_STORE, 'readwrite');
  const store = tx.objectStore(COLLECTION_STORE);

  // If sortOrder is not specified, set to max value in folder + 1
  if (sortOrder === null) {
    const index = store.index('folderId');
    const existingCollections = await new Promise((resolve) => {
      const request = index.getAll(folderId);
      request.onsuccess = () => resolve(request.result);
    });
    const maxOrder = existingCollections.reduce((max, collection) => Math.max(max, collection.sortOrder ?? 0), 0);
    sortOrder = maxOrder + 1;
  }

  const result = await new Promise((resolve, reject) => {
    const request = store.add({ folderId, gameId, sortOrder, createdAt: formatDateTime(Date.now()), deleted: false });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
}

// Get collections by folder
export async function getCollectionsByFolder(folderId) {
  const db = await initDB();
  const tx = db.transaction(COLLECTION_STORE, 'readonly');
  const store = tx.objectStore(COLLECTION_STORE);
  const index = store.index('folderId');
  const result = await new Promise((resolve, reject) => {
    const request = index.getAll(folderId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
}

// Get collection by game ID
export async function getCollectionByGameId(gameId) {
  const db = await initDB();
  const tx = db.transaction(COLLECTION_STORE, 'readonly');
  const store = tx.objectStore(COLLECTION_STORE);
  const index = store.index('gameId');
  const result = await new Promise((resolve) => {
    const request = index.get(gameId);
    request.onsuccess = () => resolve(request.result);
  });
  db.close();
  return result;
}

// Update collection folder
export async function updateCollectionFolder(collectionId, newFolderId) {
  const db = await initDB();
  const tx = db.transaction(COLLECTION_STORE, 'readwrite');
  const store = tx.objectStore(COLLECTION_STORE);
  const collection = await new Promise((resolve) => {
    const req = store.get(collectionId);
    req.onsuccess = () => resolve(req.result);
  });

  const oldSortOrder = collection.sortOrder;
  const oldFolderId = collection.folderId;

  // Get game count in destination folder and set sortOrder to the end
  const index = store.index('folderId');
  const destFolderGames = await new Promise((resolve) => {
    const request = index.getAll(newFolderId);
    request.onsuccess = () => resolve(request.result);
  });

  const activeGamesInDest = destFolderGames.filter(item => !item.deleted);
  collection.folderId = newFolderId;
  collection.sortOrder = activeGamesInDest.length + 1;

  await new Promise((resolve, reject) => {
    const request = store.put(collection);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  // Decrement sortOrder for games after the moved game in the source folder
  const sourceFolderGames = await new Promise((resolve) => {
    const request = index.getAll(oldFolderId);
    request.onsuccess = () => resolve(request.result);
  });

  for (const item of sourceFolderGames) {
    if (item.id !== collectionId && !item.deleted && typeof item.sortOrder === 'number' && item.sortOrder > oldSortOrder) {
      item.sortOrder -= 1;
      await new Promise((resolve, reject) => {
        const request = store.put(item);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }

  db.close();
}

// Delete collection
export async function deleteCollection(id) {
  const db = await initDB();
  const tx = db.transaction(COLLECTION_STORE, 'readwrite');
  const store = tx.objectStore(COLLECTION_STORE);
  await new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
}

// Update collection sort order
export async function updateCollectionOrder(collectionId, sortOrder) {
  const db = await initDB();
  const tx = db.transaction(COLLECTION_STORE, 'readwrite');
  const store = tx.objectStore(COLLECTION_STORE);
  const collection = await new Promise((resolve) => {
    const req = store.get(collectionId);
    req.onsuccess = () => resolve(req.result);
  });
  collection.sortOrder = sortOrder;
  await new Promise((resolve, reject) => {
    const request = store.put(collection);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
}

// Mark collection as deleted (move to trash)
export async function markAsDeleted(collectionId) {
  const db = await initDB();
  const tx = db.transaction(COLLECTION_STORE, 'readwrite');
  const store = tx.objectStore(COLLECTION_STORE);
  const collection = await new Promise((resolve) => {
    const req = store.get(collectionId);
    req.onsuccess = () => resolve(req.result);
  });

  const deletedSortOrder = collection.sortOrder;
  const folderId = collection.folderId;

  // Get all items in folder before deletion
  const index = store.index('folderId');
  const allInFolder = await new Promise((resolve) => {
    const request = index.getAll(folderId);
    request.onsuccess = () => resolve(request.result);
  });

  // Execute deletion
  collection.deleted = true;
  collection.sortOrder = "";

  await new Promise((resolve, reject) => {
    const request = store.put(collection);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  // Decrement sortOrder by 1 for games after the deleted game in the same folder
  for (const item of allInFolder) {
    if (item.id !== collectionId && !item.deleted && typeof item.sortOrder === 'number' && item.sortOrder > deletedSortOrder) {
      item.sortOrder -= 1;
      await new Promise((resolve, reject) => {
        const request = store.put(item);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }

  db.close();
}

// Restore collection from trash
export async function restoreFromTrash(collectionId) {
  const db = await initDB();
  const tx = db.transaction(COLLECTION_STORE, 'readwrite');
  const store = tx.objectStore(COLLECTION_STORE);
  const collection = await new Promise((resolve) => {
    const req = store.get(collectionId);
    req.onsuccess = () => resolve(req.result);
  });

  collection.deleted = false;

  // Get game count in restore folder and set sortOrder
  const index = store.index('folderId');
  const allInFolder = await new Promise((resolve) => {
    const request = index.getAll(collection.folderId);
    request.onsuccess = () => resolve(request.result);
  });

  const activeGames = allInFolder.filter(item => !item.deleted);
  collection.sortOrder = activeGames.length + 1;

  await new Promise((resolve, reject) => {
    const request = store.put(collection);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
}

// Get deleted collections (trash)
export async function getDeletedCollections() {
  const db = await initDB();
  const tx = db.transaction(COLLECTION_STORE, 'readonly');
  const store = tx.objectStore(COLLECTION_STORE);
  const result = await new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const filtered = request.result.filter(collection => collection.deleted === true);
      resolve(filtered);
    };
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
}

// Delete all collections
export async function deleteAllCollections() {
  const db = await initDB();
  const tx = db.transaction(COLLECTION_STORE, 'readwrite');
  const store = tx.objectStore(COLLECTION_STORE);
  await new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
}
