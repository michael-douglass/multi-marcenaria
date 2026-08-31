/**
 * Detecta se o aparelho aguenta WebGL sem tentar o Three.js.
 * Computadores antigos (ex.: Intel HD 3000) quebram ao criar o contexto
 * e o Three.js ainda escreve várias linhas vermelhas no console.
 * O resultado fica em cache: se falhou uma vez, não tenta de novo.
 */

let cached: boolean | null = null

export function markWebGLUnavailable(): void {
  cached = false
}

export function isWebGLAvailable(): boolean {
  if (cached !== null) return cached
  if (typeof document === 'undefined') {
    cached = false
    return false
  }

  try {
    const canvas = document.createElement('canvas')
    const options: WebGLContextAttributes = {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      failIfMajorPerformanceCaveat: true,
      powerPreference: 'low-power',
    }
    const gl =
      canvas.getContext('webgl2', options) ||
      canvas.getContext('webgl', options) ||
      canvas.getContext('experimental-webgl', options)

    if (!gl || typeof (gl as WebGLRenderingContext).getParameter !== 'function') {
      cached = false
      return false
    }

    const lose = (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context')
    lose?.loseContext()
    cached = true
    return true
  } catch {
    cached = false
    return false
  }
}

/** Cria o renderer só se o aparelho passar no teste. Se falhar, não tenta de novo. */
export function tryCreateWebGLRenderer<T>(factory: () => T): T | null {
  if (!isWebGLAvailable()) return null
  try {
    return factory()
  } catch {
    markWebGLUnavailable()
    return null
  }
}

export function isPontoLightPath(pathname: string): boolean {
  return (
    pathname.startsWith('/bater-ponto') ||
    pathname.startsWith('/historico-ponto') ||
    pathname.startsWith('/resumo-ponto')
  )
}
