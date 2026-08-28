import { useCallback, useRef, useState } from 'react';
import type { LeadWhiteboardDrawing } from '@/hooks/useLeadWhiteboard';

export type WhiteboardHistoryAction =
  | { type: 'add'; drawing: LeadWhiteboardDrawing }
  | {
      type: 'update';
      id: string;
      before: { path_data: string; cor: string; stroke_width: number };
      after: { path_data: string; cor: string; stroke_width: number };
    }
  | { type: 'delete'; drawing: LeadWhiteboardDrawing }
  | { type: 'clear'; drawings: LeadWhiteboardDrawing[] };

interface WhiteboardHistoryApi {
  deleteDrawing: (id: string) => Promise<unknown>;
  restoreDrawing: (payload: {
    path_data: string;
    cor: string;
    stroke_width: number;
  }) => Promise<LeadWhiteboardDrawing>;
  updateDrawing: (payload: {
    id: string;
    path_data?: string;
    cor?: string;
    stroke_width?: number;
  }) => Promise<unknown>;
  clearAllDrawings: (ids?: string[]) => Promise<unknown>;
}

export function useWhiteboardHistory(api: WhiteboardHistoryApi) {
  const undoStackRef = useRef<WhiteboardHistoryAction[]>([]);
  const redoStackRef = useRef<WhiteboardHistoryAction[]>([]);
  const applyingRef = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const syncFlags = useCallback(() => {
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
  }, []);

  const reset = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    syncFlags();
  }, [syncFlags]);

  const push = useCallback(
    (action: WhiteboardHistoryAction) => {
      if (applyingRef.current) return;
      undoStackRef.current.push(action);
      redoStackRef.current = [];
      syncFlags();
    },
    [syncFlags],
  );

  const applyInverse = useCallback(
    async (action: WhiteboardHistoryAction, direction: 'undo' | 'redo') => {
      if (direction === 'undo') {
        switch (action.type) {
          case 'add':
            await api.deleteDrawing(action.drawing.id);
            break;
          case 'delete':
            await api.restoreDrawing({
              path_data: action.drawing.path_data,
              cor: action.drawing.cor,
              stroke_width: action.drawing.stroke_width,
            });
            break;
          case 'update':
            await api.updateDrawing({ id: action.id, ...action.before });
            break;
          case 'clear':
            for (const d of action.drawings) {
              await api.restoreDrawing({
                path_data: d.path_data,
                cor: d.cor,
                stroke_width: d.stroke_width,
              });
            }
            break;
        }
        return;
      }

      switch (action.type) {
        case 'add':
          await api.restoreDrawing({
            path_data: action.drawing.path_data,
            cor: action.drawing.cor,
            stroke_width: action.drawing.stroke_width,
          });
          break;
        case 'delete':
          await api.deleteDrawing(action.drawing.id);
          break;
        case 'update':
          await api.updateDrawing({ id: action.id, ...action.after });
          break;
        case 'clear': {
          for (const d of action.drawings) {
            await api.deleteDrawing(d.id);
          }
          break;
        }
      }
    },
    [api],
  );

  const undo = useCallback(async () => {
    const action = undoStackRef.current.pop();
    if (!action) return;
    redoStackRef.current.push(action);
    applyingRef.current = true;
    setIsApplying(true);
    try {
      await applyInverse(action, 'undo');
    } finally {
      applyingRef.current = false;
      setIsApplying(false);
      syncFlags();
    }
  }, [applyInverse, syncFlags]);

  const redo = useCallback(async () => {
    const action = redoStackRef.current.pop();
    if (!action) return;
    undoStackRef.current.push(action);
    applyingRef.current = true;
    setIsApplying(true);
    try {
      await applyInverse(action, 'redo');
    } finally {
      applyingRef.current = false;
      setIsApplying(false);
      syncFlags();
    }
  }, [applyInverse, syncFlags]);

  return {
    push,
    undo,
    redo,
    reset,
    canUndo,
    canRedo,
    isApplying,
    isRecording: () => !applyingRef.current,
  };
}
