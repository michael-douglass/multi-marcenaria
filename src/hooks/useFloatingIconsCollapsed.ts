import { useCallback, useState } from 'react'

const STORAGE_KEY = 'garbo:floating-icons-collapsed'

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/** Estado "ícones flutuantes minimizados", lembrado neste navegador. */
export function useFloatingIconsCollapsed() {
  const [isCollapsed, setIsCollapsed] = useState(readCollapsed)

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed(prev => {
      const next = !prev
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        // localStorage indisponível (modo privado): mantém só em memória.
      }
      return next
    })
  }, [])

  return { isCollapsed, toggleCollapsed }
}
