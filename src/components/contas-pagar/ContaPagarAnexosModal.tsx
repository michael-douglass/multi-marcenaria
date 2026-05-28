import { useCallback, useEffect, useState } from 'react'
import { Paperclip } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import {
  deleteContaPagarAnexo,
  getAnexoSignedUrl,
  listAnexosByGrupo,
} from '@/lib/contas-pagar-anexos'
import type { ContaPagarAnexo } from '@/types'
import { AnexoLightbox, AnexoThumb } from './AnexoLightbox'

interface ContaPagarAnexosModalProps {
  open: boolean
  grupoLancamentoId: string | null | undefined
  onClose: () => void
}

interface AnexoView extends ContaPagarAnexo {
  previewUrl: string
  kind: 'image' | 'pdf'
}

export function ContaPagarAnexosModal({
  open,
  grupoLancamentoId,
  onClose,
}: ContaPagarAnexosModalProps) {
  const [anexos, setAnexos] = useState<AnexoView[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<AnexoView | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    if (!grupoLancamentoId) return
    setLoading(true)
    setError(null)
    try {
      const rows = await listAnexosByGrupo(grupoLancamentoId)
      const views: AnexoView[] = await Promise.all(
        rows.map(async row => {
          const path = row.preview_path ?? row.storage_path
          const previewUrl = await getAnexoSignedUrl(path)
          const kind =
            row.tipo_mime === 'application/pdf' ||
            row.nome_arquivo.toLowerCase().endsWith('.pdf')
              ? 'pdf'
              : 'image'
          return { ...row, previewUrl, kind }
        }),
      )
      setAnexos(views)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar anexos.')
    } finally {
      setLoading(false)
    }
  }, [grupoLancamentoId])

  useEffect(() => {
    if (open && grupoLancamentoId) load()
    if (!open) {
      setAnexos([])
      setLightbox(null)
    }
  }, [open, grupoLancamentoId, load])

  const handleDelete = async (anexo: AnexoView) => {
    if (!confirm(`Excluir o anexo "${anexo.nome_arquivo}"?`)) return
    setDeleting(true)
    try {
      await deleteContaPagarAnexo(anexo)
      setAnexos(prev => prev.filter(a => a.id !== anexo.id))
      setLightbox(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao excluir.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="ANEXOS DO LANÇAMENTO">
        {loading && (
          <p className="text-center text-sm text-[#8a6a55]">Carregando anexos...</p>
        )}
        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
        {!loading && anexos.length === 0 && !error && (
          <p className="text-center text-sm text-[#8a6a55]">Nenhum anexo neste lançamento.</p>
        )}
        <div className="flex flex-wrap gap-3">
          {anexos.map(a => (
            <AnexoThumb
              key={a.id}
              previewUrl={a.previewUrl}
              nome={a.nome_arquivo}
              kind={a.kind}
              onOpenFullscreen={() => setLightbox(a)}
              onDelete={() => handleDelete(a)}
            />
          ))}
        </div>
      </Modal>

      <AnexoLightbox
        open={!!lightbox}
        imageUrl={lightbox?.previewUrl ?? ''}
        title={lightbox?.nome_arquivo ?? ''}
        onClose={() => setLightbox(null)}
        onDelete={lightbox ? () => handleDelete(lightbox) : undefined}
        deleting={deleting}
      />
    </>
  )
}

/** Botão compacto na tabela para abrir anexos salvos */
export function ContaPagarAnexosButton({
  grupoLancamentoId,
}: {
  grupoLancamentoId?: string | null
}) {
  const [open, setOpen] = useState(false)
  if (!grupoLancamentoId) return null

  return (
    <>
      <button
        type="button"
        className="btn btn-outline btn-sm !px-2"
        title="Ver anexos"
        onClick={() => setOpen(true)}
      >
        <Paperclip className="h-3.5 w-3.5" />
      </button>
      <ContaPagarAnexosModal
        open={open}
        grupoLancamentoId={grupoLancamentoId}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
