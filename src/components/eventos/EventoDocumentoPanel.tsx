import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Plus, Search, Trash2, X } from 'lucide-react'
import { EventoDocumentoAura } from '@/components/eventos/EventoDocumentoAura'
import type { EventoPagina, EventoSecao } from '@/lib/evento-types'
import { EVENTO_SECOES, EVENTO_SECAO_DICAS } from '@/lib/evento-types'
import { cn } from '@/lib/utils'

type SaveHint = 'Salva sozinho' | 'Salvando...' | 'Salvo' | 'Não salvou — continue digitando'

interface CadernoHit {
  paginaId: string
  secao: EventoSecao
  field: 'titulo' | 'corpo'
  start: number
  end: number
}

interface EventoDocumentoPanelProps {
  paginas: EventoPagina[]
  onSave: (input: { id: string; titulo: string; corpo: string }) => Promise<unknown>
  onNovaFolha: (secao: EventoSecao) => Promise<unknown>
  onExcluirFolha: (input: { id: string; secao: EventoSecao }) => Promise<unknown>
  className?: string
}

/** Minúsculas, sem acento e sem espaço — para achar “Ola Mundo” em “olá  mundo”. */
function foldQuery(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, '')
}

function buildFoldMap(text: string): { folded: string; map: number[] } {
  const map: number[] = []
  let folded = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (/\s/u.test(ch)) continue
    const nfd = ch.normalize('NFD')
    for (const c of nfd) {
      if (/\p{M}/u.test(c)) continue
      folded += c.toLowerCase()
      map.push(i)
    }
  }
  return { folded, map }
}

function findHitsInField(
  paginaId: string,
  secao: EventoSecao,
  field: 'titulo' | 'corpo',
  text: string,
  queryFolded: string,
): CadernoHit[] {
  if (!queryFolded || !text) return []
  const { folded, map } = buildFoldMap(text)
  if (!folded) return []
  const hits: CadernoHit[] = []
  let from = 0
  while (from <= folded.length) {
    const at = folded.indexOf(queryFolded, from)
    if (at < 0) break
    const last = at + queryFolded.length - 1
    const start = map[at] ?? 0
    const end = (map[last] ?? start) + 1
    hits.push({ paginaId, secao, field, start, end })
    from = at + Math.max(queryFolded.length, 1)
  }
  return hits
}

function collectCadernoHits(
  paginas: EventoPagina[],
  query: string,
  draft?: { id: string; titulo: string; corpo: string } | null,
): CadernoHit[] {
  const q = foldQuery(query)
  if (!q) return []
  const ordered = [...paginas].sort((a, b) => {
    const sa = EVENTO_SECOES.indexOf(a.secao)
    const sb = EVENTO_SECOES.indexOf(b.secao)
    if (sa !== sb) return sa - sb
    return a.ordem - b.ordem
  })
  const hits: CadernoHit[] = []
  for (const page of ordered) {
    const titulo = draft && draft.id === page.id ? draft.titulo : page.titulo
    const corpo = draft && draft.id === page.id ? draft.corpo : page.corpo
    hits.push(...findHitsInField(page.id, page.secao, 'titulo', titulo, q))
    hits.push(...findHitsInField(page.id, page.secao, 'corpo', corpo, q))
  }
  return hits
}

function folhasDaSecao(paginas: EventoPagina[], secao: EventoSecao) {
  return paginas.filter((p) => p.secao === secao).sort((a, b) => a.ordem - b.ordem)
}

export function EventoDocumentoPanel({
  paginas,
  onSave,
  onNovaFolha,
  onExcluirFolha,
  className,
}: EventoDocumentoPanelProps) {
  const [secao, setSecao] = useState<EventoSecao>('detalhes')
  const folhas = useMemo(() => folhasDaSecao(paginas, secao), [paginas, secao])
  const [index, setIndex] = useState(0)
  const atual = folhas[Math.min(index, Math.max(folhas.length - 1, 0))] ?? null

  const [titulo, setTitulo] = useState('')
  const [corpo, setCorpo] = useState('')
  const [saveHint, setSaveHint] = useState<SaveHint>('Salva sozinho')
  const [busca, setBusca] = useState('')
  const [hitIdx, setHitIdx] = useState(0)

  const dirtyRef = useRef(false)
  const savingRef = useRef(false)
  const timerRef = useRef<number>(0)
  const snapshotRef = useRef({ id: '', titulo: '', corpo: '' })
  const tituloRef = useRef<HTMLInputElement>(null)
  const corpoRef = useRef<HTMLTextAreaElement>(null)
  const buscaInputRef = useRef<HTMLInputElement>(null)
  /** Próximo trecho a abrir e marcar (todas as abas/folhas). */
  const pendingHitRef = useRef<CadernoHit | null>(null)
  const markTokenRef = useRef(0)

  const draft = atual ? { id: atual.id, titulo, corpo } : null
  const hitsLive = useMemo(
    () => collectCadernoHits(paginas, busca, draft),
    [paginas, busca, draft],
  )
  const activeHit = hitsLive[hitIdx] ?? null

  useEffect(() => {
    if (!atual) return
    setTitulo(atual.titulo)
    setCorpo(atual.corpo)
    snapshotRef.current = { id: atual.id, titulo: atual.titulo, corpo: atual.corpo }
    dirtyRef.current = false
    setSaveHint('Salva sozinho')
  }, [atual?.id])

  useEffect(() => {
    if (hitsLive.length === 0) {
      setHitIdx(0)
      return
    }
    if (hitIdx >= hitsLive.length) setHitIdx(hitsLive.length - 1)
  }, [hitsLive.length, hitIdx])

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

  const applyHitSelection = useCallback((hit: CadernoHit) => {
    const token = ++markTokenRef.current
    const run = () => {
      if (token !== markTokenRef.current) return
      const el = hit.field === 'titulo' ? tituloRef.current : corpoRef.current
      if (!el) return
      el.focus({ preventScroll: true })
      try {
        el.setSelectionRange(hit.start, hit.end)
      } catch {
        /* ignore */
      }
      if (hit.field === 'corpo') {
        const lineHeight = 32
        const before = el.value.slice(0, hit.start)
        const line = before.split('\n').length - 1
        el.scrollTop = Math.max(0, line * lineHeight - el.clientHeight / 3)
      }
    }
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(run)
    })
  }, [])

  const pendingPageRef = useRef<string | null>(null)

  /** Abre a aba/folha do trecho. Com `mark`, seleciona a palavra na folha. */
  const goToHit = useCallback((hit: CadernoHit, nextIdx: number, mark = true) => {
    void flush()
    setHitIdx(nextIdx)
    if (mark) {
      pendingHitRef.current = hit
      pendingPageRef.current = null
    } else {
      pendingHitRef.current = null
      pendingPageRef.current = hit.paginaId
    }

    if (secao !== hit.secao) {
      setSecao(hit.secao)
      return
    }

    const i = folhas.findIndex((f) => f.id === hit.paginaId)
    if (i >= 0 && i !== index) {
      setIndex(i)
      return
    }
    if (mark && atual?.id === hit.paginaId) {
      applyHitSelection(hit)
      pendingHitRef.current = null
    }
  }, [flush, secao, folhas, index, atual?.id, applyHitSelection])

  // Navega até a folha (sem marcar) quando só há troca de página pela digitação
  useEffect(() => {
    const pageId = pendingPageRef.current
    if (!pageId) return
    const lista = folhasDaSecao(paginas, secao)
    const i = lista.findIndex((f) => f.id === pageId)
    if (i < 0) {
      pendingPageRef.current = null
      return
    }
    if (index !== i) {
      setIndex(i)
      return
    }
    pendingPageRef.current = null
  }, [secao, index, paginas])

  // Depois de trocar aba/folha, posiciona e marca o texto
  useEffect(() => {
    const hit = pendingHitRef.current
    if (!hit) return
    if (secao !== hit.secao) return

    const lista = folhasDaSecao(paginas, hit.secao)
    const i = lista.findIndex((f) => f.id === hit.paginaId)
    if (i < 0) {
      pendingHitRef.current = null
      return
    }
    if (index !== i) {
      setIndex(i)
      return
    }
    if (atual?.id !== hit.paginaId) return
    applyHitSelection(hit)
    pendingHitRef.current = null
  }, [secao, index, atual?.id, paginas, applyHitSelection, titulo, corpo, hitIdx])

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

  const jumpHit = (dir: 1 | -1) => {
    if (hitsLive.length === 0) return
    const next = (hitIdx + dir + hitsLive.length) % hitsLive.length
    goToHit(hitsLive[next], next, true)
  }

  const onBuscaChange = (value: string) => {
    setBusca(value)
    const nextHits = collectCadernoHits(paginas, value, draft)
    if (nextHits.length === 0) {
      pendingHitRef.current = null
      pendingPageRef.current = null
      setHitIdx(0)
      return
    }
    // Digitando: já abre a folha certa em qualquer aba; ↑↓ / Enter marca a palavra
    goToHit(nextHits[0], 0, false)
  }

  const trocarAba = (id: EventoSecao) => {
    void flush()
    pendingHitRef.current = null
    setSecao(id)
    setIndex(0)
  }

  if (!atual) {
    return (
      <div className={cn('flex h-full min-h-[520px] flex-col items-center justify-center gap-3 rounded-xl border border-gold-border bg-[var(--color-surface-card)] p-4', className)}>
        <div className="flex flex-wrap justify-center gap-2">
          {EVENTO_SECOES.map((id) => (
            <button
              key={id}
              type="button"
              title={EVENTO_SECAO_DICAS[id].dica}
              onClick={() => trocarAba(id)}
              className={cn(
                'rounded-full px-3 py-1 text-xs',
                secao === id ? 'bg-gold/20 text-gold' : 'text-cream-faint hover:text-gold',
              )}
            >
              {EVENTO_SECAO_DICAS[id].aba}
            </button>
          ))}
        </div>
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
                onClick={() => trocarAba(id)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs',
                  secao === id
                    ? 'bg-gold/20 text-gold'
                    : activeHit && activeHit.secao === id
                      ? 'text-gold ring-1 ring-gold/40'
                      : 'text-cream-faint hover:text-gold',
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
                pendingHitRef.current = null
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
                pendingHitRef.current = null
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

        <div className="evento-caderno-busca mb-2 shrink-0">
          <Search className="evento-caderno-busca__icon" aria-hidden />
          <input
            ref={buscaInputRef}
            type="search"
            value={busca}
            onChange={(e) => onBuscaChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                jumpHit(e.shiftKey ? -1 : 1)
              }
              if (e.key === 'Escape') {
                e.stopPropagation()
                setBusca('')
                pendingHitRef.current = null
                setHitIdx(0)
              }
            }}
            placeholder="Buscar em Detalhes, Discursos e Palestras…"
            aria-label="Buscar texto em todas as páginas do caderno"
            autoComplete="off"
            spellCheck={false}
          />
          {foldQuery(busca) ? (
            <div className="evento-caderno-busca__meta">
              <span className="evento-caderno-busca__count">
                {hitsLive.length === 0 ? '0' : `${hitIdx + 1}/${hitsLive.length}`}
              </span>
              <button
                type="button"
                className="evento-caderno-busca__nav"
                aria-label="Resultado anterior"
                disabled={hitsLive.length === 0}
                onClick={() => jumpHit(-1)}
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="evento-caderno-busca__nav"
                aria-label="Próximo resultado"
                disabled={hitsLive.length === 0}
                onClick={() => jumpHit(1)}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="evento-caderno-busca__clear"
                aria-label="Limpar busca"
                onClick={() => {
                  setBusca('')
                  pendingHitRef.current = null
                  setHitIdx(0)
                  buscaInputRef.current?.focus()
                }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
        </div>
        <p className="mb-2 truncate text-[11px] text-cream-faint">
          {foldQuery(busca) && hitsLive.length === 0
            ? `Nada encontrado para “${busca.trim()}” em todo o caderno.`
            : activeHit
              ? `Achado em ${EVENTO_SECAO_DICAS[activeHit.secao].aba} · ${activeHit.field === 'titulo' ? 'título' : 'texto'} · use ↑ ↓ para trocar`
              : EVENTO_SECAO_DICAS[secao].dica}
        </p>

        <div
          className={cn(
            'evento-caderno-folha mx-auto flex w-full min-h-[420px] flex-1 flex-col px-5 py-5 pl-16 sm:px-8 sm:pl-[4.5rem] xl:min-h-0',
            foldQuery(busca) && hitsLive.length > 0 && 'evento-caderno-folha--busca',
          )}
        >
          <input
            ref={tituloRef}
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
            ref={corpoRef}
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
