import { Check, Loader2, Sparkles } from 'lucide-react';
import {
  useComissoesAguardandoLiberacao,
  useLiberarComissaoPontuaGarbo,
} from '@/hooks/usePontuaGarboComissaoLiberacao';
import { COMISSAO_LIBERACAO_LABEL_AGUARDANDO } from '@/lib/pontua-garbo-comissao-liberacao';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  finCard,
  finCardMuted,
  finCardTitle,
  finRowHighlight,
  finTextSecondary,
  finTextTertiary,
  finBadgePendente,
} from '@/components/financeiro/financeiro-styles';

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export function ComissoesLiberacaoAdminPanel({ readOnly }: { readOnly?: boolean }) {
  const { aguardando, isLoading } = useComissoesAguardandoLiberacao();
  const liberar = useLiberarComissaoPontuaGarbo();

  if (isLoading) {
    return (
      <Card className={`${finCard} ring-1 ring-amber-500/25`}>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
        </CardContent>
      </Card>
    );
  }

  if (aguardando.length === 0) return null;

  return (
    <Card className={`${finCard} ring-1 ring-amber-500/30`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 flex-wrap text-foreground">
          <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
          Comissões aguardando liberação
          <Badge className="bg-amber-500 text-amber-950 border-amber-400 animate-pulse font-semibold">
            {aguardando.length} pendente{aguardando.length !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
        <p className={`text-sm ${finCardMuted}`}>
          {readOnly
            ? 'Vendas concluídas com comissão para prestador, aguardando liberação do administrador.'
            : 'Vendas concluídas com comissão para prestador. Libere o valor para que ele possa sacar.'}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {aguardando.map((item) => (
          <div
            key={`${item.leadId}-${item.fieldId}`}
            className={`flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 ${finRowHighlight}`}
          >
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm truncate text-foreground">{item.leadNome}</p>
                <Badge variant="outline" className={finBadgePendente}>
                  {COMISSAO_LIBERACAO_LABEL_AGUARDANDO}
                </Badge>
              </div>
              <p className={finTextSecondary}>
                Arquiteto:{' '}
                <span className="font-medium text-amber-50">{item.prestadorNome}</span>
                {' · '}
                {item.fieldNome} · {item.leadStatus}
              </p>
              <p className={finTextTertiary}>
                Base {BRL(item.valorBase)} × {item.percentual}%
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0 sm:flex-col sm:items-end">
              <p className="text-lg font-bold text-amber-400">{BRL(item.valorComissao)}</p>
              {!readOnly && (
                <Button
                  size="sm"
                  className="gap-1.5 bg-amber-500 hover:bg-amber-400 text-amber-950 font-semibold shadow-md shadow-amber-900/30"
                  disabled={liberar.isPending}
                  onClick={() =>
                    liberar.mutate({
                      liberacaoId: item.liberacaoId,
                      leadId: item.leadId,
                      fieldId: item.fieldId,
                      prestadorId: item.prestadorId,
                      valorComissao: item.valorComissao,
                      percentual: item.percentual,
                      valorBase: item.valorBase,
                    })
                  }
                >
                  {liberar.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Liberar para o prestador
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
