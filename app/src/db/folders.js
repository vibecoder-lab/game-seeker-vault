import { FOLDERS_STORE, COLLECTION_STORE } from '../constants/index.js';
import { formatDateTime } from '../utils/format.js';
import { initDB } from './init.js';

// Add a new folder
export async function addFolder(name) {
  const db = await initDB();
  const tx = db.transaction(FOLDERS_STORE, 'readwrite');
  const store = tx.objectStore(FOLDERS_STORE);
  const result = await new Promise((resolve, reject) => {
    const request = store.add({ name, createdAt: formatDateTime(Date.now()) });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
}

// Get all folders
export async function getFolders() {
  const db = await initDB();
  const tx = db.transaction(FOLDERS_STORE, 'readonly');
  const store = tx.objectStore(FOLDERS_STORE);
  const result = await new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
}

// Update folder name
export async function updateFolder(id, name) {
  const db = await initDB();
  const tx = db.transaction(FOLDERS_STORE, 'readwrite');
  const store = tx.objectStore(FOLDERS_STORE);
  const folder = await new Promise((resolve) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
  });
  folder.name = name;
  await new Promise((resolve, reject) => {
    const request = store.put(folder);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
}

// Delete folder and its collections
export async function deleteFolder(id) {
  const db = await initDB();
  const tx = db.transaction([FOLDERS_STORE, COLLECTION_STORE], 'readwrite');
  await new Promise((resolve, reject) => {
    const request = tx.objectStore(FOLDERS_STORE).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  const collectionStore = tx.objectStore(COLLECTION_STORE);
  const index = collectionStore.index('folderId');
  const collections = await new Promise((resolve) => {
    const req = index.getAll(id);
    req.onsuccess = () => resolve(req.result);
  });
  for (const collection of collections) {
    await new Promise((resolve) => {
      const req = collectionStore.delete(collection.id);
      req.onsuccess = () => resolve();
    });
  }
  db.close();
}

// Delete all folders
export async function deleteAllFolders() {
  const db = await initDB();
  const tx = db.transaction(FOLDERS_STORE, 'readwrite');
  const store = tx.objectStore(FOLDERS_STORE);
  await new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
}
