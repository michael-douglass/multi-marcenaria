import { useState } from 'react'
import { CheckCircle2, RotateCcw, Send, Unlock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAuth } from '@/contexts/AuthContext'
import {
  useLeadProjetoMutations,
  useProjetoPorLead,
  useProjetoStages,
} from '@/hooks/useLeadProjetos'
import {
  canPegarProjeto,
  canSolicitarNovamente,
  canSoltarOuReabrir,
  classifyProjetoStage,
  isProjetoEmDesenho,
} from '@/lib/projetos-atelie'
import { cn } from '@/lib/utils'

interface LeadProjetoConclusaoPanelProps {
  leadId: number
}

type ConfirmKind = 'soltar' | 'reabrir' | 'solicitar' | 'puxar' | 'concluir'

const COPY: Record<ConfirmKind, { title: string; body: string }> = {
  soltar: { title: 'Soltar este desenho?', body: 'O brilho para. O card volta para a fila.' },
  reabrir: { title: 'Reabrir o projeto?', body: 'Volta para a fila. Quem estava desenhando continua marcado.' },
  solicitar: { title: 'Solicitar novamente?', body: 'O card volta à fila e o dono do desenho é liberado.' },
  puxar: { title: 'Puxar este lead para o ateliê?', body: 'Ele entra na prancheta.' },
  concluir: { title: 'Concluir o projeto?', body: 'O card vai para a última coluna (feitos).' },
}

export function LeadProjetoConclusaoPanel({ leadId }: LeadProjetoConclusaoPanelProps) {
  const { userRoles, isSuperAdmin } = useAuth()
  const { projeto, isLoading } = useProjetoPorLead(leadId)
  const { data: stages = [] } = useProjetoStages()
  const { pegar, soltar, concluir, reabrir, solicitarNovamente, puxarParaProjeto } = useLeadProjetoMutations()
  const [confirm, setConfirm] = useState<{ kind: ConfirmKind; run: () => void } | null>(null)

  if (isLoading) return null

  const stage = stages.find((item) => item.id === projeto?.stage_id)
  const kind = projeto && stage ? classifyProjetoStage(stage, stages) : null
  const emDesenho = isProjetoEmDesenho(projeto)
  const canPegar = canPegarProjeto(userRoles, isSuperAdmin)
  const canSoltar = canSoltarOuReabrir(userRoles, isSuperAdmin)
  const canSolicitar = canSolicitarNovamente(userRoles, isSuperAdmin)
  const ask = (next: ConfirmKind, run: () => void) => setConfirm({ kind: next, run })

  return (
    <>
      {!projeto ? (
        <div className="rounded-xl border border-sky-400/25 bg-sky-950/20 p-3">
          <p className="font-display text-sm tracking-wide text-sky-200">Fora do ateliê</p>
          <p className="mt-1 text-xs text-cream-muted">Este lead ainda não está na prancheta.</p>
          {canPegar ? (
            <Button
              type="button"
              size="sm"
              className="mt-2 bg-gold text-[#1a120e]"
              onClick={() => ask('puxar', () => puxarParaProjeto.mutate(leadId))}
            >
              Puxar para o ateliê
            </Button>
          ) : null}
        </div>
      ) : (
        <div className={cn('rounded-xl border p-3', emDesenho ? 'border-sky-400/30 bg-sky-950/20' : 'border-gold/20 bg-[#1a120e]/60')}>
          <p className="font-display text-sm text-gold">
            {kind === 'feito' ? 'Projeto feito' : emDesenho ? 'Em desenho' : 'Na fila'}
          </p>
          <p className="text-xs text-cream-muted">{stage?.nome}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {canPegar && !emDesenho && kind !== 'feito' ? (
              <Button type="button" size="sm" className="h-8" onClick={() => pegar.mutate(projeto.id)}>
                Pegar para projetar
              </Button>
            ) : null}
            {canSoltar && emDesenho ? (
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1" onClick={() => ask('soltar', () => soltar.mutate(projeto.id))}>
                <Unlock className="h-3.5 w-3.5" />
                Soltar
              </Button>
            ) : null}
            {canPegar && kind !== 'feito' ? (
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1" onClick={() => ask('concluir', () => concluir.mutate(projeto.id))}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Concluir
              </Button>
            ) : null}
            {canSoltar && kind === 'feito' ? (
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1" onClick={() => ask('reabrir', () => reabrir.mutate(projeto.id))}>
                <RotateCcw className="h-3.5 w-3.5" />
                Reabrir
              </Button>
            ) : null}
            {canSolicitar && kind === 'feito' ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1"
                onClick={() => ask('solicitar', () => solicitarNovamente.mutate({ leadId, projetoId: projeto.id }))}
              >
                <Send className="h-3.5 w-3.5" />
                Solicitar novamente
              </Button>
            ) : null}
          </div>
        </div>
      )}
      <AlertDialog open={Boolean(confirm)} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent className="border-[#8d5e22]/20 bg-[#fffcf8]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-[#8d5e22]">
              {confirm ? COPY[confirm.kind].title : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>{confirm ? COPY[confirm.kind].body : ''}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-gold text-[#1a120e]"
              onClick={() => {
                confirm?.run()
                setConfirm(null)
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
