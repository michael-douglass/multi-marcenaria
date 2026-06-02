import type { ReactNode } from 'react'

interface ObraPageHeaderProps {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  below?: ReactNode
}

/** Cabeçalho responsivo — título e ações sempre empilhados para não estourar no mobile. */
export function ObraPageHeader({ title, subtitle, actions, below }: ObraPageHeaderProps) {
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
        <div className="obra-page-header__below">{below}</div>
      )}
    </div>
  )
}
