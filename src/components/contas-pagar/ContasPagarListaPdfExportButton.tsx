import { useState } from 'react'
import { FileDown, Loader2 } from 'lucide-react'
import {
  imprimirContasPagarListaPdf,
  type ContasPagarListaPdfExportInput,
} from '@/lib/contas-pagar-lista-pdf-export'

interface ContasPagarListaPdfExportButtonProps {
  input: ContasPagarListaPdfExportInput | null
  disabled?: boolean
  className?: string
}

/** Botão da página Contas a Pagar — PDF A4 retrato, uma coluna, agrupado por mês. */
export function ContasPagarListaPdfExportButton({
  input,
  disabled = false,
  className,
}: ContasPagarListaPdfExportButtonProps) {
  const [exporting, setExporting] = useState(false)
  const semDados = !input

  const handleExport = () => {
    if (!input || exporting) return
    setExporting(true)
    try {
      imprimirContasPagarListaPdf(input)
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
      aria-label="Exportar contas a pagar em PDF"
      title={
        semDados
          ? 'Aguarde os dados carregarem'
          : 'Exportar lista filtrada em PDF (A4 retrato, uma coluna)'
      }
    >
      {exporting
        ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        : <FileDown className="h-4 w-4" aria-hidden />}
      Exportar PDF
    </button>
  )
}
