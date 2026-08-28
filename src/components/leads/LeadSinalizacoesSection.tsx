import { useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, Clock, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useLeadSinalizacoes } from '@/hooks/useLeadSinalizacoes';
import { LeadModalSection } from '@/components/leads/LeadModalSection';

interface LeadSinalizacoesSectionProps {
  leadId: number;
}

/** Sinalizações pendentes para este lead — visível até marcar como concluída. */
export function LeadSinalizacoesSection({ leadId }: LeadSinalizacoesSectionProps) {
  const { pendentes, fecharSinalizacao } = useLeadSinalizacoes();

  const pendentesDoLead = useMemo(
    () => pendentes.filter((s) => s.lead_id === leadId),
    [pendentes, leadId],
  );

  if (pendentesDoLead.length === 0) return null;

  return (
    <LeadModalSection
      variant="alert"
      title="Sinalização pendente"
      icon={Flag}
      badge={
        <Badge
          variant="outline"
          className="border-orange-500/40 bg-orange-500/15 text-[10px] text-orange-900 dark:text-orange-100"
        >
          {pendentesDoLead.length}
        </Badge>
      }
      className="border-orange-500/40 [&>div:last-child]:py-3"
    >
      <div className="space-y-3">
        {pendentesDoLead.map((item) => (
          <div
            key={item.id}
            className={cn(
              'space-y-2 rounded-lg border border-orange-500/30 bg-mahogany-muted/20 p-3',
              pendentesDoLead.length > 1 && 'shadow-sm',
            )}
          >
            <div className="flex flex-wrap gap-1">
              <Badge
                variant="secondary"
                className="text-[10px] h-5 bg-orange-500/15 text-orange-900 dark:text-orange-100"
              >
                {item.enviado_para_todos ? 'Para todos os titulares' : 'Para você'}
              </Badge>
            </div>

            {item.mensagem?.trim() ? (
              <p className="text-sm rounded-md border border-orange-500/25 bg-orange-500/10 px-2.5 py-2 text-foreground whitespace-pre-wrap break-words">
                {item.mensagem.trim()}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground italic">Sem observação na sinalização.</p>
            )}

            <p className="text-xs text-muted-foreground">
              Sinalizado por <strong>{item.sinalizado_por_nome}</strong>
              <span className="inline-flex items-center gap-1 ml-2">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(item.criado_em), { addSuffix: true, locale: ptBR })}
              </span>
            </p>

            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full h-8 text-xs border-orange-500/40 text-orange-900 hover:bg-orange-50"
              disabled={fecharSinalizacao.isPending}
              onClick={() => void fecharSinalizacao.mutateAsync(item.id)}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              Marcar como concluída
            </Button>
          </div>
        ))}
      </div>
    </LeadModalSection>
  );
}
