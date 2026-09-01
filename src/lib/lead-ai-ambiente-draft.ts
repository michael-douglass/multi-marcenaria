import type { AmbienteCoordSpace } from '@/lib/lead-ai-ambiente-zoom';
import type {
  AmbienteBackground,
  AmbienteFurnitureObject,
  AmbienteGeoShape,
  AmbienteImageOverlay,
  AmbienteLabelMarker,
} from '@/lib/lead-ai-ambiente-types';

const DB_NAME = 'movelaria-ambiente-composer';
const DB_VERSION = 1;
const STORE = 'drafts';

export interface AmbienteComposerDraft {
  leadId: number;
  savedAt: number;
  descricao: string;
  background: AmbienteBackground | null;
  overlays: AmbienteImageOverlay[];
  objects: AmbienteFurnitureObject[];
  markers: AmbienteLabelMarker[];
  shapes: AmbienteGeoShape[];
  selectedId: string | null;
  sourceFolderId: string | null;
  /** Rascunhos novos colam móveis na foto; os antigos ainda usam a janela. */
  coordSpace?: AmbienteCoordSpace;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDraftDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'leadId' });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error ?? new Error('Não foi possível abrir o rascunho da lousa'));
    };
  });
  return dbPromise;
}

async function withDraftStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDraftDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = run(tx.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Falha no rascunho da lousa'));
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Não foi possível gravar a foto do rascunho'));
    reader.readAsDataURL(blob);
  });
}

/** Transforma blob: em data: para o rascunho sobreviver se a aba fechar. */
export async function persistableImageUrl(url: string): Promise<string> {
  if (!url.startsWith('blob:')) return url;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Não foi possível copiar a foto para o rascunho');
  return blobToDataUrl(await response.blob());
}

export function ambienteDraftHasContent(draft: Pick<
  AmbienteComposerDraft,
  'descricao' | 'background' | 'overlays' | 'objects' | 'markers' | 'shapes'
>): boolean {
  return Boolean(
    draft.descricao.trim()
    || draft.background
    || draft.overlays.length > 0
    || draft.objects.length > 0
    || draft.markers.length > 0
    || draft.shapes.length > 0,
  );
}

export async function loadAmbienteDraft(leadId: number): Promise<AmbienteComposerDraft | null> {
  if (!leadId || typeof indexedDB === 'undefined') return null;
  try {
    const row = await withDraftStore('readonly', (store) => store.get(leadId));
    if (!row || typeof row !== 'object') return null;
    const draft = row as AmbienteComposerDraft;
    if (draft.leadId !== leadId) return null;
    return {
      leadId,
      savedAt: Number(draft.savedAt) || Date.now(),
      descricao: typeof draft.descricao === 'string' ? draft.descricao : '',
      background: draft.background ?? null,
      overlays: Array.isArray(draft.overlays) ? draft.overlays : [],
      objects: Array.isArray(draft.objects) ? draft.objects : [],
      markers: Array.isArray(draft.markers) ? draft.markers : [],
      shapes: Array.isArray(draft.shapes) ? draft.shapes : [],
      selectedId: draft.selectedId ?? null,
      sourceFolderId: draft.sourceFolderId ?? null,
      coordSpace: draft.coordSpace === 'photo' ? 'photo' : 'viewport',
    };
  } catch {
    return null;
  }
}

export async function saveAmbienteDraft(draft: AmbienteComposerDraft): Promise<void> {
  if (!draft.leadId || typeof indexedDB === 'undefined') return;
  try {
    if (!ambienteDraftHasContent(draft)) {
      await clearAmbienteDraft(draft.leadId);
      return;
    }
    const background = draft.background
      ? { ...draft.background, url: await persistableImageUrl(draft.background.url) }
      : null;
    const overlays: AmbienteImageOverlay[] = [];
    for (const overlay of draft.overlays) {
      overlays.push({ ...overlay, url: await persistableImageUrl(overlay.url) });
    }
    await withDraftStore('readwrite', (store) =>
      store.put({
        ...draft,
        background,
        overlays,
        savedAt: Date.now(),
      } satisfies AmbienteComposerDraft),
    );
  } catch {
    /* quota, modo privado ou IDB bloqueado — a edição atual continua na tela */
  }
}

export async function clearAmbienteDraft(leadId: number): Promise<void> {
  if (!leadId || typeof indexedDB === 'undefined') return;
  try {
    await withDraftStore('readwrite', (store) => store.delete(leadId));
  } catch {
    /* ignora */
  }
}
