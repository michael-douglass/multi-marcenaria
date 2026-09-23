import { useMemo, useState } from 'react';
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
  Hourglass,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { EditableCardTitle } from './EditableCardTitle';
import { useVendasGanhosConfig } from '@/hooks/useVendasGanhosConfig';
import { isLeadNegocioGanho } from '@/lib/vendas-ganhos';
import { isPortalVendaPerdida } from '@/lib/crm-portal';
import { cn } from '@/lib/utils';

type ListMode = 'todos' | 'abertos';

interface OrcamentosCardProps {
  allLeads: Lead[];
  isLoading: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onLeadClick?: (leadId: number) => void;
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
  onLeadClick,
}: OrcamentosCardProps) {
  const { config: vendasGanhosConfig } = useVendasGanhosConfig();

  const [internalOpen, setInternalOpen] = useState(false);
  const isVisible = open ?? internalOpen;
  const setIsVisible = onOpenChange ?? setInternalOpen;
  const [showModal, setShowModal] = useState(false);
  const [listMode, setListMode] = useState<ListMode>('todos');
  const [searchTerm, setSearchTerm] = useState('');

  const stats = useMemo(() => {
    // Orçamentos perdidos ficam na coluna do Kanban, mas não entram nos indicadores.
    const comOrcamento = allLeads.filter(
      (lead) => (lead.budgetValue || 0) > 0 && !isPortalVendaPerdida(lead.status),
    );
    const leadsAbertos = comOrcamento.filter(
      (lead) => !isLeadNegocioGanho(lead, vendasGanhosConfig),
    );

    const valorTotal = comOrcamento.reduce((sum, lead) => sum + (lead.budgetValue || 0), 0);
    const valorAberto = leadsAbertos.reduce((sum, lead) => sum + (lead.budgetValue || 0), 0);
    const ticketMedio = comOrcamento.length > 0 ? valorTotal / comOrcamento.length : 0;
    const ticketMedioAberto = leadsAbertos.length > 0 ? valorAberto / leadsAbertos.length : 0;

    return {
      totalOrcamentos: comOrcamento.length,
      valorTotal,
      ticketMedio,
      leadsComOrcamento: comOrcamento,
      totalAbertos: leadsAbertos.length,
      valorAberto,
      ticketMedioAberto,
      leadsAbertos,
    };
  }, [allLeads, vendasGanhosConfig]);

  const openLista = (mode: ListMode = 'todos') => {
    setListMode(mode);
    setShowModal(true);
  };

  const listLeads = listMode === 'abertos' ? stats.leadsAbertos : stats.leadsComOrcamento;

  const filteredLeads = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return listLeads.filter((lead) => {
      if (!term) return true;
      return (
        lead.name?.toLowerCase().includes(term) ||
        lead.phone?.toLowerCase().includes(term) ||
        lead.regiao?.toLowerCase().includes(term)
      );
    });
  }, [listLeads, searchTerm]);

  const listTotalValue = useMemo(
    () => filteredLeads.reduce((sum, lead) => sum + (lead.budgetValue || 0), 0),
    [filteredLeads],
  );

  const handleLeadClick = (leadId: number) => {
    setShowModal(false);
    setSearchTerm('');
    onLeadClick?.(leadId);
  };

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
            if (!isVisible) openLista('todos');
          }}
          role={!isVisible ? 'button' : undefined}
          tabIndex={!isVisible ? 0 : undefined}
          onKeyDown={(e) => {
            if (!isVisible && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              openLista('todos');
            }
          }}
        >
          <div className="flex items-center gap-3 flex-wrap">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 p-0">
              <FileText className="h-4 w-4 text-primary shrink-0" />
              <EditableCardTitle
                labelKey="orcamentos"
                variant="section"
                className="normal-case tracking-normal"
              />
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setIsVisible(!isVisible);
              }}
              className="gap-1.5 h-7 ml-auto"
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
          </div>
          <CardDescription className="text-xs">
            {formatCurrency(stats.valorTotal)} • {stats.totalOrcamentos}{' '}
            {stats.totalOrcamentos === 1 ? 'orçamento' : 'orçamentos'}
            {stats.totalAbertos > 0 && (
              <>
                {' '}
                · {formatCurrency(stats.valorAberto)} em aberto
              </>
            )}
            {!isVisible && stats.totalOrcamentos > 0 && (
              <span className="text-muted-foreground/80"> — clique para ver a lista</span>
            )}
          </CardDescription>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              <div
                className="p-3 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => openLista('todos')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openLista('todos');
                  }
                }}
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
                onClick={() => openLista('todos')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openLista('todos');
                  }
                }}
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

              <div
                className={cn(
                  'p-3 rounded-lg cursor-pointer transition-colors',
                  'bg-[rgba(180,120,40,0.08)] border border-[rgba(180,120,40,0.22)]',
                  'hover:bg-[rgba(180,120,40,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(180,120,40,0.45)]',
                )}
                onClick={() => openLista('abertos')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openLista('abertos');
                  }
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Hourglass className="h-4 w-4 text-[rgb(150,95,25)]" />
                  <span className="text-xs font-medium text-[rgb(120,75,20)]">
                    Valores em aberto
                  </span>
                </div>
                <p className="text-2xl font-bold text-[rgb(120,75,20)]">
                  {formatCurrency(stats.valorAberto)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {stats.totalAbertos}{' '}
                  {stats.totalAbertos === 1 ? 'orçamento' : 'orçamentos'} · média{' '}
                  {formatCurrency(stats.ticketMedioAberto)}
                </p>
              </div>

              <div className="p-3 bg-muted/30 rounded-lg flex items-center col-span-2 sm:col-span-1 lg:col-span-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => openLista('todos')}
                >
                  Ver lista completa
                </Button>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>

      <Dialog
        open={showModal}
        onOpenChange={(nextOpen) => {
          setShowModal(nextOpen);
          if (!nextOpen) setSearchTerm('');
        }}
      >
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {listMode === 'abertos' ? (
                <>
                  <Hourglass className="h-5 w-5 text-[rgb(150,95,25)]" />
                  Valores em aberto
                </>
              ) : (
                <>
                  <FileText className="h-5 w-5 text-primary" />
                  Orçamentos — todos os clientes
                </>
              )}
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

          <ScrollArea className="h-[55vh] pr-4">
            <div className="space-y-2">
              {filteredLeads.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {searchTerm
                    ? 'Nenhum resultado encontrado'
                    : listMode === 'abertos'
                      ? 'Nenhum orçamento em aberto'
                      : 'Nenhum lead com orçamento cadastrado'}
                </p>
              ) : (
                filteredLeads.map((lead) => (
                  <div
                    key={lead.id}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      'p-3 rounded-lg border border-border text-left w-full',
                      'bg-muted/30 cursor-pointer transition-colors',
                      'hover:bg-muted/55 hover:border-primary/25',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    )}
                    onClick={() => handleLeadClick(lead.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleLeadClick(lead.id);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between mb-2 gap-3">
                      <p className="font-medium text-foreground truncate">{lead.name}</p>
                      <span className="text-primary font-bold shrink-0">
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
                    <p className="mt-2 text-[11px] text-primary/80">Clique para abrir o card</p>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <div className="pt-2 border-t border-border">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Total: {filteredLeads.length}{' '}
                {filteredLeads.length === 1 ? 'orçamento' : 'orçamentos'}
                {listMode === 'abertos' ? ' em aberto' : ''}
              </span>
              <span className="font-bold text-primary">{formatCurrency(listTotalValue)}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Collapsible>
  );
}
