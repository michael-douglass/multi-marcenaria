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
import { classifyProducaoStage } from '@/lib/projetos-producao'
import {
  PRODUCAO_STAGE_CORES,
  PRODUCAO_STAGE_COR_KEYS,
  resolveProducaoStageCor,
  type ProducaoStageCorKey,
} from '@/lib/producao-stage-cores'
import { cn } from '@/lib/utils'

interface ProducaoStagesConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Criar, renomear, recolorir, reordenar e remover colunas (admin, projetista admin, Montador Admin). */
export function ProducaoStagesConfigDialog({ open, onOpenChange }: ProducaoStagesConfigDialogProps) {
  const { stages, createStage, updateStage, deleteStage, moveStage } = useProducaoStagesAdmin()
  const [nome, setNome] = useState('')
  const [cor, setCor] = useState<ProducaoStageCorKey>('ceu')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')
  const [editCor, setEditCor] = useState<string | null>(null)

  const criar = () => {
    if (!nome.trim()) return
    void createStage.mutateAsync({ nome, cor }).then(() => setNome(''))
  }

  const salvarEdicao = (id: string) => {
    if (!editNome.trim()) return
    void updateStage.mutateAsync({ id, nome: editNome, cor: editCor }).then(() => setEditingId(null))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-[#2a3a36]/12 bg-[#fffcf7]">
        <DialogHeader>
          <DialogTitle className="font-display text-[#1c2824]">Colunas de produção</DialogTitle>
          <DialogDescription className="text-[#5a6b66]">
            Pendentes costuma ser a primeira. Concluídos é sempre a última coluna.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-2 rounded-xl border border-[#2a3a36]/10 bg-white/70 p-2.5"
          onSubmit={(e) => {
            e.preventDefault()
            criar()
          }}
        >
          <p className="font-display text-[10px] tracking-[0.22em] text-[#6b7c76]">NOVA COLUNA</p>
          <div className="flex gap-2">
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome da coluna"
              aria-label="Nome da nova coluna"
              maxLength={60}
            />
            <Button
              type="submit"
              size="sm"
              className="gap-1 bg-[#2d8c78] text-white hover:bg-[#247a68]"
              disabled={!nome.trim() || createStage.isPending}
            >
              <Plus className="h-4 w-4" />
              Criar
            </Button>
          </div>
          <CorSwatches value={cor} onChange={setCor} label="Cor da nova coluna" />
        </form>

        <ul className="max-h-80 space-y-1 overflow-y-auto">
          {stages.map((stage, index) => {
            const stageCor = resolveProducaoStageCor(stage.cor, classifyProducaoStage(stage, stages))
            const isEditing = editingId === stage.id
            return (
              <li
                key={stage.id}
                className="rounded-lg border border-[#2a3a36]/10 bg-white/70 px-2 py-1.5"
              >
                {isEditing ? (
                  <div className="space-y-2 py-0.5">
                    <div className="flex items-center gap-2">
                      <Input
                        value={editNome}
                        onChange={(e) => setEditNome(e.target.value)}
                        className="h-8"
                        aria-label="Nome da coluna"
                        maxLength={60}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') salvarEdicao(stage.id)
                        }}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        aria-label="Salvar coluna"
                        disabled={!editNome.trim() || updateStage.isPending}
                        onClick={() => salvarEdicao(stage.id)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        aria-label="Cancelar edição"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <CorSwatches value={editCor} onChange={setEditCor} label={`Cor da coluna ${stage.nome}`} />
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span
                      className={cn('h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10', stageCor.swatch)}
                      title={stageCor.label}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-sm">{stage.nome}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label="Mover para cima"
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
                      aria-label="Mover para baixo"
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
                      aria-label="Editar nome e cor"
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
                      aria-label="Remover coluna"
                      onClick={() => deleteStage.mutate(stage.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </DialogContent>
    </Dialog>
  )
}

function CorSwatches({ value, onChange, label }: CorSwatchesProps) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {PRODUCAO_STAGE_COR_KEYS.map((key) => {
        const preset = PRODUCAO_STAGE_CORES[key]
        const isSelected = value === key
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={isSelected}
            title={preset.label}
            onClick={() => onChange(key)}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d8c78]/50',
              isSelected
                ? 'border-[#2d8c78] bg-[#2d8c78]/10 text-[#1f5f52]'
                : 'border-[#2a3a36]/15 text-[#6b7c76] hover:border-[#2a3a36]/30',
            )}
          >
            <span className={cn('h-2.5 w-2.5 rounded-full ring-1 ring-black/10', preset.swatch)} aria-hidden />
            {preset.label}
          </button>
        )
      })}
    </div>
  )
}

interface CorSwatchesProps {
  value: string | null
  onChange: (cor: ProducaoStageCorKey) => void
  label: string
}
