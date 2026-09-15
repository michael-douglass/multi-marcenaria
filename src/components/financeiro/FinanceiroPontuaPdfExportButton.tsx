import { useState } from 'react'
import { FileDown, Loader2 } from 'lucide-react'
import {
  imprimirFinanceiroPontuaPdf,
  type FinanceiroPontuaPdfExportInput,
} from '@/lib/financeiro-pontua-pdf-export'

interface FinanceiroPontuaPdfExportButtonProps {
  input: FinanceiroPontuaPdfExportInput | null
  disabled?: boolean
  className?: string
}

/** Botão do Painel do Pontua — exporta métricas e listas em PDF A4. */
export function FinanceiroPontuaPdfExportButton({
  input,
  disabled = false,
  className,
}: FinanceiroPontuaPdfExportButtonProps) {
  const [exporting, setExporting] = useState(false)
  const semDados = !input

  const handleExport = () => {
    if (!input || exporting) return
    setExporting(true)
    try {
      imprimirFinanceiroPontuaPdf(input)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível exportar o PDF.')
    } finally {
      window.setTimeout(() => setExporting(false), 400)
    }
  }

  return (
    <button
      type="button"
      className={
        className
        ?? [
          'inline-flex items-center gap-2 rounded-lg border border-[rgba(26,16,12,0.16)]',
          'bg-white px-3 py-2 text-xs font-semibold text-[#1a100c]',
          'transition hover:border-[rgba(107,63,18,0.35)] hover:bg-[#fff8f0]',
          'disabled:cursor-not-allowed disabled:opacity-50',
        ].join(' ')
      }
      onClick={handleExport}
      disabled={disabled || exporting || semDados}
      aria-label="Exportar Painel do Pontua em PDF"
      title={semDados ? 'Aguarde os dados carregarem' : 'Exportar painel em PDF (A4)'}
    >
      {exporting
        ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        : <FileDown className="h-4 w-4" aria-hidden />}
      Exportar PDF
    </button>
  )
}
