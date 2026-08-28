import { useMemo, useState } from 'react';
import { Wallet, TrendingUp, Trophy } from 'lucide-react';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { useMinhaPontuaGarbo } from '@/hooks/usePontuaGarboFinanceiro';
import { useMeusSaquePedidos } from '@/hooks/useSaquePedidos';
import { calcSaldoExibidoPrestador } from '@/lib/pontua-garbo-saque';
import { TIPO_PIX_LABELS, type TipoChavePix } from '@/hooks/usePrestadorPerfil';
import { PrestadorGanhosChart } from '@/components/prestador/PrestadorGanhosChart';
import { PrestadorSolicitarSaqueDialog } from '@/components/prestador/PrestadorSolicitarSaqueDialog';
import { Button } from '@/components/ui/button';

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function MetricTile({
  icon: Icon,
  label,
  value,
  color,
  large,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
  large?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl flex flex-col gap-2 ${large ? 'p-6 sm:col-span-2' : 'p-5'}`}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div className="flex items-center gap-1.5">
        <Icon size={large ? 16 : 13} style={{ color }} />
        <span
          style={{
            color: 'rgba(255,255,255,0.3)',
            fontSize: 10,
            letterSpacing: '0.14em',
            textTransform: 'uppercase' as const,
            fontFamily: 'Raleway, sans-serif',
            fontWeight: 600,
          }}
        >
          {label}
        </span>
      </div>
      <p className={`font-display ${large ? 'text-4xl md:text-5xl' : 'text-2xl md:text-3xl'}`} style={{ color }}>
        {BRL(value)}
      </p>
    </div>
  );
}

function statusBadge(status: string) {
  if (status === 'pendente') return { label: 'Pendente', color: '#f2d892', bg: 'rgba(240,210,140,0.12)' };
  if (status === 'aprovado') return { label: 'Pago', color: '#4ade80', bg: 'rgba(74,222,128,0.1)' };
  return { label: 'Rejeitado', color: '#f87171', bg: 'rgba(248,113,113,0.1)' };
}

export function PrestadorSaldo() {
  const { data: profile } = useCurrentUserProfile();
  const { data: garbo } = useMinhaPontuaGarbo(profile?.id);
  const { pedidos, solicitar } = useMeusSaquePedidos(profile?.id);
  const [dialogOpen, setDialogOpen] = useState(false);

  const carteiraBruta =
    garbo?.totalComissaoCarteira ?? (garbo?.totalAGanar ?? 0) + (garbo?.totalComissaoGanha ?? 0);

  const exibido = useMemo(
    () =>
      calcSaldoExibidoPrestador(
        garbo?.saldoParaSacar ?? 0,
        carteiraBruta,
        garbo?.totalAGanar ?? garbo?.totalComissao ?? 0,
        garbo?.totalRetirado ?? 0,
        garbo?.totalComissaoGanha ?? 0,
        garbo?.totalAjustes ?? 0,
        pedidos,
      ),
    [garbo, carteiraBruta, pedidos],
  );

  const retirado = garbo?.totalRetirado ?? 0;
  const profilePix = profile as { chave_pix?: string | null; tipo_chave_pix?: string | null } | undefined;

  return (
    <div
      className="relative z-10 flex flex-col gap-8 px-6 md:px-14 py-10"
      style={{ minHeight: 'calc(100dvh - 80px)', overflowY: 'auto', paddingBottom: 120 }}
    >
      <div>
        <div className="h-px bg-amber-400/30 mb-5" style={{ width: '2.5rem' }} />
        <h2 className="font-display text-white text-3xl md:text-4xl tracking-wide">Saldo</h2>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginTop: 4, letterSpacing: '0.05em' }}>
          Sua comissão e retiradas
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <MetricTile icon={TrendingUp} label="A ganhar" value={exibido.carteiraExibida} color="#f2d892" />
        <MetricTile
          icon={Wallet}
          label="Para sacar"
          value={exibido.saldoDisponivel}
          color="#4ade80"
          large
        />
        <MetricTile icon={Trophy} label="Retirado" value={retirado} color="rgba(255,255,255,0.35)" />
      </div>

      {(garbo?.totalAguardandoLiberacao ?? 0) > 0 && (
        <p className="text-xs -mt-4" style={{ color: 'rgba(240,210,140,0.85)', fontFamily: 'Raleway, sans-serif' }}>
          {BRL(garbo?.totalAguardandoLiberacao ?? 0)} de vendas concluídas aguardam o administrador liberar a comissão
          antes de entrar em &quot;Para sacar&quot;.
        </p>
      )}

      {exibido.valorReservado > 0 && (
        <p className="text-xs -mt-2" style={{ color: 'rgba(240,210,140,0.75)', fontFamily: 'Raleway, sans-serif' }}>
          {BRL(exibido.valorReservado)} em pedido de saque aguardando pagamento PIX.
        </p>
      )}

      <Button
        type="button"
        onClick={() => setDialogOpen(true)}
        disabled={exibido.saldoDisponivel <= 0}
        className="w-full sm:w-auto h-12 px-8 text-sm font-semibold tracking-wide"
        style={{
          background: exibido.saldoDisponivel > 0 ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${exibido.saldoDisponivel > 0 ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.1)'}`,
          color: exibido.saldoDisponivel > 0 ? '#4ade80' : 'rgba(255,255,255,0.25)',
        }}
      >
        Sacar
      </Button>

      <PrestadorGanhosChart
        totalComissaoGanha={garbo?.totalComissaoGanha ?? 0}
        ganhoMesAtual={garbo?.ganhoMesAtual ?? 0}
        mediaMensalGanhos={garbo?.mediaMensalGanhos ?? 0}
        ganhosPorMes={garbo?.ganhosPorMes ?? []}
      />

      {pedidos.length > 0 && (
        <div className="flex flex-col gap-3">
          <span
            style={{
              fontSize: 10,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.35)',
              fontFamily: 'Raleway, sans-serif',
              fontWeight: 600,
            }}
          >
            Histórico de saques
          </span>
          <div className="flex flex-col gap-2">
            {pedidos.map((p) => {
              const badge = statusBadge(p.status);
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-xl px-4 py-3"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <p className="text-white/70 text-sm font-medium" style={{ fontFamily: 'Raleway, sans-serif' }}>
                      {BRL(Number(p.valor_solicitado))}
                    </p>
                    <p className="text-white/25 text-xs truncate">
                      {TIPO_PIX_LABELS[p.tipo_chave_pix as TipoChavePix] ?? p.tipo_chave_pix}: {p.chave_pix}
                    </p>
                    <p className="text-white/20 text-xs">
                      {new Date(p.criado_em).toLocaleDateString('pt-BR')}
                    </p>
                    {p.obs_admin && <p className="text-white/25 text-xs mt-0.5 italic">{p.obs_admin}</p>}
                  </div>
                  <span
                    className="shrink-0 text-xs px-2.5 py-1 rounded-full ml-3"
                    style={{
                      background: badge.bg,
                      color: badge.color,
                      fontFamily: 'Raleway, sans-serif',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                    }}
                  >
                    {badge.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <PrestadorSolicitarSaqueDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        saldoDisponivel={exibido.saldoDisponivel}
        isPending={solicitar.isPending}
        defaultChavePix={profilePix?.chave_pix}
        defaultTipoChavePix={profilePix?.tipo_chave_pix}
        onConfirm={(input) => solicitar.mutate(input, { onSuccess: () => setDialogOpen(false) })}
      />
    </div>
  );
}
