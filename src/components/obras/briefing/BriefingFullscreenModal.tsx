import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, ChevronLeft, X } from 'lucide-react'
import { BriefingQuestionRenderer } from '@/components/obras/briefing/BriefingQuestionRenderer'
import { getBriefingProgress, useBriefingAutosave } from '@/hooks/useObraBriefing'
import type { BriefingRespostaDraft } from '@/hooks/useObraBriefing'
import type { ObraBriefing, ObraBriefingAnexo } from '@/types'

interface BriefingFullscreenModalProps {
  open: boolean
  briefing: ObraBriefing | null
  readOnly?: boolean
  onClose: () => void
  onSaveDraft: (drafts: BriefingRespostaDraft[]) => Promise<void>
  onConcluir: () => Promise<void>
  onUploadFiles: (perguntaId: string, files: File[]) => Promise<void>
  onReplaceDrawing: (perguntaId: string, blob: Blob) => Promise<void>
  onRemoveAnexo: (anexo: ObraBriefingAnexo) => Promise<void>
}

export function BriefingFullscreenModal({
  open,
  briefing,
  readOnly = false,
  onClose,
  onSaveDraft,
  onConcluir,
  onUploadFiles,
  onReplaceDrawing,
  onRemoveAnexo,
}: BriefingFullscreenModalProps) {
  const [drafts, setDrafts] = useState<Record<string, BriefingRespostaDraft>>({})
  const [saving, setSaving] = useState(false)
  const [concluding, setConcluding] = useState(false)

  useEffect(() => {
    if (!briefing) {
      setDrafts({})
      return
    }
    const initial: Record<string, BriefingRespostaDraft> = {}
    for (const r of briefing.respostas ?? []) {
      initial[r.pergunta_id] = {
        pergunta_id: r.pergunta_id,
        valor_texto: r.valor_texto,
        valor_numero: r.valor_numero,
        unidade: r.unidade,
        valor_opcoes: r.valor_opcoes,
      }
    }
    setDrafts(initial)
  }, [briefing])

  const perguntas = useMemo(
    () => (briefing?.perguntas ?? []).filter(p => p.ativo),
    [briefing],
  )

  const progress = briefing ? getBriefingProgress({
    ...briefing,
    respostas: perguntas.map(p => {
      const d = drafts[p.id]
      const saved = briefing.respostas?.find(r => r.pergunta_id === p.id)
      if (['fotos', 'videos', 'pdf', 'desenho'].includes(p.tipo)) return saved ?? { pergunta_id: p.id } as never
      return {
        pergunta_id: p.id,
        valor_texto: d?.valor_texto ?? saved?.valor_texto,
        valor_numero: d?.valor_numero ?? saved?.valor_numero,
        unidade: d?.unidade ?? saved?.unidade,
        valor_opcoes: d?.valor_opcoes ?? saved?.valor_opcoes,
        anexos: saved?.anexos,
      } as never
    }),
  }) : { answered: 0, total: 0 }

  const persistDrafts = useCallback(async () => {
    if (!briefing || readOnly) return
    const list = Object.values(drafts)
    if (!list.length) return
    setSaving(true)
    try {
      await onSaveDraft(list)
    } finally {
      setSaving(false)
    }
  }, [briefing, drafts, onSaveDraft, readOnly])

  useBriefingAutosave(persistDrafts, [drafts], open && !readOnly && !!briefing)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const updateDraft = (perguntaId: string, patch: Partial<BriefingRespostaDraft>) => {
    setDrafts(prev => ({
      ...prev,
      [perguntaId]: { pergunta_id: perguntaId, ...prev[perguntaId], ...patch },
    }))
  }

  const handleConcluir = async () => {
    setConcluding(true)
    try {
      await persistDrafts()
      await onConcluir()
      onClose()
    } finally {
      setConcluding(false)
    }
  }

  if (!open || !briefing) return null

  return createPortal(
    <div className="fixed inset-0 z-[380] flex flex-col bg-[#0d0a08]/95 backdrop-blur-sm">
      <header className="flex shrink-0 items-center gap-3 border-b border-[rgba(240,210,140,0.18)] px-4 py-3 sm:px-6">
        <button type="button" onClick={onClose} className="btn btn-outline btn-sm shrink-0">
          <ChevronLeft size={16} />
          <span className="hidden sm:inline">Voltar</span>
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-lg tracking-widest text-[#f2d892] sm:text-xl">
            {briefing.modelo_nome ?? 'Briefing'}
          </h2>
          <p className="text-[0.72rem] text-[#edd9c4]">
            {progress.answered}/{progress.total} respondidas
            {briefing.status === 'concluido' && (
              <span className="ml-2 text-emerald-400">· Concluído</span>
            )}
            {saving && <span className="ml-2 text-[#f2d892]/70">· Salvando...</span>}
          </p>
        </div>
        <div className="h-2 w-24 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)] sm:w-32">
          <div
            className="h-full rounded-full bg-[#f2d892] transition-all duration-500"
            style={{ width: progress.total ? `${(progress.answered / progress.total) * 100}%` : '0%' }}
          />
        </div>
        <button type="button" onClick={onClose} className="btn btn-outline btn-sm shrink-0" aria-label="Fechar">
          <X size={15} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {perguntas.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <p className="text-sm text-[#edd9c4]">
                Este briefing ainda não tem perguntas cadastradas.
              </p>
              <p className="mt-2 text-[0.72rem] text-[#edd9c4]/70">
                Configure o modelo em Agenda de Obras → Configurações → Briefings Pré-Obra.
              </p>
            </div>
          ) : (
          perguntas.map((p, idx) => {
            const saved = briefing.respostas?.find(r => r.pergunta_id === p.id)
            const draft = drafts[p.id]
            const resposta = saved
              ? {
                  ...saved,
                  valor_texto: draft?.valor_texto ?? saved.valor_texto,
                  valor_numero: draft?.valor_numero ?? saved.valor_numero,
                  unidade: draft?.unidade ?? saved.unidade,
                  valor_opcoes: draft?.valor_opcoes ?? saved.valor_opcoes,
                }
              : draft
                ? { id: '', obra_briefing_id: briefing.id, pergunta_id: p.id, ...draft }
                : undefined

            return (
              <div
                key={p.id}
                className="glass-card p-4 animate-in fade-in slide-in-from-bottom-2"
                style={{ animationDelay: `${idx * 40}ms`, animationFillMode: 'both' }}
              >
                <div className="mb-2 flex items-start gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(240,210,140,0.12)] text-[0.68rem] font-semibold text-[#f2d892]">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-cream">
                      {p.enunciado}
                      {p.obrigatoria && <span className="ml-1 text-red-400">*</span>}
                    </p>
                    {p.texto_ajuda && (
                      <p className="mt-0.5 text-[0.68rem] text-[#edd9c4]/70">{p.texto_ajuda}</p>
                    )}
                  </div>
                </div>
                <BriefingQuestionRenderer
                  pergunta={p}
                  resposta={resposta}
                  readOnly={readOnly}
                  onTextChange={v => updateDraft(p.id, { valor_texto: v })}
                  onNumberChange={(n, u) => updateDraft(p.id, { valor_numero: n, unidade: u ?? p.unidade_padrao })}
                  onOpcoesChange={op => updateDraft(p.id, { valor_opcoes: op })}
                  onUploadFiles={async files => {
                    await persistDrafts()
                    await onUploadFiles(p.id, files)
                  }}
                  onUploadDrawing={async blob => {
                    await onReplaceDrawing(p.id, blob)
                  }}
                  onClearDrawing={saved?.anexos?.some(a => a.kind === 'drawing' || a.nome_arquivo === 'desenho.png')
                    ? async () => {
                      const croquis = (saved?.anexos ?? []).filter(
                        a => a.kind === 'drawing' || a.nome_arquivo === 'desenho.png',
                      )
                      for (const anexo of croquis) {
                        await onRemoveAnexo(anexo)
                      }
                    }
                    : undefined}
                  onRemoveAnexo={onRemoveAnexo}
                />
              </div>
            )
          })
          )}
        </div>
      </main>

      {!readOnly && (
        <footer className="flex shrink-0 gap-2 border-t border-[rgba(240,210,140,0.18)] px-4 py-3 sm:px-6">
          <button
            type="button"
            className="btn btn-outline btn-md flex-1"
            disabled={saving}
            onClick={() => void persistDrafts()}
          >
            {saving ? 'Salvando...' : 'Salvar rascunho'}
          </button>
          <button
            type="button"
            className="btn btn-gold btn-md flex-1"
            disabled={concluding}
            onClick={() => void handleConcluir()}
          >
            <CheckCircle2 size={16} className="mr-1 inline" />
            {concluding ? 'Concluindo...' : 'Concluir briefing'}
          </button>
        </footer>
      )}
    </div>,
    document.body,
  )
}
