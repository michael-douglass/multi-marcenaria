import { useMemo, useState } from 'react';
import { usePontuaGarboFinanceiro } from '@/hooks/usePontuaGarboFinanceiro';
import { useSaquePedidosAdmin } from '@/hooks/useSaquePedidos';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  canManagePontuaGarboFinanceiro,
  canViewPontuaGarboFinanceiro,
} from '@/lib/pontua-garbo-access';
import { Trophy, Users } from 'lucide-react';
import { SaquePedidosAdminPanel } from '@/components/financeiro/SaquePedidosAdminPanel';
import { ComissoesLiberacaoAdminPanel } from '@/components/financeiro/ComissoesLiberacaoAdminPanel';
import { ArquitetosPontuaDialog } from '@/components/financeiro/ArquitetosPontuaDialog';
import { FinanceiroPontuaPageAura } from '@/components/financeiro/FinanceiroPontuaPageAura';
import {
  PontuaMetricasCards,
  PontuaMetricasCardsSkeleton,
} from '@/components/financeiro/PontuaMetricasCards';
import {
  PontuaCadastrosChart,
  PontuaComissoesChart,
} from '@/components/financeiro/PontuaGraficos';
import {
  PontuaSolicitantesSaqueCard,
  PontuaSolicitantesSaqueDialog,
} from '@/components/financeiro/PontuaSolicitantesSaque';
import { calcularPontuaMetricas } from '@/lib/pontua-garbo-metricas';
import { FinanceiroPontuaPdfExportButton } from '@/components/financeiro/FinanceiroPontuaPdfExportButton';
import { useEmpresa } from '@/contexts/EmpresaContext';
import type { FinanceiroPontuaPdfExportInput } from '@/lib/financeiro-pontua-pdf-export';

const PERIODOS = [
  { meses: 6, label: '6 meses' },
  { meses: 12, label: '12 meses' },
] as const;

export default function Financeiro() {
  const { empresa } = useEmpresa();
  const { userRole, userRoles, isSuperAdmin } = useAuth();
  const { prestadores, isLoading } = usePontuaGarboFinanceiro();
  const { pedidos, isLoading: saquesLoading } = useSaquePedidosAdmin();
  const [busca, setBusca] = useState('');
  const [destaqueId, setDestaqueId] = useState<string | null>(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const [solicitantesAberto, setSolicitantesAberto] = useState(false);
  const [meses, setMeses] = useState<number>(12);

  const canManage = canManagePontuaGarboFinanceiro(userRole, isSuperAdmin);
  const canView = canViewPontuaGarboFinanceiro(userRole, isSuperAdmin, userRoles);

  const metricas = useMemo(
    () => calcularPontuaMetricas(prestadores, pedidos, { meses }),
    [prestadores, pedidos, meses],
  );

  const arquitetosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return prestadores;
    return prestadores.filter((p) => {
      const titulo = (p.titulo ?? '').toLowerCase();
      return (
        p.nome.toLowerCase().includes(q) ||
        (p.email ?? '').toLowerCase().includes(q) ||
        (p.telefone ?? '').includes(q) ||
        titulo.includes(q)
      );
    });
  }, [busca, prestadores]);

  const mediaMensalPaga = useMemo(() => {
    const comMovimento = metricas.serie.filter((b) => b.comissaoPaga > 0);
    if (comMovimento.length === 0) return 0;
    return comMovimento.reduce((s, b) => s + b.comissaoPaga, 0) / comMovimento.length;
  }, [metricas.serie]);

  const pdfExportInput = useMemo((): FinanceiroPontuaPdfExportInput | null => {
    if (isLoading || saquesLoading) return null;
    return {
      metricas,
      meses,
      arquitetos: arquitetosFiltrados,
      empresaNome: empresa?.nome ?? 'Movelaria Garbo',
      busca,
    };
  }, [isLoading, saquesLoading, metricas, meses, arquitetosFiltrados, empresa?.nome, busca]);

  if (!canView) {
    return (
      <div className="financeiro-pontua-shell flex min-h-[40vh] items-center justify-center">
        <p className="text-[#4a3428]">Acesso restrito.</p>
      </div>
    );
  }

  const carregando = isLoading || saquesLoading;

  return (
    <div className="financeiro-pontua-shell relative -mx-2 -mt-2 min-h-[calc(100svh-4.25rem)] px-3 pb-10 sm:-mx-3 sm:-mt-3 sm:px-4 md:px-8">
      <FinanceiroPontuaPageAura />

      <div className="relative z-[1] mx-auto max-w-6xl space-y-6 pt-4 md:pt-8">
        <header className="relative overflow-hidden rounded-2xl border border-[rgba(26,16,12,0.12)] bg-[#fffaf4] px-5 py-6 shadow-[0_12px_32px_rgba(42,24,18,0.06)] sm:px-8 sm:py-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6b3f12]">
                <Trophy className="h-3.5 w-3.5" aria-hidden />
                Financeiro · Pontua Garbo
                {!canManage && (
                  <Badge
                    variant="outline"
                    className="border-[rgba(107,63,18,0.35)] text-[10px] font-normal normal-case tracking-normal text-[#6b3f12]"
                  >
                    Somente visualização
                  </Badge>
                )}
              </p>
              <h1 className="mt-2 font-display text-3xl italic leading-tight text-[#1a100c] sm:text-5xl">
                Painel do Pontua
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-[#4a3428] sm:text-base">
                Cadastro de arquitetos mês a mês, quem está pontuando, quem pediu saque e
                quanto de comissão o programa já pagou.
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <FinanceiroPontuaPdfExportButton
                input={pdfExportInput}
                disabled={carregando}
              />
              <div
                className="inline-flex rounded-lg border border-[rgba(26,16,12,0.16)] bg-white p-0.5"
                role="group"
                aria-label="Período do painel"
              >
                {PERIODOS.map((p) => (
                  <button
                    key={p.meses}
                    type="button"
                    onClick={() => setMeses(p.meses)}
                    aria-pressed={meses === p.meses}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(107,63,18,0.5)] ${
                      meses === p.meses
                        ? 'bg-[#f4e4c4] text-[#6b3f12]'
                        : 'text-[#6b5244] hover:text-[#1a100c]'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <Button
                type="button"
                onClick={() => setMenuAberto(true)}
                className="border border-[rgba(107,63,18,0.35)] bg-[#6b3f12] text-[#fffaf4] hover:bg-[#552f0c]"
              >
                <Users className="mr-2 h-4 w-4" aria-hidden />
                Lista de arquitetos ({prestadores.length})
              </Button>
            </div>
          </div>
        </header>

        {carregando ? (
          <PontuaMetricasCardsSkeleton />
        ) : (
          <PontuaMetricasCards
            metricas={metricas}
            onAbrirSolicitantes={() => setSolicitantesAberto(true)}
          />
        )}

        <PontuaCadastrosChart serie={metricas.serie} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <PontuaComissoesChart serie={metricas.serie} mediaMensal={mediaMensalPaga} />
          <PontuaSolicitantesSaqueCard
            solicitantes={metricas.solicitantes}
            totalPendente={metricas.totalSolicitadoPendente}
            onVerTodos={() => setSolicitantesAberto(true)}
          />
        </div>

        <ComissoesLiberacaoAdminPanel readOnly={!canManage} />

        <SaquePedidosAdminPanel readOnly={!canManage} />
      </div>

      <ArquitetosPontuaDialog
        open={menuAberto}
        onOpenChange={setMenuAberto}
        arquitetos={arquitetosFiltrados}
        totalCadastrados={prestadores.length}
        isLoading={isLoading}
        busca={busca}
        onBuscaChange={setBusca}
        selecionadoId={destaqueId}
        onSelecionar={setDestaqueId}
        readOnly={!canManage}
      />

      <PontuaSolicitantesSaqueDialog
        open={solicitantesAberto}
        onOpenChange={setSolicitantesAberto}
        solicitantes={metricas.solicitantes}
      />
    </div>
  );
}
