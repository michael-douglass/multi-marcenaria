import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FileText, Download, Loader2, MessageSquare, CalendarIcon, Wallet } from 'lucide-react';
import { Lead } from '@/types/selletos';
import { format, startOfMonth, endOfMonth, subDays, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn, toSaoPauloTime } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { GARBO_LOGO_SRC } from '@/lib/garbo-brand';
import { useMarketingGastos, MktConfigColuna } from '@/hooks/useMarketingGastos';
import { useSystemDataFetcher } from '@/hooks/useSystemDataFetcher';
import { useFormulaEngine } from '@/hooks/useFormulaEngine';

interface ExportReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: Lead[];
  allLeads: Lead[];
  lastInteractionMap: Record<number, number>;
}

interface ReportSection {
  id: string;
  label: string;
  category: 'leads' | 'metricas' | 'conversas';
}

interface ChatMessageForExport {
  type: 'human' | 'ai';
  content: string;
  criado_em?: string;
  origem?: string;
}

const REPORT_SECTIONS: ReportSection[] = [
  // Dados de Leads (Lista)
  { id: 'lista_leads', label: 'Incluir Lista de Leads', category: 'leads' },
  { id: 'lead_nome', label: 'Nome do Lead', category: 'leads' },
  { id: 'lead_telefone', label: 'Telefone do Lead', category: 'leads' },
  { id: 'lead_email', label: 'E-mail do Lead', category: 'leads' },
  { id: 'lead_origem', label: 'Origem', category: 'leads' },
  { id: 'lead_regiao', label: 'Região/Fonte', category: 'leads' },
  
  // Métricas
  { id: 'vendas_ganhas', label: 'Vendas Ganhas (Mês)', category: 'metricas' },
  { id: 'conversao_leads', label: 'Conversão Leads (Vendas/Total)', category: 'metricas' },
  { id: 'conversao_aulas', label: 'Conversão Aulas (Vendas/Aulas)', category: 'metricas' },
  { id: 'tempo_medio_resposta', label: 'Tempo Médio de Resposta', category: 'metricas' },
  { id: 'leads_por_dia', label: 'Leads por Dia (Últimos 15 dias)', category: 'metricas' },
  { id: 'taxa_conversao_aulas', label: 'Taxa de Conversão de Aulas', category: 'metricas' },
  { id: 'tendencia_15_dias', label: 'Tendência de Crescimento (15 dias)', category: 'metricas' },
  { id: 'aulas_vs_semana', label: 'Aulas Experimentais vs Semana Anterior', category: 'metricas' },
  { id: 'jornada_compra', label: 'Jornada de Compra', category: 'metricas' },
  { id: 'evolucao_15_dias', label: 'Gráfico de Evolução (15 Dias)', category: 'metricas' },
  { id: 'leads_por_regiao', label: 'Leads por Região', category: 'metricas' },
  { id: 'negocios_ganhos', label: 'Negócios Ganhos', category: 'metricas' },
  { id: 'vendas_por_origem', label: 'Vendas por Origem', category: 'metricas' },
  
  // Conversas
  { id: 'exportar_conversas', label: 'Exportar Conversas', category: 'conversas' },
];

// Função para buscar mensagens de um lead específico
async function fetchLeadMessages(telefone: string): Promise<ChatMessageForExport[]> {
  const telefoneNormalizado = telefone.replace(/\D/g, '');
  if (!telefoneNormalizado) return [];

  try {
    // Buscar histórico n8n via Edge Function
    const { data: n8nData } = await supabase.functions.invoke('get-lead-whatsapp-history', {
      body: { telefone }
    });

    // Buscar histórico CRM local
    const { data: crmData } = await supabase
      .from('crm_multiempresas_chat_mensagens')
      .select('*')
      .eq('telefone', telefoneNormalizado)
      .order('criado_em', { ascending: true });

    // Combinar mensagens
    const n8nMessages: ChatMessageForExport[] = (n8nData?.messages || []).map((msg: any) => ({
      type: msg.type as 'human' | 'ai',
      content: msg.content || '',
      criado_em: msg.criado_em,
      origem: 'n8n'
    }));

    const crmMessages: ChatMessageForExport[] = (crmData || []).map((msg: any) => ({
      type: msg.tipo_remetente === 'lead' ? 'human' : 'ai',
      content: msg.conteudo || '',
      criado_em: msg.criado_em,
      origem: msg.origem
    }));

    // Combinar e ordenar
    const allMessages = [...n8nMessages, ...crmMessages];
    
    // Ordenar por criado_em quando disponível
    allMessages.sort((a, b) => {
      if (!a.criado_em && !b.criado_em) return 0;
      if (!a.criado_em) return -1;
      if (!b.criado_em) return 1;
      return new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime();
    });

    return allMessages;
  } catch (error) {
    console.error('Erro ao buscar mensagens do lead:', error);
    return [];
  }
}

export function ExportReportDialog({
  open,
  onOpenChange,
  leads,
  allLeads,
  lastInteractionMap,
}: ExportReportDialogProps) {
  // Hook de marketing gastos
  const { fontes, subFontes, colunas, lancamentos, fetchColunas, fetchLancamentos } = useMarketingGastos();
  const { fetchSystemDataBatch, getSystemDataValue, fetchAllMonthlyTotals, getMonthlyTotalValue } = useSystemDataFetcher();
  const { calculateColumnValue, formatValue } = useFormulaEngine();

  const [selectedSections, setSelectedSections] = useState<string[]>(
    REPORT_SECTIONS.filter(s => s.category !== 'conversas').map(s => s.id)
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [conversasQuantidade, setConversasQuantidade] = useState<string>('10');
  
  // Filtro de data do relatório
  const now = toSaoPauloTime(new Date());
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(now));
  const [dateTo, setDateTo] = useState<Date>(now);

  // Estados para Controle de Gastos
  const [includeGastos, setIncludeGastos] = useState(false);
  const [selectedFonteIds, setSelectedFonteIds] = useState<string[]>([]);
  const [selectedSubFonteIds, setSelectedSubFonteIds] = useState<string[]>([]);
  const [selectedColunaIds, setSelectedColunaIds] = useState<string[]>([]);
  const [gastosDisplayMode, setGastosDisplayMode] = useState<'all' | 'with_data' | 'total_only'>('all');
  const [gastosDataLoaded, setGastosDataLoaded] = useState(false);

  // Filtrar sub-fontes pelas fontes selecionadas
  const filteredSubFontes = useMemo(() => 
    subFontes.filter(sf => selectedFonteIds.includes(sf.fonte_id)),
    [subFontes, selectedFonteIds]
  );

  // Colunas das sub-fontes selecionadas
  const subFonteColunas = useMemo(() => 
    colunas.filter(c => selectedSubFonteIds.includes(c.sub_fonte_id)).sort((a, b) => a.ordem - b.ordem),
    [colunas, selectedSubFonteIds]
  );

  // Toggle fonte selecionada
  const toggleFonte = (fonteId: string) => {
    setSelectedFonteIds(prev => 
      prev.includes(fonteId) 
        ? prev.filter(id => id !== fonteId)
        : [...prev, fonteId]
    );
  };

  // Toggle sub-fonte selecionada
  const toggleSubFonte = (subFonteId: string) => {
    setSelectedSubFonteIds(prev => 
      prev.includes(subFonteId) 
        ? prev.filter(id => id !== subFonteId)
        : [...prev, subFonteId]
    );
  };

  // Selecionar/deselecionar todas as fontes
  const toggleAllFontes = (checked: boolean) => {
    if (checked) {
      setSelectedFonteIds(fontes.map(f => f.id));
    } else {
      setSelectedFonteIds([]);
    }
  };

  // Selecionar/deselecionar todas as sub-fontes
  const toggleAllSubFontes = (checked: boolean) => {
    if (checked) {
      setSelectedSubFonteIds(filteredSubFontes.map(sf => sf.id));
    } else {
      setSelectedSubFonteIds([]);
    }
  };

  // Carregar colunas quando sub-fontes mudarem
  useEffect(() => {
    if (selectedSubFonteIds.length > 0) {
      // Fetch colunas para todas as sub-fontes selecionadas
      selectedSubFonteIds.forEach(sfId => fetchColunas(sfId));
    }
  }, [selectedSubFonteIds, fetchColunas]);

  // Carregar lançamentos quando sub-fontes e período mudarem
  useEffect(() => {
    const loadGastosData = async () => {
      if (selectedSubFonteIds.length > 0 && subFonteColunas.length > 0 && includeGastos) {
        setGastosDataLoaded(false);
        const startDate = format(dateFrom, 'yyyy-MM-dd');
        const endDate = format(dateTo, 'yyyy-MM-dd');
        
        await fetchLancamentos(
          subFonteColunas.map(c => c.id),
          startDate,
          endDate
        );
        
        // Carregar dados automáticos do sistema
        const systemColumns = subFonteColunas.filter(c => c.is_system_data);
        if (systemColumns.length > 0) {
          const days = eachDayOfInterval({ start: dateFrom, end: dateTo });
          const dateStrings = days.map(d => format(d, 'yyyy-MM-dd'));
          await fetchSystemDataBatch(systemColumns, dateStrings);
          await fetchAllMonthlyTotals(systemColumns, dateFrom);
        }
        
        setGastosDataLoaded(true);
      }
    };
    loadGastosData();
  }, [selectedSubFonteIds, subFonteColunas, dateFrom, dateTo, includeGastos, fetchLancamentos, fetchSystemDataBatch, fetchAllMonthlyTotals]);

  // Reset sub-fontes quando fontes mudarem
  useEffect(() => {
    // Remover sub-fontes que não pertencem mais às fontes selecionadas
    setSelectedSubFonteIds(prev => 
      prev.filter(sfId => {
        const sf = subFontes.find(s => s.id === sfId);
        return sf && selectedFonteIds.includes(sf.fonte_id);
      })
    );
  }, [selectedFonteIds, subFontes]);

  // Selecionar todas as colunas quando sub-fontes mudarem
  useEffect(() => {
    if (subFonteColunas.length > 0) {
      setSelectedColunaIds(subFonteColunas.map(c => c.id));
    }
  }, [subFonteColunas]);

  // Toggle coluna selecionada
  const toggleColuna = (colunaId: string) => {
    setSelectedColunaIds(prev => 
      prev.includes(colunaId) 
        ? prev.filter(id => id !== colunaId)
        : [...prev, colunaId]
    );
  };

  // Filtrar leads pelo período selecionado
  const filteredLeads = useMemo(() => {
    const fromStr = format(dateFrom, 'yyyy-MM-dd');
    const toStr = format(dateTo, 'yyyy-MM-dd');
    return leads.filter(lead => {
      const leadDate = lead.dateArrived;
      return leadDate >= fromStr && leadDate <= toStr;
    });
  }, [leads, dateFrom, dateTo]);

  const filteredAllLeads = useMemo(() => {
    const fromStr = format(dateFrom, 'yyyy-MM-dd');
    const toStr = format(dateTo, 'yyyy-MM-dd');
    return allLeads.filter(lead => {
      const leadDate = lead.dateArrived;
      return leadDate >= fromStr && leadDate <= toStr;
    });
  }, [allLeads, dateFrom, dateTo]);

  const toggleSection = (sectionId: string) => {
    setSelectedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const toggleAll = (checked: boolean) => {
    setSelectedSections(checked ? REPORT_SECTIONS.map(s => s.id) : []);
  };

  const toggleCategory = (category: 'leads' | 'metricas' | 'conversas', checked: boolean) => {
    const categoryIds = REPORT_SECTIONS.filter(s => s.category === category).map(s => s.id);
    setSelectedSections(prev => {
      if (checked) {
        return [...new Set([...prev, ...categoryIds])];
      } else {
        return prev.filter(id => !categoryIds.includes(id));
      }
    });
  };

  const isCategorySelected = (category: 'leads' | 'metricas' | 'conversas') => {
    const categoryIds = REPORT_SECTIONS.filter(s => s.category === category).map(s => s.id);
    return categoryIds.every(id => selectedSections.includes(id));
  };

  // Calcular métricas para o relatório (usando leads filtrados)
  const reportData = useMemo(() => {
    const fromStr = format(dateFrom, 'yyyy-MM-dd');
    const toStr = format(dateTo, 'yyyy-MM-dd');
    const periodLabel = `${format(dateFrom, 'dd/MM/yyyy', { locale: ptBR })} - ${format(dateTo, 'dd/MM/yyyy', { locale: ptBR })}`;

    // Vendas do período
    const vendasPeriodo = filteredAllLeads.filter(lead =>
      lead.status === 'Venda Realizada (Matriculado)' &&
      lead.saleDate &&
      lead.saleDate >= fromStr &&
      lead.saleDate <= toStr
    );

    // Tempo médio de resposta (baseado na última interação)
    const temposResposta: number[] = [];
    filteredAllLeads.forEach(lead => {
      const lastTs = lastInteractionMap[lead.id];
      if (lastTs) {
        const arrivalTs = new Date(lead.dateArrived).getTime();
        const diffMinutes = (lastTs - arrivalTs) / (1000 * 60);
        if (diffMinutes > 0 && diffMinutes < 60 * 24 * 30) {
          temposResposta.push(diffMinutes);
        }
      }
    });
    const tempoMedioMinutos = temposResposta.length > 0
      ? temposResposta.reduce((a, b) => a + b, 0) / temposResposta.length
      : 0;

    // Leads por dia (dentro do período selecionado, últimos 15 dias do período ou menos)
    const diffDays = Math.ceil((dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const daysToShow = Math.min(diffDays, 15);
    const leadsUltimosDias = Array.from({ length: daysToShow }, (_, i) => {
      const date = subDays(dateTo, daysToShow - 1 - i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const count = filteredAllLeads.filter(lead => lead.dateArrived === dateStr).length;
      return { date: format(date, 'dd/MM', { locale: ptBR }), count };
    });

    // Taxa de conversão aulas
    const totalLeadsPeriodo = filteredAllLeads.length;
    const aulasMarcadas = filteredAllLeads.filter(lead =>
      lead.status === 'Aula Experimental Marcada'
    ).length;
    const taxaConversaoAulas = totalLeadsPeriodo > 0 ? (aulasMarcadas / totalLeadsPeriodo) * 100 : 0;

    // Tendência (comparação primeira metade vs segunda metade do período)
    const half = Math.ceil(daysToShow / 2);
    const avgCurrent = leadsUltimosDias.slice(-half).reduce((s, d) => s + d.count, 0) / half;
    const avgPrevious = leadsUltimosDias.slice(0, half).reduce((s, d) => s + d.count, 0) / half;
    const tendencia = avgPrevious > 0 ? ((avgCurrent - avgPrevious) / avgPrevious) * 100 : 0;

    // Aulas (primeira metade vs segunda metade do período)
    const midDate = new Date((dateFrom.getTime() + dateTo.getTime()) / 2);
    const midStr = format(midDate, 'yyyy-MM-dd');
    const aulasSegundaMetade = filteredAllLeads.filter(lead =>
      lead.status === 'Aula Experimental Marcada' && lead.dateArrived >= midStr
    ).length;
    const aulasPrimeiraMetade = filteredAllLeads.filter(lead =>
      lead.status === 'Aula Experimental Marcada' && lead.dateArrived < midStr
    ).length;

    // Leads por região
    const leadsPorRegiao: Record<string, number> = {};
    filteredAllLeads.forEach(lead => {
      const regiao = lead.regiao || 'Não definida';
      leadsPorRegiao[regiao] = (leadsPorRegiao[regiao] || 0) + 1;
    });

    // Vendas por origem
    const vendasPorOrigem: Record<string, { count: number; valor: number }> = {};
    vendasPeriodo.forEach(lead => {
      const origem = lead.origin || 'Não definida';
      if (!vendasPorOrigem[origem]) {
        vendasPorOrigem[origem] = { count: 0, valor: 0 };
      }
      vendasPorOrigem[origem].count++;
      vendasPorOrigem[origem].valor += lead.dealValue || 0;
    });

    // Leads que já tiveram aulas experimentais (status "Aula Experimental Marcada" ou já passaram por isso e viraram venda)
    const leadsAulasExperimentais = filteredAllLeads.filter(lead =>
      lead.status === 'Aula Experimental Marcada' || 
      lead.status === 'Venda Realizada (Matriculado)'
    ).length;

    // Taxa de conversão de LEADS: Vendas / Total de Leads
    const taxaConversaoLeads = totalLeadsPeriodo > 0 
      ? (vendasPeriodo.length / totalLeadsPeriodo) * 100 
      : 0;

    // Taxa de conversão de AULAS: Vendas / Leads que tiveram aula experimental
    // Considera que leads vendidos passaram por aula experimental
    const taxaConversaoAulasVendas = leadsAulasExperimentais > 0 
      ? (vendasPeriodo.length / leadsAulasExperimentais) * 100 
      : 0;

    return {
      vendasMes: vendasPeriodo,
      valorTotalVendas: vendasPeriodo.reduce((s, l) => s + (l.dealValue || 0), 0),
      tempoMedioMinutos,
      leadsUltimos15Dias: leadsUltimosDias,
      taxaConversaoAulas,
      totalLeadsMes: totalLeadsPeriodo,
      aulasMarcadas,
      tendencia,
      aulasEstaSemana: aulasSegundaMetade,
      aulasSemanaPassada: aulasPrimeiraMetade,
      leadsPorRegiao,
      vendasPorOrigem,
      monthLabel: periodLabel,
      daysInPeriod: daysToShow,
      // Novas métricas de conversão
      taxaConversaoLeads,
      taxaConversaoAulasVendas,
      leadsAulasExperimentais,
    };
  }, [filteredAllLeads, lastInteractionMap, dateFrom, dateTo]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatTempo = (minutos: number) => {
    if (minutos < 60) return `${Math.round(minutos)} min`;
    const horas = Math.floor(minutos / 60);
    const mins = Math.round(minutos % 60);
    return `${horas}h ${mins}min`;
  };

  const generateReport = async () => {
    setIsGenerating(true);

    try {
      const includesLeadData = selectedSections.some(s => s.startsWith('lead_'));

      // Criar HTML do relatório
      let htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório Pipeline - ${reportData.monthLabel}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 20px; background: #fff; color: #1a1a1a; }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #ea580c; }
    .header img { height: 60px; }
    .header h1 { font-size: 24px; color: #ea580c; }
    .header .date { font-size: 12px; color: #666; }
    .section { margin-bottom: 25px; }
    .section-title { font-size: 16px; font-weight: 600; color: #ea580c; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #e5e5e5; }
    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; }
    .metric-card { background: #f9fafb; border: 1px solid #e5e5e5; border-radius: 8px; padding: 15px; }
    .metric-label { font-size: 11px; color: #666; text-transform: uppercase; margin-bottom: 5px; }
    .metric-value { font-size: 22px; font-weight: 700; color: #1a1a1a; }
    .metric-sub { font-size: 11px; color: #888; margin-top: 3px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #e5e5e5; }
    th { background: #f3f4f6; font-weight: 600; color: #374151; }
    tr:hover { background: #f9fafb; }
    .chart-container { background: #f9fafb; border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px; }
    .chart-grid { display: grid; grid-template-columns: repeat(15, 1fr); gap: 6px; align-items: end; height: 120px; }
    .chart-column { display: flex; flex-direction: column; align-items: center; height: 100%; }
    .chart-bar { background: linear-gradient(180deg, #ea580c 0%, #fb923c 100%); border-radius: 4px 4px 0 0; min-height: 8px; width: 100%; display: flex; align-items: flex-start; justify-content: center; position: relative; }
    .chart-value { position: absolute; top: -18px; font-size: 10px; font-weight: 600; color: #ea580c; }
    .chart-label { font-size: 9px; text-align: center; color: #666; margin-top: 6px; font-weight: 500; }
    .positive { color: #16a34a; }
    .negative { color: #dc2626; }
    .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #e5e5e5; text-align: center; font-size: 10px; color: #888; }
    
    /* Estilos para bloco de conversa organizada por lead */
    .lead-conversation-block { margin-bottom: 30px; border: 1px solid #e5e5e5; border-radius: 12px; overflow: hidden; background: #fff; }
    .lead-conversation-header { background: linear-gradient(135deg, #ea580c 0%, #fb923c 100%); padding: 15px 20px; display: flex; align-items: center; gap: 15px; }
    .lead-number { width: 36px; height: 36px; background: rgba(255,255,255,0.25); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; color: #fff; }
    .lead-info-header { flex: 1; color: #fff; }
    .lead-name-header { font-size: 16px; font-weight: 600; margin-bottom: 2px; }
    .lead-phone-header { font-size: 12px; opacity: 0.9; }
    .lead-first-contact { font-size: 11px; opacity: 0.8; margin-top: 3px; }
    .lead-first-message { background: #fef3c7; padding: 12px 20px; border-bottom: 1px solid #fcd34d; }
    .first-message-label { font-size: 11px; font-weight: 600; color: #92400e; text-transform: uppercase; margin-bottom: 4px; }
    .first-message-content { font-size: 13px; color: #78350f; font-style: italic; line-height: 1.4; }
    
    /* Estilos para conversas/chat */
    .chat-container { background: #e5ddd5; padding: 15px; }
    .chat-header { background: #128C7E; color: white; padding: 10px 15px; border-radius: 8px; margin-bottom: 15px; display: flex; align-items: center; gap: 10px; }
    .chat-header-avatar { width: 40px; height: 40px; background: #25D366; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px; }
    .chat-header-info { flex: 1; }
    .chat-header-name { font-weight: 600; font-size: 14px; }
    .chat-header-phone { font-size: 11px; opacity: 0.9; }
    .chat-header-count { background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 12px; font-size: 11px; }
    .chat-messages { display: flex; flex-direction: column; gap: 6px; }
    .chat-message { max-width: 75%; padding: 8px 12px; border-radius: 8px; font-size: 12px; line-height: 1.4; position: relative; word-wrap: break-word; }
    .chat-message.lead { background: #fff; align-self: flex-start; border-bottom-left-radius: 0; }
    .chat-message.atendente { background: #dcf8c6; align-self: flex-end; border-bottom-right-radius: 0; }
    .chat-message-time { font-size: 9px; color: #667781; margin-top: 4px; text-align: right; }
    .chat-date-separator { text-align: center; margin: 10px 0; }
    .chat-date-separator span { background: #e1f3fb; padding: 4px 12px; border-radius: 6px; font-size: 10px; color: #54656f; }
    .conversation-separator { margin: 15px 0; }
    
    @media print {
      body { padding: 10px; }
      .section { page-break-inside: avoid; }
      .lead-conversation-block { page-break-inside: avoid; }
      .conversation-separator { page-break-before: always; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Relatório do Pipeline</h1>
      <div class="date">Gerado em ${format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}</div>
    </div>
    <img src="${GARBO_LOGO_SRC}" alt="Garbo Movelaria" />
  </div>
`;

      // Seção de Métricas
      const hasMetrics = selectedSections.some(s => 
        ['vendas_ganhas', 'tempo_medio_resposta', 'taxa_conversao_aulas', 'tendencia_15_dias', 'aulas_vs_semana', 'jornada_compra', 'negocios_ganhos', 'conversao_leads', 'conversao_aulas'].includes(s)
      );

      if (hasMetrics) {
        htmlContent += `<div class="section"><div class="section-title">Métricas do Período - ${reportData.monthLabel}</div><div class="metrics-grid">`;

        if (selectedSections.includes('vendas_ganhas') || selectedSections.includes('negocios_ganhos')) {
          htmlContent += `
            <div class="metric-card">
              <div class="metric-label">Vendas do Mês</div>
              <div class="metric-value">${reportData.vendasMes.length}</div>
              <div class="metric-sub">${formatCurrency(reportData.valorTotalVendas)}</div>
            </div>`;
        }

        // Novo card: Conversão Leads (Vendas / Total Leads)
        if (selectedSections.includes('conversao_leads')) {
          const isGood = reportData.taxaConversaoLeads >= 5;
          const isMedium = reportData.taxaConversaoLeads >= 2;
          const colorClass = isGood ? 'positive' : (isMedium ? '' : 'negative');
          htmlContent += `
            <div class="metric-card">
              <div class="metric-label" style="color: #ea580c;">👥 Conversão Leads</div>
              <div class="metric-value ${colorClass}" style="font-size: 28px;">${reportData.taxaConversaoLeads.toFixed(1)}% <span style="font-size: 14px;">${reportData.taxaConversaoLeads >= 0 ? (reportData.taxaConversaoLeads > reportData.taxaConversaoAulas ? '↗' : '↘') : '↘'}</span></div>
              <div class="metric-sub">${reportData.vendasMes.length} de ${reportData.totalLeadsMes} leads</div>
            </div>`;
        }

        // Novo card: Conversão Aulas (Vendas / Total Aulas Experimentais)
        if (selectedSections.includes('conversao_aulas')) {
          const isGood = reportData.taxaConversaoAulasVendas >= 20;
          const isMedium = reportData.taxaConversaoAulasVendas >= 10;
          const colorClass = isGood ? 'positive' : (isMedium ? '' : 'negative');
          htmlContent += `
            <div class="metric-card">
              <div class="metric-label" style="color: #f59e0b;">📚 Conversão Aulas</div>
              <div class="metric-value ${colorClass}" style="font-size: 28px;">${reportData.taxaConversaoAulasVendas.toFixed(1)}% <span style="font-size: 14px;">${reportData.taxaConversaoAulasVendas >= reportData.taxaConversaoLeads ? '↗' : '↘'}</span></div>
              <div class="metric-sub">${reportData.vendasMes.length} de ${reportData.leadsAulasExperimentais} aulas</div>
            </div>`;
        }

        if (selectedSections.includes('tempo_medio_resposta')) {
          htmlContent += `
            <div class="metric-card">
              <div class="metric-label">Tempo Médio de Resposta</div>
              <div class="metric-value">${formatTempo(reportData.tempoMedioMinutos)}</div>
            </div>`;
        }

        if (selectedSections.includes('taxa_conversao_aulas')) {
          htmlContent += `
            <div class="metric-card">
              <div class="metric-label">Taxa de Conversão (Aulas)</div>
              <div class="metric-value">${reportData.taxaConversaoAulas.toFixed(1)}%</div>
              <div class="metric-sub">${reportData.aulasMarcadas} de ${reportData.totalLeadsMes} leads</div>
            </div>`;
        }

        if (selectedSections.includes('tendencia_15_dias')) {
          const isPositive = reportData.tendencia >= 0;
          htmlContent += `
            <div class="metric-card">
              <div class="metric-label">Tendência (15 dias)</div>
              <div class="metric-value ${isPositive ? 'positive' : 'negative'}">${isPositive ? '+' : ''}${reportData.tendencia.toFixed(1)}%</div>
              <div class="metric-sub">${isPositive ? 'Crescimento' : 'Queda'}</div>
            </div>`;
        }

        if (selectedSections.includes('aulas_vs_semana')) {
          const diff = reportData.aulasEstaSemana - reportData.aulasSemanaPassada;
          htmlContent += `
            <div class="metric-card">
              <div class="metric-label">Aulas Esta Semana</div>
              <div class="metric-value">${reportData.aulasEstaSemana}</div>
              <div class="metric-sub ${diff >= 0 ? 'positive' : 'negative'}">
                ${diff >= 0 ? '+' : ''}${diff} vs semana anterior (${reportData.aulasSemanaPassada})
              </div>
            </div>`;
        }

        htmlContent += `</div></div>`;
      }

      // Evolução 15 dias (gráfico)
      if (selectedSections.includes('evolucao_15_dias') || selectedSections.includes('leads_por_dia')) {
        const maxCount = Math.max(...reportData.leadsUltimos15Dias.map(d => d.count), 1);
        const totalLeads15Dias = reportData.leadsUltimos15Dias.reduce((s, d) => s + d.count, 0);
        const avgLeads15Dias = (totalLeads15Dias / 15).toFixed(1);
        htmlContent += `
          <div class="section">
            <div class="section-title">Evolução dos Últimos 15 Dias</div>
            <div style="display: flex; gap: 20px; margin-bottom: 15px;">
              <div class="metric-card" style="flex: 1;">
                <div class="metric-label">Total de Leads (15 dias)</div>
                <div class="metric-value">${totalLeads15Dias}</div>
              </div>
              <div class="metric-card" style="flex: 1;">
                <div class="metric-label">Média Diária</div>
                <div class="metric-value">${avgLeads15Dias}</div>
              </div>
            </div>
            <div class="chart-container">
              <div class="chart-grid">
                ${reportData.leadsUltimos15Dias.map(d => `
                  <div class="chart-column">
                    <div class="chart-bar" style="height: ${(d.count / maxCount) * 100}%">
                      <span class="chart-value">${d.count}</span>
                    </div>
                    <div class="chart-label">${d.date}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>`;
      }

      // Leads por região
      if (selectedSections.includes('leads_por_regiao')) {
        const regioes = Object.entries(reportData.leadsPorRegiao).sort((a, b) => b[1] - a[1]);
        htmlContent += `
          <div class="section">
            <div class="section-title">Leads por Região</div>
            <table>
              <thead><tr><th>Região</th><th>Quantidade</th></tr></thead>
              <tbody>
                ${regioes.map(([regiao, count]) => `
                  <tr><td>${regiao}</td><td>${count}</td></tr>
                `).join('')}
              </tbody>
            </table>
          </div>`;
      }

      // Vendas por origem
      if (selectedSections.includes('vendas_por_origem')) {
        const origens = Object.entries(reportData.vendasPorOrigem).sort((a, b) => b[1].valor - a[1].valor);
        htmlContent += `
          <div class="section">
            <div class="section-title">Vendas por Origem</div>
            <table>
              <thead><tr><th>Origem</th><th>Vendas</th><th>Valor Total</th></tr></thead>
              <tbody>
                ${origens.map(([origem, data]) => `
                  <tr><td>${origem}</td><td>${data.count}</td><td>${formatCurrency(data.valor)}</td></tr>
                `).join('')}
              </tbody>
            </table>
          </div>`;
      }

      // Lista de Leads (somente se 'lista_leads' estiver selecionado)
      if (selectedSections.includes('lista_leads') && includesLeadData) {
        const leadsToShow = filteredLeads.slice(0, 500); // Limitar para não travar
        htmlContent += `
          <div class="section">
            <div class="section-title">Lista de Leads (${leadsToShow.length} de ${filteredLeads.length})</div>
            <table>
              <thead><tr>
                ${selectedSections.includes('lead_nome') ? '<th>Nome</th>' : ''}
                ${selectedSections.includes('lead_telefone') ? '<th>Telefone</th>' : ''}
                ${selectedSections.includes('lead_email') ? '<th>E-mail</th>' : ''}
                ${selectedSections.includes('lead_origem') ? '<th>Origem</th>' : ''}
                ${selectedSections.includes('lead_regiao') ? '<th>Região</th>' : ''}
              </tr></thead>
              <tbody>
                ${leadsToShow.map(lead => `
                  <tr>
                    ${selectedSections.includes('lead_nome') ? `<td>${lead.name || '-'}</td>` : ''}
                    ${selectedSections.includes('lead_telefone') ? `<td>${lead.phone || '-'}</td>` : ''}
                    ${selectedSections.includes('lead_email') ? `<td>${lead.email || '-'}</td>` : ''}
                    ${selectedSections.includes('lead_origem') ? `<td>${lead.origin || '-'}</td>` : ''}
                    ${selectedSections.includes('lead_regiao') ? `<td>${lead.regiao || '-'}</td>` : ''}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>`;
      }

      // Seção de Conversas
      if (selectedSections.includes('exportar_conversas')) {
        const conversasLimit = conversasQuantidade === 'todas' ? filteredLeads.length : (parseInt(conversasQuantidade) || 10);
        const leadsParaConversa = filteredLeads.filter(l => l.phone).slice(0, conversasLimit);

        if (leadsParaConversa.length > 0) {
          htmlContent += `<div class="section"><div class="section-title">Histórico de Conversas (${leadsParaConversa.length} leads)</div>`;

          // Buscar conversas de cada lead - UM POR UM de forma organizada
          let conversaIndex = 1;
          for (const lead of leadsParaConversa) {
            const messages = await fetchLeadMessages(lead.phone);
            
            if (messages.length > 0) {
              const initials = (lead.name || 'L').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
              
              // Encontrar a primeira mensagem do lead (type = human)
              const primeiraMensagemLead = messages.find(m => m.type === 'human');
              const primeiraMensagemTexto = primeiraMensagemLead?.content || messages[0]?.content || '';
              const primeiraMensagemData = primeiraMensagemLead?.criado_em || messages[0]?.criado_em || '';
              
              // Formatar data da primeira mensagem
              let dataPrimeiraMensagem = '';
              if (primeiraMensagemData) {
                try {
                  dataPrimeiraMensagem = format(new Date(primeiraMensagemData), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
                } catch (e) {
                  dataPrimeiraMensagem = '';
                }
              }

              htmlContent += `
                <div class="lead-conversation-block">
                  <div class="lead-conversation-header">
                    <div class="lead-number">${conversaIndex}</div>
                    <div class="lead-info-header">
                      <div class="lead-name-header">${lead.name || 'Lead sem nome'}</div>
                      <div class="lead-phone-header">${lead.phone}${lead.origin ? ` • ${lead.origin}` : ''}</div>
                      ${dataPrimeiraMensagem ? `<div class="lead-first-contact">Primeiro contato: ${dataPrimeiraMensagem}</div>` : ''}
                    </div>
                  </div>
                  
                  <div class="lead-first-message">
                    <div class="first-message-label">Primeira mensagem:</div>
                    <div class="first-message-content">"${primeiraMensagemTexto.substring(0, 200)}${primeiraMensagemTexto.length > 200 ? '...' : ''}"</div>
                  </div>

                  <div class="chat-container">
                    <div class="chat-header">
                      <div class="chat-header-avatar">${initials}</div>
                      <div class="chat-header-info">
                        <div class="chat-header-name">${lead.name || 'Lead'}</div>
                        <div class="chat-header-phone">${lead.phone}</div>
                      </div>
                      <div class="chat-header-count">${messages.length} mensagens</div>
                    </div>
                    <div class="chat-messages">`;

              let lastDate = '';
              for (const msg of messages) {
                // Separador de data
                if (msg.criado_em) {
                  try {
                    const msgDate = format(new Date(msg.criado_em), 'dd/MM/yyyy', { locale: ptBR });
                    if (msgDate !== lastDate) {
                      lastDate = msgDate;
                      htmlContent += `<div class="chat-date-separator"><span>${msgDate}</span></div>`;
                    }
                  } catch (e) {
                    // Ignora erro de formatação
                  }
                }

                const isLead = msg.type === 'human';
                let timeStr = '';
                if (msg.criado_em) {
                  try {
                    timeStr = format(new Date(msg.criado_em), 'HH:mm', { locale: ptBR });
                  } catch (e) {
                    timeStr = '';
                  }
                }

                htmlContent += `
                  <div class="chat-message ${isLead ? 'lead' : 'atendente'}">
                    ${msg.content || '[Mídia]'}
                    ${timeStr ? `<div class="chat-message-time">${timeStr}</div>` : ''}
                  </div>`;
              }

              htmlContent += `
                    </div>
                  </div>
                </div>
                <div class="conversation-separator"></div>`;
              
              conversaIndex++;
            }
          }

          htmlContent += `</div>`;
        }
      }

      // Seção de Controle de Gastos - Iterar por cada sub-fonte selecionada
      if (includeGastos && selectedSubFonteIds.length > 0 && selectedColunaIds.length > 0) {
        // Calcular dias do período
        const days = eachDayOfInterval({ start: dateFrom, end: dateTo });
        const dateStrings = days.map(d => format(d, 'yyyy-MM-dd'));

        // Agrupar sub-fontes por fonte
        const subFontesByFonte = new Map<string, typeof subFontes>();
        selectedSubFonteIds.forEach(sfId => {
          const sf = subFontes.find(s => s.id === sfId);
          if (sf) {
            const existing = subFontesByFonte.get(sf.fonte_id) || [];
            subFontesByFonte.set(sf.fonte_id, [...existing, sf]);
          }
        });

        // Iterar por cada fonte e suas sub-fontes
        for (const [fonteId, sfList] of subFontesByFonte) {
          const currentFonte = fontes.find(f => f.id === fonteId);

          for (const currentSubFonte of sfList) {
            const subFonteColunasLocal = colunas
              .filter(c => c.sub_fonte_id === currentSubFonte.id)
              .sort((a, b) => a.ordem - b.ordem);
            const colunasToExport = subFonteColunasLocal.filter(c => selectedColunaIds.includes(c.id));
            
            if (colunasToExport.length === 0) continue;

            // Função para obter valor de uma célula
            const getCellDisplayValue = (coluna: MktConfigColuna, date: string): string => {
              if (coluna.is_system_data && coluna.system_data_type) {
                const value = getSystemDataValue(coluna, date);
                if (value !== null) {
                  return formatValue(value, coluna.tipo);
                }
                return '-';
              }
              
              if (coluna.formula) {
                const value = calculateColumnValue(coluna, {
                  colunas: subFonteColunasLocal,
                  lancamentos,
                  data: date,
                  getSystemValue: getSystemDataValue,
                });
                return formatValue(value, coluna.tipo);
              }
              
              const lancamento = lancamentos.find(l => l.coluna_id === coluna.id && l.data === date);
              return formatValue(lancamento?.valor_numerico ?? null, coluna.tipo);
            };
            
            // Função para calcular total mensal
            const getMonthlyTotalForColuna = (coluna: MktConfigColuna): string => {
              if (coluna.is_system_data && coluna.system_data_type) {
                const value = getMonthlyTotalValue(coluna, dateFrom);
                if (value !== null) {
                  return formatValue(value, coluna.tipo);
                }
                return '-';
              }
              
              if (coluna.formula) {
                const matches = coluna.formula.match(/\[([^\]]+)\]/g);
                if (!matches) return '-';
                
                let expression = coluna.formula;
                for (const match of matches) {
                  const varName = match.slice(1, -1);
                  const referencedColuna = subFonteColunasLocal.find(
                    c => c.nome.toLowerCase() === varName.toLowerCase()
                  );
                  if (!referencedColuna) return '-';
                  
                  let refValue: number | null = null;
                  if (referencedColuna.is_system_data) {
                    refValue = getMonthlyTotalValue(referencedColuna, dateFrom);
                  } else {
                    refValue = lancamentos
                      .filter(l => l.coluna_id === referencedColuna.id)
                      .reduce((sum, l) => sum + (l.valor_numerico || 0), 0);
                  }
                  
                  if (refValue === null || (refValue === 0 && coluna.formula.includes('/'))) {
                    return '-';
                  }
                  expression = expression.replace(match, refValue.toString());
                }
                
                try {
                  const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, '');
                  // eslint-disable-next-line no-new-func
                  const result = new Function(`return ${sanitized}`)();
                  if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
                    return '-';
                  }
                  return formatValue(result, coluna.tipo);
                } catch {
                  return '-';
                }
              }
              
              const total = lancamentos
                .filter(l => l.coluna_id === coluna.id)
                .reduce((sum, l) => sum + (l.valor_numerico || 0), 0);
              return formatValue(total, coluna.tipo);
            };
            
            // Filtrar dias conforme modo de exibição
            let daysToShow = dateStrings;
            if (gastosDisplayMode === 'with_data') {
              daysToShow = dateStrings.filter(date => {
                return colunasToExport.some(col => {
                  const val = getCellDisplayValue(col, date);
                  return val !== '-' && val !== '0' && val !== 'R$ 0,00' && val !== '0,00%';
                });
              });
            } else if (gastosDisplayMode === 'total_only') {
              daysToShow = [];
            }
            
            htmlContent += `
              <div class="section">
                <div class="section-title" style="display: flex; align-items: center; gap: 8px;">
                  <span style="display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: ${currentFonte?.cor || '#3b82f6'}20; border-radius: 6px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${currentFonte?.cor || '#3b82f6'}" stroke-width="2"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M22 10H2"/><path d="M7 15h4"/></svg>
                  </span>
                  Controle de Gastos - ${currentSubFonte.nome}
                  <span style="font-size: 11px; color: #666; font-weight: normal; margin-left: auto;">
                    (${currentFonte?.nome || 'Fonte'})
                  </span>
                </div>
                
                <table style="margin-top: 10px;">
                  <thead>
                    <tr>
                      <th style="min-width: 100px;">Data</th>
                      ${colunasToExport.map(col => `<th style="min-width: 80px; text-align: right;">${col.nome}</th>`).join('')}
                    </tr>
                  </thead>
                  <tbody>
                    ${gastosDisplayMode !== 'total_only' ? `
                      <tr style="background: linear-gradient(90deg, #f59e0b20, #f59e0b10); font-weight: 600;">
                        <td style="font-weight: 700;">Total do Período</td>
                        ${colunasToExport.map(col => `<td style="text-align: right; font-weight: 600;">${getMonthlyTotalForColuna(col)}</td>`).join('')}
                      </tr>
                    ` : ''}
                    ${daysToShow.map(date => {
                      const dateLabel = format(new Date(date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });
                      return `
                        <tr>
                          <td>${dateLabel}</td>
                          ${colunasToExport.map(col => `<td style="text-align: right;">${getCellDisplayValue(col, date)}</td>`).join('')}
                        </tr>
                      `;
                    }).join('')}
                    ${gastosDisplayMode === 'total_only' ? `
                      <tr style="background: linear-gradient(90deg, #f59e0b20, #f59e0b10); font-weight: 600;">
                        <td style="font-weight: 700;">Total do Período</td>
                        ${colunasToExport.map(col => `<td style="text-align: right; font-weight: 600;">${getMonthlyTotalForColuna(col)}</td>`).join('')}
                      </tr>
                    ` : ''}
                  </tbody>
                </table>
                
                <p style="font-size: 10px; color: #888; margin-top: 8px;">
                  Período: ${format(dateFrom, 'dd/MM/yyyy', { locale: ptBR })} - ${format(dateTo, 'dd/MM/yyyy', { locale: ptBR })}
                  ${gastosDisplayMode === 'with_data' ? ' • Exibindo apenas dias com dados' : ''}
                  ${gastosDisplayMode === 'total_only' ? ' • Exibindo apenas totais' : ''}
                </p>
              </div>
            `;
          }
        }
      }

      htmlContent += `
  <div class="footer">
    Pro-Forço • Relatório gerado automaticamente pelo sistema CRM
  </div>
</body>
</html>`;

      // Abrir em nova janela para impressão/salvar
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        
        // Aguardar imagem carregar antes de imprimir
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const leadSections = REPORT_SECTIONS.filter(s => s.category === 'leads');
  const metricsSections = REPORT_SECTIONS.filter(s => s.category === 'metricas');
  const conversasSections = REPORT_SECTIONS.filter(s => s.category === 'conversas');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Exportar Relatório
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[55vh] pr-4">
          <div className="space-y-6">
            {/* Filtro de Período */}
            <div className="p-3 bg-muted/50 rounded-lg border border-border">
              <Label className="text-sm font-semibold flex items-center gap-2 mb-3">
                <CalendarIcon className="h-4 w-4" />
                Período do Relatório
              </Label>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">De:</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "w-[130px] justify-start text-left font-normal h-8",
                          !dateFrom && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {format(dateFrom, "dd/MM/yyyy", { locale: ptBR })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateFrom}
                        onSelect={(date) => date && setDateFrom(date)}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Até:</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "w-[130px] justify-start text-left font-normal h-8",
                          !dateTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {format(dateTo, "dd/MM/yyyy", { locale: ptBR })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateTo}
                        onSelect={(date) => date && setDateTo(date)}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {filteredAllLeads.length} leads no período selecionado
              </p>
            </div>

            {/* Selecionar todos */}
            <div className="flex items-center space-x-2 pb-2 border-b border-border">
              <Checkbox
                id="select-all"
                checked={selectedSections.length === REPORT_SECTIONS.length}
                onCheckedChange={(checked) => toggleAll(!!checked)}
              />
              <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                Selecionar Todos
              </label>
            </div>

            {/* Categoria: Dados dos Leads */}
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <Checkbox
                  id="cat-leads"
                  checked={isCategorySelected('leads')}
                  onCheckedChange={(checked) => toggleCategory('leads', !!checked)}
                />
                <label htmlFor="cat-leads" className="text-sm font-semibold cursor-pointer">
                  Lista de Leads
                </label>
              </div>
              <div className="ml-6 space-y-2">
                {/* Primeiro o checkbox principal para incluir a lista */}
                <div className="flex items-center space-x-2 pb-2 border-b border-border/50">
                  <Checkbox
                    id="lista_leads"
                    checked={selectedSections.includes('lista_leads')}
                    onCheckedChange={() => toggleSection('lista_leads')}
                  />
                  <label htmlFor="lista_leads" className="text-sm font-medium cursor-pointer">
                    Incluir Lista de Leads no Relatório
                  </label>
                </div>
                {/* Campos da lista (só habilitados se lista_leads estiver marcado) */}
                <p className="text-xs text-muted-foreground">Campos a exibir:</p>
                {leadSections.filter(s => s.id !== 'lista_leads').map(section => (
                  <div key={section.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={section.id}
                      checked={selectedSections.includes(section.id)}
                      onCheckedChange={() => toggleSection(section.id)}
                      disabled={!selectedSections.includes('lista_leads')}
                    />
                    <label 
                      htmlFor={section.id} 
                      className={`text-sm cursor-pointer ${!selectedSections.includes('lista_leads') ? 'text-muted-foreground' : ''}`}
                    >
                      {section.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Categoria: Métricas */}
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <Checkbox
                  id="cat-metricas"
                  checked={isCategorySelected('metricas')}
                  onCheckedChange={(checked) => toggleCategory('metricas', !!checked)}
                />
                <label htmlFor="cat-metricas" className="text-sm font-semibold cursor-pointer">
                  Métricas e Indicadores
                </label>
              </div>
              <div className="ml-6 space-y-2">
                {metricsSections.map(section => (
                  <div key={section.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={section.id}
                      checked={selectedSections.includes(section.id)}
                      onCheckedChange={() => toggleSection(section.id)}
                    />
                    <label htmlFor={section.id} className="text-sm cursor-pointer">
                      {section.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Categoria: Conversas */}
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <Checkbox
                  id="cat-conversas"
                  checked={isCategorySelected('conversas')}
                  onCheckedChange={(checked) => toggleCategory('conversas', !!checked)}
                />
                <label htmlFor="cat-conversas" className="text-sm font-semibold cursor-pointer flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Exportar Conversas
                </label>
              </div>
              <div className="ml-6 space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="exportar_conversas"
                    checked={selectedSections.includes('exportar_conversas')}
                    onCheckedChange={() => toggleSection('exportar_conversas')}
                  />
                  <label htmlFor="exportar_conversas" className="text-sm cursor-pointer">
                    Incluir histórico de conversas no relatório
                  </label>
                </div>
                
                {selectedSections.includes('exportar_conversas') && (
                  <div className="flex flex-col gap-2 pl-6 py-2 bg-muted/50 rounded-md">
                    <Label className="text-sm">Quantidade de conversas:</Label>
                    <div className="flex flex-wrap gap-2">
                      {['10', '20', '30', '40', '50', 'todas'].map((val) => (
                        <Button
                          key={val}
                          type="button"
                          size="sm"
                          variant={conversasQuantidade === val ? 'default' : 'outline'}
                          className="h-7 px-3 text-xs"
                          onClick={() => setConversasQuantidade(val)}
                        >
                          {val === 'todas' ? 'Todas' : val}
                        </Button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Label htmlFor="qtd-custom" className="text-xs text-muted-foreground whitespace-nowrap">
                        Ou digite:
                      </Label>
                      <Input
                        id="qtd-custom"
                        type="number"
                        min="1"
                        max="500"
                        placeholder="Ex: 25"
                        value={!['10', '20', '30', '40', '50', 'todas'].includes(conversasQuantidade) ? conversasQuantidade : ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || (parseInt(val) > 0 && parseInt(val) <= 500)) {
                            setConversasQuantidade(val || '10');
                          }
                        }}
                        className="h-7 w-20 text-xs"
                      />
                    </div>
                  </div>
                )}
                
                <p className="text-xs text-muted-foreground">
                  As conversas serão exportadas em formato de chat, ordenadas cronologicamente.
                </p>
              </div>
            </div>

            {/* Categoria: Controle de Gastos */}
            <div className="border-t pt-4">
              <div className="flex items-center space-x-2 mb-3">
                <Checkbox
                  id="include-gastos"
                  checked={includeGastos}
                  onCheckedChange={(checked) => setIncludeGastos(!!checked)}
                />
                <label htmlFor="include-gastos" className="text-sm font-semibold cursor-pointer flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Controle de Gastos (Planilha)
                </label>
              </div>
              
              {includeGastos && (
                <div className="ml-6 space-y-4">
                  {/* Seletor de Fontes (Múltipla seleção) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Fontes:</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => toggleAllFontes(selectedFonteIds.length !== fontes.length)}
                      >
                        {selectedFonteIds.length === fontes.length ? 'Desmarcar todas' : 'Marcar todas'}
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 p-2 bg-muted/50 rounded-md max-h-28 overflow-y-auto">
                      {fontes.map(fonte => (
                        <div key={fonte.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`fonte-${fonte.id}`}
                            checked={selectedFonteIds.includes(fonte.id)}
                            onCheckedChange={() => toggleFonte(fonte.id)}
                          />
                          <label 
                            htmlFor={`fonte-${fonte.id}`} 
                            className="text-xs cursor-pointer flex items-center gap-1.5"
                          >
                            <div 
                              className="w-2.5 h-2.5 rounded-full" 
                              style={{ backgroundColor: fonte.cor }}
                            />
                            {fonte.nome}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Seletor de Sub-fontes (Múltipla seleção) */}
                  {selectedFonteIds.length > 0 && filteredSubFontes.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Sub-fontes:</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => toggleAllSubFontes(selectedSubFonteIds.length !== filteredSubFontes.length)}
                        >
                          {selectedSubFonteIds.length === filteredSubFontes.length ? 'Desmarcar todas' : 'Marcar todas'}
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 p-2 bg-muted/50 rounded-md max-h-28 overflow-y-auto">
                        {filteredSubFontes.map(sf => {
                          const parentFonte = fontes.find(f => f.id === sf.fonte_id);
                          return (
                            <div key={sf.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`subfonte-${sf.id}`}
                                checked={selectedSubFonteIds.includes(sf.id)}
                                onCheckedChange={() => toggleSubFonte(sf.id)}
                              />
                              <label 
                                htmlFor={`subfonte-${sf.id}`} 
                                className="text-xs cursor-pointer truncate flex items-center gap-1"
                                title={`${parentFonte?.nome}: ${sf.nome}`}
                              >
                                <div 
                                  className="w-1.5 h-1.5 rounded-full flex-shrink-0" 
                                  style={{ backgroundColor: parentFonte?.cor || '#888' }}
                                />
                                {sf.nome}
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Seletor de Colunas */}
                  {selectedSubFonteIds.length > 0 && subFonteColunas.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Colunas a incluir:</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => {
                            if (selectedColunaIds.length === subFonteColunas.length) {
                              setSelectedColunaIds([]);
                            } else {
                              setSelectedColunaIds(subFonteColunas.map(c => c.id));
                            }
                          }}
                        >
                          {selectedColunaIds.length === subFonteColunas.length ? 'Desmarcar todas' : 'Marcar todas'}
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 p-2 bg-muted/50 rounded-md max-h-32 overflow-y-auto">
                        {subFonteColunas.map(coluna => (
                          <div key={coluna.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`col-${coluna.id}`}
                              checked={selectedColunaIds.includes(coluna.id)}
                              onCheckedChange={() => toggleColuna(coluna.id)}
                            />
                            <label 
                              htmlFor={`col-${coluna.id}`} 
                              className="text-xs cursor-pointer truncate"
                              title={coluna.nome}
                            >
                              {coluna.nome}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Modo de exibição */}
                  {selectedSubFonteIds.length > 0 && selectedColunaIds.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm">Exibição:</Label>
                      <RadioGroup 
                        value={gastosDisplayMode} 
                        onValueChange={(v) => setGastosDisplayMode(v as 'all' | 'with_data' | 'total_only')}
                        className="flex flex-col gap-1"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="all" id="display-all" />
                          <label htmlFor="display-all" className="text-xs cursor-pointer">
                            Todos os dias do período
                          </label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="with_data" id="display-with-data" />
                          <label htmlFor="display-with-data" className="text-xs cursor-pointer">
                            Apenas dias com dados
                          </label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="total_only" id="display-total" />
                          <label htmlFor="display-total" className="text-xs cursor-pointer">
                            Somente total do período
                          </label>
                        </div>
                      </RadioGroup>
                    </div>
                  )}

                  {/* Info de carregamento */}
                  {includeGastos && selectedSubFonteIds.length > 0 && !gastosDataLoaded && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Carregando dados da planilha...
                    </div>
                  )}
                  
                  <p className="text-xs text-muted-foreground">
                    {selectedFonteIds.length > 0 
                      ? `${selectedFonteIds.length} fonte(s) e ${selectedSubFonteIds.length} sub-fonte(s) selecionadas.`
                      : 'Selecione as fontes e sub-fontes para incluir no relatório.'
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <p className="text-xs text-muted-foreground flex-1">
            {selectedSections.length} de {REPORT_SECTIONS.length} itens selecionados
            {includeGastos && selectedColunaIds.length > 0 && (
              <span className="ml-1">+ Planilha de Gastos ({selectedColunaIds.length} colunas)</span>
            )}
          </p>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            onClick={generateReport}
            disabled={(selectedSections.length === 0 && !includeGastos) || isGenerating}
            className="gap-2"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Gerar Relatório
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
