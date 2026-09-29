import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  BookPlus,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ImagePlus,
  Library,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { EventoDocumentoAura } from '@/components/eventos/EventoDocumentoAura'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  parseEventoCadernoCorpo,
  serializeEventoCadernoCorpo,
  textoEventoCadernoSemAnexos,
} from '@/lib/evento-caderno-anexos'
import type { EventoCaderno, EventoPagina } from '@/lib/evento-types'
import { dicaDoCaderno } from '@/lib/evento-types'
import { cn } from '@/lib/utils'

type SaveHint = 'Salva sozinho' | 'Salvando...' | 'Salvo' | 'Não salvou — continue digitando'

interface CadernoHit {
  paginaId: string
  cadernoId: string
  field: 'titulo' | 'corpo'
  start: number
  end: number
}

/** Foto já enviada no evento (participante ou item) para colar no caderno. */
export interface EventoCadernoMidiaOption {
  id: string
  file_url: string
  label: string
}

interface EventoDocumentoPanelProps {
  cadernos: EventoCaderno[]
  paginas: EventoPagina[]
  midiasDisponiveis?: EventoCadernoMidiaOption[]
  onSave: (input: { id: string; titulo: string; corpo: string }) => Promise<unknown>
  onNovaFolha: (cadernoId: string) => Promise<unknown>
  onExcluirFolha: (input: { id: string; cadernoId: string }) => Promise<unknown>
  onNovoCaderno: (input: { titulo: string; dica?: string | null }) => Promise<EventoCaderno>
  onSalvarCaderno: (input: { id: string; titulo: string; dica?: string | null }) => Promise<unknown>
  onExcluirCaderno: (id: string) => Promise<unknown>
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
  cadernoId: string,
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
    hits.push({ paginaId, cadernoId, field, start, end })
    from = at + Math.max(queryFolded.length, 1)
  }
  return hits
}

function collectCadernoHits(
  cadernos: EventoCaderno[],
  paginas: EventoPagina[],
  query: string,
  draft?: { id: string; titulo: string; corpo: string } | null,
): CadernoHit[] {
  const q = foldQuery(query)
  if (!q) return []
  const ordemCaderno = new Map(cadernos.map((c, i) => [c.id, i]))
  const ordered = [...paginas].sort((a, b) => {
    const ca = ordemCaderno.get(a.caderno_id) ?? 999
    const cb = ordemCaderno.get(b.caderno_id) ?? 999
    if (ca !== cb) return ca - cb
    return a.ordem - b.ordem
  })
  const hits: CadernoHit[] = []
  for (const page of ordered) {
    const titulo = draft && draft.id === page.id ? draft.titulo : page.titulo
    const corpo =
      draft && draft.id === page.id ? draft.corpo : textoEventoCadernoSemAnexos(page.corpo)
    hits.push(...findHitsInField(page.id, page.caderno_id, 'titulo', titulo, q))
    hits.push(...findHitsInField(page.id, page.caderno_id, 'corpo', corpo, q))
  }
  return hits
}

function folhasDoCaderno(paginas: EventoPagina[], cadernoId: string) {
  return paginas.filter((p) => p.caderno_id === cadernoId).sort((a, b) => a.ordem - b.ordem)
}

function tituloCaderno(cadernos: EventoCaderno[], cadernoId: string) {
  return cadernos.find((c) => c.id === cadernoId)?.titulo.trim() || 'Caderno'
}

export function EventoDocumentoPanel({
  cadernos = [],
  paginas = [],
  midiasDisponiveis = [],
  onSave,
  onNovaFolha,
  onExcluirFolha,
  onNovoCaderno,
  onSalvarCaderno,
  onExcluirCaderno,
  className,
}: EventoDocumentoPanelProps) {
  const cadernosOrdenados = useMemo(
    () => [...(Array.isArray(cadernos) ? cadernos : [])].sort(
      (a, b) => a.ordem - b.ordem || a.criado_em.localeCompare(b.criado_em),
    ),
    [cadernos],
  )

  const [cadernoId, setCadernoId] = useState<string | null>(cadernosOrdenados[0]?.id ?? null)
  const cadernoAtivo =
    cadernosOrdenados.find((c) => c.id === cadernoId) ?? cadernosOrdenados[0] ?? null

  /** Caderno recém-criado: segura a seleção até ele aparecer na lista recarregada. */
  const cadernoDesejadoRef = useRef<string | null>(null)
  const tabsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!cadernosOrdenados.length) {
      setCadernoId(null)
      return
    }
    if (cadernoId && cadernosOrdenados.some((c) => c.id === cadernoId)) {
      cadernoDesejadoRef.current = null
      return
    }
    if (cadernoDesejadoRef.current && cadernoDesejadoRef.current === cadernoId) return
    setCadernoId(cadernosOrdenados[0].id)
  }, [cadernosOrdenados, cadernoId])

  /** Traz a aba ativa para dentro da fila visível (sem mexer no scroll da página). */
  useEffect(() => {
    const strip = tabsRef.current
    if (!strip || !cadernoAtivo) return
    const alvo = strip.querySelector<HTMLElement>(`[data-caderno-id="${cadernoAtivo.id}"]`)
    if (!alvo) return
    const fila = strip.getBoundingClientRect()
    const aba = alvo.getBoundingClientRect()
    if (aba.left < fila.left) strip.scrollLeft += aba.left - fila.left - 8
    else if (aba.right > fila.right) strip.scrollLeft += aba.right - fila.right + 8
  }, [cadernoAtivo?.id, cadernosOrdenados.length])

  const folhas = useMemo(
    () => (cadernoAtivo ? folhasDoCaderno(Array.isArray(paginas) ? paginas : [], cadernoAtivo.id) : []),
    [paginas, cadernoAtivo],
  )
  const [index, setIndex] = useState(0)
  const atual = folhas[Math.min(index, Math.max(folhas.length - 1, 0))] ?? null

  useEffect(() => {
    setIndex(0)
  }, [cadernoAtivo?.id])

  const [titulo, setTitulo] = useState('')
  const [corpo, setCorpo] = useState('')
  const [anexos, setAnexos] = useState<string[]>([])
  const [anexosAbertos, setAnexosAbertos] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saveHint, setSaveHint] = useState<SaveHint>('Salva sozinho')
  const [busca, setBusca] = useState('')
  const [hitIdx, setHitIdx] = useState(0)

  const [cadernoDialog, setCadernoDialog] = useState<'novo' | 'editar' | null>(null)
  const [cadernoTituloDraft, setCadernoTituloDraft] = useState('')
  const [cadernoDicaDraft, setCadernoDicaDraft] = useState('')
  const [cadernoBusy, setCadernoBusy] = useState(false)
  const [excluirCadernoOpen, setExcluirCadernoOpen] = useState(false)

  const dirtyRef = useRef(false)
  const savingRef = useRef(false)
  const timerRef = useRef(0)
  const snapshotRef = useRef({ id: '', titulo: '', corpo: '' })
  const tituloRef = useRef<HTMLInputElement>(null)
  const corpoRef = useRef<HTMLTextAreaElement>(null)
  const buscaInputRef = useRef<HTMLInputElement>(null)
  /** Próximo trecho a abrir e marcar (todas as abas/folhas). */
  const pendingHitRef = useRef<CadernoHit | null>(null)
  const markTokenRef = useRef(0)

  const draft = atual ? { id: atual.id, titulo, corpo } : null
  const hitsLive = useMemo(
    () => collectCadernoHits(cadernosOrdenados, paginas, busca, draft),
    [cadernosOrdenados, paginas, busca, draft],
  )
  const activeHit = hitsLive[hitIdx] ?? null

  const midiasNaoAnexadas = useMemo(
    () => midiasDisponiveis.filter((m) => !anexos.includes(m.file_url)),
    [midiasDisponiveis, anexos],
  )

  useEffect(() => {
    if (!atual) return
    const parsed = parseEventoCadernoCorpo(atual.corpo)
    setTitulo(atual.titulo)
    setCorpo(parsed.texto)
    setAnexos(parsed.imageUrls)
    snapshotRef.current = {
      id: atual.id,
      titulo: atual.titulo,
      corpo: serializeEventoCadernoCorpo(parsed.texto, parsed.imageUrls),
    }
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

  const schedule = useCallback((nextTitulo: string, nextCorpo: string, nextAnexos: string[]) => {
    snapshotRef.current = {
      ...snapshotRef.current,
      titulo: nextTitulo,
      corpo: serializeEventoCadernoCorpo(nextCorpo, nextAnexos),
    }
    dirtyRef.current = true
    setSaveHint('Salva sozinho')
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      void flush()
    }, 400)
  }, [flush])

  const anexarUrl = useCallback((url: string) => {
    if (!url || anexos.includes(url)) return
    const next = [...anexos, url]
    setAnexos(next)
    setAnexosAbertos(true)
    schedule(titulo, corpo, next)
  }, [anexos, titulo, corpo, schedule])

  const removerAnexo = useCallback((url: string) => {
    const next = anexos.filter((u) => u !== url)
    setAnexos(next)
    schedule(titulo, corpo, next)
  }, [anexos, titulo, corpo, schedule])

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

  /** Abre o caderno/folha do trecho. Com `mark`, seleciona a palavra na folha. */
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

    if (cadernoAtivo?.id !== hit.cadernoId) {
      setCadernoId(hit.cadernoId)
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
  }, [flush, cadernoAtivo?.id, folhas, index, atual?.id, applyHitSelection])

  useEffect(() => {
    const pageId = pendingPageRef.current
    if (!pageId || !cadernoAtivo) return
    const lista = folhasDoCaderno(paginas, cadernoAtivo.id)
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
  }, [cadernoAtivo, index, paginas])

  useEffect(() => {
    const hit = pendingHitRef.current
    if (!hit || !cadernoAtivo) return
    if (cadernoAtivo.id !== hit.cadernoId) return

    const lista = folhasDoCaderno(paginas, hit.cadernoId)
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
  }, [cadernoAtivo, index, atual?.id, paginas, applyHitSelection, titulo, corpo, hitIdx])

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
    const nextHits = collectCadernoHits(cadernosOrdenados, paginas, value, draft)
    if (nextHits.length === 0) {
      pendingHitRef.current = null
      pendingPageRef.current = null
      setHitIdx(0)
      return
    }
    goToHit(nextHits[0], 0, false)
  }

  const trocarCaderno = (id: string) => {
    void flush()
    pendingHitRef.current = null
    setCadernoId(id)
    setIndex(0)
  }

  /** Setas ← → trocam de caderno como numa pilha de fichas. */
  const onTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, id: string) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const pos = cadernosOrdenados.findIndex((c) => c.id === id)
    if (pos < 0) return
    const dir = event.key === 'ArrowRight' ? 1 : -1
    const alvo = cadernosOrdenados[(pos + dir + cadernosOrdenados.length) % cadernosOrdenados.length]
    if (!alvo) return
    trocarCaderno(alvo.id)
    document.getElementById(`caderno-tab-${alvo.id}`)?.focus()
  }

  const abrirNovoCaderno = () => {
    setCadernoTituloDraft('')
    setCadernoDicaDraft('')
    setCadernoDialog('novo')
  }

  const abrirEditarCaderno = () => {
    if (!cadernoAtivo) return
    setCadernoTituloDraft(cadernoAtivo.titulo)
    setCadernoDicaDraft(cadernoAtivo.dica ?? '')
    setCadernoDialog('editar')
  }

  const confirmarCadernoDialog = async () => {
    const tituloNovo = cadernoTituloDraft.trim()
    if (!tituloNovo || cadernoBusy) return
    setCadernoBusy(true)
    try {
      if (cadernoDialog === 'novo') {
        const criado = await onNovoCaderno({
          titulo: tituloNovo,
          dica: cadernoDicaDraft.trim() || null,
        })
        cadernoDesejadoRef.current = criado.id
        setCadernoId(criado.id)
        setIndex(0)
        setCadernoDialog(null)
        return
      }
      if (cadernoDialog === 'editar' && cadernoAtivo) {
        await onSalvarCaderno({
          id: cadernoAtivo.id,
          titulo: tituloNovo,
          dica: cadernoDicaDraft.trim() || null,
        })
        setCadernoDialog(null)
      }
    } finally {
      setCadernoBusy(false)
    }
  }

  const confirmarExcluirCaderno = async () => {
    if (!cadernoAtivo || cadernosOrdenados.length <= 1 || cadernoBusy) return
    setCadernoBusy(true)
    try {
      const id = cadernoAtivo.id
      await onExcluirCaderno(id)
      setExcluirCadernoOpen(false)
      const restante = cadernosOrdenados.filter((c) => c.id !== id)
      setCadernoId(restante[0]?.id ?? null)
    } finally {
      setCadernoBusy(false)
    }
  }

  if (!cadernoAtivo) {
    return (
      <div className={cn('flex h-full min-h-[520px] flex-col items-center justify-center gap-3 rounded-xl border border-gold-border bg-[var(--color-surface-card)] p-4', className)}>
        <p className="text-sm text-cream-faint">Nenhum caderno nesta pasta.</p>
        <button type="button" className="btn btn-proforco btn-md" onClick={abrirNovoCaderno}>
          <BookPlus className="h-4 w-4" />
          Novo caderno
        </button>
      </div>
    )
  }

  if (!atual) {
    return (
      <div className={cn('flex h-full min-h-[520px] flex-col items-center justify-center gap-3 rounded-xl border border-gold-border bg-[var(--color-surface-card)] p-4', className)}>
        <div ref={tabsRef} role="tablist" aria-label="Cadernos desta pasta" className="evento-caderno-tabs justify-center">
          {cadernosOrdenados.map((c) => {
            const ativo = cadernoAtivo.id === c.id
            return (
              <button
                key={c.id}
                id={`caderno-tab-${c.id}`}
                data-caderno-id={c.id}
                type="button"
                role="tab"
                aria-selected={ativo}
                tabIndex={ativo ? 0 : -1}
                title={dicaDoCaderno(c)}
                onClick={() => trocarCaderno(c.id)}
                onKeyDown={(e) => onTabKeyDown(e, c.id)}
                className={cn('evento-caderno-tab', ativo && 'evento-caderno-tab--ativo')}
              >
                <span className="evento-caderno-tab__label">{c.titulo.trim() || 'Sem nome'}</span>
              </button>
            )
          })}
          <button
            type="button"
            className="evento-caderno-tab evento-caderno-tab--add"
            onClick={abrirNovoCaderno}
          >
            <Plus className="h-3 w-3" aria-hidden />
            Caderno
          </button>
        </div>
        <p className="text-sm text-cream-faint">Nenhuma folha neste caderno.</p>
        <button type="button" className="btn btn-proforco btn-md" onClick={() => void onNovaFolha(cadernoAtivo.id)}>
          Folha
        </button>
      </div>
    )
  }

  return (
    <div className={cn('evento-caderno-cover relative flex h-full min-h-[560px] flex-1 flex-col overflow-hidden rounded-xl border border-gold-border xl:min-h-0', className)}>
      <EventoDocumentoAura className="absolute inset-0 h-full w-full" />
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col p-3 sm:p-4">
        <div className="mb-1.5 flex shrink-0 flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <p className="text-[11px] uppercase tracking-[0.18em] text-gold/80">3 · Cadernos</p>
            <span className="evento-caderno-selo hidden sm:inline-block" aria-hidden />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title="Ver e trocar entre todos os cadernos desta pasta"
                  className="inline-flex items-center gap-1 rounded-full border border-gold/35 px-2 py-0.5 text-[11px] text-cream-faint hover:border-gold hover:text-gold"
                >
                  <Library className="h-3 w-3" aria-hidden />
                  {cadernosOrdenados.length} cadernos
                  <ChevronDown className="h-3 w-3" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-[60vh] w-64 overflow-y-auto">
                <DropdownMenuLabel>Cadernos desta pasta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {cadernosOrdenados.map((c) => {
                  const total = folhasDoCaderno(Array.isArray(paginas) ? paginas : [], c.id).length
                  return (
                    <DropdownMenuItem
                      key={c.id}
                      onSelect={() => trocarCaderno(c.id)}
                      className="flex items-start gap-2"
                    >
                      <Check
                        className={cn(
                          'mt-0.5 h-3.5 w-3.5 shrink-0',
                          cadernoAtivo.id === c.id ? 'opacity-100 text-gold' : 'opacity-0',
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0">
                        <span className="block truncate">{c.titulo.trim() || 'Sem nome'}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {total} {total === 1 ? 'folha' : 'folhas'}
                        </span>
                      </span>
                    </DropdownMenuItem>
                  )
                })}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={abrirNovoCaderno} className="gap-2">
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Novo caderno
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Renomear caderno"
              title="Renomear este caderno"
              className="rounded-full p-1 text-cream-faint hover:text-gold"
              onClick={abrirEditarCaderno}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Apagar caderno"
              title="Apagar este caderno"
              className="rounded-full p-1 text-cream-faint hover:text-red-400 disabled:opacity-30"
              disabled={cadernosOrdenados.length <= 1}
              onClick={() => setExcluirCadernoOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
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
                void onNovaFolha(cadernoAtivo.id)
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
              onClick={() => void onExcluirFolha({ id: atual.id, cadernoId: cadernoAtivo.id })}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="evento-caderno-stack">
          <div ref={tabsRef} role="tablist" aria-label="Cadernos desta pasta" className="evento-caderno-tabs">
            {cadernosOrdenados.map((c) => {
              const ativo = cadernoAtivo.id === c.id
              return (
                <button
                  key={c.id}
                  id={`caderno-tab-${c.id}`}
                  data-caderno-id={c.id}
                  type="button"
                  role="tab"
                  aria-selected={ativo}
                  aria-controls="evento-caderno-painel"
                  tabIndex={ativo ? 0 : -1}
                  title={dicaDoCaderno(c)}
                  onClick={() => trocarCaderno(c.id)}
                  onKeyDown={(e) => onTabKeyDown(e, c.id)}
                  className={cn(
                    'evento-caderno-tab',
                    ativo && 'evento-caderno-tab--ativo',
                    !ativo && activeHit?.cadernoId === c.id && 'evento-caderno-tab--hit',
                  )}
                >
                  <span className="evento-caderno-tab__label">{c.titulo.trim() || 'Sem nome'}</span>
                </button>
              )
            })}
            <button
              type="button"
              title="Criar outro caderno para um tipo de conteúdo"
              className="evento-caderno-tab evento-caderno-tab--add"
              onClick={abrirNovoCaderno}
            >
              <Plus className="h-3 w-3" aria-hidden />
              Caderno
            </button>
          </div>

          <div className="evento-caderno-deck">
            {cadernosOrdenados.length > 2 ? (
              <div className="evento-caderno-deck__shadow evento-caderno-deck__shadow--1" aria-hidden />
            ) : null}
            {cadernosOrdenados.length > 1 ? (
              <div className="evento-caderno-deck__shadow evento-caderno-deck__shadow--2" aria-hidden />
            ) : null}
            <div
              id="evento-caderno-painel"
              role="tabpanel"
              aria-labelledby={`caderno-tab-${cadernoAtivo.id}`}
              className="evento-caderno-deck__face"
            >
              <div className="evento-caderno-deck__face-pad">
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
            placeholder="Buscar em todos os cadernos…"
            aria-label="Buscar texto em todas as páginas dos cadernos"
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
            ? `Nada encontrado para “${busca.trim()}” em todos os cadernos.`
            : activeHit
              ? `Achado em ${tituloCaderno(cadernosOrdenados, activeHit.cadernoId)} · ${activeHit.field === 'titulo' ? 'título' : 'texto'} · use ↑ ↓ para trocar`
              : dicaDoCaderno(cadernoAtivo)}
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
              schedule(e.target.value, corpo, anexos)
            }}
            onBlur={() => void flush()}
          />
          <textarea
            ref={corpoRef}
            aria-label="Páginas do caderno"
            className="evento-caderno-corpo min-h-[220px] w-full flex-1 resize-none bg-transparent outline-none xl:min-h-0"
            placeholder="Escreva o conteúdo deste caderno…"
            value={corpo}
            onChange={(e) => {
              setCorpo(e.target.value)
              schedule(titulo, e.target.value, anexos)
            }}
            onBlur={() => void flush()}
          />

          <div className="evento-caderno-anexos mt-3 shrink-0">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                className="evento-caderno-anexos__toggle inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-[#5c4030] hover:text-[#2a1812]"
                aria-expanded={anexosAbertos}
                onClick={() => setAnexosAbertos((v) => !v)}
              >
                {anexosAbertos ? (
                  <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                )}
                Fotos nesta folha
                {anexos.length > 0 ? (
                  <span className="rounded-full bg-[#c9a07b]/25 px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-[#5c4030]">
                    {anexos.length}
                  </span>
                ) : null}
                <span className="normal-case tracking-normal text-[#8a6a4a]">
                  {anexos.length === 0
                    ? ''
                    : anexosAbertos
                      ? '· minimizar'
                      : '· expandir'}
                </span>
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-[rgba(201,160,123,0.6)] bg-white/50 px-2.5 py-1 text-[11px] text-[#5c4030] hover:border-[#c9a07b] hover:text-[#2a1812]"
                onClick={() => setPickerOpen(true)}
              >
                <ImagePlus className="h-3.5 w-3.5" />
                Anexar imagem
              </button>
            </div>

            {!anexosAbertos && anexos.length > 0 ? (
              <button
                type="button"
                className="evento-caderno-anexos__mini flex w-full items-center gap-2 rounded-md border border-[rgba(201,160,123,0.45)] bg-white/55 px-2 py-1.5 text-left"
                onClick={() => setAnexosAbertos(true)}
                aria-label={`Expandir ${anexos.length} fotos desta folha`}
              >
                <span className="flex -space-x-2">
                  {anexos.slice(0, 4).map((url) => (
                    <img
                      key={url}
                      src={url}
                      alt=""
                      className="h-8 w-8 rounded border border-white object-cover shadow-sm"
                    />
                  ))}
                </span>
                <span className="text-[12px] text-[#5c4030]">
                  {anexos.length} {anexos.length === 1 ? 'foto minimizada' : 'fotos minimizadas'} — toque para ver
                </span>
              </button>
            ) : null}

            {anexosAbertos ? (
              anexos.length === 0 ? (
                <p className="text-[12px] leading-snug text-[#8a6a4a]">
                  Nenhuma foto ainda. Use o botão Anexar no topo (imagem ou PDF) e depois cole aqui.
                </p>
              ) : (
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {anexos.map((url) => (
                    <li
                      key={url}
                      className="group relative overflow-hidden rounded-md border border-[rgba(201,160,123,0.5)] bg-white/70"
                    >
                      <img src={url} alt="" className="aspect-square w-full object-cover" />
                      <button
                        type="button"
                        aria-label="Tirar imagem desta folha"
                        className="absolute right-1 top-1 rounded-full bg-[rgba(42,24,18,0.8)] p-1 text-white opacity-90 hover:bg-red-700"
                        onClick={() => removerAnexo(url)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </div>

          <p className="evento-caderno-rodape mt-3">
            {cadernoAtivo.titulo.trim() || 'Caderno'} · Folha {Math.min(index, folhas.length - 1) + 1} de {folhas.length} · {saveHint}
          </p>
        </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Anexar imagem nesta folha</DialogTitle>
            <DialogDescription className="sr-only">
              Escolha uma foto já enviada na pasta para colar nesta folha do caderno.
            </DialogDescription>
          </DialogHeader>
          {midiasDisponiveis.length === 0 ? (
            <p className="text-sm text-cream-faint">
              Ainda não há fotos neste evento. Clique em Anexar no topo da pasta, envie imagem ou PDF
              (o PDF vira páginas em imagem) e volte aqui.
            </p>
          ) : midiasNaoAnexadas.length === 0 ? (
            <p className="text-sm text-cream-faint">Todas as fotos do evento já estão nesta folha.</p>
          ) : (
            <ul className="grid max-h-[60vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
              {midiasNaoAnexadas.map((midia) => (
                <li key={midia.id}>
                  <button
                    type="button"
                    className="w-full overflow-hidden rounded-lg border border-gold-border/50 text-left hover:border-gold"
                    onClick={() => {
                      anexarUrl(midia.file_url)
                      setPickerOpen(false)
                    }}
                  >
                    <img src={midia.file_url} alt="" className="aspect-square w-full object-cover" />
                    <span className="block truncate px-1.5 py-1 text-[10px] text-cream-faint">{midia.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={cadernoDialog != null} onOpenChange={(open) => !open && setCadernoDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{cadernoDialog === 'editar' ? 'Renomear caderno' : 'Novo caderno'}</DialogTitle>
            <DialogDescription>
              Cada caderno guarda um tipo de conteúdo (ex.: Buffet, Montagem, Contrato).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="evento-caderno-titulo" className="text-xs uppercase tracking-[0.14em] text-cream-faint">
                Nome
              </label>
              <Input
                id="evento-caderno-titulo"
                value={cadernoTituloDraft}
                onChange={(e) => setCadernoTituloDraft(e.target.value)}
                placeholder="Ex.: Buffet"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void confirmarCadernoDialog()
                  }
                }}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="evento-caderno-dica" className="text-xs uppercase tracking-[0.14em] text-cream-faint">
                Para que serve (opcional)
              </label>
              <Input
                id="evento-caderno-dica"
                value={cadernoDicaDraft}
                onChange={(e) => setCadernoDicaDraft(e.target.value)}
                placeholder="Ex.: Cardápio e fornecedores do dia"
              />
            </div>
          </div>
          <DialogFooter>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setCadernoDialog(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-proforco btn-sm"
              disabled={!cadernoTituloDraft.trim() || cadernoBusy}
              onClick={() => void confirmarCadernoDialog()}
            >
              {cadernoDialog === 'editar' ? 'Salvar' : 'Criar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={excluirCadernoOpen} onOpenChange={setExcluirCadernoOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar o caderno “{cadernoAtivo.titulo.trim() || 'Sem nome'}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as folhas deste caderno serão apagadas. Não dá para desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-700 hover:bg-red-800"
              disabled={cadernoBusy}
              onClick={(e) => {
                e.preventDefault()
                void confirmarExcluirCaderno()
              }}
            >
              Apagar caderno
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
