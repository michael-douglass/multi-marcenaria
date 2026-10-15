import { FolderKanban, History, Layers } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatBRL } from '@/lib/orcamentos-ia/pricing'
import type { QuoteAnalysisRow, QuoteProjectRow } from '@/lib/orcamentos-ia/storage'
import { QUOTE_STATUS_LABEL, type QuoteAnalysisStatus } from '@/lib/orcamentos-ia/storage'

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
        <div className="grid gap-3 sm:grid-cols-2">
          {sheetLines.length > 0 ? (
            <div className="rounded-lg border border-border/60 px-3 py-2">
              <p className="mb-1.5 text-xs font-semibold text-foreground">Chapas (BOM)</p>
              <ul className="max-h-36 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                {sheetLines.slice(0, 12).map((s, i) => (
                  <li key={`${s.label || 'chapa'}-${i}`} className="flex justify-between gap-2">
                    <span className="truncate">
                      {s.label || 'Chapa'}
                      {s.thickness_mm ? ` ${s.thickness_mm}mm` : ''}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {Number(s.sheets) || 0} un.
                      {typeof s.area_m2 === 'number' ? ` · ${s.area_m2} m²` : ''}
                    </span>
                  </li>
                ))}
                {sheetLines.length > 12 ? (
                  <li className="text-[10px]">+{sheetLines.length - 12} SKU(s)…</li>
                ) : null}
              </ul>
            </div>
          ) : null}
          {hardwareLines.length > 0 ? (
            <div className="rounded-lg border border-border/60 px-3 py-2">
              <p className="mb-1.5 text-xs font-semibold text-foreground">Ferragens (BOM)</p>
              <ul className="max-h-36 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                {hardwareLines.slice(0, 12).map((h, i) => (
                  <li
                    key={`${h.canonicalName || 'ferragem'}-${i}`}
                    className="flex justify-between gap-2"
                  >
                    <span className="truncate">{h.canonicalName || 'Ferragem'}</span>
                    <span className="shrink-0 tabular-nums">{Number(h.quantity) || 0} un.</span>
                  </li>
                ))}
                {hardwareLines.length > 12 ? (
                  <li className="text-[10px]">+{hardwareLines.length - 12} linha(s)…</li>
                ) : null}
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

export function ProjectFolderTabs({
  project,
  batches,
  activeAnalysisId,
  viewMode,
  onViewModeChange,
  onSelectBatch,
  className,
}: ProjectFolderTabsProps) {
  return (
    <Tabs
      value={viewMode}
      onValueChange={(v) => onViewModeChange(v === 'history' ? 'history' : 'consolidated')}
      className={cn('shrink-0', className)}
    >
      <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-slate-100/90 p-1">
        <TabsTrigger
          value="consolidated"
          className="gap-1.5 data-[state=active]:bg-white data-[state=active]:text-[#0066FF]"
        >
          <Layers className="h-3.5 w-3.5" />
          <span className="truncate">Orçamento consolidado do projeto</span>
        </TabsTrigger>
        <TabsTrigger
          value="history"
          className="gap-1.5 data-[state=active]:bg-white data-[state=active]:text-[#0066FF]"
        >
          <History className="h-3.5 w-3.5" />
          <span className="truncate">Histórico por lote de páginas</span>
        </TabsTrigger>
      </TabsList>

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
                      <span className="block truncate text-xs font-semibold">{batchLabel(row)}</span>
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
    </Tabs>
  )
}
