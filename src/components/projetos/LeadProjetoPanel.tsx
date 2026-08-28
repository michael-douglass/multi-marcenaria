import { LeadEnviarProjetoDialog } from '@/components/projetos/LeadEnviarProjetoDialog'
import { LeadProjetoNotasSection } from '@/components/projetos/LeadProjetoNotasSection'

interface LeadProjetoPanelProps {
  leadId: number
}

/** Painel da Pipeline: envio ao setor + canal, se já existir. */
export function LeadProjetoPanel({ leadId }: LeadProjetoPanelProps) {
  return (
    <div className="space-y-3 rounded-xl border border-gold/20 bg-[#1a120e]/55 p-3">
      <div>
        <p className="font-display text-sm tracking-wide text-gold">Setor de projetos</p>
        <p className="text-[11px] text-cream-muted">
          Envie o lead ao ateliê e converse com o projetista no mesmo fio.
        </p>
      </div>
      <LeadEnviarProjetoDialog leadId={leadId} />
      <LeadProjetoNotasSection leadId={leadId} />
    </div>
  )
}
