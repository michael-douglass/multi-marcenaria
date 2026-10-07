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
import {
  ENGINEERING_MODULAR_AUDITOR,
  ENGINEERING_MODULAR_DISASSEMBLER_DOC,
  ENGINEERING_MODULAR_EXTRACTOR,
} from '@/lib/orcamentos-ia/prompts/engineering-modular'

const DEFAULT_PROMPTS: Record<PromptAgentKey, string> = {
  extractor: ENGINEERING_MODULAR_EXTRACTOR,
  disassembler: ENGINEERING_MODULAR_DISASSEMBLER_DOC,
  auditor: ENGINEERING_MODULAR_AUDITOR,
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
    if (agent === 'disassembler') {
      toast.message(
        'Desmontador é o motor determinístico (bom-engine). Este texto é só documentação — não altera o cálculo.',
      )
    }
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
    if (agent === 'extractor' || agent === 'auditor') {
      toast.success(
        'Override ativo. A próxima análise (Extrator/Auditor na Edge) usa este texto — confira no Inspector o prompt_traces.',
      )
    } else {
      toast.success('Texto de referência do Desmontador salvo (não altera o bom-engine).')
    }
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
            Extrator e Auditor: a Edge Function lê o override ativo na próxima análise. Desmontador:
            documentação do bom-engine (cálculo determinístico — sem fase LLM).
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
                <SelectItem value="disassembler">Desmontador (doc)</SelectItem>
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
