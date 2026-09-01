import { useState } from 'react'
import { ClipboardList, ExternalLink } from 'lucide-react'
import { Field } from '@/components/ui/Field'
import { BriefingAmbienteSelector } from '@/components/obras/briefing/BriefingAmbienteSelector'
import { BriefingFullscreenModal } from '@/components/obras/briefing/BriefingFullscreenModal'
import { getBriefingProgress } from '@/hooks/useObraBriefing'
import type { BriefingRespostaDraft } from '@/hooks/useObraBriefing'
import type { BriefingModelo, ObraBriefing, ObraBriefingAnexo } from '@/types'

interface BriefingFieldEntryProps {
  obraId: string | null
  modelos: BriefingModelo[]
  briefings: ObraBriefing[]
  canEdit: boolean
  loading?: boolean
  modelosLoading?: boolean
  modelosError?: string | null
  onLinkModelos: (ids: string[]) => Promise<void>
  onSaveDraft: (briefingId: string, drafts: BriefingRespostaDraft[]) => Promise<void>
  onConcluir: (briefingId: string) => Promise<void>
  onUploadFiles: (briefingId: string, perguntaId: string, files: File[]) => Promise<void>
  onReplaceDrawing: (briefingId: string, perguntaId: string, blob: Blob) => Promise<void>
  onRemoveAnexo: (anexo: ObraBriefingAnexo) => Promise<void>
}

export function BriefingFieldEntry({
  obraId,
  modelos,
  briefings,
  canEdit,
  loading,
  modelosLoading,
  modelosError,
  onLinkModelos,
  onSaveDraft,
  onConcluir,
  onUploadFiles,
  onReplaceDrawing,
  onRemoveAnexo,
}: BriefingFieldEntryProps) {
  const [fullscreenId, setFullscreenId] = useState<string | null>(null)
  const activeBriefing = briefings.find(b => b.id === fullscreenId) ?? null
  const selectedModeloIds = briefings.map(b => b.modelo_id)

  if (!obraId) {
    return (
      <Field label="Briefing Pré-Obra">
        <p className="text-[0.72rem] text-[#e4cbb0]/70">
          Salve a obra primeiro para vincular briefings de ambiente.
        </p>
      </Field>
    )
  }

  return (
    <>
      <Field label="Briefing Pré-Obra">
        <div className="space-y-3 rounded-lg border border-[rgba(232,196,112,0.32)] bg-[rgba(16,8,6,0.45)] p-3">
          <BriefingAmbienteSelector
            modelos={modelos}
            selectedIds={selectedModeloIds}
            readOnly={!canEdit}
            loading={modelosLoading}
            error={modelosError}
            onChange={ids => void onLinkModelos(ids)}
          />

          {loading && !modelosLoading && (
            <p className="text-[0.72rem] text-[#e4cbb0]/70">Atualizando briefings da obra...</p>
          )}

          {briefings.length > 0 && (
            <div className="space-y-2">
              {briefings.map(b => {
                const { answered, total } = getBriefingProgress(b)
                const pct = total ? Math.round((answered / total) * 100) : 0
                return (
                  <div
                    key={b.id}
                    className="flex items-center gap-3 rounded-lg border border-[rgba(232,196,112,0.28)] bg-[rgba(42,24,16,0.55)] p-2.5"
                  >
                    <ClipboardList size={16} className="shrink-0 text-[#f2d892]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-cream">{b.modelo_nome}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[rgba(16,8,6,0.55)]">
                          <div
                            className="h-full rounded-full bg-[#f6dc9a] transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[0.65rem] text-[#e4cbb0]">
                          {answered}/{total}
                          {b.status === 'concluido' && ' ✓'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation()
                        setFullscreenId(b.id)
                      }}
                      className="btn btn-outline btn-sm shrink-0"
                    >
                      <ExternalLink size={12} />
                      {canEdit ? 'Preencher' : 'Ver'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Field>

      <BriefingFullscreenModal
        open={!!activeBriefing}
        briefing={activeBriefing}
        readOnly={!canEdit}
        onClose={() => setFullscreenId(null)}
        onSaveDraft={drafts => activeBriefing ? onSaveDraft(activeBriefing.id, drafts) : Promise.resolve()}
        onConcluir={() => activeBriefing ? onConcluir(activeBriefing.id) : Promise.resolve()}
        onUploadFiles={(perguntaId, files) =>
          activeBriefing ? onUploadFiles(activeBriefing.id, perguntaId, files) : Promise.resolve()
        }
        onReplaceDrawing={(perguntaId, blob) =>
          activeBriefing ? onReplaceDrawing(activeBriefing.id, perguntaId, blob) : Promise.resolve()
        }
        onRemoveAnexo={onRemoveAnexo}
      />
    </>
  )
}
