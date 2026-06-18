import { useEffect, useRef, useState } from 'react'
import { Camera, Calendar, HardHat, Maximize2 } from 'lucide-react'
import { useEvolucaoPainel, type FiltroPeriodo } from '@/hooks/useObraEvolucao'
import { LoadingState, ErrorState } from '@/components/ui/EmptyState'
import { cn, fmtDate, fmtTime } from '@/lib/utils'
import { AnexoLightbox } from '@/components/contas-pagar/AnexoLightbox'
import { evolucaoThumbUrl, evolucaoLightboxPages } from '@/lib/obra-evolucao'
import type { EvolucaoPainelItemComUrl } from '@/lib/obra-evolucao'
import {
  KanbanPageZoomControls,
  KanbanPageZoomShell,
  KanbanPageToolbar,
  PageZoomProvider,
} from '@/components/page-zoom'

export function AcompanhamentoObras() {
  return (
    <PageZoomProvider pageKey="acompanhamento_obras">
      <AcompanhamentoObrasContent />
    </PageZoomProvider>
  )
}

type LightboxState = {
  url: string
  pages?: string[]
  nome: string
  kind: 'image' | 'pdf' | 'video'
  observacao?: string | null
}

function EvolucaoThumb({
  foto,
  onOpen,
}: {
  foto: EvolucaoPainelItemComUrl
  onOpen: () => void
}) {
  const thumbUrl = evolucaoThumbUrl(foto)
  const horario = fmtTime(foto.tirado_em)

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative h-[7.5rem] w-[7.5rem] shrink-0 overflow-hidden rounded-md border border-[rgba(240,210,140,0.15)] bg-black/40 sm:h-[8.25rem] sm:w-[8.25rem]"
      aria-label={`Ver foto de ${foto.obra_nome} às ${horario}`}
    >
      {thumbUrl ? (
        <img
          src={thumbUrl}
          alt={foto.nome_arquivo}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[#edd9c4]">
          <Camera size={14} />
        </div>
      )}

      {foto.kind === 'video' && (
        <span className="absolute left-0.5 top-0.5 rounded bg-[rgba(59,130,246,0.9)] px-0.5 text-[0.45rem] font-bold uppercase text-white">
          VÍD
        </span>
      )}
      {foto.kind === 'pdf' && (
        <span className="absolute left-0.5 top-0.5 rounded bg-[rgba(240,210,140,0.9)] px-0.5 text-[0.45rem] font-bold uppercase text-[#2a1812]">
          PDF
        </span>
      )}

      <span className="absolute bottom-0.5 left-0.5 rounded bg-black/75 px-1 py-px text-[0.5rem] font-semibold tabular-nums leading-tight text-white">
        {horario}
      </span>

      <div className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
        <Maximize2 size={12} className="text-white" />
      </div>
    </button>
  )
}

function EvolucaoObservacao({ texto }: { texto: string }) {
  const [expanded, setExpanded] = useState(false)
  const ref = useRef<HTMLParagraphElement>(null)
  const [overflows, setOverflows] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || expanded) return

    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 1)
    check()

    const observer = new ResizeObserver(check)
    observer.observe(el)
    return () => observer.disconnect()
  }, [texto, expanded])

  const canToggle = overflows || expanded

  return (
    <p
      ref={ref}
      role={canToggle ? 'button' : undefined}
      tabIndex={canToggle ? 0 : undefined}
      onClick={() => {
        if (canToggle) setExpanded(prev => !prev)
      }}
      onKeyDown={e => {
        if (!canToggle) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setExpanded(prev => !prev)
        }
      }}
      className={cn(
        'text-[0.7rem] leading-snug text-[#d4c4a8] whitespace-pre-wrap break-words transition-colors',
        !expanded && 'line-clamp-3',
        canToggle && 'cursor-pointer hover:text-[#e8d4b0]',
      )}
      title={
        !expanded && overflows
          ? 'Clique para ver o texto completo'
          : expanded
            ? 'Clique para recolher'
            : undefined
      }
    >
      {texto}
    </p>
  )
}

function AcompanhamentoObrasContent() {
  const [filtro, setFiltro] = useState<FiltroPeriodo>('hoje')
  const { grupos, loading, error } = useEvolucaoPainel(filtro)
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)

  const openFoto = (foto: EvolucaoPainelItemComUrl) => {
    const pages = evolucaoLightboxPages(foto)
    if (!pages.length) return
    setLightbox({
      url: pages[0],
      pages,
      nome: foto.nome_arquivo,
      kind: foto.kind,
      observacao: foto.observacao,
    })
  }

  const totalFotos = grupos.reduce(
    (acc, g) => acc + g.dias.reduce((d, dia) => d + dia.fotos.length, 0),
    0,
  )

  return (
    <div className="obra-page-shell obra-page-shell--acompanhamento fade-in flex flex-none flex-col overflow-visible">
      <KanbanPageToolbar>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display" style={{ fontSize: '2.2rem', color: '#f2d892', letterSpacing: '.08em' }}>
              Acompanhamento de Obras
            </h1>
            <p className="section-label mt-1">
              Visualização diária da evolução das montagens
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <KanbanPageZoomControls />
            <div className="flex rounded-lg border border-[rgba(240,210,140,0.15)] bg-[#1a1412] p-1">
              {(['hoje', 'semana', 'mes'] as FiltroPeriodo[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFiltro(f)}
                  className={`rounded-md px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${
                    filtro === f
                      ? 'bg-[#f2d892] text-[#1a1412] shadow-lg'
                      : 'text-[#edd9c4] hover:text-[#f2d892]'
                  }`}
                >
                  {f === 'hoje' ? 'Hoje' : f === 'semana' ? 'Esta Semana' : 'Este Mês'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </KanbanPageToolbar>

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} />}

      {!loading && !error && (
        <KanbanPageZoomShell
          showScrollArrows={false}
          showFloatingScrollbar={false}
          horizontalScrollbar={false}
          verticalScrollbar={false}
          contentLayout="fluid"
          contentSignal={`${filtro}-${grupos.length}-${totalFotos}`}
          className="flex-none"
        >
          {grupos.length === 0 ? (
            <div className="flex w-full flex-col items-center justify-center py-20 text-[#d4bc9f]">
              <Camera size={48} className="mb-4 opacity-20" />
              <p className="text-lg font-display">Nenhuma foto registrada no período</p>
              <p className="text-sm">Os montadores ainda não enviaram atualizações.</p>
            </div>
          ) : (
            <div className="w-full space-y-4 pb-8 pr-1">
              {grupos.map((grupo) => (
                <div key={grupo.obra_id} className="glass-card border-[rgba(240,210,140,0.12)] p-3 sm:p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="rounded-full bg-[#f2d892]/10 p-1.5 text-[#f2d892]">
                      <HardHat size={16} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-sm font-bold leading-tight text-cream sm:text-base">
                        {grupo.obra_nome}
                      </h3>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {grupo.dias.map((dia) => (
                      <div key={dia.data} className="relative border-l border-[rgba(240,210,140,0.2)] pl-4">
                        <div className="absolute -left-[4px] top-0 h-[7px] w-[7px] rounded-full bg-[#f2d892]" />

                        <div className="mb-1.5 flex items-center gap-1.5">
                          <Calendar size={10} className="text-[#f2d892]" />
                          <span className="text-[0.65rem] font-bold uppercase tracking-wider text-[#f2d892]">
                            {fmtDate(dia.data)}
                          </span>
                          <span className="text-[0.6rem] text-[#edd9c4]">
                            · {dia.fotos.length} {dia.fotos.length === 1 ? 'foto' : 'fotos'}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {dia.fotos.map((foto) => (
                            <div
                              key={foto.id}
                              className="flex w-[7.5rem] shrink-0 flex-col gap-1 sm:w-[8.25rem]"
                            >
                              <EvolucaoThumb foto={foto} onOpen={() => openFoto(foto)} />

                              {foto.observacao?.trim() && (
                                <EvolucaoObservacao texto={foto.observacao.trim()} />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </KanbanPageZoomShell>
      )}

      {lightbox && (
        <AnexoLightbox
          open
          imageUrl={lightbox.url}
          pages={lightbox.pages}
          title={lightbox.nome}
          description={lightbox.observacao}
          kind={lightbox.kind}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}
