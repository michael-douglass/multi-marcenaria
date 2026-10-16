import { useMemo, useState } from 'react'
import { Link2, Loader2, Search, Unlink } from 'lucide-react'
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
import { useLeads, type LeadWithVendor } from '@/hooks/useLeads'
import {
  linkQuoteProjectToLead,
  unlinkQuoteProjectLead,
  type QuoteProjectRow,
} from '@/lib/orcamentos-ia/storage'
import { normalizeSearchText } from '@/lib/lead-search'

interface LinkQuoteProjectToLeadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: QuoteProjectRow
  companyId: string
  onLinked: (project: QuoteProjectRow) => void
}

export function LinkQuoteProjectToLeadDialog({
  open,
  onOpenChange,
  project,
  companyId,
  onLinked,
}: LinkQuoteProjectToLeadDialogProps) {
  const { leads = [], isLoading } = useLeads({ fetchLeads: open })
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [pendingReplace, setPendingReplace] = useState<{
    lead: LeadWithVendor
    previousProjectId: string
    previousName: string
  } | null>(null)

  const filtered = useMemo(() => {
    const q = normalizeSearchText(query)
    if (!q || q.length < 1) return (leads as LeadWithVendor[]).slice(0, 40)
    return (leads as LeadWithVendor[])
      .filter((l) => {
        const blob = normalizeSearchText(
          `${l.id} ${l.nome || ''} ${l.telefone || ''} ${l.email || ''} ${l.empresa || ''}`,
        )
        return blob.includes(q)
      })
      .slice(0, 40)
  }, [leads, query])

  const linkedLead = useMemo(() => {
    if (project.lead_id == null) return null
    return (leads as LeadWithVendor[]).find((l) => l.id === project.lead_id) ?? null
  }, [leads, project.lead_id])

  const doLink = async (lead: LeadWithVendor, replaceExisting: boolean) => {
    setBusy(true)
    try {
      const result = await linkQuoteProjectToLead({
        projectId: project.id,
        companyId,
        leadId: lead.id,
        replaceExisting,
      })
      if (result.error?.startsWith('LEAD_ALREADY_LINKED:')) {
        const parts = result.error.split(':')
        setPendingReplace({
          lead,
          previousProjectId: parts[1] || result.previousProjectId || '',
          previousName: parts.slice(2).join(':') || 'outra pasta',
        })
        return
      }
      if (result.error || !result.data) {
        toast.error(result.error || 'Não foi possível alinhar o lead.')
        return
      }
      toast.success(`Pasta alinhada ao lead ${lead.nome}.`)
      onLinked(result.data)
      setPendingReplace(null)
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  const doUnlink = async () => {
    setBusy(true)
    try {
      const result = await unlinkQuoteProjectLead({
        projectId: project.id,
        companyId,
      })
      if (result.error || !result.data) {
        toast.error(result.error || 'Não foi possível desvincular.')
        return
      }
      toast.success('Lead desvinculado da pasta.')
      onLinked(result.data)
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4 text-[#0066FF]" />
            Alinhar lead ao orçamento IA
          </DialogTitle>
          <DialogDescription className="text-sm">
            A composição desta pasta passa a aparecer no card do lead (seção Orçamento com IA).
            Um lead só pode ter uma pasta.
          </DialogDescription>
        </DialogHeader>

        {project.lead_id != null ? (
          <div className="rounded-lg border border-[#0066FF]/25 bg-[#f4f8ff] px-3 py-2 text-sm">
            <p className="font-medium text-[#0f1419]">
              Já alinhado: {linkedLead?.nome || `Lead #${project.lead_id}`}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 gap-1.5"
              disabled={busy}
              onClick={() => void doUnlink()}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
              Desvincular
            </Button>
          </div>
        ) : null}

        {pendingReplace ? (
          <div className="space-y-2 rounded-lg border border-amber-400/40 bg-amber-50 px-3 py-2 text-sm">
            <p>
              O lead <strong>{pendingReplace.lead.nome}</strong> já está na pasta{' '}
              <strong>{pendingReplace.previousName}</strong>. Trocar o vínculo para esta pasta?
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                className="bg-[#0066FF] hover:bg-[#0052cc]"
                disabled={busy}
                onClick={() => void doLink(pendingReplace.lead, true)}
              >
                Trocar vínculo
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => setPendingReplace(null)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome, telefone ou ID…"
                className="pl-8"
                autoFocus
              />
            </div>
            <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border/70 p-1">
              {isLoading ? (
                <li className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Carregando leads…
                </li>
              ) : filtered.length === 0 ? (
                <li className="px-2 py-3 text-xs text-muted-foreground">Nenhum lead encontrado.</li>
              ) : (
                filtered.map((lead) => (
                  <li key={lead.id}>
                    <button
                      type="button"
                      disabled={busy}
                      className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-[#0066FF]/8"
                      onClick={() => void doLink(lead, false)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{lead.nome}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          #{lead.id}
                          {lead.telefone ? ` · ${lead.telefone}` : ''}
                        </span>
                      </span>
                      {project.lead_id === lead.id ? (
                        <Badge className="shrink-0 bg-[#0066FF] text-[10px]">Atual</Badge>
                      ) : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
