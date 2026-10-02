import { useState, useMemo, useEffect, useCallback, useRef, type CSSProperties } from 'react';
import { useLeadsPageFilters } from '@/hooks/useLeadsPageFilters';
import { usePipelineCustomStages } from '@/hooks/usePipelineCustomStages';
import {
  buildAllLeadStatusFilterOptions,
  buildAllLeadModalStatusOptions,
  pipelineStatusFilterValues,
} from '@/lib/pipeline-status-options';
import { useKanbanConfig } from '@/hooks/useKanbanConfig';
import { useSearchParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { GarboBrandLoader } from '@/components/ui/garbo-brand-loader';
import { Download, Search, Plus, Pencil, X, MapPin, Star } from 'lucide-react';
import { LeadModal } from '@/components/leads/LeadModal';
import { useLeads } from '@/hooks/useLeads';
import { useUsers } from '@/hooks/useUsers';
import { usePontuaGarboPartnerMap } from '@/hooks/usePontuaGarboPartnerLeads';
import { usePermissions } from '@/hooks/usePermissions';
import { adaptLeadFromDatabase, adaptUserFromDatabase } from '@/lib/adapters';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker } from '@/components/pipeline/DateRangePicker';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { EditOrigemNomeDialog } from '@/components/leads/EditOrigemNomeDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CadastroTabContent } from '@/components/cadastro/CadastroTabContent';

export default function Leads() {
  const { leads: dbLeads, isLoading: leadsLoading } = useLeads();
  const { users: dbUsers, isLoading: usersLoading } = useUsers();
  const { data: pontuaGarboPartnerMap } = usePontuaGarboPartnerMap();
  const { hasPermission } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeStages: pipelineStages } = usePipelineCustomStages();
  const { pages: kanbanPages } = useKanbanConfig();
  const {
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    dateRange,
    setDateRange,
    resetFilters,
    hasActiveFilters,
  } = useLeadsPageFilters();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editOrigemDialog, setEditOrigemDialog] = useState<{
    isOpen: boolean;
    nomeTabela: string;
    nomeAmigavel: string;
  }>({ isOpen: false, nomeTabela: '', nomeAmigavel: '' });

  const syncLeadIdInUrl = useCallback((leadId: number | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (leadId != null) {
        next.set('id', String(leadId));
      } else {
        next.delete('id');
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const openLeadModal = useCallback(
    (leadId: number | null, editMode: boolean) => {
      setSelectedLeadId(leadId);
      setIsEditMode(editMode);
      setIsModalOpen(true);
      syncLeadIdInUrl(leadId);
    },
    [syncLeadIdInUrl],
  );

  const closeLeadModal = useCallback(() => {
    // Limpa ?id= antes de marcar fechado: evita o efeito da URL reabrir o card.
    syncLeadIdInUrl(null);
    setIsModalOpen(false);
    setSelectedLeadId(null);
    setIsEditMode(false);
  }, [syncLeadIdInUrl]);

  const leads = dbLeads?.map(adaptLeadFromDatabase) || [];
  const users = dbUsers?.map(adaptUserFromDatabase) || [];
  const isLoading = leadsLoading || usersLoading;
  const isInitialLeadsLoad = isLoading && !dbLeads;

  const statusOptions = useMemo(
    () =>
      buildAllLeadStatusFilterOptions(
        pipelineStages,
        kanbanPages,
        leads.map((l) => l.status).filter(Boolean),
      ),
    [pipelineStages, kanbanPages, leads],
  );

  const allStatusValues = useMemo(
    () => pipelineStatusFilterValues(statusOptions),
    [statusOptions],
  );

  const leadModalStatusOptions = useMemo(
    () => buildAllLeadModalStatusOptions(pipelineStages, kanbanPages),
    [pipelineStages, kanbanPages],
  );

  useEffect(() => {
    if (statusFilter === 'all') return;
    const exists = statusOptions.some((o) => o.value === statusFilter);
    if (!exists) setStatusFilter('all');
  }, [statusFilter, statusOptions, setStatusFilter]);

  // Preencher campo de busca se houver parâmetro search na URL
  useEffect(() => {
    const searchFromUrl = searchParams.get('search');
    if (searchFromUrl && !isLoading) {
      setSearchTerm(searchFromUrl);
      // Limpar o filtro de data para mostrar todos os leads
      setDateRange(undefined);
      // Remover parâmetro da URL após usar
      searchParams.delete('search');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, isLoading, setSearchParams]);

  // Reabre o card só quando o ?id= da URL muda (F5 / botão Atualizar).
  const leadIdFromUrl = searchParams.get('id');
  const openedUrlLeadIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!leadIdFromUrl) {
      openedUrlLeadIdRef.current = null;
      return;
    }
    if (isInitialLeadsLoad) return;
    if (openedUrlLeadIdRef.current === leadIdFromUrl) return;

    const leadId = parseInt(leadIdFromUrl, 10);
    if (Number.isNaN(leadId)) return;

    const leadExists = leads.find((l) => l.id === leadId);
    if (leadExists) {
      openedUrlLeadIdRef.current = leadIdFromUrl;
      setSelectedLeadId(leadId);
      setIsEditMode(false);
      setIsModalOpen(true);
    } else if (leads.length > 0) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('id');
        return next;
      }, { replace: true });
      toast.error('Lead não encontrado');
    }
  }, [leadIdFromUrl, leads, isInitialLeadsLoad, setSearchParams]);

  const filteredLeads = useMemo(() => {
    const term = searchTerm.toLowerCase();
    
    let filtered = leads.filter(lead => {
      // Filtro de texto
      const matchesSearch = 
        lead.name.toLowerCase().includes(term) ||
        lead.email.toLowerCase().includes(term) ||
        lead.phone.includes(term);
      
      // Filtro de status
      const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
      
      // Filtro de data
      let matchesDate = true;
      if (dateRange?.from) {
        const leadDate = new Date(lead.dateArrived);
        const fromDate = new Date(dateRange.from);
        fromDate.setHours(0, 0, 0, 0);
        
        if (dateRange.to) {
          const toDate = new Date(dateRange.to);
          toDate.setHours(23, 59, 59, 999);
          matchesDate = leadDate >= fromDate && leadDate <= toDate;
        } else {
          matchesDate = leadDate >= fromDate;
        }
      }
      
      return matchesSearch && matchesStatus && matchesDate;
    });
    
    // Ordenar por data de chegada (mais recente primeiro)
    filtered.sort((a, b) => new Date(b.dateArrived).getTime() - new Date(a.dateArrived).getTime());
    
    return filtered;
  }, [leads, searchTerm, statusFilter, dateRange]);

  const handleExportCSV = () => {
    // Verificar se tem permissão para exportar dados sensíveis
    const canExportSensitive = hasPermission('lead_phone', 'view') && 
                                hasPermission('lead_email', 'view') &&
                                hasPermission('lead_company', 'view');
    
    if (!canExportSensitive) {
      toast.error('Você não tem permissão para exportar dados sensíveis');
      return;
    }

    const headers = ['Nome', 'Telefone', 'Email', 'Origem', 'Vendedor', 'Status', 'Valor'];
    const rows = filteredLeads.map(lead => [
      lead.name,
      lead.phone,
      lead.email,
      lead.origin,
      lead.vendor,
      lead.status,
      lead.dealValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leads.csv';
    a.click();
    
    toast.success('Lista exportada com sucesso!');
  };

  const getStatusColor = (status: string) => {
    if (pipelineStages.some((s) => s.nome === status && s.cor)) {
      return 'border-transparent';
    }
    if (status.includes('Venda Realizada')) return 'bg-success text-success-foreground';
    if (/perdid/i.test(status)) return 'bg-muted text-muted-foreground';
    if (status.includes('Clientes Já Cadastrados')) return 'bg-secondary text-secondary-foreground';
    if (status.includes('Aula Realizada')) return 'bg-success/80 text-success-foreground';
    if (status.includes('Não Entrou')) return 'bg-destructive text-destructive-foreground';
    if (status.includes('Marcada')) return 'bg-warning text-warning-foreground';
    return 'bg-primary text-primary-foreground';
  };

  const getStatusStyle = (status: string): CSSProperties | undefined => {
    const cor = pipelineStages.find((s) => s.nome === status)?.cor;
    if (!cor) return undefined;
    return { backgroundColor: cor, color: '#fff' };
  };

  if (!hasPermission('leads', 'view')) {
    return (
      <div className="leads-page-shell relative -mx-2 -mt-2 flex min-h-[min(70vh,calc(100svh-5rem))] items-center justify-center px-6 sm:-mx-3 sm:-mt-3">
        <div className="relative z-[1] max-w-md space-y-3 text-center">
          <p className="font-serif text-3xl text-[#2a1812]">Acesso negado</p>
          <p className="font-dm text-sm text-[#6b5244]">
            Você não tem permissão para visualizar a página de leads.
            Entre em contato com o administrador para solicitar acesso.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="leads-page-shell relative -mx-2 -mt-2 min-h-[calc(100svh-4.25rem)] sm:-mx-3 sm:-mt-3">
      <div className="relative z-[1] space-y-5 p-4 sm:p-6 md:p-8">
      {isInitialLeadsLoad ? (
        <GarboBrandLoader variant="inline" size="md" message="Carregando leads…" />
      ) : (
      <Tabs defaultValue="leads" className="w-full">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-3">
            <div>
              <p className="font-dm text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8d5e22]">
                Cadastro comercial
              </p>
              <h1 className="font-serif text-[2.15rem] leading-none tracking-tight text-[#2a1812] sm:text-[2.45rem]">
                Leads
              </h1>
              <p className="mt-1.5 font-dm text-sm text-[#6b5244]">
                {filteredLeads.length} de {leads.length} cadastros
              </p>
            </div>
            <TabsList className="grid w-full grid-cols-2 sm:inline-flex sm:w-auto">
              <TabsTrigger value="leads" className="min-w-0">Lista</TabsTrigger>
              <TabsTrigger value="cadastro" className="min-w-0">Cadastro</TabsTrigger>
            </TabsList>
          </div>
          <Button onClick={() => openLeadModal(null, true)} className="w-full shrink-0 sm:w-auto">
            <Plus className="h-4 w-4" />
            Novo lead
          </Button>
        </div>

        <TabsContent value="leads" className="mt-5 space-y-4">
          <div className="leads-page-sheet overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-[rgba(42,24,18,0.08)] px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:px-5">
              <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a8170]" />
                <Input
                  placeholder="Buscar nome, e-mail ou telefone"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border-[rgba(42,24,18,0.14)] bg-[#fffaf4] pl-10 text-[#2a1812]"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full bg-[#fffaf4] text-[#2a1812] sm:w-[200px]">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <DateRangePicker value={dateRange} onChange={setDateRange} />

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="text-[#6b5244] hover:bg-[rgba(42,24,18,0.06)] hover:text-[#2a1812]"
                >
                  <X className="h-4 w-4" />
                  Limpar
                </Button>
              )}

              <Button
                variant="outline"
                onClick={handleExportCSV}
                className="sm:ml-auto"
              >
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            </div>

            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[#6b5244]">Nome</TableHead>
                  <TableHead className="hidden text-[#6b5244] sm:table-cell">Telefone</TableHead>
                  <TableHead className="hidden text-[#6b5244] md:table-cell">Email</TableHead>
                  <TableHead className="hidden text-[#6b5244] lg:table-cell">Região</TableHead>
                  <TableHead className="hidden text-[#6b5244] xl:table-cell">Origem</TableHead>
                  <TableHead className="hidden text-[#6b5244] md:table-cell">Vendedor</TableHead>
                  <TableHead className="text-[#6b5244]">Status</TableHead>
                  <TableHead className="hidden text-[#6b5244] sm:table-cell">Valor</TableHead>
                  <TableHead className="text-right text-[#6b5244]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={9} className="py-12 text-center font-dm text-sm text-[#6b5244]">
                      Nenhum lead encontrado com esse filtro.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeads.map(lead => (
                    <TableRow
                      key={lead.id}
                      className="cursor-pointer"
                      onClick={() => openLeadModal(lead.id, false)}
                    >
                      <TableCell className="py-3 font-medium text-[#2a1812]">
                        <span className="inline-flex items-center gap-1.5">
                          {pontuaGarboPartnerMap?.get(lead.id) && (
                            <Star
                              className="h-3.5 w-3.5 shrink-0 fill-[#8d5e22] text-[#8d5e22]"
                              aria-label="Parceiro Pontua Garbo"
                            />
                          )}
                          {hasPermission('lead_name', 'view') ? lead.name : '•••••'}
                        </span>
                        <div className="mt-0.5 font-dm text-xs text-[#6b5244] sm:hidden">
                          {hasPermission('lead_phone', 'view') ? (lead.phone || lead.email || '—') : '•••'}
                        </div>
                      </TableCell>
                      <TableCell className="hidden py-3 text-[#3d261c] sm:table-cell">
                        {hasPermission('lead_phone', 'view') ? lead.phone : '••• •••• ••••'}
                      </TableCell>
                      <TableCell className="hidden py-3 text-[#3d261c] md:table-cell">
                        {hasPermission('lead_email', 'view') ? lead.email : '•••@•••.com'}
                      </TableCell>
                      <TableCell className="hidden py-3 lg:table-cell">
                        {lead.tabelaOrigemInfo ? (
                          <HoverCard>
                            <HoverCardTrigger asChild>
                              <span className="inline-flex cursor-pointer">
                                <Badge
                                  className="border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                                  variant="outline"
                                >
                                  <MapPin className="mr-1 h-3 w-3" />
                                  {lead.tabelaOrigemInfo.nomeAmigavel}
                                </Badge>
                              </span>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-72" align="start">
                              <div className="space-y-3">
                                <div>
                                  <p className="text-sm text-muted-foreground">Tabela de origem:</p>
                                  <p className="font-mono text-sm">{lead.tabelaOrigemInfo.nomeTabela}</p>
                                </div>
                                {hasPermission('leads', 'edit') && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditOrigemDialog({
                                        isOpen: true,
                                        nomeTabela: lead.tabelaOrigemInfo!.nomeTabela,
                                        nomeAmigavel: lead.tabelaOrigemInfo!.nomeAmigavel,
                                      });
                                    }}
                                  >
                                    <Pencil className="mr-1 h-3 w-3" />
                                    Editar nome amigável
                                  </Button>
                                )}
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                        ) : (
                          <span className="text-[#9a8170]">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden py-3 text-[#3d261c] xl:table-cell">
                        {hasPermission('lead_origin', 'view') ? lead.origin : '•••'}
                      </TableCell>
                      <TableCell className="hidden py-3 md:table-cell">
                        {hasPermission('lead_vendor', 'view') ? (
                          <div className="flex items-center gap-2 text-[#3d261c]">
                            {(() => {
                              const user = users.find(u => u.name === lead.vendor);
                              return user ? <UserAvatar user={user} size="sm" /> : null;
                            })()}
                            <span>{lead.vendor}</span>
                          </div>
                        ) : (
                          '•••'
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        {hasPermission('lead_status', 'view') ? (
                          <Badge
                            className={getStatusColor(lead.status)}
                            style={getStatusStyle(lead.status)}
                          >
                            {lead.status}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">•••</Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden py-3 sm:table-cell">
                        {hasPermission('lead_value', 'view') ? (
                          <span className="font-dm font-semibold tabular-nums text-emerald-800">
                            {lead.dealValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                        ) : (
                          '•••'
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-[#6b5244] hover:bg-[rgba(42,24,18,0.06)] hover:text-[#2a1812]"
                            aria-label={`Editar ${lead.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              openLeadModal(lead.id, true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="cadastro" className="mt-5">
          <CadastroTabContent />
        </TabsContent>
      </Tabs>
      )}

      <LeadModal
        isOpen={isModalOpen}
        onClose={closeLeadModal}
        leadId={selectedLeadId}
        isEditMode={isEditMode}
        statusChangeOnSelect={false}
        statusOptions={leadModalStatusOptions}
        allStatusValues={allStatusValues}
        onLeadDuplicated={(newLeadId) => openLeadModal(newLeadId, true)}
        onLeadCreated={(newLeadId) => openLeadModal(newLeadId, true)}
      />

      <EditOrigemNomeDialog
        isOpen={editOrigemDialog.isOpen}
        onClose={() => setEditOrigemDialog({ isOpen: false, nomeTabela: '', nomeAmigavel: '' })}
        nomeTabela={editOrigemDialog.nomeTabela}
        nomeAmigavelAtual={editOrigemDialog.nomeAmigavel}
      />
      </div>
    </div>
  );
}
