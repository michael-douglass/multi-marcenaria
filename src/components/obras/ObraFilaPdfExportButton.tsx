import { useState } from 'react'
import { FileDown, Loader2 } from 'lucide-react'
import {
  imprimirObraFilaPdf,
  type ObraFilaPdfExportInput,
} from '@/lib/obra-fila-pdf-export'

interface ObraFilaPdfExportButtonProps {
  colunas: ObraFilaPdfExportInput['colunas']
  filtroLabel: string
  showAllComissao?: boolean
  prestadorId?: string | null
  empresaNome?: string | null
  disabled?: boolean
  className?: string
}

/** Botão da vista Filas — exporta a ordem da tela em PDF A4. */
export function ObraFilaPdfExportButton({
  colunas,
  filtroLabel,
  showAllComissao = true,
  prestadorId = null,
  empresaNome = null,
  disabled = false,
  className,
}: ObraFilaPdfExportButtonProps) {
  const [exporting, setExporting] = useState(false)
  const semObras = colunas.length === 0

  const handleExport = () => {
    if (semObras || exporting) return
    setExporting(true)
    try {
      imprimirObraFilaPdf({
        colunas,
        filtroLabel,
        showAllComissao,
        prestadorId,
        empresaNome,
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível exportar o PDF.')
    } finally {
      // Pequeno atraso para o ícone não “piscar” antes da janela abrir
      window.setTimeout(() => setExporting(false), 400)
    }
  }

  return (
    <button
      type="button"
      className={
        className
        ?? 'btn btn-outline btn-sm btn-toolbar-icon sm:btn-md'
      }
      onClick={handleExport}
      disabled={disabled || exporting || semObras}
      aria-label="Exportar filas em PDF"
      title={
        semObras
          ? 'Não há obras na fila para exportar'
          : 'Exportar filas em PDF (A4)'
      }
    >
      {exporting
        ? <Loader2 size={14} className="shrink-0 animate-spin" aria-hidden />
        : <FileDown size={14} className="shrink-0" aria-hidden />}
      <span className="hidden sm:inline">Exportar PDF</span>
      <span className="sm:hidden">PDF</span>
    </button>
  )
}
