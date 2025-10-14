import { SETTINGS_STORE, DEFAULT_SETTINGS } from '../constants/index.js';
import { initDB } from './init.js';

// Load settings
export async function loadSettings() {
  const db = await initDB();
  const tx = db.transaction(SETTINGS_STORE, 'readonly');
  const store = tx.objectStore(SETTINGS_STORE);
  const result = await new Promise((resolve, reject) => {
    const request = store.get('app_settings');
    request.onsuccess = () => {
      const data = request.result;
      resolve(data ? { ...DEFAULT_SETTINGS, ...data.value } : { ...DEFAULT_SETTINGS });
    };
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
}

// Save settings
export async function saveSettings(settings) {
  const db = await initDB();
  const tx = db.transaction(SETTINGS_STORE, 'readwrite');
  const store = tx.objectStore(SETTINGS_STORE);
  await new Promise((resolve, reject) => {
    const request = store.put({ key: 'app_settings', value: settings });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
}

// Reset settings to default
export async function resetSettings() {
  const db = await initDB();
  const tx = db.transaction(SETTINGS_STORE, 'readwrite');
  const store = tx.objectStore(SETTINGS_STORE);
  await new Promise((resolve, reject) => {
    const request = store.delete('app_settings');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
  return { ...DEFAULT_SETTINGS };
}
