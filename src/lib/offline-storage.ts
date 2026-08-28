/**
 * Utilitários para armazenamento offline usando IndexedDB.
 * Ideal para arquivos (Blobs) que são muito grandes para o localStorage.
 */

const DB_NAME = 'crm-offline-whiteboard';
/** v3: garante criação de pending-drawings em bancos legados. */
const DB_VERSION = 3;
const STORE_NAME = 'pending-images';
const DRAWINGS_STORE = 'pending-drawings';

export interface PendingImage {
  id: string;
  leadId: number;
  file: File;
  fileName: string;
  boardWidth: number;
  placementIndex: number;
  timestamp: number;
}

export interface PendingDrawing {
  id: string;
  leadId: number;
  path_data: string;
  cor: string;
  stroke_width: number;
  timestamp: number;
  isUpdate?: boolean;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function isMissingStoreError(error: unknown): boolean {
  if (!(error instanceof DOMException)) return false;
  return error.name === 'NotFoundError';
}

function ensureStores(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
  }
  if (!db.objectStoreNames.contains(DRAWINGS_STORE)) {
    db.createObjectStore(DRAWINGS_STORE, { keyPath: 'id' });
  }
}

function hasAllStores(db: IDBDatabase): boolean {
  return db.objectStoreNames.contains(STORE_NAME) && db.objectStoreNames.contains(DRAWINGS_STORE);
}

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Falha ao excluir IndexedDB'));
    request.onblocked = () => {
      console.warn('[offline-storage] Exclusão do IndexedDB bloqueada — feche outras abas do CRM');
    };
  });
}

function openDBInternal(retryCount = 0): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      ensureStores(request.result);
    };

    request.onsuccess = () => {
      const db = request.result;

      if (!hasAllStores(db)) {
        db.close();

        if (retryCount >= 2) {
          reject(new Error('IndexedDB inconsistente após tentativas de migração'));
          return;
        }

        void deleteDatabase()
          .then(() => openDBInternal(retryCount + 1).then(resolve).catch(reject))
          .catch(reject);
        return;
      }

      db.onversionchange = () => db.close();
      resolve(db);
    };

    request.onerror = () => {
      reject(request.error ?? new Error('Falha ao abrir IndexedDB'));
    };

    request.onblocked = () => {
      console.warn('[offline-storage] Upgrade do IndexedDB bloqueado — feche outras abas do CRM');
    };
  });
}

function openDB(forceReset = false): Promise<IDBDatabase> {
  if (forceReset) {
    dbPromise = null;
  }

  if (!dbPromise) {
    dbPromise = (async () => {
      try {
        return await openDBInternal();
      } catch (error) {
        dbPromise = null;
        throw error;
      }
    })();
  }

  return dbPromise;
}

async function recreateDatabase(): Promise<IDBDatabase> {
  dbPromise = null;
  await deleteDatabase();
  return openDB(true);
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const run = async (db: IDBDatabase): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      let transaction: IDBTransaction;
      try {
        transaction = db.transaction(storeName, mode);
      } catch (error) {
        reject(error);
        return;
      }

      const store = transaction.objectStore(storeName);
      const request = operation(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error(`IndexedDB: ${storeName}`));
    });
  };

  try {
    const db = await openDB();
    return await run(db);
  } catch (error) {
    if (!isMissingStoreError(error)) throw error;

    console.warn('[offline-storage] Object store ausente, recriando banco:', storeName);
    const db = await recreateDatabase();
    return run(db);
  }
}

/** Salva uma imagem para upload posterior. */
export async function savePendingImage(image: PendingImage): Promise<void> {
  await withStore(STORE_NAME, 'readwrite', (store) => store.put(image));
}

/** Lista todas as imagens pendentes. */
export async function listPendingImages(): Promise<PendingImage[]> {
  try {
    return await withStore(STORE_NAME, 'readonly', (store) => store.getAll());
  } catch (error) {
    console.warn('[offline-storage] Erro ao listar imagens pendentes:', error);
    return [];
  }
}

/** Remove uma imagem da fila. */
export async function removePendingImage(id: string): Promise<void> {
  await withStore(STORE_NAME, 'readwrite', (store) => store.delete(id));
}

/** Salva um desenho para sincronização posterior. */
export async function savePendingDrawing(drawing: PendingDrawing): Promise<void> {
  await withStore(DRAWINGS_STORE, 'readwrite', (store) => store.put(drawing));
}

/** Lista todos os desenhos pendentes. */
export async function listPendingDrawings(): Promise<PendingDrawing[]> {
  try {
    return await withStore(DRAWINGS_STORE, 'readonly', (store) => store.getAll());
  } catch (error) {
    console.warn('[offline-storage] Erro ao listar desenhos pendentes:', error);
    return [];
  }
}

/** Remove um desenho da fila. */
export async function removePendingDrawing(id: string): Promise<void> {
  await withStore(DRAWINGS_STORE, 'readwrite', (store) => store.delete(id));
}
