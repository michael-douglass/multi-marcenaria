import { useCallback, useEffect, useState } from 'react'
import { Field } from '@/components/ui/Field'
import {
  deleteContaPagarAnexo,
  getAnexoSignedUrl,
  listAnexosByGrupo,
} from '@/lib/contas-pagar-anexos'
import { resolveGrupoLancamentoId } from '@/lib/contas-pagar-grupo'
import type { ContaPagar, ContaPagarAnexo, PendingContaPagarAnexo } from '@/types'
import { ContaPagarAnexosField } from './ContaPagarAnexosField'
import { AnexoLightbox, AnexoThumb } from './AnexoLightbox'

interface ContaPagarAnexosGrupoFieldProps {
  conta: ContaPagar
  todasContas: ContaPagar[]
  novosAnexos: PendingContaPagarAnexo[]
  onNovosAnexosChange: (anexos: PendingContaPagarAnexo[]) => void
}

interface AnexoSalvoView extends ContaPagarAnexo {
  previewUrl: string
  kind: 'image' | 'pdf'
}

export function ContaPagarAnexosGrupoField({
  conta,
  todasContas,
  novosAnexos,
  onNovosAnexosChange,
}: ContaPagarAnexosGrupoFieldProps) {
  const grupoId = resolveGrupoLancamentoId(conta, todasContas)
  const [salvos, setSalvos] = useState<AnexoSalvoView[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<AnexoSalvoView | null>(null)

  const loadSalvos = useCallback(async () => {
    if (!grupoId) {
      setSalvos([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const rows = await listAnexosByGrupo(grupoId)
      const views: AnexoSalvoView[] = await Promise.all(
        rows.map(async row => {
          const path = row.preview_path ?? row.storage_path
          const previewUrl = await getAnexoSignedUrl(path)
          const kind =
            row.tipo_mime === 'application/pdf'
            || row.nome_arquivo.toLowerCase().endsWith('.pdf')
              ? 'pdf'
              : 'image'
          return { ...row, previewUrl, kind }
        }),
      )
      setSalvos(views)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar anexos.')
    } finally {
      setLoading(false)
    }
  }, [grupoId])

  useEffect(() => {
    void loadSalvos()
  }, [loadSalvos])

  const handleDeleteSalvo = async (anexo: AnexoSalvoView) => {
    if (!confirm(`Excluir o anexo "${anexo.nome_arquivo}" de todas as parcelas?`)) return
    try {
      await deleteContaPagarAnexo(anexo)
      setSalvos(prev => prev.filter(a => a.id !== anexo.id))
      setLightbox(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao excluir anexo.')
    }
  }

  const compartilhado = conta.total_parcelas > 1

  return (
    <div className="space-y-3">
      {compartilhado && (
        <p className="text-xs text-[#d4a853]">
          Anexos deste lançamento aparecem em todas as parcelas do grupo.
        </p>
      )}

      {loading && (
        <p className="text-xs text-[#8a6a55]">Carregando anexos do lançamento...</p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {salvos.length > 0 && (
        <Field label="Anexos já salvos (todas as parcelas)">
          <div className="flex flex-wrap gap-3">
            {salvos.map(a => (
              <AnexoThumb
                key={a.id}
                previewUrl={a.previewUrl}
                nome={a.nome_arquivo}
                kind={a.kind}
                onOpenFullscreen={() => setLightbox(a)}
                onDelete={() => void handleDeleteSalvo(a)}
              />
            ))}
          </div>
        </Field>
      )}

      <ContaPagarAnexosField anexos={novosAnexos} onChange={onNovosAnexosChange} />

      <AnexoLightbox
        open={!!lightbox}
        imageUrl={lightbox?.previewUrl ?? ''}
        title={lightbox?.nome_arquivo ?? ''}
        onClose={() => setLightbox(null)}
        onDelete={lightbox ? () => void handleDeleteSalvo(lightbox) : undefined}
      />
    </div>
  )
}
