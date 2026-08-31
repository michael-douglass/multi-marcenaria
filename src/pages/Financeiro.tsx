import { useMemo, useState } from 'react';
import { usePontuaGarboFinanceiro } from '@/hooks/usePontuaGarboFinanceiro';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  canManagePontuaGarboFinanceiro,
  canViewPontuaGarboFinanceiro,
} from '@/lib/pontua-garbo-access';
import {
  Trophy,
  Wallet,
  TrendingUp,
  Loader2,
  ScrollText,
  Award,
  ArrowDownToLine,
} from 'lucide-react';
import { SaquePedidosAdminPanel } from '@/components/financeiro/SaquePedidosAdminPanel';
import { ComissoesLiberacaoAdminPanel } from '@/components/financeiro/ComissoesLiberacaoAdminPanel';
import { ArquitetosPontuaGarboMural } from '@/components/financeiro/ArquitetosPontuaGarboMural';
import { PrestadorFinanceiroRow } from '@/components/financeiro/PrestadorFinanceiroRow';
import { FinanceiroPontuaPageAura } from '@/components/financeiro/FinanceiroPontuaPageAura';
import { formatBRLPontua } from '@/lib/pontua-garbo-arquiteto';
import {
  finCard,
  finCardMuted,
  finCardTitle,
  finTextTertiary,
  finValueGold,
  finValueLate,
  finValueOk,
} from '@/components/financeiro/financeiro-styles';

export default function Financeiro() {
  const { userRole, userRoles, isSuperAdmin } = useAuth();
  const { prestadores, isLoading } = usePontuaGarboFinanceiro();
  const [busca, setBusca] = useState('');
  const [destaqueId, setDestaqueId] = useState<string | null>(null);
  const canManage = canManagePontuaGarboFinanceiro(userRole, isSuperAdmin);
  const canView = canViewPontuaGarboFinanceiro(userRole, isSuperAdmin, userRoles);

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

  if (!canView) {
    return (
      <div className="financeiro-pontua-shell flex min-h-[40vh] items-center justify-center">
        <p className="text-[#4a3428]">Acesso restrito.</p>
      </div>
    );
  }

  const totalGeral = prestadores.reduce((s, p) => s + p.totalComissao, 0);
  const totalRetirado = prestadores.reduce((s, p) => s + p.totalRetirado, 0);
  const totalAPagar = prestadores.reduce((s, p) => s + p.saldoParaSacar, 0);

  const handleSelecionarArquiteto = (id: string) => {
    setDestaqueId(id);
  };

  return (
    <div className="financeiro-pontua-shell relative -mx-2 -mt-2 min-h-[calc(100svh-4.25rem)] px-3 pb-10 sm:-mx-3 sm:-mt-3 sm:px-4 md:px-8">
      <FinanceiroPontuaPageAura />
      <div className="relative z-[1] mx-auto max-w-6xl space-y-6 pt-4 md:pt-8">
      <header className="relative overflow-hidden rounded-2xl border border-[rgba(26,16,12,0.12)] bg-[#fffaf4] px-5 py-6 shadow-[0_12px_32px_rgba(42,24,18,0.06)] sm:px-8 sm:py-8">
        <div className="relative">
          <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6b3f12]">
            <Trophy className="h-3.5 w-3.5" aria-hidden />
            Financeiro · Pontua Garbo
            {!canManage && (
              <Badge variant="outline" className="normal-case tracking-normal text-[10px] font-normal text-[#6b3f12] border-[rgba(107,63,18,0.35)]">
                Somente visualização
              </Badge>
            )}
          </p>
          <h1 className="mt-2 font-display text-3xl italic leading-tight text-[#1a100c] sm:text-5xl">
            Arquitetos cadastrados
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#4a3428] sm:text-base">
            {canManage
              ? 'Quem entra no Pontua Garbo é reconhecido aqui: nome, título de arquiteto, comissões e saldo a pagar.'
              : 'Consulta dos arquitetos, comissões e saldos do Pontua Garbo. Alterações ficam com o administrador.'}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className={`${finCard} border-[rgba(107,63,18,0.28)]`}>
          <CardHeader className="pb-2">
            <CardTitle className={`${finCardTitle} flex items-center gap-2`}>
              <Award className={`h-4 w-4 ${finValueGold}`} />
              Arquitetos cadastrados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`font-display text-3xl font-semibold ${finValueGold}`}>{prestadores.length}</p>
            <p className={`${finCardMuted} mt-1`}>reconhecidos no Pontua Garbo</p>
          </CardContent>
        </Card>

        <Card className={`${finCard} border-[rgba(107,63,18,0.22)]`}>
          <CardHeader className="pb-2">
            <CardTitle className={`${finCardTitle} flex items-center gap-2`}>
              <TrendingUp className={`h-4 w-4 ${finValueGold}`} />
              Total comissões
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${finValueGold}`}>{formatBRLPontua(totalGeral)}</p>
            <p className={`${finCardMuted} mt-1`}>calculado pelos leads do programa</p>
          </CardContent>
        </Card>

        <Card className={`${finCard} border-[rgba(159,18,57,0.28)]`}>
          <CardHeader className="pb-2">
            <CardTitle className={`${finCardTitle} flex items-center gap-2`}>
              <ArrowDownToLine className={`h-4 w-4 ${finValueLate}`} />
              Total retirado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${finValueLate}`}>{formatBRLPontua(totalRetirado)}</p>
            <p className={`${finCardMuted} mt-1`}>registrado pelos admins</p>
          </CardContent>
        </Card>

        <Card className={`${finCard} border-[rgba(20,108,56,0.28)]`}>
          <CardHeader className="pb-2">
            <CardTitle className={`${finCardTitle} flex items-center gap-2`}>
              <Wallet className={`h-4 w-4 ${finValueOk}`} />
              Saldo a pagar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${finValueOk}`}>{formatBRLPontua(totalAPagar)}</p>
            <p className={`${finCardMuted} mt-1`}>pendente para os arquitetos</p>
          </CardContent>
        </Card>
      </div>

      <ArquitetosPontuaGarboMural
        arquitetos={arquitetosFiltrados}
        totalCadastrados={prestadores.length}
        isLoading={isLoading}
        busca={busca}
        onBuscaChange={setBusca}
        selecionadoId={destaqueId}
        onSelecionar={handleSelecionarArquiteto}
      />

      <ComissoesLiberacaoAdminPanel readOnly={!canManage} />

      <SaquePedidosAdminPanel readOnly={!canManage} />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-xl text-[#1a100c]">
            <ScrollText className={`h-4 w-4 ${finValueGold}`} />
            Carteira dos arquitetos
          </h2>
          {isLoading && <Loader2 className={`h-4 w-4 animate-spin ${finValueGold}`} />}
        </div>

        {!isLoading && prestadores.length === 0 && (
          <div className="rounded-xl border border-dashed border-[rgba(26,16,12,0.18)] bg-[#fffaf4] p-10 text-center">
            <Trophy className="mx-auto mb-3 h-8 w-8 text-[#6b3f12]/40" />
            <p className={`text-sm ${finCardMuted}`}>
              Nenhum arquiteto cadastrado no Pontua Garbo ainda.
            </p>
            <p className={`mt-1 text-xs ${finTextTertiary}`}>
              O cadastro pelo link do programa ou a opção &quot;Pontua Garbo&quot; no Admin faz a pessoa aparecer aqui.
            </p>
          </div>
        )}

        {!isLoading && prestadores.length > 0 && arquitetosFiltrados.length === 0 && (
          <p className={`text-sm ${finCardMuted}`}>Nenhum arquiteto corresponde à busca.</p>
        )}

        {arquitetosFiltrados.map((p) => (
          <PrestadorFinanceiroRow
            key={p.id}
            prestador={p}
            highlighted={destaqueId === p.id}
            readOnly={!canManage}
          />
        ))}
      </div>
      </div>
    </div>
  );
}
