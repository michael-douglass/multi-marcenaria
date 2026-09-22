import { useCallback, useEffect, useState } from 'react'
import { Brain, Loader2, Plus, Trash2 } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import {
  deleteCompanyMemory,
  listCompanyMemories,
  saveCompanyMemory,
  type AiMemoryRow,
} from '@/lib/orcamentos-ia/memory'

interface CompanyMemoriesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string
}

const fieldClass =
  'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-[#0066FF]'

export function CompanyMemoriesModal({
  open,
  onOpenChange,
  companyId,
}: CompanyMemoriesModalProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [memories, setMemories] = useState<AiMemoryRow[]>([])
  const [instruction, setInstruction] = useState('')
  const [category, setCategory] = useState('regra_oficina')

  const load = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    const { memories: rows, error } = await listCompanyMemories(companyId)
    setLoading(false)
    if (error) {
      toast.error(error)
      return
    }
    setMemories(rows)
  }, [companyId])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const save = async () => {
    if (!instruction.trim()) {
      toast.error('Escreva a regra ou correção que a IA deve lembrar.')
      return
    }
    setSaving(true)
    const { error } = await saveCompanyMemory({
      companyId,
      category: category.trim() || 'regra_oficina',
      userInstruction: instruction,
    })
    setSaving(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Memória salva — a IA usará isso nos próximos orçamentos.')
    setInstruction('')
    await load()
  }

  const remove = async (id: string) => {
    setSaving(true)
    const { error } = await deleteCompanyMemory(id)
    setSaving(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Memória removida.')
    await load()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden border-slate-200 bg-[#f7f4ef] p-0 text-slate-900 sm:max-w-2xl">
        <div
          className="border-b border-slate-200 px-6 py-5"
          style={{
            background:
              'radial-gradient(ellipse 70% 120% at 0% 0%, rgba(0,102,255,0.18), transparent 55%), linear-gradient(120deg, #1a2233 0%, #0d2847 100%)',
          }}
        >
          <DialogHeader>
            <DialogTitle
              className="flex items-center gap-2 text-2xl tracking-wide text-white"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              <Brain className="h-5 w-5 text-[#6ea8ff]" />
              Treinamento / Memórias RAG
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-200">
              Regras que a oficina ensinou ao Max. Correções justificadas na auditoria também entram
              aqui automaticamente.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-3 border-b border-slate-200 bg-white px-6 py-4">
          <label className="space-y-1 text-[11px] font-bold uppercase tracking-wide text-slate-700">
            Categoria
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="ex.: mesa_saia, ferragem, fita"
              className={fieldClass}
            />
          </label>
          <label className="space-y-1 text-[11px] font-bold uppercase tracking-wide text-slate-700">
            Instrução para a IA
            <Textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder='Ex.: "Sempre extrair Mesa com Saia com tampo engrossado e passa-cabos."'
              rows={3}
              className={fieldClass}
            />
          </label>
          <div className="flex justify-end">
            <Button
              type="button"
              className="bg-[#0066FF] text-white hover:bg-[#0052cc]"
              onClick={() => void save()}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Salvar memória
            </Button>
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1 px-4 py-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-[#0066FF]" />
              Carregando memórias…
            </div>
          ) : memories.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">
              Nenhuma memória ainda. Cadastre regras ou corrija itens na auditoria com justificativa.
            </p>
          ) : (
            <div className="space-y-2 pb-4">
              {memories.map((m) => (
                <div
                  key={m.id}
                  className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <Badge className="border-0 bg-slate-200 text-[10px] text-slate-800">
                      {m.category}
                    </Badge>
                    <p className="text-sm text-slate-800">{m.user_instruction}</p>
                    <p className="text-[11px] text-slate-400">
                      {new Date(m.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-red-600 hover:bg-red-50"
                    onClick={() => void remove(m.id)}
                    disabled={saving}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="border-t border-slate-200 bg-white px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
