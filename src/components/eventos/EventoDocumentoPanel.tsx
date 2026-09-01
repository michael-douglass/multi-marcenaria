import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { EventoDocumentoAura } from '@/components/eventos/EventoDocumentoAura'
import type { EventoPagina, EventoSecao } from '@/lib/evento-types'
import { EVENTO_SECOES, EVENTO_SECAO_DICAS } from '@/lib/evento-types'
import { cn } from '@/lib/utils'

type SaveHint = 'Salva sozinho' | 'Salvando...' | 'Salvo' | 'Não salvou — continue digitando'

interface EventoDocumentoPanelProps {
  paginas: EventoPagina[]
  onSave: (input: { id: string; titulo: string; corpo: string }) => Promise<unknown>
  onNovaFolha: (secao: EventoSecao) => Promise<unknown>
  onExcluirFolha: (input: { id: string; secao: EventoSecao }) => Promise<unknown>
  className?: string
}

export function EventoDocumentoPanel({
  paginas,
  onSave,
  onNovaFolha,
  onExcluirFolha,
  className,
}: EventoDocumentoPanelProps) {
  const [secao, setSecao] = useState<EventoSecao>('detalhes')
  const folhas = useMemo(
    () => paginas.filter((p) => p.secao === secao).sort((a, b) => a.ordem - b.ordem),
    [paginas, secao],
  )
  const [index, setIndex] = useState(0)
  const atual = folhas[Math.min(index, Math.max(folhas.length - 1, 0))] ?? null

  const [titulo, setTitulo] = useState('')
  const [corpo, setCorpo] = useState('')
  const [saveHint, setSaveHint] = useState<SaveHint>('Salva sozinho')
  const dirtyRef = useRef(false)
  const savingRef = useRef(false)
  const timerRef = useRef<number>(0)
  const snapshotRef = useRef({ id: '', titulo: '', corpo: '' })

  useEffect(() => {
    setIndex(0)
  }, [secao])

  useEffect(() => {
    if (!atual) return
    setTitulo(atual.titulo)
    setCorpo(atual.corpo)
    snapshotRef.current = { id: atual.id, titulo: atual.titulo, corpo: atual.corpo }
    dirtyRef.current = false
    setSaveHint('Salva sozinho')
  }, [atual?.id])

  const flush = useCallback(async () => {
    const id = snapshotRef.current.id
    if (!id || !dirtyRef.current || savingRef.current) return
    savingRef.current = true
    setSaveHint('Salvando...')
    try {
      await onSave({ id, titulo: snapshotRef.current.titulo, corpo: snapshotRef.current.corpo })
      dirtyRef.current = false
      setSaveHint('Salvo')
    } catch {
      setSaveHint('Não salvou — continue digitando')
    } finally {
      savingRef.current = false
    }
  }, [onSave])

  const schedule = useCallback((nextTitulo: string, nextCorpo: string) => {
    snapshotRef.current = { ...snapshotRef.current, titulo: nextTitulo, corpo: nextCorpo }
    dirtyRef.current = true
    setSaveHint('Salva sozinho')
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      void flush()
    }, 400)
  }, [flush])

  useEffect(() => {
    const onHide = () => {
      void flush()
    }
    window.addEventListener('beforeunload', onHide)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.clearTimeout(timerRef.current)
      void flush()
      window.removeEventListener('beforeunload', onHide)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [flush])

  if (!atual) {
    return (
      <div className={cn('flex h-full min-h-[520px] flex-col items-center justify-center gap-3 rounded-xl border border-gold-border bg-[var(--color-surface-card)] p-4', className)}>
        <p className="text-sm text-cream-faint">Nenhuma folha nesta seção.</p>
        <button type="button" className="btn btn-proforco btn-md" onClick={() => void onNovaFolha(secao)}>
          Folha
        </button>
      </div>
    )
  }

  return (
    <div className={cn('evento-caderno-cover relative flex h-full min-h-[560px] flex-1 flex-col overflow-hidden rounded-xl border border-gold-border xl:min-h-0', className)}>
      <EventoDocumentoAura className="absolute inset-0 h-full w-full" />
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col p-3 sm:p-4">
        <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="text-[11px] uppercase tracking-[0.18em] text-gold/80">3 · Caderno</p>
            <span className="evento-caderno-selo hidden sm:inline-block" aria-hidden />
            {EVENTO_SECOES.map((id) => (
              <button
                key={id}
                type="button"
                title={EVENTO_SECAO_DICAS[id].dica}
                onClick={() => {
                  void flush()
                  setSecao(id)
                }}
                className={cn(
                  'rounded-full px-3 py-1 text-xs',
                  secao === id ? 'bg-gold/20 text-gold' : 'text-cream-faint hover:text-gold',
                )}
              >
                {EVENTO_SECAO_DICAS[id].aba}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Folha anterior"
              className="rounded-full p-1 text-cream-faint hover:text-gold disabled:opacity-30"
              disabled={index <= 0}
              onClick={() => {
                void flush()
                setIndex((i) => Math.max(0, i - 1))
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Próxima folha"
              className="rounded-full p-1 text-cream-faint hover:text-gold disabled:opacity-30"
              disabled={index >= folhas.length - 1}
              onClick={() => {
                void flush()
                setIndex((i) => Math.min(folhas.length - 1, i + 1))
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                void flush()
                void onNovaFolha(secao)
              }}
            >
              <Plus className="h-3 w-3" />
              Folha
            </button>
            <button
              type="button"
              aria-label="Apagar folha"
              className="p-1 text-cream-faint hover:text-red-400 disabled:opacity-30"
              disabled={folhas.length <= 1}
              onClick={() => void onExcluirFolha({ id: atual.id, secao })}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        <p className="mb-2 truncate text-[11px] text-cream-faint">{EVENTO_SECAO_DICAS[secao].dica}</p>

        <div className="evento-caderno-folha mx-auto flex w-full min-h-[420px] flex-1 flex-col px-5 py-5 pl-16 sm:px-8 sm:pl-[4.5rem] xl:min-h-0">
          <input
            aria-label="Título da folha"
            className="evento-caderno-titulo mb-1 w-full bg-transparent outline-none"
            placeholder="Título"
            value={titulo}
            onChange={(e) => {
              setTitulo(e.target.value)
              schedule(e.target.value, corpo)
            }}
            onBlur={() => void flush()}
          />
          <textarea
            aria-label="Páginas do caderno"
            className="evento-caderno-corpo min-h-[320px] w-full flex-1 resize-none bg-transparent outline-none xl:min-h-0"
            placeholder="Escreva o roteiro do dia…"
            value={corpo}
            onChange={(e) => {
              setCorpo(e.target.value)
              schedule(titulo, e.target.value)
            }}
            onBlur={() => void flush()}
          />
          <p className="evento-caderno-rodape mt-3">
            Folha {Math.min(index, folhas.length - 1) + 1} de {folhas.length} · {saveHint}
          </p>
        </div>
      </div>
    </div>
  )
}
