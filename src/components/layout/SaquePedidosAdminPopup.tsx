import { useState } from 'react';
import { Check, Loader2, Minus, Wallet, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
import { cn } from '@/lib/utils';
import { floatingPopupMaxHeightStyle, floatingPopupPositionClass } from '@/lib/floating-ui-layout';
import { useNomesPrestadoresPorIds } from '@/hooks/useSaquePedidos';
import type { useSaquePedidosAdminAlert } from '@/hooks/useSaquePedidosAdminAlert';
import { TIPO_PIX_LABELS, type TipoChavePix } from '@/hooks/usePrestadorPerfil';

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

type SaqueAlert = ReturnType<typeof useSaquePedidosAdminAlert>;

interface SaquePedidosAdminPopupProps {
  alert: SaqueAlert;
}

export function SaquePedidosAdminPopup({ alert }: SaquePedidosAdminPopupProps) {
  const navigate = useNavigate();
  const [rejeitarId, setRejeitarId] = useState<string | null>(null);
  const [obsRejeitar, setObsRejeitar] = useState('');
  const {
    isPopupOpen,
    closePopup,
    pendentes,
    isLoading,
    aprovar,
    rejeitar,
  } = alert;
  const { data: nomesPrestadores } = useNomesPrestadoresPorIds(
    pendentes.map((p) => p.prestador_id),
    isPopupOpen,
  );

  const nomePrestador = (id: string) =>
    nomesPrestadores?.get(id) ?? 'Prestador';

  const pedidoRejeitar = pendentes.find((p) => p.id === rejeitarId);

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

  if (!isPopupOpen || alert.pendentesCount === 0) return null;

  return (
    <>
      <div
        className={cn(
          floatingPopupPositionClass,
          'w-[90vw] sm:w-[440px] max-w-[440px]',
          'bg-background border border-green-500/35 rounded-xl shadow-2xl',
          'flex flex-col overflow-hidden',
          'animate-in fade-in slide-in-from-top-2 duration-200',
        )}
        style={floatingPopupMaxHeightStyle}
        role="dialog"
        aria-label="Saques pendentes de prestadores"
      >
        <div className="p-3 sm:p-4 border-b flex items-center justify-between gap-2 shrink-0 bg-green-500/10">
          <div className="flex items-center gap-2 min-w-0">
            <Wallet className="h-5 w-5 text-green-500 shrink-0" />
            <div className="min-w-0">
              <h3 className="font-semibold text-sm sm:text-base truncate">
                Saques a pagar
              </h3>
              <p className="text-[11px] text-muted-foreground truncate">
                Prestadores aguardando PIX
              </p>
            </div>
            <Badge className="bg-amber-500 text-amber-950 shrink-0 animate-pulse">
              {pendentes.length}
            </Badge>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                closePopup();
                navigate('/financeiro');
              }}
              title="Abrir Financeiro"
            >
              <Wallet className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={closePopup}
              title="Minimizar (ícone no topo)"
            >
              <Minus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-green-500" />
            </div>
          ) : (
            pendentes.map((p) => {
              const valor = Number(p.valor_solicitado);

              return (
                <div
                  key={p.id}
                  className="rounded-lg border border-green-500/25 bg-muted/30 p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {nomePrestador(p.prestador_id)}
                      </p>
                      <p className="text-lg font-bold text-green-500">{BRL(valor)}</p>
                      <p className="text-xs text-muted-foreground">
                        {TIPO_PIX_LABELS[p.tipo_chave_pix as TipoChavePix] ?? p.tipo_chave_pix}:{' '}
                        <span className="font-mono text-foreground/90">{p.chave_pix}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(p.criado_em).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="gap-1.5 bg-green-600 hover:bg-green-700 flex-1 sm:flex-none"
                      onClick={() => aprovar.mutate(p)}
                      disabled={aprovar.isPending}
                    >
                      {aprovar.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Marcar como pago
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => {
                        setRejeitarId(p.id);
                        setObsRejeitar('');
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                      Rejeitar
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <Dialog open={!!rejeitarId} onOpenChange={(o) => !o && setRejeitarId(null)}>
        <DialogContent className="max-w-md z-[70]">
          <DialogHeader>
            <DialogTitle>Rejeitar pedido de saque</DialogTitle>
          </DialogHeader>
          {pedidoRejeitar && (
            <p className="text-sm text-muted-foreground">
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
    </>
  );
}
