import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface ObraPageHeaderProps {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  below?: ReactNode
  /** No mobile, recolhe a área `below` para o cabeçalho não ocupar metade da tela. */
  collapseBelowOnMobile?: boolean
  belowMobileLabel?: string
}

/** Cabeçalho responsivo — título e ações empilhados; no mobile o bloco extra pode ser recolhido. */
export function ObraPageHeader({
  title,
  subtitle,
  actions,
  below,
  collapseBelowOnMobile = false,
  belowMobileLabel = 'Filtros',
}: ObraPageHeaderProps) {
  const [belowOpen, setBelowOpen] = useState(false)

  return (
    <div className="obra-page-header">
      <div className="obra-page-header__title-block">
        <h1 className="obra-page-title">{title}</h1>
        {subtitle != null && (
          <div className="obra-page-header__subtitle section-label mt-1">{subtitle}</div>
        )}
      </div>
      {actions != null && (
        <div className="obra-page-header__actions">{actions}</div>
      )}
      {below != null && (
        <>
          {collapseBelowOnMobile && (
            <button
              type="button"
              className="obra-page-below-toggle md:hidden"
              onClick={() => setBelowOpen(open => !open)}
              aria-expanded={belowOpen}
            >
              <span>{belowMobileLabel}</span>
              {belowOpen ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
            </button>
          )}
          <div
            className={[
              'obra-page-header__below',
              collapseBelowOnMobile && !belowOpen ? 'obra-page-header__below--collapsed-mobile' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {below}
          </div>
        </>
      )}
    </div>
  )
}
