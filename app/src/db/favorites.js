import { FAVORITES_STORE } from '../constants/index.js';
import { formatDateTime } from '../utils/format.js';
import { initDB } from './init.js';

// Add a favorite
export async function addFavorite(folderId, gameId, sortOrder = null) {
  const db = await initDB();
  const tx = db.transaction(FAVORITES_STORE, 'readwrite');
  const store = tx.objectStore(FAVORITES_STORE);

  // If sortOrder is not specified, set to max value in folder + 1
  if (sortOrder === null) {
    const index = store.index('folderId');
    const existingFavs = await new Promise((resolve) => {
      const request = index.getAll(folderId);
      request.onsuccess = () => resolve(request.result);
    });
    const maxOrder = existingFavs.reduce((max, fav) => Math.max(max, fav.sortOrder ?? 0), 0);
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

// Get favorites by folder
export async function getFavoritesByFolder(folderId) {
  const db = await initDB();
  const tx = db.transaction(FAVORITES_STORE, 'readonly');
  const store = tx.objectStore(FAVORITES_STORE);
  const index = store.index('folderId');
  const result = await new Promise((resolve, reject) => {
    const request = index.getAll(folderId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
}

// Get favorite by game ID
export async function getFavoriteByGameId(gameId) {
  const db = await initDB();
  const tx = db.transaction(FAVORITES_STORE, 'readonly');
  const store = tx.objectStore(FAVORITES_STORE);
  const index = store.index('gameId');
  const result = await new Promise((resolve) => {
    const request = index.get(gameId);
    request.onsuccess = () => resolve(request.result);
  });
  db.close();
  return result;
}

// Update favorite folder
export async function updateFavoriteFolder(favoriteId, newFolderId) {
  const db = await initDB();
  const tx = db.transaction(FAVORITES_STORE, 'readwrite');
  const store = tx.objectStore(FAVORITES_STORE);
  const fav = await new Promise((resolve) => {
    const req = store.get(favoriteId);
    req.onsuccess = () => resolve(req.result);
  });
  fav.folderId = newFolderId;
  await new Promise((resolve, reject) => {
    const request = store.put(fav);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
}

// Delete favorite
export async function deleteFavorite(id) {
  const db = await initDB();
  const tx = db.transaction(FAVORITES_STORE, 'readwrite');
  const store = tx.objectStore(FAVORITES_STORE);
  await new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
}

// Update favorite sort order
export async function updateFavoriteOrder(favoriteId, sortOrder) {
  const db = await initDB();
  const tx = db.transaction(FAVORITES_STORE, 'readwrite');
  const store = tx.objectStore(FAVORITES_STORE);
  const fav = await new Promise((resolve) => {
    const req = store.get(favoriteId);
    req.onsuccess = () => resolve(req.result);
  });
  fav.sortOrder = sortOrder;
  await new Promise((resolve, reject) => {
    const request = store.put(fav);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
}

// Mark favorite as deleted (move to trash)
export async function markAsDeleted(favoriteId) {
  const db = await initDB();
  const tx = db.transaction(FAVORITES_STORE, 'readwrite');
  const store = tx.objectStore(FAVORITES_STORE);
  const fav = await new Promise((resolve) => {
    const req = store.get(favoriteId);
    req.onsuccess = () => resolve(req.result);
  });

  const deletedSortOrder = fav.sortOrder;
  const folderId = fav.folderId;

  // Get all items in folder before deletion
  const index = store.index('folderId');
  const allInFolder = await new Promise((resolve) => {
    const request = index.getAll(folderId);
    request.onsuccess = () => resolve(request.result);
  });

  // Execute deletion
  fav.deleted = true;
  fav.sortOrder = "";

  await new Promise((resolve, reject) => {
    const request = store.put(fav);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  // Decrement sortOrder by 1 for games after the deleted game in the same folder
  for (const item of allInFolder) {
    if (item.id !== favoriteId && !item.deleted && typeof item.sortOrder === 'number' && item.sortOrder > deletedSortOrder) {
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

// Restore favorite from trash
export async function restoreFromTrash(favoriteId) {
  const db = await initDB();
  const tx = db.transaction(FAVORITES_STORE, 'readwrite');
  const store = tx.objectStore(FAVORITES_STORE);
  const fav = await new Promise((resolve) => {
    const req = store.get(favoriteId);
    req.onsuccess = () => resolve(req.result);
  });

  fav.deleted = false;

  // Get game count in restore folder and set sortOrder
  const index = store.index('folderId');
  const allInFolder = await new Promise((resolve) => {
    const request = index.getAll(fav.folderId);
    request.onsuccess = () => resolve(request.result);
  });

  const activeGames = allInFolder.filter(item => item.id !== favoriteId && !item.deleted);
  fav.sortOrder = activeGames.length + 1;

  await new Promise((resolve, reject) => {
    const request = store.put(fav);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
}

// Get deleted favorites (trash)
export async function getDeletedFavorites() {
  const db = await initDB();
  const tx = db.transaction(FAVORITES_STORE, 'readonly');
  const store = tx.objectStore(FAVORITES_STORE);
  const result = await new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const filtered = request.result.filter(fav => fav.deleted === true);
      resolve(filtered);
    };
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
}
