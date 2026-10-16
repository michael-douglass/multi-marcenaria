import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, FolderKanban, History, Layers } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatBRL } from '@/lib/orcamentos-ia/pricing'
import type { QuoteAnalysisRow, QuoteProjectRow } from '@/lib/orcamentos-ia/storage'
import { QUOTE_STATUS_LABEL, type QuoteAnalysisStatus } from '@/lib/orcamentos-ia/storage'

const FOLDER_PANEL_EXPANDED_KEY = 'orcamentos-ia:folder-panel-expanded'

export type FolderViewMode = 'consolidated' | 'history'

export interface ProjectFolderTabsProps {
  project: QuoteProjectRow
  batches: QuoteAnalysisRow[]
  activeAnalysisId: string
  viewMode: FolderViewMode
  onViewModeChange: (mode: FolderViewMode) => void
  onSelectBatch: (analysisId: string) => void
  className?: string
}

function batchLabel(row: QuoteAnalysisRow): string {
  const totals = row.totals && typeof row.totals === 'object' ? row.totals : {}
  if (typeof totals.batch_label === 'string' && totals.batch_label.trim()) {
    return `Págs. ${totals.batch_label}`
  }
  if (Array.isArray(totals.page_ranges) && totals.page_ranges.length) {
    return `Págs. ${totals.page_ranges[0]}…`
  }
  return `Lote ${row.id.slice(0, 8)}`
}

function ConsolidatedSummary({ project }: { project: QuoteProjectRow }) {
  const totals = project.totals && typeof project.totals === 'object' ? project.totals : {}
  const extraction =
    totals.consolidated_extraction && typeof totals.consolidated_extraction === 'object'
      ? (totals.consolidated_extraction as {
          environments?: Array<{ name?: string; modules?: unknown[] }>
        })
      : null
  const bom =
    totals.consolidated_bom && typeof totals.consolidated_bom === 'object'
      ? (totals.consolidated_bom as {
          sheets?: Array<{ label?: string; thickness_mm?: number; sheets?: number; area_m2?: number }>
          hardware?: Array<{ canonicalName?: string; quantity?: number }>
          notes?: string[]
        })
      : null
  const modules =
    typeof totals.modules === 'number'
      ? totals.modules
      : extraction?.environments?.reduce((n, e) => n + (e.modules?.length ?? 0), 0) ?? 0
  const environments =
    typeof totals.environments === 'number'
      ? totals.environments
      : extraction?.environments?.length ?? 0
  const sale = typeof totals.sale_price === 'number' ? totals.sale_price : null
  const cost = typeof totals.materials_cost === 'number' ? totals.materials_cost : null
  const modality =
    typeof totals.pricing_modality === 'string' ? totals.pricing_modality : null
  const mpcPct =
    typeof totals.mpc_margin_pct === 'number' ? totals.mpc_margin_pct : null
  const formula =
    typeof totals.pricing_formula === 'string' ? totals.pricing_formula : null
  const budgetedCount = Array.isArray(project.budgeted_pages)
    ? project.budgeted_pages.length
    : Array.isArray(totals.budgeted_pages)
      ? (totals.budgeted_pages as unknown[]).length
      : 0
  const pageTotal =
    typeof project.page_count === 'number' && project.page_count > 0
      ? project.page_count
      : null

  const sheetLines = Array.isArray(bom?.sheets) ? bom.sheets : []
  const hardwareLines = Array.isArray(bom?.hardware) ? bom.hardware : []
  const totalSheets = sheetLines.reduce((s, x) => s + (Number(x.sheets) || 0), 0)

  return (
    <div className="space-y-3 rounded-xl border border-[#0066FF]/20 bg-white/80 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{project.name}</p>
          <p className="text-xs text-muted-foreground">
            Orçamento consolidado — BOM da pasta com preço MPC unificado.
          </p>
        </div>
        {sale != null && sale > 0 ? (
          <div className="text-right">
            <p className="text-sm font-semibold text-[#0066FF]">{formatBRL(sale)}</p>
            {formula ? (
              <p className="text-[10px] text-muted-foreground">{formula}</p>
            ) : modality === 'mpc_margin' && mpcPct != null ? (
              <p className="text-[10px] text-muted-foreground">MPC {mpcPct}%</p>
            ) : null}
          </div>
        ) : null}
      </div>
      {pageTotal != null && budgetedCount < pageTotal ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Projeto parcial: {budgetedCount}/{pageTotal} páginas orçadas. Ambientes das páginas
          restantes entram em outros lotes — isso não é erro de cobertura.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2 text-xs">
        {pageTotal != null ? (
          <Badge variant="outline" className="border-[#0066FF]/40 text-[#0066FF]">
            Páginas {budgetedCount}/{pageTotal} orçadas
          </Badge>
        ) : budgetedCount > 0 ? (
          <Badge variant="outline" className="border-[#0066FF]/40 text-[#0066FF]">
            {budgetedCount} página(s) orçada(s)
          </Badge>
        ) : null}
        <Badge variant="secondary">{environments} ambiente(s)</Badge>
        <Badge variant="secondary">{modules} módulo(s)</Badge>
        {cost != null && cost > 0 ? (
          <Badge variant="outline">Materiais {formatBRL(cost)}</Badge>
        ) : null}
        {totalSheets > 0 ? (
          <Badge variant="outline">{totalSheets} chapa(s)</Badge>
        ) : null}
        {hardwareLines.length > 0 ? (
          <Badge variant="outline">{hardwareLines.length} ferragem(ns)</Badge>
        ) : null}
      </div>

      {sheetLines.length > 0 || hardwareLines.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {sheetLines.length > 0 ? (
            <div className="rounded-lg border border-border/60 px-3 py-2">
              <p className="mb-1.5 text-xs font-semibold text-foreground">
                Chapas — SKU × qtd ({sheetLines.length} SKU{sheetLines.length === 1 ? '' : 's'})
              </p>
              <div className="max-h-48 overflow-auto">
                <table className="w-full text-left text-xs text-muted-foreground">
                  <thead className="sticky top-0 bg-white/95 text-[10px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="py-1 pr-2 font-medium">SKU</th>
                      <th className="py-1 px-1 font-medium tabular-nums">mm</th>
                      <th className="py-1 px-1 font-medium tabular-nums">un.</th>
                      <th className="py-1 pl-1 font-medium tabular-nums">m²</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...sheetLines]
                      .sort((a, b) => (Number(b.sheets) || 0) - (Number(a.sheets) || 0))
                      .map((s, i) => (
                        <tr
                          key={`${s.label || 'chapa'}-${s.thickness_mm || 0}-${i}`}
                          className="border-t border-border/40"
                        >
                          <td className="max-w-[10rem] truncate py-1 pr-2 text-foreground">
                            {s.label || 'Chapa'}
                          </td>
                          <td className="py-1 px-1 tabular-nums">
                            {s.thickness_mm != null ? s.thickness_mm : '—'}
                          </td>
                          <td className="py-1 px-1 tabular-nums font-medium text-foreground">
                            {Number(s.sheets) || 0}
                          </td>
                          <td className="py-1 pl-1 tabular-nums">
                            {typeof s.area_m2 === 'number' ? s.area_m2.toFixed(2) : '—'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
          {hardwareLines.length > 0 ? (
            <div className="rounded-lg border border-border/60 px-3 py-2">
              <p className="mb-1.5 text-xs font-semibold text-foreground">Ferragens (BOM)</p>
              <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                {hardwareLines.map((h, i) => (
                  <li
                    key={`${h.canonicalName || 'ferragem'}-${i}`}
                    className="flex justify-between gap-2"
                  >
                    <span className="truncate">{h.canonicalName || 'Ferragem'}</span>
                    <span className="shrink-0 tabular-nums">{Number(h.quantity) || 0} un.</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {extraction?.environments?.length ? (
        <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
          {extraction.environments.map((env, i) => (
            <li key={`${env.name || 'env'}-${i}`} className="rounded-lg border border-border/60 px-3 py-2">
              <p className="font-medium">{env.name || 'Ambiente'}</p>
              <p className="text-xs text-muted-foreground">
                {env.modules?.length ?? 0} módulo(s)
                {Array.isArray(env.modules) && env.modules.length
                  ? ` — ${env.modules
                      .slice(0, 4)
                      .map((m) =>
                        m && typeof m === 'object' && 'name' in m
                          ? String((m as { name?: string }).name || 'módulo')
                          : 'módulo',
                      )
                      .join(', ')}${env.modules.length > 4 ? '…' : ''}`
                  : ''}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          Ainda não há snapshot consolidado. Conclua pelo menos um lote para ver a união aqui.
        </p>
      )}
    </div>
  )
}

function compactSale(project: QuoteProjectRow): number | null {
  const totals = project.totals && typeof project.totals === 'object' ? project.totals : {}
  const sale = typeof totals.sale_price === 'number' ? totals.sale_price : null
  return sale != null && sale > 0 ? sale : null
}

export function ProjectFolderTabs({
  project,
  batches,
  activeAnalysisId,
  viewMode,
  onViewModeChange,
  onSelectBatch,
  className,
}: ProjectFolderTabsProps) {
  // Começa minimizado para não cobrir PDF/materiais; lembrar escolha na sessão.
  const [expanded, setExpanded] = useState(() => {
    try {
      return sessionStorage.getItem(FOLDER_PANEL_EXPANDED_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      sessionStorage.setItem(FOLDER_PANEL_EXPANDED_KEY, expanded ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [expanded])

  const sale = compactSale(project)
  const activeBatch = batches.find((b) => b.id === activeAnalysisId)

  return (
    <Tabs
      value={viewMode}
      onValueChange={(v) => onViewModeChange(v === 'history' ? 'history' : 'consolidated')}
      className={cn('shrink-0', className)}
    >
      <div className="flex flex-wrap items-stretch gap-2">
        <TabsList className="grid h-auto min-w-0 flex-1 grid-cols-2 gap-1 bg-slate-100/90 p-1">
          <TabsTrigger
            value="consolidated"
            className="gap-1.5 data-[state=active]:bg-white data-[state=active]:text-[#0066FF]"
            onClick={() => {
              if (!expanded) setExpanded(true)
            }}
          >
            <Layers className="h-3.5 w-3.5" />
            <span className="truncate">Orçamento consolidado do projeto</span>
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="gap-1.5 data-[state=active]:bg-white data-[state=active]:text-[#0066FF]"
            onClick={() => {
              if (!expanded) setExpanded(true)
            }}
          >
            <History className="h-3.5 w-3.5" />
            <span className="truncate">Histórico por lote de páginas</span>
          </TabsTrigger>
        </TabsList>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-auto shrink-0 gap-1.5 border-[#0066FF]/30 px-3 py-2 text-[#0066FF] hover:bg-[#0066FF]/5"
          aria-expanded={expanded}
          aria-label={expanded ? 'Minimizar painel da pasta' : 'Expandir painel da pasta'}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <>
              <ChevronUp className="h-4 w-4" />
              <span className="hidden sm:inline">Minimizar</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              <span className="hidden sm:inline">Expandir</span>
            </>
          )}
        </Button>
      </div>

      {!expanded ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#0066FF]/15 bg-white/70 px-3 py-2 text-xs text-muted-foreground">
          <span className="min-w-0 truncate">
            {viewMode === 'consolidated'
              ? `${project.name} · painel minimizado`
              : activeBatch
                ? `${batchLabel(activeBatch)} · ${QUOTE_STATUS_LABEL[activeBatch.status as QuoteAnalysisStatus] ?? activeBatch.status}`
                : 'Histórico · painel minimizado'}
          </span>
          {sale != null ? (
            <span className="shrink-0 font-semibold tabular-nums text-[#0066FF]">
              {formatBRL(sale)}
            </span>
          ) : null}
        </div>
      ) : null}

      {expanded ? (
        <>
          <TabsContent value="consolidated" className="mt-2 focus-visible:outline-none">
            <ConsolidatedSummary project={project} />
          </TabsContent>

          <TabsContent value="history" className="mt-2 focus-visible:outline-none">
            <div className="rounded-xl border border-border/70 bg-white/80 p-2 sm:p-3">
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <FolderKanban className="h-3.5 w-3.5 text-[#0066FF]" />
                Escolha um lote para inspecionar o que saiu naquele intervalo de páginas.
              </div>
              <ul className="flex max-h-40 flex-col gap-1.5 overflow-y-auto sm:max-h-48">
                {batches.map((row) => {
                  const active = row.id === activeAnalysisId
                  const status = row.status as QuoteAnalysisStatus
                  return (
                    <li key={row.id}>
                      <Button
                        type="button"
                        variant={active ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          'h-auto w-full justify-between gap-2 px-3 py-2 text-left',
                          active && 'bg-[#0066FF] hover:bg-[#0052cc]',
                        )}
                        onClick={() => onSelectBatch(row.id)}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold">
                            {batchLabel(row)}
                          </span>
                          <span
                            className={cn(
                              'block truncate text-[10px]',
                              active ? 'text-white/80' : 'text-muted-foreground',
                            )}
                          >
                            {QUOTE_STATUS_LABEL[status] ?? status}
                          </span>
                        </span>
                        <Badge
                          variant="secondary"
                          className={cn(
                            'shrink-0 text-[10px]',
                            active && 'bg-white/20 text-white',
                          )}
                        >
                          {row.mode === 'max' ? 'Max' : 'Pro'}
                        </Badge>
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </div>
          </TabsContent>
        </>
      ) : null}
    </Tabs>
  )
}
