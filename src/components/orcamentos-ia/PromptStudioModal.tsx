import { useEffect, useState } from 'react'
import { Loader2, Save, Sparkles } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'
import type { PromptAgentKey } from '@/lib/orcamentos-ia/observability'

const DEFAULT_PROMPTS: Record<PromptAgentKey, string> = {
  extractor:
    'Extrator Corte Claude v11: liste tipologias, cotas e insumos unitários. PROIBIDO preço por m² de fachada.',
  disassembler:
    'Desmontador: aplique preferências construtivas e explode peças com desconto de espessura.',
  auditor:
    'Auditor: valide BOM completo (chapas, fitas, ferragens por unidade) e reporte gaps.',
}

interface PromptStudioModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string
}

export function PromptStudioModal({ open, onOpenChange, companyId }: PromptStudioModalProps) {
  const [agent, setAgent] = useState<PromptAgentKey>('extractor')
  const [prompt, setPrompt] = useState(DEFAULT_PROMPTS.extractor)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !companyId) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('ai_prompt_overrides')
        .select('agent_key, system_prompt, active')
        .eq('company_id', companyId)
        .eq('agent_key', agent)
        .maybeSingle()
      if (cancelled) return
      if (error) toast.error(error.message)
      setPrompt(data?.system_prompt || DEFAULT_PROMPTS[agent])
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [open, companyId, agent])

  const save = async () => {
    setSaving(true)
    const { error } = await supabase.from('ai_prompt_overrides').upsert(
      {
        company_id: companyId,
        agent_key: agent,
        system_prompt: prompt,
        active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,agent_key' },
    )
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Prompt salvo. Próximas análises usam este override.')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#0066FF]" />
            Prompt Studio
          </DialogTitle>
          <DialogDescription>
            Edite os system prompts dos agentes (Extrator, Desmontador, Auditor). Só usuários
            autenticados — a Edge Function lê o override ativo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Agente</Label>
            <Select value={agent} onValueChange={(v) => setAgent(v as PromptAgentKey)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="extractor">Extrator</SelectItem>
                <SelectItem value="disassembler">Desmontador</SelectItem>
                <SelectItem value="auditor">Auditor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando…
            </div>
          ) : (
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[220px] font-mono text-xs"
            />
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button type="button" onClick={() => void save()} disabled={loading || saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
