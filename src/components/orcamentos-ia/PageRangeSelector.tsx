/**
 * Compat: o antigo seletor só-texto virou atalho para a grade visual.
 * “Cotar seleção de páginas” = PageGridSelector com prévia do PDF.
 */
import { PageGridSelector } from '@/components/orcamentos-ia/PageGridSelector'
import { allPages } from '@/lib/orcamentos-ia/page-ranges'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Layers } from 'lucide-react'

export type PageRangeMode = 'all' | 'selection'

export interface PageRangeSelectorProps {
  totalPages: number
  fileName?: string
  /** PDF local — obrigatório para prévia ao escolher páginas. */
  localFile?: File | null
  pdfUrl?: string | null
  projectId?: string
  companyId?: string
  budgetedPages?: number[]
  disabled?: boolean
  onConfirm: (pages: number[]) => void
  onCancel?: () => void
  className?: string
}

export function PageRangeSelector({
  totalPages,
  fileName,
  localFile = null,
  pdfUrl = null,
  projectId,
  companyId,
  budgetedPages = [],
  disabled = false,
  onConfirm,
  onCancel,
  className,
}: PageRangeSelectorProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {fileName ? <span className="font-medium text-foreground/80">{fileName}</span> : null}
          {fileName ? ' · ' : null}
          {totalPages} página{totalPages === 1 ? '' : 's'} — marque nas miniaturas.
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={disabled || totalPages < 1}
          onClick={() => onConfirm(allPages(totalPages))}
        >
          <Layers className="h-3.5 w-3.5 text-[#0066FF]" />
          Cotar todas ({totalPages})
        </Button>
      </div>
      <PageGridSelector
        projectId={projectId}
        companyId={companyId}
        pdfUrl={pdfUrl}
        localFile={localFile}
        pageCount={totalPages}
        budgetedPages={budgetedPages}
        disabled={disabled}
        title="Cotar seleção de páginas"
        subtitle="Prévia do PDF enviado — clique nas páginas que deseja cotar (ex.: 1 e 7, ou 1–4 e 9)."
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    </div>
  )
}
