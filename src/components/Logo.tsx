import { useEffect, useState } from 'react'
import { useAppOptional } from '@/context/AppContext'
import { DEFAULT_BRAND_LOGO_URL, resolveBrandLogo, resolveBrandName } from '@/lib/app-branding'

interface LogoProps {
  full?: boolean
  /** Sombra atrás da marca. Desligue no menu para não cobrir o desenho. */
  halo?: boolean
  /** Altura da marca aberta, em pixels. */
  height?: number
}

/**
 * Logo da empresa ativa (multi-empresa), com a logo GARBO como padrão. Enquanto a empresa carrega
 * a imagem fica invisível (mantendo o espaço) para não piscar a marca de outra empresa.
 */
export function Logo({ full = true, halo = true, height = 44 }: LogoProps) {
  const app = useAppOptional()
  const carregando = app?.empresaLoading === true && !!app?.session
  const logoEmpresa = app?.empresa?.logoUrl ?? null
  const alt = resolveBrandName(app?.empresa?.nome)
  const [falhou, setFalhou] = useState(false)

  // Logo nova (upload/troca de empresa): tenta de novo antes de cair no padrão.
  useEffect(() => setFalhou(false), [logoEmpresa])

  const src = falhou ? DEFAULT_BRAND_LOGO_URL : resolveBrandLogo(logoEmpresa)
  const onError = () => {
    if (!falhou && src !== DEFAULT_BRAND_LOGO_URL) setFalhou(true)
  }
  const visibilidade = carregando ? ('hidden' as const) : undefined

  if (full) {
    return (
      <div
        style={{
          background: 'transparent',
          borderRadius: '10px',
          padding: '2px 8px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: halo ? '0 6px 18px rgba(0,0,0,.25)' : 'none',
        }}
      >
        <img
          src={src}
          alt={alt}
          onError={onError}
          style={{
            height,
            width: 'auto',
            maxWidth: '100%',
            objectFit: 'contain',
            display: 'block',
            visibility: visibilidade,
            filter: halo ? undefined : 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))',
          }}
          draggable={false}
        />
      </div>
    )
  }

  // Icon-only: keeps the whole logo visible inside the square
  return (
    <div
      style={{
        width: 40,
        height: 40,
        overflow: 'hidden',
        background: 'transparent',
        borderRadius: '10px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: halo ? '0 4px 14px rgba(0,0,0,.22)' : 'none',
      }}
    >
      <img
        src={src}
        alt={alt}
        onError={onError}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
          visibility: visibilidade,
        }}
        draggable={false}
      />
    </div>
  )
}
