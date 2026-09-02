import { useState } from 'react'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useProducaoStagesAdmin } from '@/hooks/useObraProducao'
import { cn } from '@/lib/utils'

interface ProducaoStagesConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const PRESETS = [
  { label: 'Âmbar', value: 'warning' },
  { label: 'Primário', value: 'primary' },
  { label: 'Esmeralda', value: 'success' },
  { label: 'Secundário', value: 'secondary' },
  { label: 'Neutro', value: 'muted' },
]

export function ProducaoStagesConfigDialog({ open, onOpenChange }: ProducaoStagesConfigDialogProps) {
  const { stages, createStage, updateStage, deleteStage, moveStage } = useProducaoStagesAdmin()
  const [nome, setNome] = useState('')
  const [cor, setCor] = useState<string | null>('warning')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')
  const [editCor, setEditCor] = useState<string | null>(null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-[#2a3a36]/12 bg-[#fffcf7]">
        <DialogHeader>
          <DialogTitle className="font-display text-[#1c2824]">Colunas de produção</DialogTitle>
          <DialogDescription className="text-[#5a6b66]">
            Pendentes costuma ser a primeira. Concluídos é sempre a última coluna.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da coluna" />
          <Button
            type="button"
            size="sm"
            className="gap-1 bg-[#2d8c78] text-white hover:bg-[#247a68]"
            disabled={!nome.trim() || createStage.isPending}
            onClick={() => {
              void createStage.mutateAsync({ nome, cor }).then(() => setNome(''))
            }}
          >
            <Plus className="h-4 w-4" />
            Criar
          </Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className={cn(
                'rounded-full border px-2 py-0.5 text-[11px]',
                cor === preset.value
                  ? 'border-[#2d8c78] text-[#1f5f52]'
                  : 'border-[#2a3a36]/15 text-[#6b7c76]',
              )}
              onClick={() => setCor(preset.value)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <ul className="max-h-80 space-y-1 overflow-y-auto">
          {stages.map((stage, index) => (
            <li
              key={stage.id}
              className="flex items-center gap-2 rounded-lg border border-[#2a3a36]/10 bg-white/70 px-2 py-1.5"
            >
              {editingId === stage.id ? (
                <>
                  <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} className="h-8" />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => {
                      void updateStage.mutateAsync({ id: stage.id, nome: editNome, cor: editCor })
                      setEditingId(null)
                    }}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm">{stage.nome}</span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={index === 0}
                    onClick={() => moveStage.mutate({ id: stage.id, direction: 'up' })}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={index === stages.length - 1}
                    onClick={() => moveStage.mutate({ id: stage.id, direction: 'down' })}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => {
                      setEditingId(stage.id)
                      setEditNome(stage.nome)
                      setEditCor(stage.cor)
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={() => deleteStage.mutate(stage.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
