import { useMemo, useState } from 'react';
import { TrendingUp, Wallet, Trophy, Sparkles, Clock } from 'lucide-react';
import type { PontuaGarboResumoFinanceiro } from '@/lib/pontua-garbo';
import { calcSaldoExibidoPrestador } from '@/lib/pontua-garbo-saque';
import { PrestadorGanhosChart } from '@/components/prestador/PrestadorGanhosChart';
import { PrestadorSolicitarSaqueDialog } from '@/components/prestador/PrestadorSolicitarSaqueDialog';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { useMeusSaquePedidos } from '@/hooks/useSaquePedidos';
import { Button } from '@/components/ui/button';

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export interface PrestadorPortalResumoProps extends PontuaGarboResumoFinanceiro {
  saldoParaSacar: number;
  totalRetirado: number;
  totalAjustes?: number;
}

function SaldoRow({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Icon size={13} style={{ color, flexShrink: 0 }} />
        <span
          className="text-[10px] uppercase tracking-widest truncate"
          style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'Raleway, sans-serif', fontWeight: 600 }}
        >
          {label}
        </span>
      </div>
      <span className="font-display text-base shrink-0" style={{ color }}>
        {BRL(value)}
      </span>
    </div>
  );
}

function AGanharHero({
  valorCarteira,
  comissaoPendente,
  saldoJaLiberado,
}: {
  /** Carteira exibida (já sem o que está em Para sacar). */
  valorCarteira: number;
  /** Comissão de vendas ainda em andamento no pipeline. */
  comissaoPendente: number;
  /** Valor já liberado e mostrado em Para sacar. */
  saldoJaLiberado: number;
}) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-1.5"
      style={{
        background:
          'linear-gradient(135deg, rgba(240,210,140,0.18) 0%, rgba(240,210,140,0.04) 45%, rgba(255,255,255,0.02) 100%)',
        border: '1px solid rgba(240,210,140,0.35)',
        boxShadow: '0 8px 32px rgba(240,210,140,0.12), inset 0 1px 0 rgba(255,255,255,0.08)',
      }}
    >
      <div className="flex items-center gap-2">
        <TrendingUp size={15} style={{ color: '#f2d892' }} />
        <span
          className="text-[10px] uppercase tracking-[0.2em] font-semibold"
          style={{ color: 'rgba(240,210,140,0.85)', fontFamily: 'Raleway, sans-serif' }}
        >
          A ganhar
        </span>
      </div>
      <p className="font-display text-3xl leading-none" style={{ color: '#f2d892' }}>
        {BRL(valorCarteira)}
      </p>
      <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.32)' }}>
        Comissões em andamento e aguardando liberação
        {comissaoPendente > 0 && (
          <>
            {' '}
            · em negociação: <span style={{ color: 'rgba(240,210,140,0.7)' }}>{BRL(comissaoPendente)}</span>
          </>
        )}
        {saldoJaLiberado > 0 && (
          <>
            {' '}
            · já liberado (em Para sacar):{' '}
            <span style={{ color: 'rgba(74,222,128,0.75)' }}>{BRL(saldoJaLiberado)}</span>
          </>
        )}
      </p>
    </div>
  );
}

function ParaSacarHero({
  saldoDisponivel,
  valorReservado,
  onSacar,
}: {
  saldoDisponivel: number;
  valorReservado: number;
  onSacar: () => void;
}) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3"
      style={{
        background:
          'linear-gradient(135deg, rgba(74,222,128,0.22) 0%, rgba(74,222,128,0.06) 50%, rgba(255,255,255,0.02) 100%)',
        border: '1px solid rgba(74,222,128,0.4)',
        boxShadow: '0 12px 40px rgba(74,222,128,0.15), inset 0 1px 0 rgba(255,255,255,0.1)',
      }}
    >
      <div className="flex items-center gap-2">
        <Wallet size={18} style={{ color: '#4ade80' }} />
        <span
          className="text-[11px] uppercase tracking-[0.2em] font-semibold"
          style={{ color: 'rgba(74,222,128,0.9)', fontFamily: 'Raleway, sans-serif' }}
        >
          Para sacar
        </span>
      </div>
      <p className="font-display text-4xl leading-none" style={{ color: '#4ade80' }}>
        {BRL(saldoDisponivel)}
      </p>
      {valorReservado > 0 && (
        <p
          className="text-[11px] flex items-center gap-1.5"
          style={{ color: 'rgba(240,210,140,0.85)', fontFamily: 'Raleway, sans-serif' }}
        >
          <Clock size={12} />
          {BRL(valorReservado)} aguardando liberação do administrador
        </p>
      )}
      <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
        Comissão de vendas já realizadas no CRM, menos o que você já retirou ou está em análise.
      </p>
      <Button
        type="button"
        onClick={onSacar}
        disabled={saldoDisponivel <= 0}
        className="w-full h-11 text-sm font-semibold tracking-wide"
        style={{
          background: saldoDisponivel > 0 ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${saldoDisponivel > 0 ? 'rgba(74,222,128,0.5)' : 'rgba(255,255,255,0.1)'}`,
          color: saldoDisponivel > 0 ? '#4ade80' : 'rgba(255,255,255,0.3)',
        }}
      >
        Sacar
      </Button>
    </div>
  );
}

export function PrestadorPortalResumo({
  totalAGanar,
  totalComissaoCarteira,
  totalComissaoGanha,
  ganhoMesAtual,
  mediaMensalGanhos,
  ganhosPorMes,
  saldoParaSacar,
  totalRetirado,
  totalAjustes = 0,
}: PrestadorPortalResumoProps) {
  const { data: profile } = useCurrentUserProfile();
  const { pedidos, solicitar } = useMeusSaquePedidos(profile?.id);
  const [dialogOpen, setDialogOpen] = useState(false);

  const carteiraBruta = totalComissaoCarteira ?? totalAGanar + totalComissaoGanha;

  const exibido = useMemo(
    () =>
      calcSaldoExibidoPrestador(
        saldoParaSacar,
        carteiraBruta,
        totalAGanar,
        totalRetirado,
        totalComissaoGanha,
        totalAjustes,
        pedidos,
      ),
    [saldoParaSacar, carteiraBruta, totalAGanar, totalRetirado, totalComissaoGanha, totalAjustes, pedidos],
  );

  const profilePix = profile as { chave_pix?: string | null; tipo_chave_pix?: string | null } | undefined;

  const hasAny =
    totalAGanar > 0 ||
    carteiraBruta > 0 ||
    saldoParaSacar > 0 ||
    totalComissaoGanha > 0 ||
    totalRetirado > 0 ||
    exibido.valorReservado > 0;

  if (!hasAny) return null;

  return (
    <>
      <aside
        className="w-full shrink-0 flex flex-col gap-4"
        style={{ fontFamily: 'Raleway, sans-serif' }}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={14} style={{ color: 'rgba(240,210,140,0.7)' }} />
          <p
            className="text-[10px] uppercase tracking-[0.2em] font-semibold"
            style={{ color: 'rgba(240,210,140,0.75)' }}
          >
            Seu desempenho
          </p>
        </div>

        <div
          className="rounded-2xl overflow-hidden relative"
          style={{
            background:
              'linear-gradient(165deg, rgba(22,18,12,0.95) 0%, rgba(10,10,10,0.98) 55%, rgba(8,8,8,1) 100%)',
            border: '1px solid rgba(240,210,140,0.22)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.45), inset 0 1px 0 rgba(240,210,140,0.12)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div
            className="absolute top-0 right-0 w-24 h-24 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at 100% 0%, rgba(240,210,140,0.15), transparent 70%)',
            }}
          />

          <div className="p-4 flex flex-col gap-4">
            <AGanharHero
              valorCarteira={exibido.carteiraExibida}
              comissaoPendente={exibido.aGanharExibido}
              saldoJaLiberado={exibido.saldoDisponivel}
            />

            <ParaSacarHero
              saldoDisponivel={exibido.saldoDisponivel}
              valorReservado={exibido.valorReservado}
              onSacar={() => setDialogOpen(true)}
            />

            <div
              className="h-px"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(240,210,140,0.25), transparent)' }}
            />

            <PrestadorGanhosChart
              variant="sidebar"
              totalComissaoGanha={totalComissaoGanha}
              ganhoMesAtual={ganhoMesAtual}
              mediaMensalGanhos={mediaMensalGanhos}
              ganhosPorMes={ganhosPorMes}
            />

            {totalRetirado > 0 && (
              <>
                <div
                  className="h-px"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(240,210,140,0.25), transparent)',
                  }}
                />
                <SaldoRow icon={Trophy} label="Retirado" value={totalRetirado} color="rgba(255,255,255,0.45)" />
              </>
            )}

            <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.22)' }}>
              Ao sacar, o valor é descontado de &quot;A ganhar&quot; e de &quot;Para sacar&quot; na hora — você já
              não conta com esse dinheiro na carteira. Saques em análise ficam reservados até o administrador
              liberar na área Financeiro.
            </p>
          </div>
        </div>
      </aside>

      <PrestadorSolicitarSaqueDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        saldoDisponivel={exibido.saldoDisponivel}
        isPending={solicitar.isPending}
        defaultChavePix={profilePix?.chave_pix}
        defaultTipoChavePix={profilePix?.tipo_chave_pix}
        onConfirm={(input) =>
          solicitar.mutate(input, { onSuccess: () => setDialogOpen(false) })
        }
      />
    </>
  );
}
