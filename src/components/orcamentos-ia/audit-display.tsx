import { useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronRight, CircleAlert, EyeOff, PackageSearch, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { CoverageReport } from '@/lib/orcamentos-ia/merge-extraction'
import type { QuoteMaterialRow } from '@/lib/orcamentos-ia/quote-tree'
import {
  DEFAULT_SHEET_LOSS_PCT,
  isSuggestedPriceNote,
  formatBRL,
  materialLineCost,
} from '@/lib/orcamentos-ia/pricing'
import { isCuttingListNote } from '@/lib/orcamentos-ia/module-sheet-pricing'

/**
 * Apresentação do Audit Workspace em linguagem de marceneiro/cliente:
 * sem jargão de pipeline ("contingência", "cobertura", "exato × compra").
 * Paleta Bourbon Daylight (tinta mogno + dourado); azul #0066FF só para seleção.
 */

const INK = 'text-[#2a1812]'
const INK_SOFT = 'text-[#6b5244]'
const INK_MUTED = 'text-[#8a7060]'

const UNIT_LABEL: Record<string, [string, string]> = {
  m2: ['m²', 'm²'],
  'm²': ['m²', 'm²'],
  m: ['metro', 'metros'],
  un: ['unidade', 'unidades'],
  barra: ['barra de 3 m', 'barras de 3 m'],
  chapa: ['chapa', 'chapas'],
  par: ['par', 'pares'],
  kg: ['kg', 'kg'],
}

const number = (value: number, digits = 2) =>
  value.toLocaleString('pt-BR', { maximumFractionDigits: digits })

/** "0,48 m²", "12 unidades", "14,9 metros". */
export function formatQuantity(qty: number, unit: string | null | undefined): string {
  const [one, many] = UNIT_LABEL[unit ?? ''] ?? [unit || 'un', unit || 'un']
  const label = unit === 'm2' || unit === 'm²' || unit === 'kg' ? one : qty === 1 ? one : many
  return `${number(qty)} ${label}`
}

/** "por m²", "por metro", "por unidade". */
export function perUnitLabel(unit: string | null | undefined): string {
  const [one] = UNIT_LABEL[unit ?? ''] ?? [unit || 'unidade']
  return `por ${one}`
}

export interface MaterialDisplay {
  /** "Lateral" (peça) ou o próprio insumo quando não há peça. */
  title: string
  /** "MDF Arauco Lino" — material da peça. */
  material: string | null
  /** "550 × 700 mm · 2 peças" */
  detail: string | null
  estimatedSize: boolean
  quantity: string
  total: number
  priceStatus: 'ok' | 'suggested' | 'market'
}

export function describeMaterial(mat: QuoteMaterialRow): MaterialDisplay {
  const [piece, material] = mat.raw_name.includes('—')
    ? mat.raw_name.split('—').map((s) => s.trim())
    : [mat.raw_name, null]
  const notes = mat.notes ?? ''
  const dims = notes.match(/(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)x\d+(?:\.\d+)?mm(?: × (\d+(?:\.\d+)?))?/)
  const pieces = dims?.[3] ? Number(dims[3]) : null
  const detail = dims
    ? `${number(Number(dims[1]), 0)} × ${number(Number(dims[2]), 0)} mm${
        pieces ? ` · ${number(pieces, 0)} ${pieces === 1 ? 'peça' : 'peças'}` : ''
      }`
    : null
  const pendingPrice =
    !isCuttingListNote(notes) && mat.using_market_price && !mat.market_price_confirmed
  const cutting = isCuttingListNote(notes)
  return {
    title: piece,
    material,
    detail: cutting ? [detail, 'lista de corte'].filter(Boolean).join(' · ') : detail,
    estimatedSize: /medida estimada/.test(notes),
    quantity: formatQuantity(Number(mat.exact_quantity) || 0, mat.unit_measure),
    total: materialLineCost(mat, DEFAULT_SHEET_LOSS_PCT),
    priceStatus: cutting
      ? 'ok'
      : !pendingPrice
        ? 'ok'
        : isSuggestedPriceNote(notes)
          ? 'suggested'
          : 'market',
  }
}

/** Linha de insumo: nome da peça, material, medida, quantidade e total em R$. */
export function MaterialRow({
  mat,
  selected,
  onSelect,
  onEdit,
  onConfirmPrice,
}: {
  mat: QuoteMaterialRow
  selected: boolean
  onSelect: () => void
  onEdit: () => void
  onConfirmPrice: () => void
}) {
  const d = describeMaterial(mat)
  return (
    <div
      className={cn(
        'group rounded-lg border border-transparent transition-colors',
        selected ? 'border-[#0066FF]/35 bg-[#0066FF]/[0.06]' : 'hover:bg-[#8d5e22]/[0.05]',
      )}
    >
      <div className="flex items-start gap-2 px-2.5 py-2">
        <button
          type="button"
          onClick={onSelect}
          onDoubleClick={onEdit}
          title="Clique para ver na planta"
          className="min-w-0 flex-1 text-left"
        >
          <p className={cn('truncate text-[13px] font-semibold leading-tight', INK)}>{d.title}</p>
          {(d.material || d.detail) && (
            <p className={cn('mt-0.5 truncate text-[11.5px] leading-snug', INK_SOFT)}>
              {[d.material, d.detail].filter(Boolean).join(' · ')}
              {d.estimatedSize && (
                <span className="ml-1.5 rounded-sm bg-[#8d5e22]/10 px-1 py-px text-[10px] font-medium text-[#8d5e22]">
                  medida aproximada
                </span>
              )}
            </p>
          )}
        </button>
        <div className="shrink-0 text-right">
          {d.total > 0 ? (
            <p className={cn('text-[13px] font-semibold tabular-nums leading-tight', INK)}>
              {formatBRL(d.total)}
            </p>
          ) : (
            <p className={cn('text-[11px] leading-tight', INK_MUTED)}>sem custo</p>
          )}
          <p className={cn('mt-0.5 text-[11px] tabular-nums', INK_MUTED)}>{d.quantity}</p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Editar ${d.title}`}
          title="Editar quantidade ou preço"
          className="mt-0.5 rounded-md p-1 text-[#8a7060] opacity-60 transition hover:bg-[#8d5e22]/10 hover:text-[#8d5e22] hover:opacity-100 group-hover:opacity-100"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
      {d.priceStatus !== 'ok' && (
        <PriceHint mat={mat} status={d.priceStatus} onConfirm={onConfirmPrice} onEdit={onEdit} />
      )}
    </div>
  )
}

/** Linha compacta de preço a conferir (a explicação completa fica em `PriceReviewBanner`). */
function PriceHint({
  mat,
  status,
  onConfirm,
  onEdit,
}: {
  mat: QuoteMaterialRow
  status: 'suggested' | 'market'
  onConfirm: () => void
  onEdit: () => void
}) {
  const price = `${formatBRL(Number(mat.unit_price) || 0)} ${perUnitLabel(mat.unit_measure)}`
  return (
    <div className="mx-2.5 mb-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-md border border-[#c4963a]/35 bg-[#fbf3e3] px-2.5 py-1.5">
      <CircleAlert className="h-3.5 w-3.5 shrink-0 text-[#a8741f]" />
      <p className="min-w-0 flex-1 text-[11.5px] leading-snug text-[#5c3d16]">
        {status === 'suggested' ? 'Preço médio' : 'Preço de mercado'}:{' '}
        <strong className="font-semibold tabular-nums">{price}</strong>
        <span className="text-[#7a5a30]"> · confira</span>
      </p>
      <div className="flex gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-6 gap-1 border-[#8d5e22]/30 bg-white/70 px-2 text-[11px] text-[#5c3d16] hover:bg-white"
          onClick={onConfirm}
        >
          <Check className="h-3 w-3" />
          Está certo
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-6 bg-[#2a1812] px-2 text-[11px] text-[#fffcf8] hover:bg-[#3d251b]"
          onClick={onEdit}
        >
          Meu preço
        </Button>
      </div>
    </div>
  )
}

/**
 * Explica UMA vez por que alguns itens têm "preço médio" e o que fazer —
 * em vez de repetir o parágrafo em cada linha.
 */
export function PriceReviewBanner({ materials }: { materials: QuoteMaterialRow[] }) {
  const pending = materials.filter((m) => describeMaterial(m).priceStatus !== 'ok')
  if (!pending.length) return null
  const names = [
    ...new Set(pending.map((m) => describeMaterial(m).material ?? describeMaterial(m).title)),
  ]
  return (
    <div className="mt-2 rounded-xl border border-[#c4963a]/40 bg-[#fbf3e3] p-3">
      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#5c3d16]">
        <CircleAlert className="h-4 w-4 text-[#a8741f]" />
        {pending.length} {pending.length === 1 ? 'item com preço' : 'itens com preço'} para conferir
      </p>
      <p className="mt-1 text-[11.5px] leading-relaxed text-[#6b4a1c]">
        Estes materiais não estão cadastrados no seu estoque, então o sistema usou um{' '}
        <strong className="font-semibold">preço médio de mercado</strong> para não deixar o valor
        zerado. Confira cada um ou cadastre o material em “Tabela de Preços &amp; Estoque” para
        usar o seu preço nos próximos orçamentos.
      </p>
      <p className="mt-1.5 text-[11px] text-[#7a5a30]">
        <span className="font-medium">Materiais:</span> {names.slice(0, 6).join(', ')}
        {names.length > 6 ? ` e mais ${names.length - 6}` : ''}
      </p>
    </div>
  )
}

/** Agrupa "Ambiente → Móvel" por ambiente (evita repetir o nome do ambiente em cada linha). */
function groupByEnvironment(items: Array<{ environment: string; module: string }>) {
  const map = new Map<string, string[]>()
  for (const { environment, module } of items) {
    const list = map.get(environment) ?? []
    if (!list.includes(module)) list.push(module)
    map.set(environment, list)
  }
  return [...map.entries()]
}

const COVERAGE_SUMMARY_HIDDEN_KEY = 'orcamentos-ia-coverage-summary-hidden'

function readCoverageHidden(): boolean {
  try {
    return localStorage.getItem(COVERAGE_SUMMARY_HIDDEN_KEY) === '1'
  } catch {
    return false
  }
}

/** "Conferência do projeto": quantos móveis do projeto entraram no orçamento. */
export function CoverageSummary({ coverage }: { coverage: CoverageReport }) {
  const [hidden, setHidden] = useState(readCoverageHidden)
  const [showFound, setShowFound] = useState(false)
  const expected = coverage.expectedCount || coverage.extracted.length
  const found = coverage.expectedCount ? coverage.coveredCount : coverage.extracted.length
  const pct = expected ? Math.round((found / expected) * 100) : 100
  const missing = useMemo(() => groupByEnvironment(coverage.missing ?? []), [coverage.missing])
  const extracted = useMemo(() => groupByEnvironment(coverage.extracted ?? []), [coverage.extracted])
  const complete = missing.length === 0

  const setHiddenPersist = (next: boolean) => {
    setHidden(next)
    try {
      localStorage.setItem(COVERAGE_SUMMARY_HIDDEN_KEY, next ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  if (hidden) {
    return (
      <button
        type="button"
        onClick={() => setHiddenPersist(false)}
        className="mt-3 flex w-full items-center justify-between gap-2 rounded-xl border border-[#8d5e22]/15 bg-[#fffcf8] px-3 py-2 text-left transition hover:bg-[#fff8f0]"
        title="Mostrar conferência do projeto"
      >
        <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-[#8d5e22]">
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.04em' }}>
            Conferência do projeto
          </span>
          <span className={cn('truncate text-[11px] tabular-nums', INK_MUTED)}>
            · {found}/{expected} móveis
          </span>
        </span>
        <span className="shrink-0 text-[11px] font-medium text-[#8d5e22]">Mostrar</span>
      </button>
    )
  }

  return (
    <div className="mt-3 rounded-xl border border-[#8d5e22]/15 bg-[#fffcf8] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p
              className="text-[15px] tracking-[0.06em] text-[#8d5e22]"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              Conferência do projeto
            </p>
            <p className={cn('text-[12px] tabular-nums', INK_SOFT)}>
              <strong className={cn('font-semibold', INK)}>{found}</strong> de {expected}{' '}
              {expected === 1 ? 'móvel encontrado' : 'móveis encontrados'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setHiddenPersist(true)}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-[#8d5e22] hover:bg-[#8d5e22]/10"
          title="Ocultar conferência do projeto"
          aria-label="Ocultar conferência do projeto"
        >
          <EyeOff className="h-3.5 w-3.5" />
          Ocultar
        </button>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#8d5e22]/10">
        <div
          className={cn('h-full rounded-full', complete ? 'bg-[#4f7a4a]' : 'bg-[#c4963a]')}
          style={{ width: `${pct}%` }}
        />
      </div>

      {complete ? (
        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-[#3f6a3a]">
          <Check className="h-3.5 w-3.5" />
          Todos os móveis do projeto estão no orçamento.
        </p>
      ) : (
        <div className="mt-2.5">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#8a4b12]">
            <PackageSearch className="h-3.5 w-3.5" />
            Não encontramos no orçamento:
          </p>
          <ModuleChips groups={missing} tone="missing" />
          <p className={cn('mt-1.5 text-[11px]', INK_MUTED)}>
            Confira na planta e, se precisar, clique em “Reprocessar PDF”.
          </p>
        </div>
      )}

      {extracted.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowFound((v) => !v)}
            className="mt-2.5 flex items-center gap-1 text-[11.5px] font-medium text-[#8d5e22] hover:underline"
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !showFound && '-rotate-90')} />
            {showFound ? 'Esconder móveis encontrados' : 'Ver móveis encontrados'}
          </button>
          {showFound && <ModuleChips groups={extracted} tone="found" />}
        </>
      )}
    </div>
  )
}

function ModuleChips({
  groups,
  tone,
}: {
  groups: Array<[string, string[]]>
  tone: 'missing' | 'found'
}) {
  const showEnvNames = groups.length > 1
  return (
    <div className="mt-1.5 space-y-1.5">
      {groups.map(([env, modules]) => (
        <div key={env}>
          {showEnvNames && <p className={cn('mb-1 text-[11px] font-medium', INK_MUTED)}>{env}</p>}
          <div className="flex flex-wrap gap-1">
            {modules.map((m) => (
              <span
                key={m}
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[11.5px]',
                  tone === 'missing'
                    ? 'border-[#c4963a]/45 bg-[#fbf3e3] text-[#5c3d16]'
                    : 'border-[#2a1812]/10 bg-[#f8f4ee] text-[#4a3228]',
                )}
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
