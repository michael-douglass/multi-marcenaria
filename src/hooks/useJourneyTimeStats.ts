import { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Lead } from '@/types/selletos';
import { toSaoPauloTime } from '@/lib/utils';
import { useVendasGanhosConfig } from '@/hooks/useVendasGanhosConfig';
import {
  calculateLeadJourneyDays,
  filterNegociosGanhos,
  getReferenciaVendaDate,
} from '@/lib/vendas-ganhos';

interface MonthJourneyStats {
  month: string;
  label: string;
  avgJourneyDays: number;
  salesCount: number;
}

export interface JourneyTimeStats {
  monthlyStats: MonthJourneyStats[];
  currentMonthIndex: number;
  totalAvgJourneyDays: number;
  totalSalesCount: number;
  isLoading: boolean;
}

/**
 * Tempo médio entre cadastro do lead e fechamento da venda (jornada de compra).
 * Usa as mesmas fontes de "Negócios Ganhos" (status configurados + data da venda).
 */
export function useJourneyTimeStats(allLeads: Lead[]): JourneyTimeStats {
  const { config, isLoading: isLoadingConfig } = useVendasGanhosConfig();

  return useMemo(() => {
    if (isLoadingConfig) {
      return {
        monthlyStats: [],
        currentMonthIndex: 0,
        totalAvgJourneyDays: 0,
        totalSalesCount: 0,
        isLoading: true,
      };
    }

    const vendasGanhas = filterNegociosGanhos(allLeads, config).filter((lead) => {
      return calculateLeadJourneyDays(lead) !== null && !!getReferenciaVendaDate(lead);
    });

    const todaySP = toSaoPauloTime(new Date());
    const currentMonthStr = format(todaySP, 'yyyy-MM');

    const journeyByLead = vendasGanhas
      .map((lead) => ({
        lead,
        days: calculateLeadJourneyDays(lead)!,
        saleRef: getReferenciaVendaDate(lead)!,
      }))
      .filter((row) => row.days >= 0);

    const totalAvgJourneyDays =
      journeyByLead.length > 0
        ? journeyByLead.reduce((sum, r) => sum + r.days, 0) / journeyByLead.length
        : 0;

    const monthlyStats: MonthJourneyStats[] = [];
    let currentMonthIndex = 0;

    for (let i = 11; i >= 0; i--) {
      const monthDate = subMonths(todaySP, i);
      const monthStr = format(monthDate, 'yyyy-MM');
      const monthStart = format(startOfMonth(monthDate), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(monthDate), 'yyyy-MM-dd');

      const salesThisMonth = journeyByLead.filter(
        (row) => row.saleRef >= monthStart && row.saleRef <= monthEnd,
      );

      const avgJourney =
        salesThisMonth.length > 0
          ? salesThisMonth.reduce((sum, r) => sum + r.days, 0) / salesThisMonth.length
          : 0;

      monthlyStats.push({
        month: monthStr,
        label: format(monthDate, 'MMM/yy', { locale: ptBR }),
        avgJourneyDays: avgJourney,
        salesCount: salesThisMonth.length,
      });

      if (monthStr === currentMonthStr) {
        currentMonthIndex = monthlyStats.length - 1;
      }
    }

    return {
      monthlyStats,
      currentMonthIndex,
      totalAvgJourneyDays,
      totalSalesCount: journeyByLead.length,
      isLoading: false,
    };
  }, [allLeads, config, isLoadingConfig]);
}

/**
 * Formata dias em texto legível
 */
export function formatJourneyTime(days: number): string {
  if (days < 1) {
    const hours = Math.round(days * 24);
    if (hours < 1) return '< 1h';
    return `${hours}h`;
  }

  if (days < 7) {
    const wholeDays = Math.floor(days);
    const hours = Math.round((days - wholeDays) * 24);
    if (hours === 0) return `${wholeDays} dia${wholeDays > 1 ? 's' : ''}`;
    return `${wholeDays}d ${hours}h`;
  }

  const weeks = Math.floor(days / 7);
  const remainingDays = Math.round(days % 7);

  if (remainingDays === 0) return `${weeks} sem`;
  return `${weeks}sem ${remainingDays}d`;
}
