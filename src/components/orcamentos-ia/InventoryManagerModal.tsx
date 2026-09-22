import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Link2, Package, Plus, Save, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  createInventoryAlias,
  createInventoryItem,
  deleteInventoryAlias,
  getInventoryAliases,
  getInventoryItems,
  getRollMeters,
  INVENTORY_CATEGORY_LABEL,
  updateInventoryItemsBatch,
  type InventoryAlias,
  type InventoryCategory,
  type InventoryItem,
  type InventoryItemPatch,
} from '@/lib/orcamentos-ia/inventory'

interface InventoryManagerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string
}

type DraftRow = {
  name: string
  unit: string
  unit_price: string
  price_per_m2: string
  price_per_sheet: string
  loss_pct: string
  roll_meters: string
  active: boolean
}

function toDraft(item: InventoryItem): DraftRow {
  return {
    name: item.name,
    unit: item.unit,
    unit_price: item.unit_price != null ? String(item.unit_price) : '',
    price_per_m2: item.price_per_m2 != null ? String(item.price_per_m2) : '',
    price_per_sheet: item.price_per_sheet != null ? String(item.price_per_sheet) : '',
    loss_pct: item.loss_pct != null ? String(item.loss_pct) : '',
    roll_meters: getRollMeters(item) != null ? String(getRollMeters(item)) : '',
    active: item.active,
  }
}

function parseNum(value: string): number | null {
  const t = value.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function compact(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

const CATEGORY_TABS: Array<InventoryCategory | 'all'> = [
  'all',
  'chapa',
  'fita_borda',
  'ferragem',
  'puxador',
  'mao_obra',
  'servico',
  'consumivel',
]

const fieldClass =
  'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-[#0066FF]'

export function InventoryManagerModal({
  open,
  onOpenChange,
  companyId,
}: InventoryManagerModalProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<InventoryItem[]>([])
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({})
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set())
  const [category, setCategory] = useState<InventoryCategory | 'all'>('all')
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState({
    category: 'ferragem' as InventoryCategory,
    name: '',
    unit_price: '',
    price_per_m2: '',
    price_per_sheet: '',
    roll_meters: '20',
  })
  const [mainTab, setMainTab] = useState<'estoque' | 'apelidos'>('estoque')
  const [aliases, setAliases] = useState<InventoryAlias[]>([])
  const [aliasLoading, setAliasLoading] = useState(false)
  const [aliasForm, setAliasForm] = useState({ aliasRaw: '', inventoryItemId: '' })

  const load = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    const { data, error } = await getInventoryItems({
      companyId,
      includeInactive: true,
    })
    setLoading(false)
    if (error) {
      toast.error(error)
      return
    }
    setItems(data)
    const next: Record<string, DraftRow> = {}
    for (const item of data) next[item.id] = toDraft(item)
    setDrafts(next)
    setDirtyIds(new Set())
  }, [companyId])

  const loadAliases = useCallback(async () => {
    if (!companyId) return
    setAliasLoading(true)
    const { data, error } = await getInventoryAliases(companyId)
    setAliasLoading(false)
    if (error) {
      toast.error(error)
      return
    }
    setAliases(data)
  }, [companyId])

  useEffect(() => {
    if (open) {
      void load()
      void loadAliases()
    }
  }, [open, load, loadAliases])

  const filtered = useMemo(() => {
    const q = compact(search)
    return items.filter((item) => {
      if (category !== 'all' && item.category !== category) return false
      if (!q) return true
      return compact(`${item.name} ${item.sku ?? ''} ${item.category}`).includes(q)
    })
  }, [items, category, search])

  const markDirty = (id: string, patch: Partial<DraftRow>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
    setDirtyIds((prev) => new Set(prev).add(id))
  }

  const saveAll = async () => {
    if (!dirtyIds.size) {
      toast.message('Nenhuma alteração para salvar.')
      return
    }
    setSaving(true)
    const updates: Array<{ id: string; patch: InventoryItemPatch }> = []
    for (const id of dirtyIds) {
      const d = drafts[id]
      const original = items.find((i) => i.id === id)
      if (!d || !original) continue
      const meta = { ...(original.metadata ?? {}) }
      if (original.category === 'fita_borda') {
        const roll = parseNum(d.roll_meters)
        if (roll != null) meta.roll_meters = roll
        else delete meta.roll_meters
      }
      updates.push({
        id,
        patch: {
          name: d.name.trim() || original.name,
          unit: d.unit.trim() || original.unit,
          unit_price: parseNum(d.unit_price),
          price_per_m2: parseNum(d.price_per_m2),
          price_per_sheet: parseNum(d.price_per_sheet),
          loss_pct: parseNum(d.loss_pct),
          active: d.active,
          metadata: meta,
        },
      })
    }
    const { error, saved } = await updateInventoryItemsBatch(updates)
    setSaving(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success(`${saved} item(ns) atualizado(s).`)
    await load()
  }

  const createNew = async () => {
    if (!newForm.name.trim()) {
      toast.error('Informe o nome do material.')
      return
    }
    setSaving(true)
    const metadata: Record<string, unknown> = {}
    if (newForm.category === 'fita_borda') {
      const roll = parseNum(newForm.roll_meters)
      if (roll) metadata.roll_meters = roll
    }
    const { error } = await createInventoryItem({
      companyId,
      category: newForm.category,
      name: newForm.name,
      unit_price: parseNum(newForm.unit_price),
      price_per_m2: parseNum(newForm.price_per_m2),
      price_per_sheet: parseNum(newForm.price_per_sheet),
      metadata,
    })
    setSaving(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Material cadastrado.')
    setShowNew(false)
    setNewForm({
      category: 'ferragem',
      name: '',
      unit_price: '',
      price_per_m2: '',
      price_per_sheet: '',
      roll_meters: '20',
    })
    await load()
  }

  const createAlias = async () => {
    if (!aliasForm.aliasRaw.trim() || !aliasForm.inventoryItemId) {
      toast.error('Informe o apelido e o item do estoque.')
      return
    }
    setSaving(true)
    const { error } = await createInventoryAlias({
      companyId,
      aliasRaw: aliasForm.aliasRaw,
      inventoryItemId: aliasForm.inventoryItemId,
    })
    setSaving(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Apelido De-Para cadastrado.')
    setAliasForm({ aliasRaw: '', inventoryItemId: '' })
    await loadAliases()
  }

  const removeAlias = async (id: string) => {
    setSaving(true)
    const { error } = await deleteInventoryAlias(id)
    setSaving(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Apelido removido.')
    await loadAliases()
  }

  const activeItems = useMemo(() => items.filter((i) => i.active), [items])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col gap-0 overflow-hidden border-slate-200 bg-[#f7f4ef] p-0 text-slate-900 sm:max-w-5xl">
        <div
          className="relative overflow-hidden border-b border-slate-200"
          style={{
            background:
              'radial-gradient(ellipse 70% 120% at 0% 0%, rgba(0,102,255,0.18), transparent 55%), linear-gradient(120deg, #1a2233 0%, #0d2847 100%)',
          }}
        >
          <DialogHeader className="relative px-6 py-5">
            <DialogTitle
              className="flex items-center gap-2 text-2xl tracking-wide text-white"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              <Package className="h-5 w-5 text-[#6ea8ff]" />
              Tabela de Preços & Estoque
            </DialogTitle>
            <DialogDescription
              className="text-sm text-slate-200"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              Mesa de preços Planilha 4.0 — chapas, fitas, ferragens por unidade, puxadores em barra
              de 3 m, mão de obra e serviços.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-3 border-b border-slate-200 bg-white px-6 py-3">
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMainTab('estoque')}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-all',
                mainTab === 'estoque'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800',
              )}
            >
              <Package className="h-3.5 w-3.5" />
              Estoque
            </button>
            <button
              type="button"
              onClick={() => setMainTab('apelidos')}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-all',
                mainTab === 'apelidos'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800',
              )}
            >
              <Link2 className="h-3.5 w-3.5" />
              Apelidos / De-Para
            </button>
          </div>

          {mainTab === 'estoque' && (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar material, SKU ou categoria…"
                  className={cn('pl-9', fieldClass)}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_TABS.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setCategory(tab)}
                    className={cn(
                      'rounded-md px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition-all',
                      category === tab
                        ? 'bg-[#0066FF] text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900',
                    )}
                  >
                    {tab === 'all' ? 'Todos' : INVENTORY_CATEGORY_LABEL[tab]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {mainTab === 'apelidos' ? (
          <ScrollArea className="min-h-0 flex-1 bg-[#f7f4ef] px-4 py-3">
            <div className="mb-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-600">
                Quando o PDF vier com um nome diferente do cadastro (ex.: &quot;CHAPA-MDF15 BRANCO&quot;),
                cadastre o apelido e aponte para o item certo do estoque.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-[11px] font-bold uppercase tracking-wide text-slate-700">
                  Nome no PDF / apelido
                  <Input
                    value={aliasForm.aliasRaw}
                    onChange={(e) => setAliasForm((f) => ({ ...f, aliasRaw: e.target.value }))}
                    placeholder="Ex.: MDF Louro Freijó 15mm"
                    className={fieldClass}
                  />
                </label>
                <label className="space-y-1 text-[11px] font-bold uppercase tracking-wide text-slate-700">
                  Item do estoque
                  <Select
                    value={aliasForm.inventoryItemId || undefined}
                    onValueChange={(v) => setAliasForm((f) => ({ ...f, inventoryItemId: v }))}
                  >
                    <SelectTrigger className={fieldClass}>
                      <SelectValue placeholder="Selecione o material…" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  className="bg-[#0066FF] text-white hover:bg-[#0052cc]"
                  onClick={() => void createAlias()}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Adicionar apelido
                </Button>
              </div>
            </div>

            {aliasLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin text-[#0066FF]" />
                Carregando apelidos…
              </div>
            ) : aliases.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">
                Nenhum apelido cadastrado ainda.
              </p>
            ) : (
              <div className="space-y-2 pb-4">
                {aliases.map((alias) => (
                  <div
                    key={alias.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium text-slate-900">{alias.alias_raw}</p>
                      <p className="text-xs text-slate-500">
                        → {alias.inventory_items?.name ?? 'Item removido'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => void removeAlias(alias.id)}
                      disabled={saving}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        ) : (
        <ScrollArea className="min-h-0 flex-1 bg-[#f7f4ef] px-4 py-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-[#0066FF]" />
              Carregando estoque…
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">Nenhum item encontrado.</p>
          ) : (
            <div className="space-y-2 pb-4">
              {filtered.map((item) => {
                const d = drafts[item.id] ?? toDraft(item)
                const dirty = dirtyIds.has(item.id)
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-colors',
                      dirty && 'border-[#0066FF] bg-[#0066FF]/5 ring-1 ring-[#0066FF]/25',
                    )}
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge className="border-0 bg-slate-200 text-[10px] font-semibold text-slate-800">
                        {INVENTORY_CATEGORY_LABEL[item.category]}
                      </Badge>
                      {!item.company_id && (
                        <Badge
                          variant="outline"
                          className="border-slate-400 text-[10px] font-medium text-slate-700"
                        >
                          Global
                        </Badge>
                      )}
                      {dirty && (
                        <Badge className="bg-[#0066FF] text-[10px] text-white hover:bg-[#0066FF]">
                          Alterado
                        </Badge>
                      )}
                      <label className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={d.active}
                          onChange={(e) => markDirty(item.id, { active: e.target.checked })}
                          className="accent-[#0066FF]"
                        />
                        Ativo
                      </label>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <label className="space-y-1 text-[11px] font-bold uppercase tracking-wide text-slate-700 sm:col-span-2">
                        Nome
                        <Input
                          value={d.name}
                          onChange={(e) => markDirty(item.id, { name: e.target.value })}
                          className={fieldClass}
                        />
                      </label>
                      <label className="space-y-1 text-[11px] font-bold uppercase tracking-wide text-slate-700">
                        Unidade
                        <Input
                          value={d.unit}
                          onChange={(e) => markDirty(item.id, { unit: e.target.value })}
                          className={cn(fieldClass, 'font-mono')}
                        />
                      </label>
                      <label className="space-y-1 text-[11px] font-bold uppercase tracking-wide text-slate-700">
                        {item.category === 'puxador'
                          ? item.unit === 'barra'
                            ? 'Custo / barra 3 m'
                            : 'Custo / tampinha (un)'
                          : 'Preço unitário'}
                        <Input
                          inputMode="decimal"
                          value={d.unit_price}
                          onChange={(e) => markDirty(item.id, { unit_price: e.target.value })}
                          placeholder="R$"
                          className={cn(fieldClass, 'font-mono tabular-nums')}
                        />
                      </label>

                      {item.category === 'chapa' && (
                        <>
                          <label className="space-y-1 text-[11px] font-bold uppercase tracking-wide text-slate-700">
                            Custo / m²
                            <Input
                              inputMode="decimal"
                              value={d.price_per_m2}
                              onChange={(e) => markDirty(item.id, { price_per_m2: e.target.value })}
                              className={cn(fieldClass, 'font-mono tabular-nums')}
                            />
                          </label>
                          <label className="space-y-1 text-[11px] font-bold uppercase tracking-wide text-slate-700">
                            Custo / chapa
                            <Input
                              inputMode="decimal"
                              value={d.price_per_sheet}
                              onChange={(e) =>
                                markDirty(item.id, { price_per_sheet: e.target.value })
                              }
                              className={cn(fieldClass, 'font-mono tabular-nums')}
                            />
                          </label>
                          <label className="space-y-1 text-[11px] font-bold uppercase tracking-wide text-slate-700">
                            Perda %
                            <Input
                              inputMode="decimal"
                              value={d.loss_pct}
                              onChange={(e) => markDirty(item.id, { loss_pct: e.target.value })}
                              className={cn(fieldClass, 'font-mono tabular-nums')}
                            />
                          </label>
                        </>
                      )}

                      {item.category === 'fita_borda' && (
                        <label className="space-y-1 text-[11px] font-bold uppercase tracking-wide text-slate-700">
                          Rolo (metros)
                          <Input
                            inputMode="numeric"
                            value={d.roll_meters}
                            onChange={(e) => markDirty(item.id, { roll_meters: e.target.value })}
                            placeholder="20 / 50 / 100"
                            className={cn(fieldClass, 'font-mono tabular-nums')}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
        )}

        {showNew && mainTab === 'estoque' && (
          <div className="space-y-3 border-t border-slate-200 bg-[#0066FF]/8 px-6 py-4">
            <p
              className="text-lg tracking-wide text-slate-900"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              Cadastrar novo material
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1 text-[11px] font-bold uppercase tracking-wide text-slate-700">
                Categoria
                <Select
                  value={newForm.category}
                  onValueChange={(v) =>
                    setNewForm((f) => ({ ...f, category: v as InventoryCategory }))
                  }
                >
                  <SelectTrigger className={fieldClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(INVENTORY_CATEGORY_LABEL) as InventoryCategory[]).map((c) => (
                      <SelectItem key={c} value={c}>
                        {INVENTORY_CATEGORY_LABEL[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="space-y-1 text-[11px] font-bold uppercase tracking-wide text-slate-700 sm:col-span-2">
                Nome
                <Input
                  value={newForm.name}
                  onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
                  className={fieldClass}
                />
              </label>
              <label className="space-y-1 text-[11px] font-bold uppercase tracking-wide text-slate-700">
                Preço unitário
                <Input
                  value={newForm.unit_price}
                  onChange={(e) => setNewForm((f) => ({ ...f, unit_price: e.target.value }))}
                  className={cn(fieldClass, 'font-mono')}
                />
              </label>
              {newForm.category === 'chapa' && (
                <>
                  <label className="space-y-1 text-[11px] font-bold uppercase tracking-wide text-slate-700">
                    Custo / m²
                    <Input
                      value={newForm.price_per_m2}
                      onChange={(e) => setNewForm((f) => ({ ...f, price_per_m2: e.target.value }))}
                      className={cn(fieldClass, 'font-mono')}
                    />
                  </label>
                  <label className="space-y-1 text-[11px] font-bold uppercase tracking-wide text-slate-700">
                    Custo / chapa
                    <Input
                      value={newForm.price_per_sheet}
                      onChange={(e) =>
                        setNewForm((f) => ({ ...f, price_per_sheet: e.target.value }))
                      }
                      className={cn(fieldClass, 'font-mono')}
                    />
                  </label>
                </>
              )}
              {newForm.category === 'fita_borda' && (
                <label className="space-y-1 text-[11px] font-bold uppercase tracking-wide text-slate-700">
                  Rolo (m)
                  <Input
                    value={newForm.roll_meters}
                    onChange={(e) => setNewForm((f) => ({ ...f, roll_meters: e.target.value }))}
                    className={cn(fieldClass, 'font-mono')}
                  />
                </label>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setShowNew(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                className="bg-[#0066FF] text-white hover:bg-[#0052cc]"
                onClick={() => void createNew()}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Cadastrar
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 border-t border-slate-200 bg-white px-6 py-4 sm:justify-between">
          {mainTab === 'estoque' ? (
            <Button type="button" variant="outline" onClick={() => setShowNew((v) => !v)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo material
            </Button>
          ) : (
            <span className="text-xs text-slate-500">
              De-Para: nome do PDF → preço do estoque
            </span>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            {mainTab === 'estoque' && (
              <Button
                type="button"
                className="bg-[#0066FF] text-white hover:bg-[#0052cc]"
                onClick={() => void saveAll()}
                disabled={saving || dirtyIds.size === 0}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Salvar alterações{dirtyIds.size ? ` (${dirtyIds.size})` : ''}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
