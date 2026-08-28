import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MktConfigColuna, SystemDataType } from './useMarketingGastos';
import { format, startOfMonth, endOfMonth } from 'date-fns';

interface SystemDataCache {
  [key: string]: number; // key = `${type}_${filter}_${date}` => value
}

interface MonthlyTotals {
  [key: string]: number; // key = `${type}_${filter}_${month}` => value
}

/**
 * Hook para buscar dados automáticos do sistema CRM
 * Suporta: leads, reuniões, vendas por data e filtro
 */
export function useSystemDataFetcher() {
  const [cache, setCache] = useState<SystemDataCache>({});
  const [monthlyTotals, setMonthlyTotals] = useState<MonthlyTotals>({});
  const [loading, setLoading] = useState(false);
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Refs para acessar cache atual sem invalidar callbacks (evita loops de re-fetch)
  const cacheRef = useRef<SystemDataCache>({});
  const monthlyTotalsRef = useRef<MonthlyTotals>({});
  useEffect(() => { cacheRef.current = cache; }, [cache]);
  useEffect(() => { monthlyTotalsRef.current = monthlyTotals; }, [monthlyTotals]);

  /**
   * Gera chave única para cache
   */
  const getCacheKey = (type: SystemDataType, filter: string | null, date: string): string => {
    return `${type}_${filter || 'all'}_${date}`;
  };

  /**
   * Gera chave única para totais mensais
   */
  const getMonthlyKey = (type: SystemDataType, filter: string | null, month: string): string => {
    return `monthly_${type}_${filter || 'all'}_${month}`;
  };

  /**
   * Busca contagem de leads para uma data específica
   * Usa correspondência EXATA de origem para alinhar com o Pipeline
   */
  const fetchLeadsCount = useCallback(async (
    date: string, 
    filterOrigin?: string | null
  ): Promise<number> => {
    let query = supabase
      .from('CRM-multi-empresas>leads<')
      .select('id', { count: 'exact', head: true })
      .gte('data_chegada', `${date}T00:00:00`)
      .lt('data_chegada', `${date}T23:59:59`);

    if (filterOrigin) {
      // Filtro por origem - correspondência EXATA (igual ao Pipeline)
      query = query.eq('origem', filterOrigin);
    }

    const { count, error } = await query;
    
    if (error) {
      console.error('Erro ao buscar leads:', error);
      return 0;
    }

    return count || 0;
  }, []);

  /**
   * Busca contagem de leads por mês (para totais mensais)
   * Usa correspondência EXATA de origem para alinhar com o Pipeline
   */
  const fetchLeadsCountMonth = useCallback(async (
    monthDate: Date,
    filterOrigin?: string | null
  ): Promise<number> => {
    const startDate = format(startOfMonth(monthDate), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(monthDate), 'yyyy-MM-dd');

    let query = supabase
      .from('CRM-multi-empresas>leads<')
      .select('id', { count: 'exact', head: true })
      .gte('data_chegada', `${startDate}T00:00:00`)
      .lte('data_chegada', `${endDate}T23:59:59`);

    if (filterOrigin) {
      // Filtro por origem - correspondência EXATA (igual ao Pipeline)
      query = query.eq('origem', filterOrigin);
    }

    const { count, error } = await query;
    
    if (error) {
      console.error('Erro ao buscar leads do mês:', error);
      return 0;
    }

    return count || 0;
  }, []);

  /**
   * Busca contagem de reuniões para uma data específica
   */
  const fetchReunioesCount = useCallback(async (
    date: string,
    apenasConc: boolean = false
  ): Promise<number> => {
    let query = supabase
      .from('CRM-multi-empresas>agenda_reunioes<')
      .select('id', { count: 'exact', head: true })
      .gte('data_hora_inicio', `${date}T00:00:00`)
      .lt('data_hora_inicio', `${date}T23:59:59`);

    if (apenasConc) {
      query = query.eq('status', 'concluida');
    }

    const { count, error } = await query;
    
    if (error) {
      console.error('Erro ao buscar reuniões:', error);
      return 0;
    }

    return count || 0;
  }, []);

  /**
   * Busca vendas para uma data específica
   * Suporta filtro de origem para alinhar com sub-fontes (ex: Google Ads)
   */
  const fetchVendasCount = useCallback(async (
    date: string,
    filterOrigin?: string | null
  ): Promise<number> => {
    let query = supabase
      .from('CRM-multi-empresas>leads<')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'Venda Realizada (Matriculado)')
      .gte('venda_realizada_em', `${date}T00:00:00`)
      .lt('venda_realizada_em', `${date}T23:59:59`);
    
    if (filterOrigin) {
      query = query.eq('origem', filterOrigin);
    }

    const { count, error } = await query;
    
    if (error) {
      console.error('Erro ao buscar vendas:', error);
      return 0;
    }

    return count || 0;
  }, []);

  /**
   * Busca valor total de vendas para uma data específica
   * Suporta filtro de origem para alinhar com sub-fontes (ex: Google Ads)
   */
  const fetchVendasValor = useCallback(async (
    date: string,
    filterOrigin?: string | null
  ): Promise<number> => {
    let query = supabase
      .from('CRM-multi-empresas>leads<')
      .select('valor_negocio')
      .eq('status', 'Venda Realizada (Matriculado)')
      .gte('venda_realizada_em', `${date}T00:00:00`)
      .lt('venda_realizada_em', `${date}T23:59:59`);
    
    if (filterOrigin) {
      query = query.eq('origem', filterOrigin);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Erro ao buscar valor de vendas:', error);
      return 0;
    }

    return data?.reduce((sum, l) => sum + (l.valor_negocio || 0), 0) || 0;
  }, []);

  /**
   * Busca dados do sistema baseado no tipo e filtro
   */
  const fetchSystemData = useCallback(async (
    type: SystemDataType,
    date: string,
    filter?: string | null
  ): Promise<number> => {
    const cacheKey = getCacheKey(type, filter, date);
    
    // Verifica cache via ref (não invalida callback)
    if (cacheRef.current[cacheKey] !== undefined) {
      return cacheRef.current[cacheKey];
    }

    let value = 0;

    switch (type) {
      case 'leads_total':
        value = await fetchLeadsCount(date);
        break;
      case 'leads_origem':
        value = await fetchLeadsCount(date, filter);
        break;
      case 'reunioes_total':
        value = await fetchReunioesCount(date, false);
        break;
      case 'reunioes_concluidas':
        value = await fetchReunioesCount(date, true);
        break;
      case 'vendas_total':
        value = await fetchVendasCount(date, filter);
        break;
      case 'vendas_valor':
        value = await fetchVendasValor(date, filter);
        break;
    }

    cacheRef.current[cacheKey] = value;
    setCache(prev => ({ ...prev, [cacheKey]: value }));
    
    return value;
  }, [fetchLeadsCount, fetchReunioesCount, fetchVendasCount, fetchVendasValor]);

  /**
   * Busca dados do sistema para múltiplas datas de uma vez
   */
  const fetchSystemDataBatch = useCallback(async (
    columns: MktConfigColuna[],
    dates: string[]
  ): Promise<SystemDataCache> => {
    setLoading(true);
    const newCache: SystemDataCache = { ...cacheRef.current };

    const systemColumns = columns.filter(c => c.is_system_data && c.system_data_type);

    const promises: Promise<void>[] = [];

    for (const col of systemColumns) {
      for (const date of dates) {
        const cacheKey = getCacheKey(col.system_data_type!, col.system_data_filter, date);
        if (newCache[cacheKey] !== undefined) continue;

        promises.push(
          fetchSystemData(col.system_data_type!, date, col.system_data_filter)
            .then(value => {
              newCache[cacheKey] = value;
            })
        );
      }
    }

    await Promise.all(promises);
    
    cacheRef.current = newCache;
    setCache(newCache);
    setLoading(false);
    
    return newCache;
  }, [fetchSystemData]);

  /**
   * Obtém valor do cache para uma coluna e data específica
   */
  const getSystemDataValue = useCallback((
    coluna: MktConfigColuna,
    date: string
  ): number | null => {
    if (!coluna.is_system_data || !coluna.system_data_type) {
      return null;
    }

    const cacheKey = getCacheKey(coluna.system_data_type, coluna.system_data_filter, date);
    return cache[cacheKey] ?? null;
  }, [cache]);

  /**
   * Busca total mensal para uma coluna
   */
  const fetchMonthlyTotal = useCallback(async (
    coluna: MktConfigColuna,
    monthDate: Date
  ): Promise<number> => {
    if (!coluna.is_system_data || !coluna.system_data_type) {
      return 0;
    }

    const startDate = format(startOfMonth(monthDate), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(monthDate), 'yyyy-MM-dd');
    const monthKey = format(monthDate, 'yyyy-MM');

    let value = 0;

    switch (coluna.system_data_type) {
      case 'leads_total':
      case 'leads_origem': {
        let query = supabase
          .from('CRM-multi-empresas>leads<')
          .select('id', { count: 'exact', head: true })
          .gte('data_chegada', `${startDate}T00:00:00`)
          .lte('data_chegada', `${endDate}T23:59:59`);

        if (coluna.system_data_filter) {
          // Correspondência EXATA para alinhar com Pipeline
          query = query.eq('origem', coluna.system_data_filter);
        }

        const { count } = await query;
        value = count || 0;
        break;
      }
      case 'reunioes_total': {
        const { count } = await supabase
          .from('CRM-multi-empresas>agenda_reunioes<')
          .select('id', { count: 'exact', head: true })
          .gte('data_hora_inicio', `${startDate}T00:00:00`)
          .lte('data_hora_inicio', `${endDate}T23:59:59`);
        value = count || 0;
        break;
      }
      case 'reunioes_concluidas': {
        const { count } = await supabase
          .from('CRM-multi-empresas>agenda_reunioes<')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'concluida')
          .gte('data_hora_inicio', `${startDate}T00:00:00`)
          .lte('data_hora_inicio', `${endDate}T23:59:59`);
        value = count || 0;
        break;
      }
      case 'vendas_total': {
        let vendaQuery = supabase
          .from('CRM-multi-empresas>leads<')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'Venda Realizada (Matriculado)')
          .gte('venda_realizada_em', `${startDate}T00:00:00`)
          .lte('venda_realizada_em', `${endDate}T23:59:59`);
        
        if (coluna.system_data_filter) {
          vendaQuery = vendaQuery.eq('origem', coluna.system_data_filter);
        }
        
        const { count } = await vendaQuery;
        value = count || 0;
        break;
      }
      case 'vendas_valor': {
        let valorQuery = supabase
          .from('CRM-multi-empresas>leads<')
          .select('valor_negocio')
          .eq('status', 'Venda Realizada (Matriculado)')
          .gte('venda_realizada_em', `${startDate}T00:00:00`)
          .lte('venda_realizada_em', `${endDate}T23:59:59`);
        
        if (coluna.system_data_filter) {
          valorQuery = valorQuery.eq('origem', coluna.system_data_filter);
        }
        
        const { data } = await valorQuery;
        value = data?.reduce((sum, l) => sum + (l.valor_negocio || 0), 0) || 0;
        break;
      }
    }

    // Armazena no cache de totais mensais
    const cacheKey = getMonthlyKey(coluna.system_data_type, coluna.system_data_filter, monthKey);
    setMonthlyTotals(prev => ({ ...prev, [cacheKey]: value }));

    return value;
  }, []);

  /**
   * Busca todos os totais mensais para múltiplas colunas
   */
  const fetchAllMonthlyTotals = useCallback(async (
    columns: MktConfigColuna[],
    monthDate: Date
  ): Promise<void> => {
    const systemColumns = columns.filter(c => c.is_system_data && c.system_data_type);
    if (systemColumns.length === 0) return;

    await Promise.all(systemColumns.map(col => fetchMonthlyTotal(col, monthDate)));
  }, [fetchMonthlyTotal]);

  /**
   * Obtém total mensal do cache
   */
  const getMonthlyTotalValue = useCallback((
    coluna: MktConfigColuna,
    monthDate: Date
  ): number | null => {
    if (!coluna.is_system_data || !coluna.system_data_type) {
      return null;
    }

    const monthKey = format(monthDate, 'yyyy-MM');
    const cacheKey = getMonthlyKey(coluna.system_data_type, coluna.system_data_filter, monthKey);
    return monthlyTotals[cacheKey] ?? null;
  }, [monthlyTotals]);

  /**
   * Configura subscription real-time para atualizar totais automaticamente
   */
  const setupRealtimeSubscription = useCallback((
    columns: MktConfigColuna[],
    monthDate: Date,
    onUpdate: () => void
  ) => {
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
    }

    // Debounce agressivo: leads chegam com muita frequência (5000+ leads).
    // Refetch no máximo 1x a cada 60 segundos.
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (debounceTimer) return; // Já agendado, ignora
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        // Limpa apenas totais mensais (mantém daily cache)
        monthlyTotalsRef.current = {};
        setMonthlyTotals({});
        fetchAllMonthlyTotals(columns, monthDate);
        onUpdate();
      }, 60000);
    };

    const channel = supabase
      .channel('leads_realtime_monthly')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'CRM-multi-empresas>leads<' },
        scheduleRefresh
      )
      .subscribe();

    subscriptionRef.current = channel;

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [fetchAllMonthlyTotals]);

  /**
   * Limpa o cache
   */
  const clearCache = useCallback(() => {
    setCache({});
    setMonthlyTotals({});
  }, []);

  return {
    fetchSystemData,
    fetchSystemDataBatch,
    getSystemDataValue,
    clearCache,
    loading,
    cache,
    // Totais mensais
    fetchMonthlyTotal,
    fetchAllMonthlyTotals,
    getMonthlyTotalValue,
    monthlyTotals,
    setupRealtimeSubscription,
    // Expor funções individuais para uso direto
    fetchLeadsCount,
    fetchLeadsCountMonth,
    fetchReunioesCount,
    fetchVendasCount,
    fetchVendasValor,
  };
}
