import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { toSaoPauloTime, formatDateSaoPaulo } from '@/lib/utils';
import { Lead } from '@/types/selletos';

type DateFilterType = 'today' | 'week' | 'month' | 'current_month' | 'custom' | 'date_range' | 'all';

interface ConversionStats {
  // Dados do período filtrado (ou hoje se sem filtro)
  leadsPeriodo: number;
  aulasPeriodo: number;
  conversionPeriodo: number;
  periodoLabel: string;
  
  // Dados do mês atual
  leadsMonth: number;
  aulasMonth: number;
  conversionMonth: number;
  
  isLoading: boolean;
}

interface UseConversionStatsParams {
  allLeads: Lead[];
  dateFilter: DateFilterType;
  customDateFilter?: Date;
  selectedOrigins?: string[];
  selectedRegioes?: string[];
}

/**
 * Converte criado_em (TIMESTAMPTZ) para data no timezone de São Paulo
 */
function getLeadDateSP(atualizadoEm: string | null, dataChegada: string | null): string {
  if (atualizadoEm) {
    return formatDateSaoPaulo(atualizadoEm, 'yyyy-MM-dd');
  }
  if (!dataChegada) return '';
  return dataChegada.includes('T') ? dataChegada.split('T')[0] : dataChegada;
}

// Calcular datas do mês atual (estáveis)
function getMonthRange() {
  const todaySP = toSaoPauloTime(new Date());
  const monthStart = startOfMonth(todaySP);
  const monthEnd = endOfMonth(todaySP);
  const todayStr = format(todaySP, 'yyyy-MM-dd');
  return {
    todayStr,
    monthStartStr: format(monthStart, 'yyyy-MM-dd'),
    monthEndStr: format(monthEnd, 'yyyy-MM-dd'),
  };
}

// Calcular range de datas baseado no filtro
// Para o card de conversão: só muda quando é "custom" com data específica
function getFilterDateRange(dateFilter: DateFilterType, customDateFilter?: Date): {
  startStr: string;
  endStr: string;
  label: string;
} {
  const todaySP = toSaoPauloTime(new Date());
  const todayStr = format(todaySP, 'yyyy-MM-dd');
  
  // Só altera o período se for uma data customizada específica
  if (dateFilter === 'custom' && customDateFilter) {
    const customStr = format(customDateFilter, 'yyyy-MM-dd');
    const isToday = customStr === todayStr;
    return { 
      startStr: customStr, 
      endStr: customStr, 
      label: isToday ? 'Hoje' : format(customDateFilter, 'dd/MM')
    };
  }
  
  // Default: sempre mostra "Hoje"
  return { startStr: todayStr, endStr: todayStr, label: 'Hoje' };
}

/**
 * Hook para calcular taxa de conversão de leads para aulas experimentais marcadas
 * Taxa = (Leads com Aula Experimental Marcada / Total de Leads) * 100
 * 
 * Agora respeita os filtros de data aplicados no Pipeline
 */
export function useConversionStats({ 
  allLeads, 
  dateFilter, 
  customDateFilter,
  selectedOrigins = [],
  selectedRegioes = [],
}: UseConversionStatsParams): ConversionStats {
  // Buscar reuniões da agenda (aulas marcadas) pelo criado_em do mês atual
  const { data: aulasReunioes = [], isLoading } = useQuery({
    queryKey: ['aulas-conversion-stats-reunioes', selectedOrigins, selectedRegioes],
    queryFn: async () => {
      const { monthStartStr, monthEndStr } = getMonthRange();
      
      let query = supabase
        .from('CRM-multi-empresas>agenda_reunioes<')
        .select('id, criado_em, lead_id, status')
        // Inclui todas as reuniões marcadas (inclusive canceladas)
        .gte('criado_em', `${monthStartStr}T00:00:00`)
        .lte('criado_em', `${monthEndStr}T23:59:59`);

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar reuniões para conversão:', error);
        return [];
      }
      return data || [];
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const stats = useMemo(() => {
    const { monthStartStr, monthEndStr, todayStr } = getMonthRange();
    const { startStr, endStr, label } = getFilterDateRange(dateFilter, customDateFilter);
    
    // Filtrar allLeads por origem e região (se selecionados)
    let filteredAllLeads = allLeads;
    
    if (selectedOrigins.length > 0) {
      filteredAllLeads = filteredAllLeads.filter(lead => 
        lead.origin && selectedOrigins.includes(lead.origin)
      );
    }
    
    if (selectedRegioes.length > 0) {
      filteredAllLeads = filteredAllLeads.filter(lead => 
        lead.regiao && selectedRegioes.includes(lead.regiao)
      );
    }
    
    // Processar reuniões com data de criação convertida para SP
    const aulasWithDateSP = aulasReunioes.map(reuniao => ({
      ...reuniao,
      dateSP: formatDateSaoPaulo(reuniao.criado_em, 'yyyy-MM-dd'),
    }));

    // ===== DADOS DO PERÍODO FILTRADO =====
    const leadsPeriodo = filteredAllLeads.filter(lead => 
      lead.dateArrived >= startStr && lead.dateArrived <= endStr
    ).length;
    const aulasPeriodo = aulasWithDateSP.filter(reuniao => 
      reuniao.dateSP >= startStr && reuniao.dateSP <= endStr
    ).length;
    const conversionPeriodo = leadsPeriodo > 0 
      ? (aulasPeriodo / leadsPeriodo) * 100 
      : 0;

    // ===== DADOS DO MÊS =====
    const leadsMonth = filteredAllLeads.filter(lead => 
      lead.dateArrived >= monthStartStr && lead.dateArrived <= monthEndStr
    ).length;
    const aulasMonth = aulasWithDateSP.filter(reuniao => 
      reuniao.dateSP >= monthStartStr && reuniao.dateSP <= monthEndStr
    ).length;
    const conversionMonth = leadsMonth > 0 
      ? (aulasMonth / leadsMonth) * 100 
      : 0;

    return {
      leadsPeriodo,
      aulasPeriodo,
      conversionPeriodo,
      periodoLabel: label,
      leadsMonth,
      aulasMonth,
      conversionMonth,
    };
  }, [allLeads, aulasReunioes, dateFilter, customDateFilter, selectedOrigins, selectedRegioes]);

  return {
    leadsPeriodo: stats?.leadsPeriodo ?? 0,
    aulasPeriodo: stats?.aulasPeriodo ?? 0,
    conversionPeriodo: stats?.conversionPeriodo ?? 0,
    periodoLabel: stats?.periodoLabel ?? 'Hoje',
    leadsMonth: stats?.leadsMonth ?? 0,
    aulasMonth: stats?.aulasMonth ?? 0,
    conversionMonth: stats?.conversionMonth ?? 0,
    isLoading,
  };
}
