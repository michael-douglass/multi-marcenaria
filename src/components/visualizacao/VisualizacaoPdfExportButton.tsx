import { useState } from 'react'
import { FileDown, Loader2 } from 'lucide-react'
import {
  imprimirVisualizacaoPdf,
  type VisualizacaoPdfExportInput,
} from '@/lib/visualizacao-pdf-export'

interface VisualizacaoPdfExportButtonProps {
  input: VisualizacaoPdfExportInput | null
  disabled?: boolean
  className?: string
}

/** Botão da Visualização — exporta os painéis visíveis em PDF A4. */
export function VisualizacaoPdfExportButton({
  input,
  disabled = false,
  className,
}: VisualizacaoPdfExportButtonProps) {
  const [exporting, setExporting] = useState(false)
  const semDados = !input

  const handleExport = () => {
    if (!input || exporting) return
    setExporting(true)
    try {
      imprimirVisualizacaoPdf(input)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível exportar o PDF.')
    } finally {
      window.setTimeout(() => setExporting(false), 400)
    }
  }

  return (
    <button
      type="button"
      className={className ?? 'btn btn-outline btn-sm gap-1.5'}
      onClick={handleExport}
      disabled={disabled || exporting || semDados}
      aria-label="Exportar visualização em PDF"
      title={semDados ? 'Aguarde os dados carregarem' : 'Exportar painéis em PDF (A4)'}
    >
      {exporting
        ? <Loader2 size={14} className="animate-spin" aria-hidden />
        : <FileDown size={14} aria-hidden />}
      Exportar PDF
    </button>
  )
}
