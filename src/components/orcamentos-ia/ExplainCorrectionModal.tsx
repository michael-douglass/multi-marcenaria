import { useState } from 'react'
import { BrainCircuit, Loader2 } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { saveCompanyMemory } from '@/lib/orcamentos-ia/memory'

interface ExplainCorrectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string
  category?: string
  contextLabel?: string
  onSaved?: () => void
}

export function ExplainCorrectionModal({
  open,
  onOpenChange,
  companyId,
  category = 'correcao_auditoria',
  contextLabel,
  onSaved,
}: ExplainCorrectionModalProps) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    const result = await saveCompanyMemory({
      companyId,
      category,
      userInstruction: contextLabel
        ? `Contexto: ${contextLabel}. Correção: ${text.trim()}`
        : text.trim(),
    })
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Correção salva na memória da IA.')
    setText('')
    onOpenChange(false)
    onSaved?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-[#0066FF]" />
            Explique a correção à IA
          </DialogTitle>
          <DialogDescription>
            Essa explicação vira memória (RAG) e guia orçamentos futuros desta marcenaria.
          </DialogDescription>
        </DialogHeader>
        {contextLabel && (
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            Item: {contextLabel}
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="correcao-ia">O que a IA deve aprender?</Label>
          <Textarea
            id="correcao-ia"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="Ex.: Neste cliente usamos sempre dobradiça com amortecedor e nunca Minifix na porta basculante."
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Pular
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={saving || !text.trim()}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Salvar na memória
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
