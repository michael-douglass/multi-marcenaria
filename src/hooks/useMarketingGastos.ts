import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Types para o módulo de Controle de Gastos
export interface MktFonte {
  id: string;
  nome: string;
  icone: string;
  cor: string;
  ativo: boolean;
  ordem: number;
  criado_em: string;
  atualizado_em: string;
}

export interface MktSubFonte {
  id: string;
  fonte_id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  ordem: number;
  criado_em: string;
  atualizado_em: string;
}

export type ColunaType = 'number' | 'percent' | 'currency';

export type SystemDataType = 
  | 'leads_total' 
  | 'leads_origem' 
  | 'reunioes_total' 
  | 'reunioes_concluidas'
  | 'vendas_total'
  | 'vendas_valor';

export interface MktConfigColuna {
  id: string;
  sub_fonte_id: string;
  nome: string;
  tipo: ColunaType;
  formula: string | null;
  is_system_data: boolean;
  system_data_type: SystemDataType | null;
  system_data_filter: string | null;
  ordem: number;
  largura: number;
  editavel: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface MktLancamento {
  id: string;
  coluna_id: string;
  data: string;
  valor_numerico: number | null;
  observacao: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface MktGastosConfig {
  id: string;
  chave: string;
  valor: string | null;
  tipo: string;
  descricao: string | null;
}

export function useMarketingGastos() {
  const { toast } = useToast();
  const [fontes, setFontes] = useState<MktFonte[]>([]);
  const [subFontes, setSubFontes] = useState<MktSubFonte[]>([]);
  const [colunas, setColunas] = useState<MktConfigColuna[]>([]);
  const [lancamentos, setLancamentos] = useState<MktLancamento[]>([]);
  const [config, setConfig] = useState<MktGastosConfig[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all fontes
  const fetchFontes = useCallback(async () => {
    const { data, error } = await supabase
      .from('crm_multiempresas_mkt_fontes')
      .select('*')
      .eq('ativo', true)
      .order('ordem', { ascending: true });

    if (error) {
      console.error('Erro ao buscar fontes:', error);
      return;
    }
    setFontes(data || []);
  }, []);

  // Fetch sub-fontes by fonte_id
  const fetchSubFontes = useCallback(async (fonteId?: string) => {
    let query = supabase
      .from('crm_multiempresas_mkt_sub_fontes')
      .select('*')
      .eq('ativo', true)
      .order('ordem', { ascending: true });

    if (fonteId) {
      query = query.eq('fonte_id', fonteId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar sub-fontes:', error);
      return;
    }
    setSubFontes(data || []);
  }, []);

  // Fetch colunas by sub_fonte_id
  const fetchColunas = useCallback(async (subFonteId?: string) => {
    let query = supabase
      .from('crm_multiempresas_mkt_config_colunas')
      .select('*')
      .order('ordem', { ascending: true });

    if (subFonteId) {
      query = query.eq('sub_fonte_id', subFonteId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar colunas:', error);
      return;
    }
    setColunas((data as MktConfigColuna[]) || []);
  }, []);

  // Fetch lancamentos by coluna_id and date range
  const fetchLancamentos = useCallback(async (colunaIds?: string[], dataInicio?: string, dataFim?: string) => {
    let query = supabase
      .from('crm_multiempresas_mkt_lancamentos')
      .select('*')
      .order('data', { ascending: false });

    if (colunaIds && colunaIds.length > 0) {
      query = query.in('coluna_id', colunaIds);
    }
    if (dataInicio) {
      query = query.gte('data', dataInicio);
    }
    if (dataFim) {
      query = query.lte('data', dataFim);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar lançamentos:', error);
      return;
    }
    setLancamentos(data || []);
  }, []);

  // Fetch config
  const fetchConfig = useCallback(async () => {
    const { data, error } = await supabase
      .from('crm_multiempresas_mkt_gastos_config')
      .select('*');

    if (error) {
      console.error('Erro ao buscar configurações:', error);
      return;
    }
    setConfig(data || []);
  }, []);

  // Create fonte
  const createFonte = useCallback(async (fonte: Partial<MktFonte>) => {
    const { data, error } = await supabase
      .from('crm_multiempresas_mkt_fontes')
      .insert([{
        nome: fonte.nome,
        icone: fonte.icone || 'wallet',
        cor: fonte.cor || '#3b82f6',
        ordem: fontes.length,
      }])
      .select()
      .single();

    if (error) {
      toast({ title: 'Erro', description: 'Falha ao criar fonte', variant: 'destructive' });
      return null;
    }

    toast({ title: 'Sucesso', description: 'Fonte criada com sucesso' });
    await fetchFontes();
    return data;
  }, [fontes.length, fetchFontes, toast]);

  // Update fonte
  const updateFonte = useCallback(async (id: string, updates: Partial<MktFonte>) => {
    const { error } = await supabase
      .from('crm_multiempresas_mkt_fontes')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro', description: 'Falha ao atualizar fonte', variant: 'destructive' });
      return false;
    }

    toast({ title: 'Sucesso', description: 'Fonte atualizada' });
    await fetchFontes();
    return true;
  }, [fetchFontes, toast]);

  // Delete fonte (soft delete)
  const deleteFonte = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('crm_multiempresas_mkt_fontes')
      .update({ ativo: false })
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro', description: 'Falha ao excluir fonte', variant: 'destructive' });
      return false;
    }

    toast({ title: 'Sucesso', description: 'Fonte excluída' });
    await fetchFontes();
    return true;
  }, [fetchFontes, toast]);

  // Create sub-fonte
  const createSubFonte = useCallback(async (subFonte: Partial<MktSubFonte>) => {
    const { data, error } = await supabase
      .from('crm_multiempresas_mkt_sub_fontes')
      .insert([{
        fonte_id: subFonte.fonte_id,
        nome: subFonte.nome,
        descricao: subFonte.descricao,
        ordem: subFontes.filter(sf => sf.fonte_id === subFonte.fonte_id).length,
      }])
      .select()
      .single();

    if (error) {
      toast({ title: 'Erro', description: 'Falha ao criar sub-fonte', variant: 'destructive' });
      return null;
    }

    toast({ title: 'Sucesso', description: 'Sub-fonte criada com sucesso' });
    await fetchSubFontes(subFonte.fonte_id);
    return data;
  }, [subFontes, fetchSubFontes, toast]);

  // Update sub-fonte
  const updateSubFonte = useCallback(async (id: string, updates: Partial<MktSubFonte>) => {
    const { error } = await supabase
      .from('crm_multiempresas_mkt_sub_fontes')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro', description: 'Falha ao atualizar sub-fonte', variant: 'destructive' });
      return false;
    }

    await fetchSubFontes();
    return true;
  }, [fetchSubFontes, toast]);

  // Delete sub-fonte (soft delete)
  const deleteSubFonte = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('crm_multiempresas_mkt_sub_fontes')
      .update({ ativo: false })
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro', description: 'Falha ao excluir sub-fonte', variant: 'destructive' });
      return false;
    }

    toast({ title: 'Sucesso', description: 'Sub-fonte excluída' });
    await fetchSubFontes();
    return true;
  }, [fetchSubFontes, toast]);

  // Create coluna
  const createColuna = useCallback(async (coluna: Partial<MktConfigColuna>) => {
    const existingColunas = colunas.filter(c => c.sub_fonte_id === coluna.sub_fonte_id);
    
    const { data, error } = await supabase
      .from('crm_multiempresas_mkt_config_colunas')
      .insert([{
        sub_fonte_id: coluna.sub_fonte_id,
        nome: coluna.nome,
        tipo: coluna.tipo || 'number',
        formula: coluna.formula,
        is_system_data: coluna.is_system_data || false,
        system_data_type: coluna.system_data_type,
        system_data_filter: coluna.system_data_filter,
        ordem: existingColunas.length,
        largura: coluna.largura || 120,
        editavel: coluna.editavel !== false,
      }])
      .select()
      .single();

    if (error) {
      toast({ title: 'Erro', description: 'Falha ao criar coluna', variant: 'destructive' });
      return null;
    }

    toast({ title: 'Sucesso', description: 'Coluna criada' });
    await fetchColunas(coluna.sub_fonte_id);
    return data;
  }, [colunas, fetchColunas, toast]);

  // Update coluna
  const updateColuna = useCallback(async (id: string, updates: Partial<MktConfigColuna>) => {
    const { error } = await supabase
      .from('crm_multiempresas_mkt_config_colunas')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro', description: 'Falha ao atualizar coluna', variant: 'destructive' });
      return false;
    }

    await fetchColunas();
    return true;
  }, [fetchColunas, toast]);

  // Delete coluna
  const deleteColuna = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('crm_multiempresas_mkt_config_colunas')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro', description: 'Falha ao excluir coluna', variant: 'destructive' });
      return false;
    }

    toast({ title: 'Sucesso', description: 'Coluna excluída' });
    await fetchColunas();
    return true;
  }, [fetchColunas, toast]);

  // Create or update lancamento (upsert)
  const upsertLancamento = useCallback(async (
    colunaId: string, 
    data: string, 
    valorNumerico: number | null,
    observacao?: string
  ) => {
    const { error } = await supabase
      .from('crm_multiempresas_mkt_lancamentos')
      .upsert({
        coluna_id: colunaId,
        data,
        valor_numerico: valorNumerico,
        observacao,
      }, {
        onConflict: 'coluna_id,data',
      });

    if (error) {
      console.error('Erro ao salvar lançamento:', error);
      return false;
    }

    return true;
  }, []);

  // Batch upsert lancamentos
  const batchUpsertLancamentos = useCallback(async (
    items: Array<{ coluna_id: string; data: string; valor_numerico: number | null }>
  ) => {
    const { error } = await supabase
      .from('crm_multiempresas_mkt_lancamentos')
      .upsert(items, {
        onConflict: 'coluna_id,data',
      });

    if (error) {
      toast({ title: 'Erro', description: 'Falha ao salvar lançamentos', variant: 'destructive' });
      return false;
    }

    return true;
  }, [toast]);

  // Delete lancamento
  const deleteLancamento = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('crm_multiempresas_mkt_lancamentos')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro', description: 'Falha ao excluir lançamento', variant: 'destructive' });
      return false;
    }

    return true;
  }, [toast]);

  // Update config
  const updateConfig = useCallback(async (chave: string, valor: string) => {
    const { error } = await supabase
      .from('crm_multiempresas_mkt_gastos_config')
      .update({ valor })
      .eq('chave', chave);

    if (error) {
      toast({ title: 'Erro', description: 'Falha ao atualizar configuração', variant: 'destructive' });
      return false;
    }

    await fetchConfig();
    return true;
  }, [fetchConfig, toast]);

  // Get config value by key
  const getConfigValue = useCallback((chave: string, defaultValue?: string) => {
    const item = config.find(c => c.chave === chave);
    return item?.valor || defaultValue || '';
  }, [config]);

  // Initial load
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([
        fetchFontes(),
        fetchSubFontes(),
        fetchColunas(),
        fetchConfig(),
      ]);
      setLoading(false);
    };
    loadAll();
  }, [fetchFontes, fetchSubFontes, fetchColunas, fetchConfig]);

  // Real-time subscriptions (apenas configuração; lançamentos são atualizados via fetch após save)
  useEffect(() => {
    const fontesChannel = supabase
      .channel('crm_multiempresas_mkt_fontes_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_multiempresas_mkt_fontes' }, () => {
        fetchFontes();
      })
      .subscribe();

    const subFontesChannel = supabase
      .channel('crm_multiempresas_mkt_sub_fontes_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_multiempresas_mkt_sub_fontes' }, () => {
        fetchSubFontes();
      })
      .subscribe();

    const colunasChannel = supabase
      .channel('crm_multiempresas_mkt_config_colunas_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_multiempresas_mkt_config_colunas' }, () => {
        fetchColunas();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(fontesChannel);
      supabase.removeChannel(subFontesChannel);
      supabase.removeChannel(colunasChannel);
    };
  }, [fetchFontes, fetchSubFontes, fetchColunas]);

  return {
    // Data
    fontes,
    subFontes,
    colunas,
    lancamentos,
    config,
    loading,
    
    // Fetch methods
    fetchFontes,
    fetchSubFontes,
    fetchColunas,
    fetchLancamentos,
    fetchConfig,
    
    // Fonte CRUD
    createFonte,
    updateFonte,
    deleteFonte,
    
    // SubFonte CRUD
    createSubFonte,
    updateSubFonte,
    deleteSubFonte,
    
    // Coluna CRUD
    createColuna,
    updateColuna,
    deleteColuna,
    
    // Lancamento CRUD
    upsertLancamento,
    batchUpsertLancamentos,
    deleteLancamento,
    
    // Config
    updateConfig,
    getConfigValue,
  };
}
