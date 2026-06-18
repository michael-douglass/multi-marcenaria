import { useEffect, useState } from 'react'

/** Mesmo breakpoint das regras mobile em index.css (max-width: 767px). */
export const MOBILE_LAYOUT_MEDIA = '(max-width: 767px)'

export function useMobileLayout(): boolean {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_LAYOUT_MEDIA).matches : false,
  )

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_LAYOUT_MEDIA)
    const onChange = () => setMobile(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return mobile
}
