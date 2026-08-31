import { useState } from 'react';
import { Check, Loader2, Undo2, X, Wallet, Receipt } from 'lucide-react';
import { useSaquePedidosAdmin } from '@/hooks/useSaquePedidos';
import { usePontuaGarboFinanceiro } from '@/hooks/usePontuaGarboFinanceiro';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { abrirReciboSaque } from '@/lib/recibo-saque-print';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { TIPO_PIX_LABELS, type SaquePedido, type TipoChavePix } from '@/hooks/usePrestadorPerfil';
import {
  finCard,
  finCardMuted,
  finRowBase,
  finTextSecondary,
  finTextTertiary,
  finValueGold,
  finValueOk,
} from '@/components/financeiro/financeiro-styles';

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export function SaquePedidosAdminPanel({ readOnly }: { readOnly?: boolean }) {
  const { pedidos, pendentes, isLoading, aprovar, rejeitar, reverterAprovacao } =
    useSaquePedidosAdmin();
  const { prestadores } = usePontuaGarboFinanceiro();
  const { empresa } = useEmpresa();
  const [rejeitarId, setRejeitarId] = useState<string | null>(null);
  const [obsRejeitar, setObsRejeitar] = useState('');
  const [reverterPedido, setReverterPedido] = useState<SaquePedido | null>(null);

  const nomePrestador = (id: string) =>
    prestadores.find((p) => p.id === id)?.nome ?? 'Arquiteto';

  const pedidoRejeitar = pedidos.find((p) => p.id === rejeitarId);

  const confirmarRejeitar = () => {
    if (!rejeitarId) return;
    rejeitar.mutate(
      { id: rejeitarId, obs: obsRejeitar.trim() || undefined },
      {
        onSuccess: () => {
          setRejeitarId(null);
          setObsRejeitar('');
        },
      },
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className={`h-6 w-6 animate-spin ${finValueGold}`} />
        </CardContent>
      </Card>
    );
  }

  if (pendentes.length === 0 && pedidos.length === 0) return null;

  return (
    <>
      <Card className={`${finCard} border-[rgba(20,108,56,0.28)]`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-[#1a100c]">
            <Wallet className={`h-4 w-4 ${finValueOk}`} />
            Saques solicitados pelos prestadores
            {pendentes.length > 0 && (
              <Badge className="bg-[#f4e4c4] text-[#6b3f12] border-[rgba(107,63,18,0.28)]">
                {pendentes.length} pendente{pendentes.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </CardTitle>
          <p className={`text-sm ${finCardMuted}`}>
            {readOnly
              ? 'Pedidos de saque dos prestadores. Somente o administrador pode marcar como pago.'
              : 'Ao marcar como pago, o valor é registrado como retirada e some do saldo do prestador.'}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendentes.length === 0 ? (
            <p className={`text-sm ${finCardMuted}`}>Nenhum pedido aguardando liberação.</p>
          ) : (
            pendentes.map((p) => (
              <SaquePedidoRow
                key={p.id}
                pedido={p}
                prestadorNome={nomePrestador(p.prestador_id)}
                saldoParaSacar={
                  prestadores.find((pr) => pr.id === p.prestador_id)?.saldoParaSacar ?? 0
                }
                onAprovar={() => aprovar.mutate(p)}
                onRejeitar={() => {
                  setRejeitarId(p.id);
                  setObsRejeitar('');
                }}
                isAprovando={aprovar.isPending}
                readOnly={readOnly}
              />
            ))
          )}

          {pedidos.filter((p) => p.status !== 'pendente').length > 0 && (
            <div className="pt-4 border-t space-y-2">
              <p className={`text-xs font-medium ${finTextTertiary} uppercase tracking-wider`}>
                Histórico recente
              </p>
              {pedidos
                .filter((p) => p.status !== 'pendente')
                .slice(0, 8)
                .map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between gap-2 text-sm px-3 py-2 ${finRowBase}`}
                  >
                    <span className="truncate min-w-0">
                      {nomePrestador(p.prestador_id)} · {BRL(Number(p.valor_solicitado))}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {!readOnly && p.status === 'aprovado' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 border-[rgba(107,63,18,0.35)] text-[#6b3f12] hover:bg-[#f4e4c4]"
                          disabled={reverterAprovacao.isPending}
                          onClick={() => setReverterPedido(p)}
                        >
                          <Undo2 className="h-3 w-3" />
                          Desfazer
                        </Button>
                      )}
                      {p.status === 'aprovado' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 border-[rgba(20,108,56,0.35)] text-[#146c38] hover:bg-[#e8f6ee]"
                          onClick={() =>
                            abrirReciboSaque({
                              prestadorNome: nomePrestador(p.prestador_id),
                              valorSolicitado: Number(p.valor_solicitado),
                              chavePix: p.chave_pix,
                              tipoChavePix: p.tipo_chave_pix,
                              processadoEm: p.processado_em,
                              logoUrl: empresa?.logo_url,
                              nomeEmpresa: empresa?.nome,
                              razaoSocial: empresa?.razao_social,
                              cnpj: empresa?.cnpj,
                            })
                          }
                        >
                          <Receipt className="h-3 w-3" />
                          Recibo
                        </Button>
                      )}
                      <Badge
                        variant="outline"
                        className={
                          p.status === 'aprovado'
                            ? 'text-[#146c38] border-[rgba(20,108,56,0.35)] bg-[#e8f6ee]'
                            : 'text-[#9f1239] border-[rgba(159,18,57,0.35)] bg-[#fde8ee]'
                        }
                      >
                        {p.status === 'aprovado' ? 'Pago' : 'Rejeitado'}
                      </Badge>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!rejeitarId} onOpenChange={(o) => !o && setRejeitarId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeitar pedido de saque</DialogTitle>
          </DialogHeader>
          {pedidoRejeitar && (
            <p className={finTextSecondary}>
              {nomePrestador(pedidoRejeitar.prestador_id)} ·{' '}
              {BRL(Number(pedidoRejeitar.valor_solicitado))}
            </p>
          )}
          <Textarea
            rows={2}
            placeholder="Motivo (opcional)"
            value={obsRejeitar}
            onChange={(e) => setObsRejeitar(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejeitarId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmarRejeitar}
              disabled={rejeitar.isPending}
            >
              {rejeitar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!reverterPedido} onOpenChange={(o) => !o && setReverterPedido(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desfazer pagamento do saque?</AlertDialogTitle>
            <AlertDialogDescription>
              {reverterPedido && (
                <>
                  O pedido de {nomePrestador(reverterPedido.prestador_id)} (
                  {BRL(Number(reverterPedido.valor_solicitado))}) voltará para{' '}
                  <strong>pendente</strong>, a retirada será apagada e o saldo do prestador será
                  recalculado.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700"
              disabled={reverterAprovacao.isPending}
              onClick={() => {
                if (reverterPedido) {
                  reverterAprovacao.mutate(reverterPedido, {
                    onSuccess: () => setReverterPedido(null),
                  });
                }
              }}
            >
              {reverterAprovacao.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Desfazer pagamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SaquePedidoRow({
  pedido,
  prestadorNome,
  saldoParaSacar,
  onAprovar,
  onRejeitar,
  isAprovando,
  readOnly,
}: {
  pedido: SaquePedido;
  prestadorNome: string;
  saldoParaSacar: number;
  onAprovar: () => void;
  onRejeitar: () => void;
  isAprovando: boolean;
  readOnly?: boolean;
}) {
  const valor = Number(pedido.valor_solicitado);

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 ${finRowBase}`}>
      <div className="flex-1 min-w-0 space-y-1">
        <p className="font-semibold text-sm text-foreground">{prestadorNome}</p>
        <p className="text-lg font-bold text-[#146c38]">{BRL(valor)}</p>
        <p className={finTextSecondary}>
          Saldo disponível (vendas confirmadas − retiradas):{' '}
          <span className={saldoParaSacar > 0 ? 'text-[#146c38] font-medium' : 'text-[#9f1239] font-medium'}>
            {BRL(saldoParaSacar)}
          </span>
        </p>
        <p className={finTextTertiary}>
          {TIPO_PIX_LABELS[pedido.tipo_chave_pix as TipoChavePix] ?? pedido.tipo_chave_pix}:{' '}
          {pedido.chave_pix}
        </p>
        <p className={finTextTertiary}>{new Date(pedido.criado_em).toLocaleString('pt-BR')}</p>
      </div>
      {!readOnly && (
        <div className="flex gap-2 shrink-0">
          <Button
            size="sm"
            className="gap-1.5 bg-green-600 hover:bg-green-700"
            onClick={onAprovar}
            disabled={isAprovando}
          >
            {isAprovando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Marcar como pago
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={onRejeitar}>
            <X className="h-3.5 w-3.5" />
            Rejeitar
          </Button>
        </div>
      )}
    </div>
  );
}
