import { useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  format,
  subMonths,
  addMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  addDays,
  isSameMonth,
} from 'date-fns';
import { toSaoPauloTime, getTodaySaoPaulo, formatDateSaoPaulo } from '@/lib/utils';
import { ptBR } from 'date-fns/locale';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase, useTableName } from '@/hooks/useEmpresaSupabase';
import { useMetricasColunaConfig } from '@/hooks/useMetricasColunaConfig';

interface WeekDayStats {
  date: string;
  label: string;
  count: number;
  isFuture?: boolean;
}

interface WeekStats {
  weekNumber: number;
  weekLabel: string;
  startDate: string;
  endDate: string;
  dailyStats: WeekDayStats[];
  total: number;
  isCurrentWeek: boolean;
}

interface MeetingsStats {
  monthLabel: string;
  weeksOfMonth: WeekStats[];
  selectedWeekIndex: number;
  setSelectedWeekIndex: (index: number) => void;
  currentMonth: Date;
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
  canGoNext: boolean;
  totalThisMonth: number;
  growthPercentage: number;
  trend: 'up' | 'down' | 'stable';
  statusColuna: string;
  isLoading: boolean;
}

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface MovimentoRow {
  id: string;
  lead_id: number;
  status: string;
  criado_em: string;
}

/**
 * Estatísticas por semana do mês: conta cada passagem do lead pela coluna configurada
 * (ex.: "Visita Feita"), usando o histórico lead_pipeline_movimentos.
 */
export function useMeetingsStats(): MeetingsStats {
  const todaySP = toSaoPauloTime(new Date());
  const { schemaEmpresa } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = useTableName();
  const movimentosTable = table('lead_pipeline_movimentos', 'CRM-multi-empresas>lead_pipeline_movimentos<');
  const { config, isLoading: isLoadingConfig } = useMetricasColunaConfig();

  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(todaySP));
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number | null>(null);

  const goToPreviousMonth = useCallback(() => {
    setCurrentMonth((prev) => subMonths(prev, 1));
    setSelectedWeekIndex(null);
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentMonth((prev) => addMonths(prev, 1));
    setSelectedWeekIndex(null);
  }, []);

  const canGoNext = !isSameMonth(currentMonth, todaySP);

  const monthKey = format(currentMonth, 'yyyy-MM');
  const statusColuna = config.statusColuna;

  const { data: movimentos = [], isLoading: isLoadingMovimentos } = useQuery({
    queryKey: ['pipeline-coluna-movimentos', schemaEmpresa ?? 'master', monthKey, statusColuna],
    queryFn: async () => {
      const extendedStart = subMonths(currentMonth, 2);
      const extendedEnd = addMonths(endOfMonth(currentMonth), 1);

      const { data, error } = await db
        .from(movimentosTable)
        .select('id, lead_id, status, criado_em')
        .eq('status', statusColuna)
        .gte('criado_em', extendedStart.toISOString())
        .lte('criado_em', extendedEnd.toISOString());

      if (error) {
        console.error('Erro ao buscar movimentos do pipeline:', error);
        return [];
      }
      return (data ?? []) as MovimentoRow[];
    },
    enabled: !!statusColuna && !isLoadingConfig,
    staleTime: 30 * 1000,
  });

  const stats = useMemo(() => {
    const todayStr = getTodaySaoPaulo();
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    const eventos = movimentos.map((m) => ({
      ...m,
      dateSP: formatDateSaoPaulo(m.criado_em, 'yyyy-MM-dd'),
    }));

    const weeksOfMonth: WeekStats[] = [];
    let weekStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    let weekNumber = 1;

    while (weekStart <= monthEnd) {
      const weekDays: WeekDayStats[] = [];
      let weekTotal = 0;
      let hasCurrentDay = false;

      for (let i = 0; i < 7; i++) {
        const date = addDays(weekStart, i);
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayOfWeek = date.getDay();
        const isFuture = dateStr > todayStr;
        const isInMonth = isSameMonth(date, currentMonth);

        const count = isInMonth
          ? eventos.filter((e) => e.dateSP === dateStr).length
          : 0;

        if (dateStr === todayStr) {
          hasCurrentDay = true;
        }

        weekDays.push({
          date: dateStr,
          label: WEEKDAY_LABELS[dayOfWeek],
          count,
          isFuture,
        });

        if (!isFuture && isInMonth) {
          weekTotal += count;
        }
      }

      const weekEndDate = addDays(weekStart, 6);

      weeksOfMonth.push({
        weekNumber,
        weekLabel: `Semana ${weekNumber}`,
        startDate: format(weekStart, 'dd/MM'),
        endDate: format(weekEndDate, 'dd/MM'),
        dailyStats: weekDays,
        total: weekTotal,
        isCurrentWeek: hasCurrentDay,
      });

      weekStart = addDays(weekStart, 7);
      weekNumber++;

      if (weekNumber > 6) break;
    }

    const monthStartStr = format(monthStart, 'yyyy-MM-dd');
    const monthEndStr = format(monthEnd, 'yyyy-MM-dd');
    const totalThisMonth = eventos.filter(
      (e) => e.dateSP >= monthStartStr && e.dateSP <= monthEndStr,
    ).length;

    const prevMonthStart = subMonths(monthStart, 1);
    const prevMonthEnd = endOfMonth(prevMonthStart);
    const prevMonthStartStr = format(prevMonthStart, 'yyyy-MM-dd');
    const prevMonthEndStr = format(prevMonthEnd, 'yyyy-MM-dd');

    const totalPrevMonth = eventos.filter(
      (e) => e.dateSP >= prevMonthStartStr && e.dateSP <= prevMonthEndStr,
    ).length;

    let growthPercentage = 0;
    let trend: 'up' | 'down' | 'stable' = 'stable';

    if (totalPrevMonth === 0 && totalThisMonth > 0) {
      growthPercentage = 100;
      trend = 'up';
    } else if (totalPrevMonth > 0) {
      growthPercentage = ((totalThisMonth - totalPrevMonth) / totalPrevMonth) * 100;
      trend = growthPercentage > 5 ? 'up' : growthPercentage < -5 ? 'down' : 'stable';
    }

    return {
      monthLabel: format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR }),
      weeksOfMonth,
      totalThisMonth,
      growthPercentage: Math.abs(growthPercentage),
      trend,
    };
  }, [movimentos, currentMonth]);

  const effectiveWeekIndex = useMemo(() => {
    if (selectedWeekIndex !== null) {
      return selectedWeekIndex;
    }
    const currentWeekIdx = stats.weeksOfMonth.findIndex((w) => w.isCurrentWeek);
    return currentWeekIdx >= 0 ? currentWeekIdx : 0;
  }, [selectedWeekIndex, stats.weeksOfMonth]);

  const handleSetSelectedWeekIndex = (index: number) => {
    setSelectedWeekIndex(index);
  };

  const isLoading = isLoadingConfig || isLoadingMovimentos;

  return {
    monthLabel: stats.monthLabel,
    weeksOfMonth: stats.weeksOfMonth,
    selectedWeekIndex: effectiveWeekIndex,
    setSelectedWeekIndex: handleSetSelectedWeekIndex,
    currentMonth,
    goToPreviousMonth,
    goToNextMonth,
    canGoNext,
    totalThisMonth: stats.totalThisMonth,
    growthPercentage: stats.growthPercentage,
    trend: stats.trend,
    statusColuna,
    isLoading,
  };
}
