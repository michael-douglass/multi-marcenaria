import { useCallback, useMemo, useState } from 'react';
import { Lead } from '@/types/selletos';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import {
  ChevronDown,
  ChevronUp,
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Target,
  Users,
  Search,
  Settings2,
  Calculator,
  Pencil,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toSaoPauloTime } from '@/lib/utils';
import { EditableCardTitle } from './EditableCardTitle';
import { VendasGanhosConfigDialog } from './VendasGanhosConfigDialog';
import { VendasGanhosMetricasConfigDialog } from './VendasGanhosMetricasConfigDialog';
import { useVendasGanhosConfig } from '@/hooks/useVendasGanhosConfig';
import { useVendasGanhosMetricas } from '@/hooks/useVendasGanhosMetricas';
import { usePermissions } from '@/hooks/usePermissions';
import { useKanbanConfig } from '@/hooks/useKanbanConfig';
import { useLeads } from '@/hooks/useLeads';
import { useLeadPontuaGarboSaleInfo } from '@/hooks/useLeadPontuaGarboSaleInfo';
import {
  filterNegociosGanhos,
  getReferenciaVendaDate,
} from '@/lib/vendas-ganhos';
import {
  buildMetricaSomaVariableKey,
  evaluateVendasGanhosFormula,
  formatVendasGanhosMetricValue,
  parseMetricaSomaVariable,
} from '@/lib/vendas-ganhos-formula';
import { computeKanbanColumnSums } from '@/lib/orcamento-kanban-sums';
import { cn } from '@/lib/utils';
import { SaleValueDialog } from '@/components/leads/SaleValueDialog';

interface SalesStatsCardProps {
  allLeads: Lead[];
  isLoading: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function SalesStatsCard({
  allLeads,
  isLoading,
  open,
  onOpenChange,
}: SalesStatsCardProps) {
  const { userRole } = usePermissions();
  const isAdmin = userRole === 'admin';
  const queryClient = useQueryClient();
  const { config, isLoading: isLoadingConfig } = useVendasGanhosConfig();
  const { cardMetricas, colunaMetricas, metricas } = useVendasGanhosMetricas();
  const { pages: kanbanPages } = useKanbanConfig();
  const { updateLead } = useLeads({ fetchLeads: false });

  const [internalOpen, setInternalOpen] = useState(false);
  const isVisible = open ?? internalOpen;
  const setIsVisible = onOpenChange ?? setInternalOpen;
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showFormulas, setShowFormulas] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingSaleLeadId, setEditingSaleLeadId] = useState<number | null>(null);
  const { data: pontuaGarboSale } = useLeadPontuaGarboSaleInfo(editingSaleLeadId);

  const stats = useMemo(() => {
    const now = toSaoPauloTime(new Date());
    const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');
    const monthLabel = format(now, 'MMMM yyyy', { locale: ptBR });

    const leadsDoMes = allLeads.filter(
      (lead) => lead.dateArrived >= monthStart && lead.dateArrived <= monthEnd,
    );

    const vendasDoMes = filterNegociosGanhos(allLeads, config, {
      periodStart: monthStart,
      periodEnd: monthEnd,
    });

    const totalLeadsMes = leadsDoMes.length;
    const totalVendas = vendasDoMes.length;
    const valorTotal = vendasDoMes.reduce((sum, lead) => sum + (lead.dealValue || 0), 0);
    const ticketMedio = totalVendas > 0 ? valorTotal / totalVendas : 0;
    const taxaConversaoLeads =
      totalLeadsMes > 0 ? (totalVendas / totalLeadsMes) * 100 : 0;

    return {
      monthLabel,
      monthStart,
      monthEnd,
      totalVendas,
      valorTotal,
      ticketMedio,
      totalLeadsMes,
      taxaConversaoLeads,
      vendasDoMes,
    };
  }, [allLeads, config]);

  const baseAggregateValues = useMemo(
    () => ({
      faturamento_total: stats.valorTotal,
      total_vendas: stats.totalVendas,
      ticket_medio: stats.ticketMedio,
      total_leads_mes: stats.totalLeadsMes,
      taxa_conversao_leads: stats.taxaConversaoLeads,
    }),
    [stats],
  );

  const kanbanSomaValues = useMemo(
    () => computeKanbanColumnSums(kanbanPages, stats.vendasDoMes),
    [kanbanPages, stats.vendasDoMes],
  );

  const metricaSomaValues = useMemo(() => {
    const sums: Record<string, number> = {};
    const leads = stats.vendasDoMes;
    const referencedIds = new Set<string>();
    for (const m of metricas) {
      const matches = m.formula.match(/\[([^\]]+)\]/g);
      if (!matches) continue;
      for (const match of matches) {
        const parsed = parseMetricaSomaVariable(match.slice(1, -1).trim());
        if (parsed) referencedIds.add(parsed.metricaId);
      }
    }
    for (const metricaId of referencedIds) {
      const source = colunaMetricas.find((m) => m.id === metricaId);
      if (!source) continue;
      let sum = 0;
      let hasAny = false;
      for (const lead of leads) {
        const v = evaluateVendasGanhosFormula(source.formula, {
          valor_negocio: lead.dealValue || 0,
          valor_orcamento: lead.budgetValue || 0,
          ...baseAggregateValues,
          ...kanbanSomaValues,
        });
        if (v !== null) {
          sum += v;
          hasAny = true;
        }
      }
      if (hasAny) sums[buildMetricaSomaVariableKey(metricaId)] = sum;
    }
    return sums;
  }, [metricas, colunaMetricas, stats.vendasDoMes, baseAggregateValues, kanbanSomaValues]);

  const getLeadFormulaValues = useCallback(
    (lead: Lead) => ({
      valor_negocio: lead.dealValue || 0,
      valor_orcamento: lead.budgetValue || 0,
      ...baseAggregateValues,
      ...kanbanSomaValues,
      ...metricaSomaValues,
    }),
    [baseAggregateValues, kanbanSomaValues, metricaSomaValues],
  );

  const aggregateValues = useMemo(
    () => ({
      ...baseAggregateValues,
      ...kanbanSomaValues,
      ...metricaSomaValues,
    }),
    [baseAggregateValues, kanbanSomaValues, metricaSomaValues],
  );

  const cardValues = useMemo(
    () =>
      cardMetricas.map((metrica) => ({
        metrica,
        value: evaluateVendasGanhosFormula(metrica.formula, aggregateValues),
      })),
    [cardMetricas, aggregateValues],
  );

  const filteredVendas = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return stats.vendasDoMes.filter((lead) => {
      if (!term) return true;
      return (
        lead.name?.toLowerCase().includes(term) ||
        lead.phone?.toLowerCase().includes(term) ||
        lead.regiao?.toLowerCase().includes(term) ||
        lead.origin?.toLowerCase().includes(term)
      );
    });
  }, [stats.vendasDoMes, searchTerm]);

  const colunaFooterSums = useMemo(() => {
    return colunaMetricas.map((metrica) => {
      let sum = 0;
      let hasAny = false;
      for (const lead of filteredVendas) {
        const v = evaluateVendasGanhosFormula(metrica.formula, getLeadFormulaValues(lead));
        if (v !== null) {
          sum += v;
          hasAny = true;
        }
      }
      return { metrica, sum: hasAny ? sum : null };
    });
  }, [colunaMetricas, filteredVendas, getLeadFormulaValues]);

  const getConversionColor = (rate: number) => {
    if (rate >= 20) return 'text-success';
    if (rate >= 10) return 'text-amber-500';
    return 'text-destructive';
  };

  const getConversionIcon = (rate: number) => {
    if (rate >= 20) return <TrendingUp className="h-4 w-4 text-success" />;
    if (rate >= 10) return <Minus className="h-4 w-4 text-amber-500" />;
    return <TrendingDown className="h-4 w-4 text-destructive" />;
  };

  const openLista = () => setShowSalesModal(true);
  const leadEmEdicao =
    editingSaleLeadId == null
      ? null
      : stats.vendasDoMes.find((lead) => lead.id === editingSaleLeadId) ?? null;

  const handleEditSaleValue = (leadId: number) => {
    setEditingSaleLeadId(leadId);
  };

  const handleConfirmEditedSale = async (value: number) => {
    if (!editingSaleLeadId) return;

    try {
      await updateLead.mutateAsync({
        id: editingSaleLeadId,
        updates: { valor_negocio: value },
      });
      void queryClient.invalidateQueries({ queryKey: ['minha-pontua-garbo'] });
      void queryClient.invalidateQueries({ queryKey: ['pontua-garbo-financeiro'] });
      void queryClient.invalidateQueries({ queryKey: ['pontua-garbo-comissao-liberacao'] });
      toast.success('Valor da venda atualizado com sucesso!');
      setEditingSaleLeadId(null);
    } catch {
      toast.error('Erro ao atualizar o valor da venda');
    }
  };

  if (isLoading || isLoadingConfig) {
    return (
      <Card className="flex items-center justify-center p-6">
        <div className="text-muted-foreground text-sm">Carregando...</div>
      </Card>
    );
  }

  return (
    <Collapsible open={isVisible} onOpenChange={setIsVisible}>
      <Card className="border-border">
        <CardHeader
          className={cn('pb-2', !isVisible && 'cursor-pointer hover:bg-muted/30 transition-colors')}
          onClick={() => {
            if (!isVisible) openLista();
          }}
          role={!isVisible ? 'button' : undefined}
          tabIndex={!isVisible ? 0 : undefined}
          onKeyDown={(e) => {
            if (!isVisible && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              openLista();
            }
          }}
        >
          <div className="flex items-center gap-3 flex-wrap">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 p-0">
              <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
              <EditableCardTitle labelKey="sales_stats" variant="section" className="normal-case tracking-normal" />
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setIsVisible(!isVisible);
              }}
              className="gap-1.5 h-7"
            >
              {isVisible ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  <span className="text-xs">Ocultar</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  <span className="text-xs">Mostrar</span>
                </>
              )}
            </Button>
            {isAdmin && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 h-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowConfig(true);
                  }}
                  title="Fontes de dados e coluna ao ganhar venda"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  <span className="text-xs hidden sm:inline">Configurar</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 h-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFormulas(true);
                  }}
                  title="Cards com fórmula"
                >
                  <Calculator className="h-3.5 w-3.5" />
                  <span className="text-xs hidden sm:inline">Fórmulas</span>
                </Button>
              </>
            )}
          </div>
          <CardDescription className="text-xs">
            {stats.monthLabel} • {stats.totalVendas} vendas • {formatCurrency(stats.valorTotal)}
            {!isVisible && stats.totalVendas > 0 && (
              <span className="text-muted-foreground/80"> — clique para ver a lista</span>
            )}
          </CardDescription>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <div
              className={cn(
                'grid gap-4',
                'grid-cols-2 md:grid-cols-4',
                cardMetricas.length > 0 && 'lg:grid-cols-5',
              )}
            >
              <div
                className="p-3 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={openLista}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  <span className="text-xs font-medium text-muted-foreground">Vendas</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{stats.totalVendas}</p>
                <p className="text-xs text-muted-foreground">negócios ganhos</p>
              </div>

              <div
                className="p-3 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={openLista}
              >
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-success" />
                  <span className="text-xs font-medium text-muted-foreground">Faturamento</span>
                </div>
                <p className="text-2xl font-bold text-success">{formatCurrency(stats.valorTotal)}</p>
                <p className="text-xs text-muted-foreground">
                  Ticket médio: {formatCurrency(stats.ticketMedio)}
                </p>
              </div>

              <div className="p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">Conversão Leads</span>
                </div>
                <div className="flex items-center gap-2">
                  <p className={`text-2xl font-bold ${getConversionColor(stats.taxaConversaoLeads)}`}>
                    {stats.taxaConversaoLeads.toFixed(1)}%
                  </p>
                  {getConversionIcon(stats.taxaConversaoLeads)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats.totalVendas} de {stats.totalLeadsMes} leads do mês
                </p>
              </div>

              <div className="p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">Leads no mês</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{stats.totalLeadsMes}</p>
                <p className="text-xs text-muted-foreground">entraram no período</p>
              </div>

              {cardValues.map(({ metrica, value }) => (
                <div
                  key={metrica.id}
                  className="p-3 bg-amber-500/5 border border-amber-500/15 rounded-lg"
                  title={metrica.formula}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Calculator className="h-4 w-4 text-amber-600" />
                    <span className="text-xs font-medium text-muted-foreground truncate">
                      {metrica.nome}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-500">
                    {formatVendasGanhosMetricValue(value, metrica.formato)}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">
                    {metrica.formula}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-border">
              <Button variant="outline" size="sm" onClick={openLista}>
                Ver lista de vendas ({stats.totalVendas})
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>

      <Dialog
        open={showSalesModal}
        onOpenChange={(open) => {
          setShowSalesModal(open);
          if (!open) setSearchTerm('');
        }}
      >
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Negócios Ganhos — {stats.monthLabel}
            </DialogTitle>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone, origem ou região..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {colunaMetricas.length > 0 ? (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left p-2 font-medium">Cliente</th>
                    <th className="text-right p-2 font-medium">Valor</th>
                    {colunaMetricas.map((m) => (
                      <th key={m.id} className="text-right p-2 font-medium whitespace-nowrap">
                        {m.nome}
                      </th>
                    ))}
                    <th className="text-left p-2 font-medium hidden md:table-cell">Origem</th>
                    <th className="text-left p-2 font-medium hidden md:table-cell">Data venda</th>
                    <th className="text-right p-2 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVendas.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5 + colunaMetricas.length}
                        className="p-8 text-center text-muted-foreground"
                      >
                        {searchTerm
                          ? 'Nenhum resultado encontrado'
                          : 'Nenhuma venda ganha neste mês — confira a configuração de fontes'}
                      </td>
                    </tr>
                  ) : (
                    filteredVendas.map((lead) => (
                      <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="p-2">
                          <p className="font-medium">{lead.name}</p>
                          <p className="text-xs text-muted-foreground">{lead.phone || '—'}</p>
                        </td>
                        <td className="p-2 text-right font-medium text-success">
                          {formatCurrency(lead.dealValue || 0)}
                        </td>
                        {colunaMetricas.map((m) => {
                          const v = evaluateVendasGanhosFormula(
                            m.formula,
                            getLeadFormulaValues(lead),
                          );
                          return (
                            <td key={m.id} className="p-2 text-right text-muted-foreground">
                              {formatVendasGanhosMetricValue(v, m.formato)}
                            </td>
                          );
                        })}
                        <td className="p-2 text-xs hidden md:table-cell">{lead.origin || '—'}</td>
                        <td className="p-2 text-xs hidden md:table-cell">
                          {getReferenciaVendaDate(lead) || '—'}
                        </td>
                        <td className="p-2 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5"
                            onClick={() => handleEditSaleValue(lead.id)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Editar valor</span>
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {colunaFooterSums.length > 0 && filteredVendas.length > 0 && (
                  <tfoot>
                    <tr className="border-t bg-muted/30 font-medium">
                      <td className="p-2">Total</td>
                      <td className="p-2 text-right text-success">
                        {formatCurrency(stats.valorTotal)}
                      </td>
                      {colunaFooterSums.map(({ metrica, sum }) => (
                        <td key={metrica.id} className="p-2 text-right">
                          {formatVendasGanhosMetricValue(sum, metrica.formato)}
                        </td>
                      ))}
                      <td className="hidden md:table-cell" />
                      <td className="hidden md:table-cell" />
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          ) : (
            <ScrollArea className="h-[55vh] pr-4">
              <div className="space-y-2">
                {filteredVendas.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {searchTerm
                      ? 'Nenhum resultado encontrado'
                      : 'Nenhuma venda ganha neste mês'}
                  </p>
                ) : (
                  filteredVendas.map((lead) => (
                    <div
                      key={lead.id}
                      className="p-3 bg-muted/30 rounded-lg border border-border"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-foreground">{lead.name}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-success font-bold">
                            {formatCurrency(lead.dealValue || 0)}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => handleEditSaleValue(lead.id)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div>
                          <span className="font-medium">Origem:</span> {lead.origin || 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">Data:</span>{' '}
                          {getReferenciaVendaDate(lead) || 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">Status:</span> {lead.status}
                        </div>
                        <div>
                          <span className="font-medium">Região:</span> {lead.regiao || 'N/A'}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          )}

          <div className="pt-2 border-t border-border">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {stats.totalVendas} vendas • conversão {stats.taxaConversaoLeads.toFixed(1)}%
              </span>
              <span className="font-bold text-success">{formatCurrency(stats.valorTotal)}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {isAdmin && (
        <>
          <VendasGanhosConfigDialog open={showConfig} onOpenChange={setShowConfig} />
          <VendasGanhosMetricasConfigDialog open={showFormulas} onOpenChange={setShowFormulas} />
        </>
      )}

      <SaleValueDialog
        isOpen={editingSaleLeadId !== null}
        onClose={() => setEditingSaleLeadId(null)}
        onConfirm={handleConfirmEditedSale}
        leadName={leadEmEdicao?.name ?? ''}
        budgetValue={leadEmEdicao?.budgetValue ?? 0}
        pontuaGarbo={pontuaGarboSale ?? null}
      />
    </Collapsible>
  );
}
