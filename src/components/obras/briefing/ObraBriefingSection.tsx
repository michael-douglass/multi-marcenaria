import { useCallback, useEffect } from 'react'
import { BriefingFieldEntry } from '@/components/obras/briefing/BriefingFieldEntry'
import { buildPendingBriefingAnexo, revokePendingBriefingAnexo } from '@/lib/briefing-storage'
import { useBriefingModelos } from '@/hooks/useBriefingModelos'
import { useObraBriefing, type BriefingRespostaDraft } from '@/hooks/useObraBriefing'

interface ObraBriefingSectionProps {
  obraId: string | null
  canEdit: boolean
}

export function ObraBriefingSection({ obraId, canEdit }: ObraBriefingSectionProps) {
  const modelosHook = useBriefingModelos()
  const {
    briefings,
    loading,
    linkModelos,
    upsertResposta,
    uploadAnexo,
    removeAnexo,
    setStatus,
  } = useObraBriefing(obraId)

  useEffect(() => {
    if (obraId) {
      void modelosHook.reload()
    }
  }, [obraId, modelosHook.reload])

  const handleSaveDraft = useCallback(async (briefingId: string, drafts: BriefingRespostaDraft[]) => {
    await Promise.all(drafts.map(d => upsertResposta(briefingId, d)))
    await setStatus(briefingId, 'rascunho')
  }, [upsertResposta, setStatus])

  const handleConcluir = useCallback(async (briefingId: string) => {
    await setStatus(briefingId, 'concluido')
  }, [setStatus])

  const handleUploadFiles = useCallback(async (briefingId: string, perguntaId: string, files: File[]) => {
    for (const file of files) {
      const pending = await buildPendingBriefingAnexo(file)
      try {
        await uploadAnexo(briefingId, perguntaId, pending)
      } finally {
        revokePendingBriefingAnexo(pending)
      }
    }
  }, [uploadAnexo])

  const handleLinkModelos = useCallback(async (ids: string[]) => {
    try {
      await linkModelos(ids)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível atualizar os briefings da obra.')
    }
  }, [linkModelos])

  return (
    <BriefingFieldEntry
      obraId={obraId}
      modelos={modelosHook.data}
      briefings={briefings}
      canEdit={canEdit}
      loading={loading}
      modelosLoading={modelosHook.loading}
      modelosError={modelosHook.error}
      onLinkModelos={handleLinkModelos}
      onSaveDraft={handleSaveDraft}
      onConcluir={handleConcluir}
      onUploadFiles={handleUploadFiles}
      onRemoveAnexo={removeAnexo}
    />
  )
}
