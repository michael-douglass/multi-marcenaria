import { useState } from 'react'
import { ImagePlus, Pencil, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EventoItemNomeAutocomplete } from '@/components/eventos/EventoItemNomeAutocomplete'
import type { EventoItemInput } from '@/hooks/useEventoBoard'
import { formatarMoedaEvento, totalLinhaItem } from '@/lib/evento-helpers'
import type { EventoCatalogoItem, EventoItem, EventoUnidade } from '@/lib/evento-types'
import { EVENTO_UNIDADES } from '@/lib/evento-types'

interface EventoItemCardProps {
  item: EventoItem
  catalogo: EventoCatalogoItem[]
  onSave: (input: EventoItemInput & { id?: string }) => Promise<unknown>
  onDelete: () => void
  onFotos: () => void
}

export function EventoItemCard({ item, catalogo, onSave, onDelete, onFotos }: EventoItemCardProps) {
  const [open, setOpen] = useState(false)
  const capa = item.midias[0]
  const total = totalLinhaItem(item)

  return (
    <>
      <article className="overflow-hidden rounded-xl border border-gold-border bg-[var(--color-surface-card)]">
        <button type="button" onClick={onFotos} className="block w-full">
          {capa ? (
            <img src={capa.file_url} alt="" className="h-24 w-full object-cover" />
          ) : (
            <div className="h-24 bg-mahogany-base/80" />
          )}
        </button>
        <div className="px-3 py-2">
          <div className="flex items-start justify-between gap-2">
            <button type="button" onClick={() => setOpen(true)} className="min-w-0 text-left">
              <p className="truncate font-medium">{item.nome}</p>
              <p className="text-xs text-cream-faint">
                {item.quantidade} {item.unidade}
                {item.fornecedor ? ` · ${item.fornecedor}` : ''}
              </p>
            </button>
            <div className="flex gap-1">
              <button type="button" aria-label="Editar item" onClick={() => setOpen(true)} className="p-1 text-cream-faint hover:text-gold">
                <Pencil className="h-4 w-4" />
              </button>
              <button type="button" aria-label="Fotos do item" onClick={onFotos} className="p-1 text-cream-faint hover:text-gold">
                <ImagePlus className="h-4 w-4" />
              </button>
              <button type="button" aria-label="Excluir item" onClick={onDelete} className="p-1 text-cream-faint hover:text-red-400">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          <p className="mt-1 text-sm text-gold">
            {formatarMoedaEvento(item.preco_unitario)} · {formatarMoedaEvento(total)}
          </p>
        </div>
      </article>
      <EventoItemDialog
        open={open}
        onOpenChange={setOpen}
        catalogo={catalogo}
        initial={item}
        onSave={async (input) => {
          await onSave({ ...input, id: item.id })
          setOpen(false)
        }}
      />
    </>
  )
}

interface EventoItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  catalogo: EventoCatalogoItem[]
  initial?: EventoItem | null
  onSave: (input: EventoItemInput) => Promise<unknown>
}

export function EventoItemDialog({ open, onOpenChange, catalogo, initial, onSave }: EventoItemDialogProps) {
  const [nome, setNome] = useState(initial?.nome ?? '')
  const [quantidade, setQuantidade] = useState(String(initial?.quantidade ?? 1))
  const [unidade, setUnidade] = useState<EventoUnidade>(initial?.unidade ?? 'un')
  const [preco, setPreco] = useState(String(initial?.preco_unitario ?? 0))
  const [fornecedor, setFornecedor] = useState(initial?.fornecedor ?? '')
  const [telefone, setTelefone] = useState(initial?.telefone_fornecedor ?? '')

  const reset = (item?: EventoItem | null) => {
    setNome(item?.nome ?? '')
    setQuantidade(String(item?.quantidade ?? 1))
    setUnidade(item?.unidade ?? 'un')
    setPreco(String(item?.preco_unitario ?? 0))
    setFornecedor(item?.fornecedor ?? '')
    setTelefone(item?.telefone_fornecedor ?? '')
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (next) reset(initial)
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? 'Editar item' : 'Adicionar item'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <EventoItemNomeAutocomplete
              value={nome}
              catalogo={catalogo}
              onChange={setNome}
              onPick={(cat) => {
                setNome(cat.nome)
                setPreco(String(cat.preco_unitario))
                setUnidade(cat.unidade_padrao)
                setFornecedor(cat.fornecedor ?? '')
                setTelefone(cat.telefone_fornecedor ?? '')
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="item-qtd">Quantidade</Label>
              <Input id="item-qtd" type="number" min="0" step="0.01" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-un">Unidade</Label>
              <select id="item-un" className="glass-input h-10" value={unidade} onChange={(e) => setUnidade(e.target.value as EventoUnidade)}>
                {EVENTO_UNIDADES.map((un) => (
                  <option key={un} value={un}>{un}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="item-preco">Preço unitário</Label>
            <Input id="item-preco" type="number" min="0" step="0.01" value={preco} onChange={(e) => setPreco(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="item-forn">Fornecedor</Label>
            <Input id="item-forn" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="item-tel">Telefone</Label>
            <Input id="item-tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <button type="button" className="btn btn-outline btn-md" onClick={() => onOpenChange(false)}>Cancelar</button>
          <button
            type="button"
            className="btn btn-proforco btn-md"
            disabled={!nome.trim()}
            onClick={() => void onSave({
              nome,
              quantidade: Number(quantidade) || 1,
              unidade,
              preco_unitario: Number(preco) || 0,
              fornecedor,
              telefone_fornecedor: telefone,
            })}
          >
            Salvar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
