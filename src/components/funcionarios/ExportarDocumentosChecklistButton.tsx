import { useState } from 'react'
import { FileDown, FileImage, FileText, Loader2, ScrollText } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { ADMISSAO_DOC_TIPOS } from '@/lib/funcionario-constants'
import {
  baixarChecklistDocumentosJpg,
  imprimirChecklistDocumentosPdf,
} from '@/lib/funcionario-checklist-docs-export'
import { showToast } from '@/lib/toast'
import { useReciboConfig } from '@/hooks/useReciboConfig'

interface Props {
  className?: string
}

export function ExportarDocumentosChecklistButton({ className }: Props) {
  const { config } = useReciboConfig()
  const [open, setOpen] = useState(false)
  const [exportando, setExportando] = useState<'pdf' | 'jpg' | null>(null)

  const exportar = async (modo: 'pdf' | 'jpg') => {
    if (exportando) return
    setExportando(modo)
    try {
      const opts = { cnpj: config?.cnpj ?? null }
      if (modo === 'pdf') {
        imprimirChecklistDocumentosPdf(opts)
        showToast('Papel timbrado aberto — escolha “Salvar como PDF” na impressão.')
      } else {
        await baixarChecklistDocumentosJpg(opts)
        showToast('JPG do papel timbrado baixado.')
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Não foi possível exportar o documento.',
        'error',
      )
    } finally {
      setExportando(null)
    }
  }

  return (
    <>
      <button
        type="button"
        className={
          className
          ?? 'group relative inline-flex items-center gap-2 overflow-hidden rounded-lg border border-[rgba(212,168,83,0.35)] bg-[linear-gradient(135deg,rgba(36,16,8,0.92),rgba(58,28,12,0.88))] px-4 py-2.5 text-sm font-medium text-[#f2d892] shadow-[0_8px_24px_rgba(20,8,2,0.35)] transition duration-300 hover:-translate-y-0.5 hover:border-[rgba(242,216,146,0.55)] hover:text-[#fff1c4]'
        }
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100"
          style={{
            background:
              'radial-gradient(circle at 20% 0%, rgba(242,216,146,0.18), transparent 55%)',
          }}
        />
        <FileDown size={16} className="relative" />
        <span className="relative tracking-[0.04em]">Exportar documentos</span>
      </button>

      <Modal open={open} onClose={() => !exportando && setOpen(false)} title="EXPORTAR DOCUMENTOS">
        <div className="space-y-5">
          <div className="relative overflow-hidden rounded-xl border border-[rgba(212,168,83,0.25)] bg-[linear-gradient(160deg,#1c0e07_0%,#2a160c_55%,#1a0d06_100%)] p-4">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[rgba(242,216,146,0.12)] blur-2xl"
            />
            <div className="relative flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[rgba(212,168,83,0.4)] bg-[rgba(242,216,146,0.08)] text-[#f2d892]">
                <ScrollText size={18} />
              </div>
              <div>
                <p className="font-medium text-[#f2d892]">Papel timbrado — assinatura de carteira</p>
                <p className="mt-1 text-sm leading-relaxed text-[#b8957f]">
                  Gera a lista oficial de documentos que o colaborador precisa entregar
                  para o registro em carteira, com logo e dados da GARBO.
                </p>
              </div>
            </div>
          </div>

          <div>
            <p className="section-label mb-2">Itens do checklist</p>
            <ol className="max-h-52 space-y-1.5 overflow-y-auto rounded-xl border border-[rgba(212,168,83,0.15)] bg-[rgba(20,10,4,0.35)] p-3">
              {ADMISSAO_DOC_TIPOS.map((doc, i) => (
                <li
                  key={doc.id}
                  className="flex items-start gap-2.5 text-sm text-[#edd9c4]"
                >
                  <span className="mt-0.5 w-6 shrink-0 font-mono text-[0.7rem] text-[#d4a853]">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span>{doc.label}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-gold btn-md flex-1 sm:flex-none"
              disabled={!!exportando}
              onClick={() => void exportar('pdf')}
            >
              {exportando === 'pdf' ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <FileText size={15} />
              )}
              Exportar PDF
            </button>
            <button
              type="button"
              className="btn btn-outline btn-md flex-1 sm:flex-none"
              disabled={!!exportando}
              onClick={() => void exportar('jpg')}
            >
              {exportando === 'jpg' ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <FileImage size={15} />
              )}
              Exportar JPG
            </button>
          </div>

          <p className="text-xs text-[#8a6d5c]">
            No PDF, use “Salvar como PDF” na janela de impressão. O JPG baixa direto no computador.
          </p>
        </div>
      </Modal>
    </>
  )
}
