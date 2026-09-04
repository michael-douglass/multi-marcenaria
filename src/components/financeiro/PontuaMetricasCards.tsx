import { ArrowDownToLine, Award, Sparkles, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBRLPontua } from '@/lib/pontua-garbo-arquiteto';
import type { PontuaMetricas } from '@/lib/pontua-garbo-metricas';
import {
  finCard,
  finCardMuted,
  finCardTitle,
  finValueGold,
  finValueOk,
  finValueSky,
} from '@/components/financeiro/financeiro-styles';

function DeltaCadastros({ delta }: { delta: number | null }) {
  if (delta === null || !Number.isFinite(delta)) return null;
  const subiu = delta >= 0;
  const Icone = subiu ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
        subiu ? 'text-[#146c38]' : 'text-[#9f1239]'
      }`}
    >
      <Icone className="h-3 w-3" aria-hidden />
      {subiu ? '+' : ''}
      {delta.toFixed(0)}%
    </span>
  );
}

export function PontuaMetricasCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className={finCard}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-32 bg-[rgba(26,16,12,0.08)]" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-8 w-20 bg-[rgba(26,16,12,0.08)]" />
            <Skeleton className="h-3 w-40 bg-[rgba(26,16,12,0.06)]" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface PontuaMetricasCardsProps {
  metricas: PontuaMetricas;
  onAbrirSolicitantes: () => void;
}

export function PontuaMetricasCards({
  metricas,
  onAbrirSolicitantes,
}: PontuaMetricasCardsProps) {
  const {
    cadastradosMes,
    cadastradosMesAnterior,
    deltaCadastrados,
    totalCadastrados,
    pontuando,
    pontuaramNoMes,
    percentualPontuando,
    solicitantesPendentes,
    totalSolicitadoPendente,
    mediaComissaoPaga,
    arquitetosComComissaoPaga,
    totalComissaoPaga,
  } = metricas;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card className={`${finCard} border-[rgba(180,83,9,0.30)]`}>
        <CardHeader className="pb-2">
          <CardTitle className={`${finCardTitle} flex items-center gap-2`}>
            <Award className="h-4 w-4 text-[#b45309]" aria-hidden />
            Cadastrados neste mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="flex items-baseline gap-2">
            <span className="font-display text-3xl font-semibold text-[#b45309]">
              {cadastradosMes}
            </span>
            <DeltaCadastros delta={deltaCadastrados} />
          </p>
          <p className={`${finCardMuted} mt-1`}>
            {cadastradosMesAnterior} no mês anterior · {totalCadastrados} no total
          </p>
        </CardContent>
      </Card>

      <Card className={`${finCard} border-[rgba(3,105,161,0.28)]`}>
        <CardHeader className="pb-2">
          <CardTitle className={`${finCardTitle} flex items-center gap-2`}>
            <Sparkles className={`h-4 w-4 ${finValueSky}`} aria-hidden />
            Arquitetos pontuando
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-display text-3xl font-semibold text-[#0369a1]">{pontuando}</p>
          <p className={`${finCardMuted} mt-1`}>
            {percentualPontuando.toFixed(0)}% dos cadastrados · {pontuaramNoMes} com venda
            ganha neste mês
          </p>
        </CardContent>
      </Card>

      <Card className={`${finCard} border-[rgba(107,63,18,0.28)]`}>
        <CardHeader className="pb-2">
          <CardTitle className={`${finCardTitle} flex items-center gap-2`}>
            <ArrowDownToLine className={`h-4 w-4 ${finValueGold}`} aria-hidden />
            Solicitaram saque
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`font-display text-3xl font-semibold ${finValueGold}`}>
            {solicitantesPendentes.length}
          </p>
          <p className={`${finCardMuted} mt-1`}>
            {formatBRLPontua(totalSolicitadoPendente)} aguardando aprovação
          </p>
          {solicitantesPendentes.length > 0 && (
            <button
              type="button"
              onClick={onAbrirSolicitantes}
              className="mt-2 rounded-md text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b3f12] underline decoration-[rgba(107,63,18,0.4)] underline-offset-4 transition hover:decoration-[#6b3f12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(107,63,18,0.5)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffaf4]"
            >
              Ver quem solicitou
            </button>
          )}
        </CardContent>
      </Card>

      <Card className={`${finCard} border-[rgba(20,108,56,0.28)]`}>
        <CardHeader className="pb-2">
          <CardTitle className={`${finCardTitle} flex items-center gap-2`}>
            <Wallet className={`h-4 w-4 ${finValueOk}`} aria-hidden />
            Média de comissão paga
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-2xl font-bold ${finValueOk}`}>
            {formatBRLPontua(mediaComissaoPaga)}
          </p>
          <p className={`${finCardMuted} mt-1`}>
            por arquiteto que já recebeu ({arquitetosComComissaoPaga}) ·{' '}
            {formatBRLPontua(totalComissaoPaga)} pagos
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
