import { ArrowDownToLine, Clock } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  formatBRLPontua,
  iniciaisNomeArquiteto,
  tituloReconhecidoPontuaGarbo,
} from '@/lib/pontua-garbo-arquiteto';
import type { SaqueSolicitante } from '@/lib/pontua-garbo-metricas';
import {
  finCard,
  finCardMuted,
  finRowBase,
  finTextTertiary,
  finValueGold,
  finValueOk,
} from '@/components/financeiro/financeiro-styles';

const PREVIA = 4;

const dataCurta = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(iso))
    : null;

function SolicitanteRow({ solicitante }: { solicitante: SaqueSolicitante }) {
  const quando = dataCurta(solicitante.ultimaSolicitacao);
  const pendentes = solicitante.pedidos.filter((p) => p.status === 'pendente').length;

  return (
    <li
      className={`${finRowBase} flex flex-wrap items-center gap-3 px-3 py-2.5 sm:flex-nowrap`}
    >
      <Avatar className="h-9 w-9 shrink-0 border border-[rgba(107,63,18,0.22)]">
        {solicitante.avatarUrl && (
          <AvatarImage src={solicitante.avatarUrl} alt={solicitante.nome} />
        )}
        <AvatarFallback className="bg-[#f4e4c4] text-[11px] font-semibold text-[#6b3f12]">
          {iniciaisNomeArquiteto(solicitante.nome)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#1a100c]">{solicitante.nome}</p>
        <p className={`${finTextTertiary} truncate`}>
          {tituloReconhecidoPontuaGarbo(solicitante.titulo)}
          {quando && ` · pediu em ${quando}`}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {solicitante.temPendente ? (
          <div className="text-right">
            <p className={`text-sm font-bold ${finValueGold}`}>
              {formatBRLPontua(solicitante.totalPendente)}
            </p>
            <Badge
              variant="outline"
              className="mt-0.5 border-[rgba(107,63,18,0.35)] bg-[#f4e4c4] text-[10px] font-semibold text-[#6b3f12]"
            >
              <Clock className="mr-1 h-2.5 w-2.5" aria-hidden />
              {pendentes > 1 ? `${pendentes} pendentes` : 'aguardando'}
            </Badge>
          </div>
        ) : (
          <div className="text-right">
            <p className={`text-sm font-semibold ${finValueOk}`}>
              {formatBRLPontua(solicitante.totalAprovado)}
            </p>
            <p className={finTextTertiary}>já pago</p>
          </div>
        )}
      </div>
    </li>
  );
}

interface CardProps {
  solicitantes: SaqueSolicitante[];
  totalPendente: number;
  onVerTodos: () => void;
}

/** Quem pediu saque, agrupado por arquiteto. A aprovação em si fica no painel de pedidos. */
export function PontuaSolicitantesSaqueCard({
  solicitantes,
  totalPendente,
  onVerTodos,
}: CardProps) {
  const pendentes = solicitantes.filter((s) => s.temPendente);
  const lista = (pendentes.length > 0 ? pendentes : solicitantes).slice(0, PREVIA);
  const restantes = (pendentes.length > 0 ? pendentes : solicitantes).length - lista.length;

  return (
    <section className={`rounded-2xl border p-5 sm:p-6 ${finCard}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl text-[#1a100c]">
            <ArrowDownToLine className={`h-4 w-4 ${finValueGold}`} aria-hidden />
            Quem solicitou saque
          </h2>
          <p className={`${finCardMuted} mt-1`}>
            {pendentes.length > 0
              ? `${pendentes.length} arquiteto${pendentes.length > 1 ? 's' : ''} aguardando · ${formatBRLPontua(totalPendente)}`
              : 'Nenhum pedido aguardando aprovação.'}
          </p>
        </div>
        {solicitantes.length > 0 && (
          <button
            type="button"
            onClick={onVerTodos}
            className="rounded-md text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b3f12] underline decoration-[rgba(107,63,18,0.4)] underline-offset-4 transition hover:decoration-[#6b3f12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(107,63,18,0.5)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffaf4]"
          >
            Ver todos ({solicitantes.length})
          </button>
        )}
      </div>

      {lista.length === 0 ? (
        <p className="py-6 text-center text-sm text-[#6b5244]">
          Nenhum arquiteto solicitou saque até agora.
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {lista.map((s) => (
              <SolicitanteRow key={s.prestadorId} solicitante={s} />
            ))}
          </ul>
          {restantes > 0 && (
            <p className={`${finTextTertiary} mt-3`}>
              e mais {restantes} arquiteto{restantes > 1 ? 's' : ''} na lista completa.
            </p>
          )}
        </>
      )}
    </section>
  );
}

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  solicitantes: SaqueSolicitante[];
}

export function PontuaSolicitantesSaqueDialog({
  open,
  onOpenChange,
  solicitantes,
}: DialogProps) {
  const pendentes = solicitantes.filter((s) => s.temPendente);
  const historico = solicitantes.filter((s) => !s.temPendente);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-[rgba(26,16,12,0.14)] bg-[#fffaf4]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-[#1a100c]">
            Solicitações de saque
          </DialogTitle>
          <DialogDescription className="text-[#4a3428]">
            {solicitantes.length} arquiteto{solicitantes.length === 1 ? '' : 's'} já pediram
            retirada no Pontua Garbo.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-3">
          <div className="space-y-5">
            {pendentes.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b3f12]">
                  Aguardando aprovação ({pendentes.length})
                </p>
                <ul className="space-y-2">
                  {pendentes.map((s) => (
                    <SolicitanteRow key={s.prestadorId} solicitante={s} />
                  ))}
                </ul>
              </div>
            )}

            {historico.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#4a3428]">
                  Já processados ({historico.length})
                </p>
                <ul className="space-y-2">
                  {historico.map((s) => (
                    <SolicitanteRow key={s.prestadorId} solicitante={s} />
                  ))}
                </ul>
              </div>
            )}

            {solicitantes.length === 0 && (
              <p className="py-8 text-center text-sm text-[#6b5244]">
                Nenhum arquiteto solicitou saque até agora.
              </p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
