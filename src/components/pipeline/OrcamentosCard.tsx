import { useCallback, useMemo, useState } from 'react';
import { Lead } from '@/types/selletos';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import {
  ChevronDown,
  ChevronUp,
  FileText,
  DollarSign,
  Users,
  Search,
  Settings2,
  Calculator,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { EditableCardTitle } from './EditableCardTitle';
import { OrcamentoMetricasConfigDialog } from './OrcamentoMetricasConfigDialog';
import { useOrcamentoMetricas } from '@/hooks/useOrcamentoMetricas';
import { usePermissions } from '@/hooks/usePermissions';
import {
  buildMetricaSomaVariableKey,
  evaluateOrcamentoFormula,
  formatOrcamentoMetricValue,
  parseMetricaSomaVariable,
} from '@/lib/orcamento-formula';
import { computeKanbanColumnSums } from '@/lib/orcamento-kanban-sums';
import { useKanbanConfig } from '@/hooks/useKanbanConfig';
import { isPortalVendaPerdida } from '@/lib/crm-portal';
import { cn } from '@/lib/utils';

interface OrcamentosCardProps {
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

export function OrcamentosCard({
  allLeads,
  isLoading,
  open,
  onOpenChange,
}: OrcamentosCardProps) {
  const { userRole } = usePermissions();
  const isAdmin = userRole === 'admin';
  const { cardMetricas, colunaMetricas, metricas } = useOrcamentoMetricas();
  const { pages: kanbanPages } = useKanbanConfig();

  const [internalOpen, setInternalOpen] = useState(false);
  const isVisible = open ?? internalOpen;
  const setIsVisible = onOpenChange ?? setInternalOpen;
  const [showModal, setShowModal] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const stats = useMemo(() => {
    // Orçamentos perdidos ficam na coluna do Kanban, mas não entram nos indicadores.
    const comOrcamento = allLeads.filter(
      (lead) => (lead.budgetValue || 0) > 0 && !isPortalVendaPerdida(lead.status),
    );
    const valorTotal = comOrcamento.reduce((sum, lead) => sum + (lead.budgetValue || 0), 0);
    const ticketMedio = comOrcamento.length > 0 ? valorTotal / comOrcamento.length : 0;

    return {
      totalOrcamentos: comOrcamento.length,
      valorTotal,
      ticketMedio,
      leadsComOrcamento: comOrcamento,
    };
  }, [allLeads]);

  const baseAggregateValues = useMemo(
    () => ({
      valor_total: stats.valorTotal,
      total_orcamentos: stats.totalOrcamentos,
      ticket_medio: stats.ticketMedio,
    }),
    [stats],
  );

  const kanbanSomaValues = useMemo(
    () => computeKanbanColumnSums(kanbanPages, allLeads),
    [kanbanPages, allLeads],
  );

  const metricaSomaValues = useMemo(() => {
    const sums: Record<string, number> = {};
    const leads = stats.leadsComOrcamento;

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
        const v = evaluateOrcamentoFormula(source.formula, {
          valor_orcamento: lead.budgetValue || 0,
          valor_negocio: lead.dealValue || 0,
          ...baseAggregateValues,
          ...kanbanSomaValues,
        });
        if (v !== null) {
          sum += v;
          hasAny = true;
        }
      }
      if (hasAny) {
        sums[buildMetricaSomaVariableKey(metricaId)] = sum;
      }
    }
    return sums;
  }, [metricas, colunaMetricas, stats.leadsComOrcamento, baseAggregateValues, kanbanSomaValues]);

  const getLeadFormulaValues = useCallback(
    (lead: Lead) => ({
      valor_orcamento: lead.budgetValue || 0,
      valor_negocio: lead.dealValue || 0,
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

  const cardValues = useMemo(() => {
    return cardMetricas.map((metrica) => ({
      metrica,
      value: evaluateOrcamentoFormula(metrica.formula, aggregateValues),
    }));
  }, [cardMetricas, aggregateValues]);

  const openLista = () => setShowModal(true);

  const filteredLeads = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return stats.leadsComOrcamento.filter((lead) => {
      if (!term) return true;
      return (
        lead.name?.toLowerCase().includes(term) ||
        lead.phone?.toLowerCase().includes(term) ||
        lead.regiao?.toLowerCase().includes(term)
      );
    });
  }, [stats.leadsComOrcamento, searchTerm]);

  const colunaFooterSums = useMemo(() => {
    return colunaMetricas.map((metrica) => {
      let sum = 0;
      let hasAny = false;
      for (const lead of filteredLeads) {
        const v = evaluateOrcamentoFormula(metrica.formula, getLeadFormulaValues(lead));
        if (v !== null) {
          sum += v;
          hasAny = true;
        }
      }
      return { metrica, sum: hasAny ? sum : null };
    });
  }, [colunaMetricas, filteredLeads, getLeadFormulaValues]);

  if (isLoading) {
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
              <FileText className="h-4 w-4 text-primary shrink-0" />
              <EditableCardTitle labelKey="orcamentos" variant="section" className="normal-case tracking-normal" />
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
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 h-7 ml-auto"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowConfig(true);
                }}
                title="Configurar métricas e fórmulas"
              >
                <Settings2 className="h-3.5 w-3.5" />
                <span className="text-xs hidden sm:inline">Fórmulas</span>
              </Button>
            )}
          </div>
          <CardDescription className="text-xs">
            {formatCurrency(stats.valorTotal)} • {stats.totalOrcamentos}{' '}
            {stats.totalOrcamentos === 1 ? 'orçamento' : 'orçamentos'}
            {!isVisible && stats.totalOrcamentos > 0 && (
              <span className="text-muted-foreground/80"> — clique para ver a lista</span>
            )}
          </CardDescription>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <div
              className={cn(
                'grid gap-4',
                'grid-cols-2 sm:grid-cols-3',
                cardMetricas.length > 0 && 'lg:grid-cols-4 xl:grid-cols-5',
              )}
            >
              <div
                className="p-3 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={openLista}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">Orçamentos</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{stats.totalOrcamentos}</p>
                <p className="text-xs text-muted-foreground">clientes com valor</p>
              </div>

              <div
                className="p-3 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={openLista}
              >
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-success" />
                  <span className="text-xs font-medium text-muted-foreground">Valor total</span>
                </div>
                <p className="text-2xl font-bold text-success">{formatCurrency(stats.valorTotal)}</p>
                <p className="text-xs text-muted-foreground">
                  Média: {formatCurrency(stats.ticketMedio)}
                </p>
              </div>

              {cardValues.map(({ metrica, value }) => (
                <div
                  key={metrica.id}
                  className="p-3 bg-primary/5 border border-primary/15 rounded-lg"
                  title={metrica.formula}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Calculator className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground truncate">
                      {metrica.nome}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-primary">
                    {formatOrcamentoMetricValue(value, metrica.formato)}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">
                    {metrica.formula}
                  </p>
                </div>
              ))}

              <div className="p-3 bg-muted/30 rounded-lg flex items-center col-span-2 sm:col-span-1">
                <Button variant="outline" size="sm" className="w-full" onClick={openLista}>
                  Ver lista completa
                </Button>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>

      <Dialog
        open={showModal}
        onOpenChange={(open) => {
          setShowModal(open);
          if (!open) setSearchTerm('');
        }}
      >
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Orçamentos — todos os clientes
            </DialogTitle>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou região..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {colunaMetricas.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left p-2 font-medium">Cliente</th>
                    <th className="text-right p-2 font-medium">Orçamento</th>
                    {colunaMetricas.map((m) => (
                      <th key={m.id} className="text-right p-2 font-medium whitespace-nowrap">
                        {m.nome}
                      </th>
                    ))}
                    <th className="text-left p-2 font-medium hidden md:table-cell">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3 + colunaMetricas.length}
                        className="p-8 text-center text-muted-foreground"
                      >
                        {searchTerm
                          ? 'Nenhum resultado encontrado'
                          : 'Nenhum lead com orçamento cadastrado'}
                      </td>
                    </tr>
                  ) : (
                    filteredLeads.map((lead) => (
                      <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="p-2">
                          <p className="font-medium">{lead.name}</p>
                          <p className="text-xs text-muted-foreground">{lead.phone || '—'}</p>
                        </td>
                        <td className="p-2 text-right font-semibold text-primary whitespace-nowrap">
                          {formatCurrency(lead.budgetValue || 0)}
                        </td>
                        {colunaMetricas.map((metrica) => {
                          const v = evaluateOrcamentoFormula(
                            metrica.formula,
                            getLeadFormulaValues(lead),
                          );
                          return (
                            <td
                              key={metrica.id}
                              className="p-2 text-right whitespace-nowrap text-muted-foreground"
                            >
                              {formatOrcamentoMetricValue(v, metrica.formato)}
                            </td>
                          );
                        })}
                        <td className="p-2 text-xs text-muted-foreground hidden md:table-cell">
                          {lead.status || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {filteredLeads.length > 0 && colunaMetricas.length > 0 && (
                  <tfoot>
                    <tr className="bg-muted/30 font-medium">
                      <td className="p-2">Total ({filteredLeads.length})</td>
                      <td className="p-2 text-right text-primary">
                        {formatCurrency(
                          filteredLeads.reduce((s, l) => s + (l.budgetValue || 0), 0),
                        )}
                      </td>
                      {colunaFooterSums.map(({ metrica, sum }) => (
                        <td key={metrica.id} className="p-2 text-right">
                          {formatOrcamentoMetricValue(sum, metrica.formato)}
                        </td>
                      ))}
                      <td className="hidden md:table-cell" />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {colunaMetricas.length === 0 && (
            <ScrollArea className="h-[55vh] pr-4">
              <div className="space-y-2">
                {filteredLeads.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {searchTerm
                      ? 'Nenhum resultado encontrado'
                      : 'Nenhum lead com orçamento cadastrado'}
                  </p>
                ) : (
                  filteredLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="p-3 bg-muted/30 rounded-lg border border-border"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-foreground">{lead.name}</p>
                        <span className="text-primary font-bold">
                          {formatCurrency(lead.budgetValue || 0)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div>
                          <span className="font-medium">Telefone:</span> {lead.phone || 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">Origem:</span> {lead.origin || 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">Região:</span> {lead.regiao || 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">Status:</span> {lead.status || 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">Vendedor:</span> {lead.vendor || 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">Valor negócio:</span>{' '}
                          {lead.dealValue > 0 ? formatCurrency(lead.dealValue) : '—'}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          )}

          <div className="pt-2 border-t border-border space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Total: {stats.totalOrcamentos} orçamentos
              </span>
              <span className="font-bold text-primary">{formatCurrency(stats.valorTotal)}</span>
            </div>
            {cardValues.length > 0 && (
              <div className="flex flex-wrap gap-3 text-xs">
                {cardValues.map(({ metrica, value }) => (
                  <span key={metrica.id} className="text-muted-foreground">
                    {metrica.nome}:{' '}
                    <strong className="text-foreground">
                      {formatOrcamentoMetricValue(value, metrica.formato)}
                    </strong>
                  </span>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {isAdmin && (
        <OrcamentoMetricasConfigDialog open={showConfig} onOpenChange={setShowConfig} />
      )}
    </Collapsible>
  );
}
