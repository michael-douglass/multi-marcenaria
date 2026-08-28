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
import { formatBRLPontua } from '@/lib/pontua-garbo-arquiteto';
import {
  finCard,
  finCardMuted,
  finCardTitle,
  finTextTertiary,
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
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-muted-foreground">Acesso restrito.</p>
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
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <header className="relative overflow-hidden rounded-2xl border border-[#f2d892]/20 bg-[#1a100c] px-5 py-6 sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute inset-0 grain-overlay opacity-30" aria-hidden />
        <div
          className="pointer-events-none absolute -left-10 top-0 h-40 w-40 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(242,216,146,0.16) 0%, transparent 70%)' }}
          aria-hidden
        />
        <div className="relative">
          <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#f2d892]/85">
            <Trophy className="h-3.5 w-3.5" aria-hidden />
            Financeiro · Pontua Garbo
            {!canManage && (
              <Badge variant="outline" className="normal-case tracking-normal text-[10px] font-normal text-amber-200 border-amber-500/40">
                Somente visualização
              </Badge>
            )}
          </p>
          <h1 className="mt-2 font-display text-3xl italic leading-tight text-[#fffaf4] sm:text-5xl">
            Arquitetos cadastrados
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#edd9c4] sm:text-base">
            {canManage
              ? 'Quem entra no Pontua Garbo é reconhecido aqui: nome, título de arquiteto, comissões e saldo a pagar.'
              : 'Consulta dos arquitetos, comissões e saldos do Pontua Garbo. Alterações ficam com o administrador.'}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className={`${finCard} border-[#f2d892]/45`}>
          <CardHeader className="pb-2">
            <CardTitle className={`${finCardTitle} flex items-center gap-2`}>
              <Award className="h-4 w-4 text-[#f2d892]" />
              Arquitetos cadastrados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl font-semibold text-[#f2d892]">{prestadores.length}</p>
            <p className={`${finCardMuted} mt-1`}>reconhecidos no Pontua Garbo</p>
          </CardContent>
        </Card>

        <Card className={`${finCard} border-amber-500/40`}>
          <CardHeader className="pb-2">
            <CardTitle className={`${finCardTitle} flex items-center gap-2`}>
              <TrendingUp className="h-4 w-4 text-amber-400" />
              Total comissões
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-400">{formatBRLPontua(totalGeral)}</p>
            <p className={`${finCardMuted} mt-1`}>calculado pelos leads do programa</p>
          </CardContent>
        </Card>

        <Card className={`${finCard} border-red-500/35`}>
          <CardHeader className="pb-2">
            <CardTitle className={`${finCardTitle} flex items-center gap-2`}>
              <ArrowDownToLine className="h-4 w-4 text-red-400" />
              Total retirado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-400">{formatBRLPontua(totalRetirado)}</p>
            <p className={`${finCardMuted} mt-1`}>registrado pelos admins</p>
          </CardContent>
        </Card>

        <Card className={`${finCard} border-green-500/35`}>
          <CardHeader className="pb-2">
            <CardTitle className={`${finCardTitle} flex items-center gap-2`}>
              <Wallet className="h-4 w-4 text-green-400" />
              Saldo a pagar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-400">{formatBRLPontua(totalAPagar)}</p>
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
          <h2 className="flex items-center gap-2 font-display text-xl text-[#fffaf4]">
            <ScrollText className="h-4 w-4 text-[#f2d892]" />
            Carteira dos arquitetos
          </h2>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-amber-400" />}
        </div>

        {!isLoading && prestadores.length === 0 && (
          <div className="rounded-xl border border-dashed border-amber-800/50 bg-background/20 p-10 text-center">
            <Trophy className="mx-auto mb-3 h-8 w-8 text-amber-500/30" />
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
  );
}
