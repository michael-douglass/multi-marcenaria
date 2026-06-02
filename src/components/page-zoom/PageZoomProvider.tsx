import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '@/lib/supabase'
import {
  clampPageZoom,
  PAGE_ZOOM_DEFAULT,
  PAGE_ZOOM_MAX,
  PAGE_ZOOM_MIN,
  PAGE_ZOOM_STEP,
  type PageZoomKey,
} from '@/lib/page-zoom'

interface PageZoomContextValue {
  zoom: number
  loading: boolean
  setZoom: (value: number) => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
}

const PageZoomContext = createContext<PageZoomContextValue | null>(null)

export function usePageZoom(): PageZoomContextValue {
  const ctx = useContext(PageZoomContext)
  if (!ctx) {
    throw new Error('usePageZoom deve ser usado dentro de PageZoomProvider')
  }
  return ctx
}

interface PageZoomProviderProps {
  pageKey: PageZoomKey
  children: ReactNode
}

export function PageZoomProvider({ pageKey, children }: PageZoomProviderProps) {
  const [zoom, setZoomState] = useState(PAGE_ZOOM_DEFAULT)
  const [loading, setLoading] = useState(true)
  const saveTimerRef = useRef<number | null>(null)
  const userIdRef = useRef<string | null>(null)

  useEffect(() => {
    let active = true

    void (async () => {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!active || !user) return

        userIdRef.current = user.id

        const { data, error } = await supabase
          .from('movelaria_page_zoom')
          .select('zoom_percent')
          .eq('usuario_id', user.id)
          .eq('page_key', pageKey)
          .maybeSingle()

        if (error) throw error
        if (!active) return

        if (data?.zoom_percent != null) {
          setZoomState(clampPageZoom(data.zoom_percent))
        }
      } catch (err) {
        console.error('[PageZoomProvider] Erro ao carregar zoom:', err)
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
      if (saveTimerRef.current != null) {
        window.clearTimeout(saveTimerRef.current)
      }
    }
  }, [pageKey])

  const persistZoom = useCallback((value: number) => {
    const userId = userIdRef.current
    if (!userId) return

    if (saveTimerRef.current != null) {
      window.clearTimeout(saveTimerRef.current)
    }

    saveTimerRef.current = window.setTimeout(() => {
      void supabase
        .from('movelaria_page_zoom')
        .upsert(
          {
            usuario_id: userId,
            page_key: pageKey,
            zoom_percent: value,
          },
          { onConflict: 'usuario_id,page_key' },
        )
        .then(({ error }) => {
          if (error) console.error('[PageZoomProvider] Erro ao salvar zoom:', error)
        })
    }, 400)
  }, [pageKey])

  const setZoom = useCallback((value: number) => {
    const next = clampPageZoom(value)
    setZoomState(next)
    persistZoom(next)
  }, [persistZoom])

  const zoomIn = useCallback(() => {
    setZoom(zoom + PAGE_ZOOM_STEP)
  }, [setZoom, zoom])

  const zoomOut = useCallback(() => {
    setZoom(zoom - PAGE_ZOOM_STEP)
  }, [setZoom, zoom])

  const resetZoom = useCallback(() => {
    setZoom(PAGE_ZOOM_DEFAULT)
  }, [setZoom])

  const value = useMemo<PageZoomContextValue>(() => ({
    zoom,
    loading,
    setZoom,
    zoomIn,
    zoomOut,
    resetZoom,
  }), [zoom, loading, setZoom, zoomIn, zoomOut, resetZoom])

  return (
    <PageZoomContext.Provider value={value}>
      {children}
    </PageZoomContext.Provider>
  )
}

export { PAGE_ZOOM_MIN, PAGE_ZOOM_MAX }
