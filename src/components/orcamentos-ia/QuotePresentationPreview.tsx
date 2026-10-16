import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Expand,
  ImagePlus,
  Upload,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  formatBRL,
  recomputePresentationTotals,
  type QuotePageImage,
  type QuotePresentationLayout,
} from '@/lib/orcamentos-ia/quote-presentation'
import { CORTE_CLAUDE_TOKENS } from '@/lib/orcamentos-ia/ui-tokens'

interface QuotePresentationPreviewProps {
  layout: QuotePresentationLayout
  onChange?: (next: QuotePresentationLayout) => void
  pageImages?: QuotePageImage[]
  /** Quando true, nomes/preços/fotos são editáveis na própria prévia. */
  editable?: boolean
  /** Completa (fotos) ou só lista de preços. */
  viewMode?: 'full' | 'priceList'
  className?: string
}

type ImageTarget =
  | { kind: 'env'; envId: string }
  | { kind: 'mod'; envId: string; modId: string }

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Falha ao ler a imagem.'))
    reader.readAsDataURL(file)
  })
}

const T = CORTE_CLAUDE_TOKENS

/**
 * Prévia WYSIWYG da proposta — edição direta no layout de impressão.
 */
export function QuotePresentationPreview({
  layout,
  onChange,
  pageImages = [],
  editable = false,
  viewMode = 'full',
  className,
}: QuotePresentationPreviewProps) {
  const [pickerFor, setPickerFor] = useState<ImageTarget | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const canEdit = Boolean(editable && onChange) && viewMode === 'full'

  const patch = (next: QuotePresentationLayout) => onChange?.(next)

  const updateEnvName = (envId: string, name: string) => {
    patch({
      ...layout,
      environments: layout.environments.map((e) =>
        e.id === envId ? { ...e, name } : e,
      ),
    })
  }

  const updateModName = (envId: string, modId: string, name: string) => {
    patch({
      ...layout,
      environments: layout.environments.map((e) => {
        if (e.id !== envId) return e
        return {
          ...e,
          modules: e.modules.map((m) => (m.id === modId ? { ...m, name } : m)),
        }
      }),
    })
  }

  const updateModPrice = (envId: string, modId: string, raw: string) => {
    const value = Number(String(raw).replace(',', '.'))
    const safe = Number.isFinite(value) && value >= 0 ? value : 0
    const environments = layout.environments.map((e) => {
      if (e.id !== envId) return e
      return {
        ...e,
        modules: e.modules.map((m) =>
          m.id === modId ? { ...m, salePrice: safe } : m,
        ),
      }
    })
    patch(recomputePresentationTotals({ ...layout, environments }))
  }

  const updateTitle = (projectTitle: string) => {
    patch({ ...layout, projectTitle })
  }

  const applyImage = (url: string) => {
    if (!pickerFor || !onChange) return
    let environments = layout.environments.map((env) => ({
      ...env,
      modules: [...env.modules],
    }))
    if (pickerFor.kind === 'env') {
      environments = environments.map((env) =>
        env.id === pickerFor.envId ? { ...env, imageUrl: url } : env,
      )
    } else {
      environments = environments.map((env) => {
        if (env.id !== pickerFor.envId) return env
        return {
          ...env,
          modules: env.modules.map((m) =>
            m.id === pickerFor.modId ? { ...m, imageUrl: url } : m,
          ),
        }
      })
    }
    patch({ ...layout, environments })
    setPickerFor(null)
  }

  const openUpload = (target: ImageTarget) => {
    setPickerFor(target)
    queueMicrotask(() => fileRef.current?.click())
  }

  const { branding, pricing } = layout
  const legalBits = [branding.razaoSocial, branding.cnpj ? `CNPJ ${branding.cnpj}` : null]
    .filter(Boolean)
    .join(' · ')

  if (viewMode === 'priceList') {
    return (
      <div
        className={cn(
          'max-h-[72vh] overflow-y-auto rounded-xl border border-slate-200/80 bg-[#f4f1ec] p-2 sm:p-3',
          className,
        )}
        style={{ fontFamily: 'Raleway, sans-serif' }}
      >
        <p className="mb-2 px-1 text-[11px] text-slate-600">
          Prévia da lista de preços (sem fotos). Use Exportar → lista de preços para baixar.
        </p>
        <article
          className="mx-auto max-w-[794px] overflow-hidden rounded-lg bg-white shadow-sm"
          style={{ color: T.ink }}
        >
          <header
            className="border-b-[3px] px-6 py-5 sm:px-8"
            style={{
              borderColor: T.accent,
              background:
                'linear-gradient(135deg, rgba(0,102,255,0.09) 0%, transparent 42%), linear-gradient(180deg, #f8fafc 0%, #fff 70%)',
            }}
          >
            <div className="mb-3 flex items-center gap-3">
              {branding.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt=""
                  className="max-h-12 max-w-[120px] object-contain"
                />
              ) : null}
              <div>
                <div className="text-base font-bold">{branding.companyName}</div>
                {legalBits ? (
                  <div className="text-xs" style={{ color: T.muted }}>
                    {legalBits}
                  </div>
                ) : null}
              </div>
            </div>
            <p
              className="text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{ color: T.accent }}
            >
              Lista de preços · Corte Claude
            </p>
            <h1 className="mt-1 text-xl font-bold">{layout.projectTitle}</h1>
            <p className="mt-1 text-xs" style={{ color: T.muted }}>
              Gerado em {layout.generatedAtLabel}
            </p>
            <div
              className="mt-3 inline-block rounded-[10px] px-3 py-2"
              style={{
                border: '1px solid rgba(0,102,255,0.4)',
                background:
                  'linear-gradient(135deg, rgba(0,102,255,0.1), rgba(0,102,255,0.03))',
              }}
            >
              <div className="text-[10px] uppercase tracking-wider" style={{ color: T.muted }}>
                Total da proposta
              </div>
              <div className="text-2xl font-bold tabular-nums" style={{ color: T.accent }}>
                {formatBRL(pricing.salePrice)}
              </div>
            </div>
          </header>
          {layout.environments.map((env) => {
            const mods = env.modules.filter((m) => !m.outOfScope)
            if (!mods.length) return null
            return (
              <section key={env.id} className="border-t border-slate-100 px-6 py-4 sm:px-8">
                <div className="mb-2 flex items-baseline justify-between gap-2 border-b border-[#0066FF]/25 pb-1.5">
                  <h2 className="text-sm font-bold">{env.name}</h2>
                  <span className="text-sm font-bold tabular-nums" style={{ color: T.accent }}>
                    {formatBRL(env.salePrice)}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {mods.map((mod) => (
                    <li
                      key={mod.id}
                      className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-1.5 text-sm"
                    >
                      <span className="min-w-0 truncate">{mod.name}</span>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {formatBRL(mod.salePrice)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
          <footer className="border-t border-slate-100 px-6 py-3 text-center text-xs font-bold tracking-wide">
            Garbo orçamentos
          </footer>
        </article>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'max-h-[72vh] overflow-y-auto rounded-xl border border-slate-200/80 bg-[#f4f1ec] p-2 sm:p-3',
        className,
      )}
      style={{ fontFamily: 'Raleway, sans-serif' }}
    >
      {canEdit && (
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file || !pickerFor) return
            void readFileAsDataUrl(file).then(applyImage).catch(() => setPickerFor(null))
          }}
        />
      )}

      {canEdit && (
        <p className="mb-2 px-1 text-[11px] text-slate-600">
          Clique nos nomes e preços para editar. Clique na foto para trocar a imagem.
        </p>
      )}

      <article
        className="mx-auto max-w-[794px] overflow-hidden rounded-lg bg-white shadow-sm"
        style={{ color: T.ink }}
      >
        {/* Capa */}
        <header
          className="relative overflow-hidden border-b-[3px] px-6 py-6 sm:px-8"
          style={{
            borderColor: T.accent,
            background:
              'linear-gradient(135deg, rgba(0,102,255,0.09) 0%, transparent 42%), linear-gradient(180deg, #f8fafc 0%, #fff 70%)',
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-35"
            style={{
              backgroundImage:
                'linear-gradient(rgba(0,102,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(0,102,255,0.07) 1px, transparent 1px)',
              backgroundSize: '14px 14px',
              maskImage: 'linear-gradient(180deg, #000 0%, transparent 75%)',
            }}
          />
          <div className="relative z-[1] mb-4 flex items-center gap-3.5">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt=""
                className="max-h-14 max-w-[130px] object-contain"
              />
            ) : null}
            <div>
              <div className="text-lg font-bold tracking-wide">{branding.companyName}</div>
              {legalBits ? (
                <div className="mt-0.5 text-xs" style={{ color: T.muted }}>
                  {legalBits}
                </div>
              ) : null}
            </div>
          </div>
          <p
            className="relative z-[1] mb-2 text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ color: T.accent }}
          >
            Proposta · Corte Claude
          </p>
          {canEdit ? (
            <Input
              className="relative z-[1] h-auto border-transparent bg-transparent px-0 text-xl font-bold shadow-none focus-visible:border-[#0066FF]/40 focus-visible:ring-[#0066FF]/20 sm:text-2xl"
              value={layout.projectTitle}
              onChange={(e) => updateTitle(e.target.value)}
              aria-label="Título da proposta"
            />
          ) : (
            <h1 className="relative z-[1] text-xl font-bold leading-tight sm:text-2xl">
              {layout.projectTitle}
            </h1>
          )}
          <p className="relative z-[1] mt-2 text-xs" style={{ color: T.muted }}>
            Gerado em {layout.generatedAtLabel}
          </p>
          <div
            className="relative z-[1] mt-4 max-w-[300px] rounded-[10px] px-3.5 py-3"
            style={{
              border: '1px solid rgba(0,102,255,0.4)',
              background:
                'linear-gradient(135deg, rgba(0,102,255,0.1), rgba(0,102,255,0.03))',
            }}
          >
            <div
              className="text-[10px] uppercase tracking-wider"
              style={{ color: T.muted }}
            >
              Total da proposta
            </div>
            <div
              className="mt-1 text-2xl font-bold tabular-nums"
              style={{ color: T.accent }}
            >
              {formatBRL(pricing.salePrice)}
            </div>
          </div>
        </header>

        {layout.environments.map((env) => {
          const pickingEnv =
            pickerFor?.kind === 'env' && pickerFor.envId === env.id
          return (
            <section
              key={env.id}
              className="border-t border-slate-100 px-5 py-5 sm:px-8"
            >
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => canEdit && setPickerFor({ kind: 'env', envId: env.id })}
                className={cn(
                  'group relative mb-3 block w-full overflow-hidden rounded-xl border border-[#0066FF]/25 bg-slate-50 text-left',
                  canEdit && 'cursor-pointer hover:ring-2 hover:ring-[#0066FF]/35',
                )}
              >
                {env.imageUrl ? (
                  <img
                    src={env.imageUrl}
                    alt=""
                    className="h-[210px] w-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-[210px] items-center justify-center text-sm font-bold uppercase tracking-widest"
                    style={{ color: T.accent }}
                  >
                    Ambiente
                  </div>
                )}
                {canEdit && (
                  <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-white/95 px-2 py-1 text-[10px] font-semibold text-[#0066FF] opacity-90 shadow-sm group-hover:opacity-100">
                    <ImagePlus className="h-3 w-3" />
                    Trocar foto
                  </span>
                )}
              </button>

              {pickingEnv && canEdit && (
                <ImagePickerPanel
                  pageImages={pageImages}
                  onPick={applyImage}
                  onUpload={() => openUpload({ kind: 'env', envId: env.id })}
                  onCancel={() => setPickerFor(null)}
                />
              )}

              <div className="mb-3.5 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {canEdit ? (
                    <Input
                      className="h-9 border-transparent bg-transparent px-0 text-lg font-bold shadow-none focus-visible:border-[#0066FF]/40"
                      value={env.name}
                      onChange={(e) => updateEnvName(env.id, e.target.value)}
                      aria-label="Nome do ambiente"
                    />
                  ) : (
                    <h2 className="text-lg font-bold">{env.name}</h2>
                  )}
                  <p className="text-xs" style={{ color: T.muted }}>
                    {env.modules.length} móvel(is) nesta proposta
                  </p>
                </div>
                <div
                  className="shrink-0 text-right text-lg font-bold tabular-nums"
                  style={{ color: T.accent }}
                >
                  {formatBRL(env.salePrice)}
                </div>
              </div>

              <div className="space-y-3.5">
                {env.modules.map((mod) => {
                  const pickingMod =
                    pickerFor?.kind === 'mod' &&
                    pickerFor.envId === env.id &&
                    pickerFor.modId === mod.id
                  const chips = [
                    mod.dimensionsLabel,
                    mod.pageNumber != null ? `Pág. ${mod.pageNumber}` : null,
                    mod.sheetPieceCount > 0
                      ? `${Math.round(mod.sheetPieceCount)} peças`
                      : null,
                    mod.hardwareCount > 0
                      ? `${Math.round(mod.hardwareCount)} ferragens`
                      : null,
                  ].filter(Boolean) as string[]

                  return (
                    <article
                      key={mod.id}
                      className="overflow-hidden rounded-xl border border-slate-200/90 bg-[#fafaf8]"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-[188px_1fr_auto]">
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() =>
                            canEdit &&
                            setPickerFor({
                              kind: 'mod',
                              envId: env.id,
                              modId: mod.id,
                            })
                          }
                          className={cn(
                            'group relative block overflow-hidden bg-slate-100 text-left',
                            canEdit && 'cursor-pointer hover:ring-2 hover:ring-inset hover:ring-[#0066FF]/40',
                          )}
                        >
                          {mod.imageUrl ? (
                            <img
                              src={mod.imageUrl}
                              alt=""
                              className="h-44 w-full object-cover sm:h-[168px]"
                            />
                          ) : (
                            <div
                              className="flex h-44 items-center justify-center text-xs font-bold uppercase tracking-wider sm:h-[168px]"
                              style={{ color: T.accent }}
                            >
                              Foto
                            </div>
                          )}
                          {canEdit && (
                            <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded bg-white/95 px-1.5 py-0.5 text-[9px] font-semibold text-[#0066FF]">
                              <ImagePlus className="h-2.5 w-2.5" />
                              Foto
                            </span>
                          )}
                        </button>

                        <div className="flex min-w-0 flex-col justify-center gap-1.5 px-3.5 py-3">
                          {canEdit ? (
                            <Input
                              className="h-8 border-transparent bg-transparent px-0 text-sm font-bold shadow-none focus-visible:border-[#0066FF]/40"
                              value={mod.name}
                              onChange={(e) =>
                                updateModName(env.id, mod.id, e.target.value)
                              }
                              aria-label="Nome do móvel"
                            />
                          ) : (
                            <div className="text-sm font-bold leading-snug">{mod.name}</div>
                          )}
                          {chips.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {chips.map((chip) => (
                                <span
                                  key={chip}
                                  className="rounded-full border border-[#0066FF]/25 px-2 py-0.5 text-[10px] font-semibold"
                                  style={{
                                    color: T.inkSoft,
                                    background: 'rgba(0,102,255,0.06)',
                                  }}
                                >
                                  {chip}
                                </span>
                              ))}
                            </div>
                          )}
                          {mod.description ? (
                            <p className="text-[11px] leading-snug" style={{ color: T.muted }}>
                              {mod.description}
                            </p>
                          ) : null}
                          {mod.detailLines?.length > 0 ? (
                            <p
                              className="text-[11px] leading-snug"
                              style={{ color: T.inkSoft }}
                            >
                              {mod.detailLines.join(' · ')}
                            </p>
                          ) : null}
                        </div>

                        <div
                          className="flex flex-col items-start justify-center border-t border-slate-100 px-3.5 py-3 sm:items-end sm:border-t-0 sm:border-l sm:border-slate-100"
                          style={{
                            background:
                              'linear-gradient(180deg, rgba(0,102,255,0.04), transparent)',
                          }}
                        >
                          <span
                            className="text-[9px] uppercase tracking-wider"
                            style={{ color: T.muted }}
                          >
                            Preço
                          </span>
                          {canEdit ? (
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              className="mt-0.5 h-9 w-28 border-[#0066FF]/25 bg-white text-right text-base font-bold tabular-nums"
                              value={mod.salePrice}
                              onChange={(e) =>
                                updateModPrice(env.id, mod.id, e.target.value)
                              }
                              aria-label="Preço do móvel"
                            />
                          ) : (
                            <div className="mt-0.5 text-base font-bold tabular-nums">
                              {formatBRL(mod.salePrice)}
                            </div>
                          )}
                        </div>
                      </div>

                      {pickingMod && canEdit && (
                        <div className="border-t border-slate-200 p-2">
                          <ImagePickerPanel
                            pageImages={pageImages}
                            onPick={applyImage}
                            onUpload={() =>
                              openUpload({
                                kind: 'mod',
                                envId: env.id,
                                modId: mod.id,
                              })
                            }
                            onCancel={() => setPickerFor(null)}
                          />
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            </section>
          )
        })}

        {layout.outOfScopeModules.length > 0 && (
          <section className="border-t border-dashed border-slate-200 px-5 py-4 sm:px-8">
            <h3
              className="mb-2 text-xs font-bold uppercase tracking-wider"
              style={{ color: T.walnutSoft }}
            >
              Fora do orçamento de marcenaria
            </h3>
            <p className="text-xs leading-relaxed" style={{ color: T.muted }}>
              {layout.outOfScopeModules.map((m) => m.name).join(' · ')}
            </p>
          </section>
        )}

        <footer className="border-t border-slate-100 px-5 py-4 text-center text-sm font-bold tracking-wide sm:px-8">
          Garbo orçamentos
        </footer>
      </article>
    </div>
  )
}

function ImagePickerPanel({
  pageImages,
  onPick,
  onUpload,
  onCancel,
}: {
  pageImages: QuotePageImage[]
  onPick: (url: string) => void
  onUpload: () => void
  onCancel: () => void
}) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  return (
    <div className="rounded-lg border border-[#0066FF]/25 bg-[#f5f8ff] p-2">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-[#0066FF]">Escolha a imagem</p>
        <div className="flex gap-1.5">
          {pageImages.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 gap-1 px-2 text-[11px] border-[#0066FF]/40 text-[#0066FF]"
              onClick={() => setViewerIndex(0)}
            >
              <Expand className="h-3 w-3" />
              Tela cheia
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2 text-[11px]"
            onClick={onUpload}
          >
            <Upload className="h-3 w-3" />
            Enviar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={onCancel}
          >
            Fechar
          </Button>
        </div>
      </div>
      {pageImages.length === 0 ? (
        <p className="text-xs text-slate-600">
          Nenhuma página do PDF. Use “Enviar” para escolher uma foto.
        </p>
      ) : (
        <div className="grid max-h-48 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
          {pageImages.map((page, index) => (
            <button
              key={page.path}
              type="button"
              onClick={() => setViewerIndex(index)}
              className="group relative overflow-hidden rounded-md border border-slate-200 bg-white transition hover:border-[#0066FF] hover:ring-2 hover:ring-[#0066FF]/30"
              title={`Ver página ${page.index} em tela cheia`}
            >
              <img src={page.url} alt="" className="aspect-[4/3] w-full object-cover" />
              <span className="block px-1 py-0.5 text-center text-[10px] text-slate-600">
                pág. {page.index}
              </span>
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100">
                <Expand className="h-5 w-5 text-white drop-shadow" />
              </span>
            </button>
          ))}
        </div>
      )}

      {viewerIndex != null && pageImages.length > 0 && (
        <ImageFullscreenViewer
          pages={pageImages}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onSelect={(url) => {
            onPick(url)
            setViewerIndex(null)
          }}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </div>
  )
}

function ImageFullscreenViewer({
  pages,
  index,
  onIndexChange,
  onSelect,
  onClose,
}: {
  pages: QuotePageImage[]
  index: number
  onIndexChange: (index: number) => void
  onSelect: (url: string) => void
  onClose: () => void
}) {
  const safeIndex = Math.min(Math.max(0, index), pages.length - 1)
  const page = pages[safeIndex]
  const touchStartX = useRef<number | null>(null)
  const stripRef = useRef<HTMLDivElement>(null)

  const goPrev = () => onIndexChange(safeIndex <= 0 ? pages.length - 1 : safeIndex - 1)
  const goNext = () => onIndexChange(safeIndex >= pages.length - 1 ? 0 : safeIndex + 1)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        onIndexChange(safeIndex <= 0 ? pages.length - 1 : safeIndex - 1)
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        onIndexChange(safeIndex >= pages.length - 1 ? 0 : safeIndex + 1)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const current = pages[safeIndex]
        if (current) onSelect(current.url)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [safeIndex, pages, onClose, onSelect, onIndexChange])

  useEffect(() => {
    const el = stripRef.current?.querySelector(`[data-page-idx="${safeIndex}"]`)
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }
  }, [safeIndex])

  if (!page || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[500] flex flex-col bg-[#0b0f14]/92 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Selecionar imagem em tela cheia"
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5 sm:px-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">
            Página {page.index}
            <span className="ml-2 font-normal text-white/60">
              {safeIndex + 1} / {pages.length}
            </span>
          </p>
          <p className="text-[11px] text-white/50">
            Setas ou deslize para o lado · Enter para usar
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            className="gap-1.5 bg-[#0066FF] hover:bg-[#0052cc]"
            onClick={() => onSelect(page.url)}
          >
            <Check className="h-3.5 w-3.5" />
            Usar esta
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 text-white hover:bg-white/10 hover:text-white"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-12 py-3 sm:px-16"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          touchStartX.current = e.changedTouches[0]?.clientX ?? null
        }}
        onTouchEnd={(e) => {
          const start = touchStartX.current
          const end = e.changedTouches[0]?.clientX
          touchStartX.current = null
          if (start == null || end == null) return
          const delta = end - start
          if (Math.abs(delta) < 48) return
          if (delta > 0) goPrev()
          else goNext()
        }}
      >
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="absolute left-2 top-1/2 z-10 h-11 w-11 -translate-y-1/2 rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-white sm:left-4"
          onClick={goPrev}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>

        <img
          src={page.url}
          alt={`Página ${page.index}`}
          className="max-h-full max-w-full select-none rounded-lg object-contain shadow-2xl ring-1 ring-white/15"
          draggable={false}
        />

        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="absolute right-2 top-1/2 z-10 h-11 w-11 -translate-y-1/2 rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-white sm:right-4"
          onClick={goNext}
          aria-label="Próxima página"
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>

      <div
        className="border-t border-white/10 bg-black/40 px-3 py-2.5 sm:px-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          ref={stripRef}
          className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {pages.map((p, i) => (
            <button
              key={p.path}
              type="button"
              data-page-idx={i}
              onClick={() => onIndexChange(i)}
              className={cn(
                'relative h-16 w-24 shrink-0 overflow-hidden rounded-md border-2 transition',
                i === safeIndex
                  ? 'border-[#0066FF] ring-2 ring-[#0066FF]/40'
                  : 'border-white/20 opacity-70 hover:opacity-100',
              )}
              title={`Página ${p.index}`}
            >
              <img src={p.url} alt="" className="h-full w-full object-cover" />
              <span className="absolute bottom-0 inset-x-0 bg-black/55 py-0.5 text-center text-[9px] text-white">
                {p.index}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-2 flex justify-center">
          <Button
            type="button"
            size="sm"
            className="gap-1.5 bg-[#0066FF] px-5 hover:bg-[#0052cc]"
            onClick={() => onSelect(page.url)}
          >
            <Check className="h-3.5 w-3.5" />
            Usar página {page.index}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
