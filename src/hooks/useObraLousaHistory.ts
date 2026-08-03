import { useCallback, useState } from 'react'

export type HistoryAction =
  | { type: 'add'; drawingId: string }
  | { type: 'remove'; drawingId: string; snapshot: unknown }
  | { type: 'clear'; drawingIds: string[] }

/**
 * Histórico local simples (undo/redo) — pilha de IDs de desenhos.
 * A persistência real fica no hook useObraLousa; aqui só controlamos a ordem.
 */
export function useObraLousaHistory() {
  const [undoStack, setUndoStack] = useState<string[]>([])
  const [redoStack, setRedoStack] = useState<string[]>([])

  const pushCreated = useCallback((drawingId: string) => {
    setUndoStack(prev => [...prev, drawingId])
    setRedoStack([])
  }, [])

  const undo = useCallback((): string | null => {
    let id: string | null = null
    setUndoStack(prev => {
      if (!prev.length) return prev
      id = prev[prev.length - 1]
      return prev.slice(0, -1)
    })
    if (id) {
      setRedoStack(prev => [...prev, id!])
    }
    return id
  }, [])

  const redo = useCallback((): string | null => {
    let id: string | null = null
    setRedoStack(prev => {
      if (!prev.length) return prev
      id = prev[prev.length - 1]
      return prev.slice(0, -1)
    })
    if (id) {
      setUndoStack(prev => [...prev, id!])
    }
    return id
  }, [])

  const reset = useCallback(() => {
    setUndoStack([])
    setRedoStack([])
  }, [])

  return {
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    pushCreated,
    undo,
    redo,
    reset,
    pendingRedoId: redoStack[redoStack.length - 1] ?? null,
  }
}
