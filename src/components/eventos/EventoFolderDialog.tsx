import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { EventoPastaInput } from '@/hooks/useControleEventos'
import { formatDataEventoIso } from '@/lib/evento-helpers'
import type { EventoPasta, EventoTipo } from '@/lib/evento-types'

interface EventoFolderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pasta?: EventoPasta | null
  saving?: boolean
  onSave: (input: EventoPastaInput) => Promise<void> | void
}

export function EventoFolderDialog({ open, onOpenChange, pasta, saving, onSave }: EventoFolderDialogProps) {
  const [titulo, setTitulo] = useState('')
  const [dataEvento, setDataEvento] = useState(formatDataEventoIso(new Date()))
  const [tipo, setTipo] = useState<EventoTipo>('festa_fim_ano')
  const [tipoCustom, setTipoCustom] = useState('')
  const [observacoes, setObservacoes] = useState('')

  useEffect(() => {
    if (!open) return
    setTitulo(pasta?.titulo ?? '')
    setDataEvento(pasta?.data_evento ?? formatDataEventoIso(new Date()))
    setTipo(pasta?.tipo ?? 'festa_fim_ano')
    setTipoCustom(pasta?.tipo_custom ?? '')
    setObservacoes(pasta?.observacoes ?? '')
  }, [open, pasta])

  const submit = async () => {
    await onSave({
      titulo,
      data_evento: dataEvento,
      tipo,
      tipo_custom: tipo === 'outro' ? tipoCustom : null,
      observacoes,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{pasta ? 'Editar pasta' : 'Nova pasta'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="evento-titulo">Título</Label>
            <Input id="evento-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Festa de fim de ano" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="evento-data">Data</Label>
            <Input id="evento-data" type="date" value={dataEvento} onChange={(e) => setDataEvento(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="evento-tipo">Tipo</Label>
            <select
              id="evento-tipo"
              className="glass-input h-10"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as EventoTipo)}
            >
              <option value="festa_fim_ano">Festa de fim de ano</option>
              <option value="arquitetos">Evento de arquitetos</option>
              <option value="outro">Outro</option>
            </select>
          </div>
          {tipo === 'outro' && (
            <div className="space-y-1.5">
              <Label htmlFor="evento-tipo-custom">Qual tipo?</Label>
              <Input id="evento-tipo-custom" value={tipoCustom} onChange={(e) => setTipoCustom(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="evento-obs">Observações</Label>
            <Textarea
              id="evento-obs"
              className="glass-input min-h-[88px]"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Recado curto na capa"
            />
          </div>
        </div>
        <DialogFooter>
          <button type="button" className="btn btn-outline btn-md" onClick={() => onOpenChange(false)}>
            Cancelar
          </button>
          <button type="button" className="btn btn-proforco btn-md" disabled={saving || !titulo.trim()} onClick={() => void submit()}>
            {pasta ? 'Salvar' : 'Criar pasta'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
