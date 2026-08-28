import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  AGENDA_ITEM_ANEXO_MAX_COUNT,
  convertPdfToImageFiles,
  deleteAgendaItemAnexosFromStorage,
  isPdfFile,
  parseAgendaItemAnexos,
  uploadAgendaItemFile,
  validateAgendaItemFile,
  type AgendaItemAnexo,
  type AgendaItemAnexosAccept,
  type AgendaItemAnexosScope,
} from '@/lib/agenda-item-anexos';

export interface PendingAgendaPage {
  file: File;
  previewUrl: string;
  page?: number;
  sourceName?: string;
  kind: 'image' | 'pdf-page';
}

export interface PendingAgendaGrupo {
  tempId: string;
  originalName: string;
  converting: boolean;
  error: string | null;
  pages: PendingAgendaPage[];
}

export interface AgendaAnexoPreview {
  key: string;
  previewUrl: string;
  name: string;
  badge?: string;
  converting?: boolean;
  error?: string;
  origin: 'saved' | 'pending';
}

function revokeIfBlob(url: string) {
  if (url.startsWith('blob:')) URL.revokeObjectURL(url);
}

export function useAgendaItemAnexosDraft(options: {
  accept: AgendaItemAnexosAccept;
  scope: AgendaItemAnexosScope;
  open: boolean;
}) {
  const { user } = useAuth();
  const [saved, setSaved] = useState<AgendaItemAnexo[]>([]);
  const [removed, setRemoved] = useState<AgendaItemAnexo[]>([]);
  const [pending, setPending] = useState<PendingAgendaGrupo[]>([]);
  const [busy, setBusy] = useState(false);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  const reset = useCallback((raw?: unknown) => {
    pendingRef.current.forEach((grupo) => {
      grupo.pages.forEach((page) => revokeIfBlob(page.previewUrl));
    });
    setSaved(parseAgendaItemAnexos(raw));
    setRemoved([]);
    setPending([]);
    setBusy(false);
  }, []);

  useEffect(() => {
    if (options.open) return;
    reset();
  }, [options.open, reset]);

  useEffect(() => {
    return () => {
      pendingRef.current.forEach((grupo) => {
        grupo.pages.forEach((page) => revokeIfBlob(page.previewUrl));
      });
    };
  }, []);

  const visibleSaved = useMemo(
    () => saved.filter((item) => !removed.some((r) => r.id === item.id)),
    [saved, removed],
  );

  const currentCount =
    visibleSaved.length + pending.reduce((sum, grupo) => sum + Math.max(grupo.pages.length, grupo.converting ? 1 : 0), 0);

  const previews = useMemo<AgendaAnexoPreview[]>(() => {
    const savedItems: AgendaAnexoPreview[] = visibleSaved.map((anexo) => ({
      key: `saved:${anexo.id}`,
      previewUrl: anexo.url,
      name: anexo.source_name || anexo.name,
      badge: anexo.kind === 'pdf-page' && anexo.page ? `PDF · p.${anexo.page}` : undefined,
      origin: 'saved',
    }));

    const pendingItems: AgendaAnexoPreview[] = pending.flatMap((grupo) => {
      if (grupo.converting) {
        return [
          {
            key: `pending:${grupo.tempId}:loading`,
            previewUrl: '',
            name: grupo.originalName,
            converting: true,
            origin: 'pending' as const,
          },
        ];
      }
      if (grupo.error && grupo.pages.length === 0) {
        return [
          {
            key: `pending:${grupo.tempId}:error`,
            previewUrl: '',
            name: grupo.originalName,
            error: grupo.error,
            origin: 'pending' as const,
          },
        ];
      }
      return grupo.pages.map((page, index) => ({
        key: `pending:${grupo.tempId}:${index}`,
        previewUrl: page.previewUrl,
        name: page.sourceName || grupo.originalName,
        badge:
          page.kind === 'pdf-page' && page.page
            ? `PDF · p.${page.page}`
            : undefined,
        origin: 'pending' as const,
      }));
    });

    return [...savedItems, ...pendingItems];
  }, [visibleSaved, pending]);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;
      let usedSlots = currentCount;

      for (const file of list) {
        const error = validateAgendaItemFile(file, options.accept);
        if (error) {
          toast.error(file.name, { description: error });
          continue;
        }

        const slotsLeft = AGENDA_ITEM_ANEXO_MAX_COUNT - usedSlots;
        if (slotsLeft <= 0) {
          toast.error(`Máximo de ${AGENDA_ITEM_ANEXO_MAX_COUNT} anexos neste item.`);
          break;
        }

        if (!isPdfFile(file)) {
          const previewUrl = URL.createObjectURL(file);
          usedSlots += 1;
          setPending((prev) => [
            ...prev,
            {
              tempId: crypto.randomUUID(),
              originalName: file.name,
              converting: false,
              error: null,
              pages: [
                {
                  file,
                  previewUrl,
                  kind: 'image',
                },
              ],
            },
          ]);
          continue;
        }

        const tempId = crypto.randomUUID();
        setPending((prev) => [
          ...prev,
          {
            tempId,
            originalName: file.name,
            converting: true,
            error: null,
            pages: [],
          },
        ]);

        try {
          const imageFiles = await Promise.race([
            convertPdfToImageFiles(file),
            new Promise<File[]>((_, reject) => {
              window.setTimeout(
                () => reject(new Error('O PDF demorou demais para virar fotos. Tente outro arquivo.')),
                25_000,
              );
            }),
          ]);
          const limited = imageFiles.slice(0, Math.max(1, AGENDA_ITEM_ANEXO_MAX_COUNT - usedSlots));
          usedSlots += limited.length;
          if (imageFiles.length > limited.length) {
            toast.message(`${file.name}: anexamos as ${limited.length} primeiras páginas.`);
          }

          setPending((prev) =>
            prev.map((grupo) => {
              if (grupo.tempId !== tempId) return grupo;
              return {
                ...grupo,
                converting: false,
                pages: limited.map((imageFile, index) => ({
                  file: imageFile,
                  previewUrl: URL.createObjectURL(imageFile),
                  page: index + 1,
                  sourceName: file.name,
                  kind: 'pdf-page' as const,
                })),
              };
            }),
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Não foi possível converter este PDF em fotos.';
          setPending((prev) =>
            prev.map((grupo) =>
              grupo.tempId === tempId
                ? { ...grupo, converting: false, error: message }
                : grupo,
            ),
          );
          toast.error('Falha ao converter PDF', { description: message });
        }
      }
    },
    [currentCount, options.accept],
  );

  const removePreview = useCallback((key: string) => {
    if (key.startsWith('saved:')) {
      const id = key.slice('saved:'.length);
      setRemoved((prev) => {
        if (prev.some((item) => item.id === id)) return prev;
        const found = saved.find((item) => item.id === id);
        return found ? [...prev, found] : prev;
      });
      return;
    }

    const match = /^pending:([^:]+)/.exec(key);
    if (!match) return;
    const tempId = match[1];
    setPending((prev) => {
      const grupo = prev.find((g) => g.tempId === tempId);
      grupo?.pages.forEach((page) => revokeIfBlob(page.previewUrl));
      return prev.filter((g) => g.tempId !== tempId);
    });
  }, [saved]);

  const flush = useCallback(
    async (entityId: string): Promise<AgendaItemAnexo[]> => {
      if (!user?.id) throw new Error('Não autenticado');
      setBusy(true);
      try {
        if (removed.length > 0) {
          await deleteAgendaItemAnexosFromStorage(removed);
        }

        const uploaded: AgendaItemAnexo[] = [];
        for (const grupo of pending) {
          for (const page of grupo.pages) {
            uploaded.push(
              await uploadAgendaItemFile({
                file: page.file,
                scope: options.scope,
                entityId,
                userId: user.id,
                kind: page.kind,
                sourceName: page.sourceName,
                page: page.page,
              }),
            );
          }
        }

        const next = [...visibleSaved, ...uploaded];
        setSaved(next);
        setRemoved([]);
        pending.forEach((grupo) => grupo.pages.forEach((page) => revokeIfBlob(page.previewUrl)));
        setPending([]);
        return next;
      } finally {
        setBusy(false);
      }
    },
    [options.scope, pending, removed, user?.id, visibleSaved],
  );

  const converting = pending.some((grupo) => grupo.converting);

  return {
    previews,
    currentCount,
    maxCount: AGENDA_ITEM_ANEXO_MAX_COUNT,
    busy,
    converting,
    hasChanges: pending.length > 0 || removed.length > 0,
    reset,
    addFiles,
    removePreview,
    flush,
  };
}
