import { DB_NAME, DB_VERSION, UI_STATE_STORE } from '../constants/index.js';

// Save UI state to IndexedDB
export const saveUIState = async (state) => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      const db = request.result;

      // Check if object store exists
      if (!db.objectStoreNames.contains(UI_STATE_STORE)) {
        console.warn('[uiState] Object store not found. DB version might be outdated.');
        db.close();
        resolve(); // Resolve without error to avoid breaking the app
        return;
      }

      const transaction = db.transaction([UI_STATE_STORE], 'readwrite');
      const store = transaction.objectStore(UI_STATE_STORE);

      const uiStateData = {
        key: 'app_ui_state',
        value: state
      };

      const putRequest = store.put(uiStateData);

      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);

      transaction.oncomplete = () => db.close();
    };
  });
};

// Load UI state from IndexedDB
export const loadUIState = async () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      const db = request.result;

      // Check if object store exists
      if (!db.objectStoreNames.contains(UI_STATE_STORE)) {
        console.warn('[uiState] Object store not found. DB version might be outdated.');
        db.close();
        resolve(null); // Return null to indicate no state available
        return;
      }

      const transaction = db.transaction([UI_STATE_STORE], 'readonly');
      const store = transaction.objectStore(UI_STATE_STORE);

      const getRequest = store.get('app_ui_state');

      getRequest.onsuccess = () => {
        const result = getRequest.result;
        resolve(result ? result.value : null);
      };

      getRequest.onerror = () => reject(getRequest.error);

      transaction.oncomplete = () => db.close();
    };
  });
};

// Clear UI state from IndexedDB
export const clearUIState = async () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      const db = request.result;

      // Check if object store exists
      if (!db.objectStoreNames.contains(UI_STATE_STORE)) {
        console.warn('[uiState] Object store not found. DB version might be outdated.');
        db.close();
        resolve(); // Resolve without error to avoid breaking the app
        return;
      }

      const transaction = db.transaction([UI_STATE_STORE], 'readwrite');
      const store = transaction.objectStore(UI_STATE_STORE);

      const deleteRequest = store.delete('app_ui_state');

      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);

      transaction.oncomplete = () => db.close();
    };
  });
};
