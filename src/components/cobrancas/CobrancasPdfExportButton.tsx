import { useState } from 'react'
import { FileDown, Loader2 } from 'lucide-react'
import {
  imprimirCobrancasPdf,
  type CobrancasPdfExportInput,
} from '@/lib/cobrancas-pdf-export'

interface CobrancasPdfExportButtonProps {
  input: CobrancasPdfExportInput | null
  disabled?: boolean
  className?: string
}

/** Botão da página Cobranças — exporta a lista filtrada em PDF A4. */
export function CobrancasPdfExportButton({
  input,
  disabled = false,
  className,
}: CobrancasPdfExportButtonProps) {
  const [exporting, setExporting] = useState(false)
  const semDados = !input

  const handleExport = () => {
    if (!input || exporting) return
    setExporting(true)
    try {
      imprimirCobrancasPdf(input)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível exportar o PDF.')
    } finally {
      window.setTimeout(() => setExporting(false), 400)
    }
  }

  return (
    <button
      type="button"
      className={className ?? 'btn btn-outline btn-md gap-1.5'}
      onClick={handleExport}
      disabled={disabled || exporting || semDados}
      aria-label="Exportar cobranças em PDF"
      title={
        semDados
          ? 'Aguarde os dados carregarem'
          : 'Exportar lista filtrada em PDF (A4)'
      }
    >
      {exporting
        ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        : <FileDown className="h-4 w-4" aria-hidden />}
      Exportar PDF
    </button>
  )
}
