import { useState } from 'react'
import { FileDown, Loader2 } from 'lucide-react'
import {
  imprimirDashboardPdf,
  type DashboardPdfExportInput,
} from '@/lib/dashboard-pdf-export'

interface DashboardPdfExportButtonProps {
  input: DashboardPdfExportInput | null
  disabled?: boolean
  className?: string
}

/** Botão do dashboard — exporta saldos, KPIs e tabelas mensais em PDF A4. */
export function DashboardPdfExportButton({
  input,
  disabled = false,
  className,
}: DashboardPdfExportButtonProps) {
  const [exporting, setExporting] = useState(false)
  const semDados = !input

  const handleExport = () => {
    if (!input || exporting) return
    setExporting(true)
    try {
      imprimirDashboardPdf(input)
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
          'inline-flex items-center gap-2 rounded-md border border-[rgba(42,24,18,0.16)]',
          'bg-[#fffcf8] px-3 py-2 text-xs font-semibold tracking-wide text-[#2a1812]',
          'transition-colors hover:border-[rgba(42,24,18,0.28)] hover:bg-[#fff8f0]',
          'disabled:cursor-not-allowed disabled:opacity-50',
        ].join(' ')
      }
      onClick={handleExport}
      disabled={disabled || exporting || semDados}
      aria-label="Exportar dashboard em PDF"
      title={semDados ? 'Aguarde os dados carregarem' : 'Exportar dashboard em PDF (A4)'}
    >
      {exporting
        ? <Loader2 size={14} className="shrink-0 animate-spin" aria-hidden />
        : <FileDown size={14} className="shrink-0" aria-hidden />}
      <span>Exportar PDF</span>
    </button>
  )
}
