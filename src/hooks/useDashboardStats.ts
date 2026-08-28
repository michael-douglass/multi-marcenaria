import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays, startOfDay, format } from 'date-fns';

export interface ConversionStats {
  total_leads: number;
  marcaram_aula: number;
  nao_entraram_aula: number;
  realizaram_aula: number;
  percentual_marcaram: number;
  percentual_nao_entraram: number;
  percentual_realizaram: number;
}

export interface VendorPerformanceStats {
  vendedor_id: string;
  vendedor_nome: string;
  avatar_url: string | null;
  total_leads: number;
  vendas: number;
  receita: number;
  taxa_conversao: number | null;
  ticket_medio: number | null;
}

export interface OriginStats {
  origem: string;
  total_leads: number;
  vendas: number;
  receita: number;
}

export interface EvolutionStats {
  data: string;
  total_leads: number;
  vendas: number;
}

export type PeriodFilter = 'today' | 'week' | 'month' | 'all';

export interface CustomDateRange {
  from: Date;
  to: Date;
}

/**
 * Helper para calcular data de corte baseada no período
 */
function getPeriodCutoffDate(period: PeriodFilter): string {
  const daysMap = {
    today: 0,
    week: 7,
    month: 30,
    all: 0,
  };
  const days = daysMap[period];
  return format(startOfDay(subDays(new Date(), days)), 'yyyy-MM-dd');
}

/**
 * Hook para buscar estatísticas de conversão de aulas experimentais
 */
export function useConversionStats(period: PeriodFilter = 'all', customRange?: CustomDateRange) {
  return useQuery({
    queryKey: ['conversion-stats', period, customRange],
    queryFn: async () => {
      // PRIORIDADE 1: Se tem customRange, usar
      if (customRange) {
        const fromDate = format(customRange.from, 'yyyy-MM-dd');
        const { data, error } = await supabase.rpc('get_conversion_stats_filtered', {
          _cutoff_date: fromDate
        });
        
        if (error) throw error;
        return (Array.isArray(data) && data.length > 0 ? data[0] : null) as ConversionStats | null;
      }
      
      // PRIORIDADE 2: Se período for 'all', usa a view (COMPORTAMENTO EXISTENTE)
      if (period === 'all') {
        const { data, error } = await supabase
          .from('CRM-multi-empresas>lead_conversion_stats<')
          .select('*')
          .maybeSingle();
        
        if (error) throw error;
        return data as ConversionStats | null;
      }
      
      // PRIORIDADE 3: Usa a função RPC com filtro (COMPORTAMENTO EXISTENTE)
      const fromDate = getPeriodCutoffDate(period);
      const { data, error } = await supabase.rpc('get_conversion_stats_filtered', {
        _cutoff_date: fromDate
      });
      
      if (error) throw error;
      // RPC retorna array, pegar primeiro elemento
      return (Array.isArray(data) && data.length > 0 ? data[0] : null) as ConversionStats | null;
    },
  });
}

/**
 * Hook para buscar performance dos vendedores
 */
export function useVendorPerformance(period: PeriodFilter = 'all', customRange?: CustomDateRange) {
  return useQuery({
    queryKey: ['vendor-performance', period, customRange],
    queryFn: async () => {
      let fromDate: string;
      
      // PRIORIDADE 1: customRange
      if (customRange) {
        fromDate = format(customRange.from, 'yyyy-MM-dd');
      } else {
        // PRIORIDADE 2: Comportamento original
        fromDate = period === 'all' ? '1900-01-01' : getPeriodCutoffDate(period);
      }
      
      const { data, error } = await supabase.rpc('get_vendor_performance_filtered', {
        _cutoff_date: fromDate
      });
      
      if (error) throw error;
      // RPC já retorna array
      return (Array.isArray(data) ? data : []) as VendorPerformanceStats[];
    },
  });
}

/**
 * Hook para buscar estatísticas por origem
 */
export function useOriginStats(period: PeriodFilter = 'all', customRange?: CustomDateRange) {
  return useQuery({
    queryKey: ['origin-stats-v2', period, customRange],
    queryFn: async () => {
      let fromDate: string;
      
      // PRIORIDADE 1: customRange
      if (customRange) {
        fromDate = format(customRange.from, 'yyyy-MM-dd');
      } else {
        // PRIORIDADE 2: Comportamento original
        fromDate = period === 'all' ? '1900-01-01' : getPeriodCutoffDate(period);
      }
      
      const { data, error } = await supabase.rpc('get_origin_stats_filtered', {
        _cutoff_date: fromDate
      });
      
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as OriginStats[];
    },
  });
}

/**
 * Hook para buscar evolução de leads e vendas
 */
export function useEvolutionStats(period: PeriodFilter = 'all') {
  return useQuery({
    queryKey: ['evolution-stats', period],
    queryFn: async () => {
      let query = supabase
        .from('CRM-multi-empresas>lead_evolution_stats<')
        .select('*')
        .order('data', { ascending: true });

      // Aplicar filtro de período se necessário
      if (period !== 'all') {
        const daysMap = {
          today: 0,
          week: 7,
          month: 30,
        };
        const days = daysMap[period];
        const cutoffDate = startOfDay(subDays(new Date(), days)).toISOString().split('T')[0];
        query = query.gte('data', cutoffDate);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      return (data || []) as EvolutionStats[];
    },
  });
}
