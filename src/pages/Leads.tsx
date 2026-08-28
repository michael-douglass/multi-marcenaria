import { useState, useMemo, useEffect, useCallback, type CSSProperties } from 'react';
import { useLeadsPageFilters } from '@/hooks/useLeadsPageFilters';
import { usePipelineCustomStages } from '@/hooks/usePipelineCustomStages';
import {
  buildAllLeadStatusFilterOptions,
  buildAllLeadModalStatusOptions,
  pipelineStatusFilterValues,
} from '@/lib/pipeline-status-options';
import { useKanbanConfig } from '@/hooks/useKanbanConfig';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { GarboBrandLoader } from '@/components/ui/garbo-brand-loader';
import { Download, Search, Eye, Plus, Pencil, X, MapPin, ChevronDown, Star } from 'lucide-react';
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
import { DateRange } from 'react-day-picker';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { EditOrigemNomeDialog } from '@/components/leads/EditOrigemNomeDialog';
import { LeadSinalizarButton } from '@/components/leads/LeadSinalizarButton';
import { TabelaOrigemInfo } from '@/types/selletos';
import { REGIOES_DISPONIVEIS } from '@/hooks/useWebhooks';
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

  // Reabre o card só quando a URL muda (ex.: F5 / atualização do sistema com ?id=).
  // Não depende de isModalOpen — senão, ao fechar, o ?id= antigo ainda na URL reabria o card.
  useEffect(() => {
    const leadIdFromUrl = searchParams.get('id');
    if (!leadIdFromUrl || isInitialLeadsLoad) return;

    const leadId = parseInt(leadIdFromUrl, 10);
    if (Number.isNaN(leadId)) return;

    const leadExists = leads.find((l) => l.id === leadId);
    if (leadExists) {
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
  }, [searchParams, leads, isInitialLeadsLoad, setSearchParams]);

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
    if (status.includes('Venda Perdida')) return 'bg-muted text-muted-foreground';
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

  // Verificar permissão para acessar a página
  if (!hasPermission('leads', 'view')) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="text-6xl">🔒</div>
          <h2 className="text-2xl font-bold text-foreground">Acesso Negado</h2>
          <p className="text-muted-foreground max-w-md">
            Você não tem permissão para visualizar a página de leads.
            Entre em contato com o administrador para solicitar acesso.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6">
      {isInitialLeadsLoad ? (
        <GarboBrandLoader variant="inline" size="md" message="Carregando leads…" />
      ) : (
      <Tabs defaultValue="leads" className="w-full">
        <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:inline-flex mb-4">
          <TabsTrigger value="leads" className="min-w-0">Leads</TabsTrigger>
          <TabsTrigger value="cadastro" className="min-w-0">Cadastro</TabsTrigger>
        </TabsList>
        <TabsContent value="leads" className="mt-0 space-y-6">
          <div className="flex justify-end">
            <Button onClick={() => openLeadModal(null, true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Lead
            </Button>
          </div>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <CardTitle>Todos os Leads ({filteredLeads.length})</CardTitle>
            <Button variant="outline" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
          
          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-[300px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
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
                className="text-muted-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Limpar filtros
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Região</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Nenhum lead encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeads.map(lead => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          {pontuaGarboPartnerMap?.get(lead.id) && (
                            <Star
                              className="h-3.5 w-3.5 shrink-0 fill-gold text-gold"
                              aria-label="Parceiro Pontua Garbo"
                            />
                          )}
                          {hasPermission('lead_name', 'view') ? lead.name : '•••••'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {hasPermission('lead_phone', 'view') ? lead.phone : '••• •••• ••••'}
                      </TableCell>
                      <TableCell>
                        {hasPermission('lead_email', 'view') ? lead.email : '•••@•••.com'}
                      </TableCell>
                      <TableCell>
                        {lead.tabelaOrigemInfo ? (
                          <HoverCard>
                            <HoverCardTrigger asChild>
                              <span className="inline-flex cursor-pointer">
                                <Badge 
                                  className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 transition-colors"
                                  variant="outline"
                                >
                                  <MapPin className="h-3 w-3 mr-1" />
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
                                    <Pencil className="h-3 w-3 mr-1" />
                                    Editar nome amigável
                                  </Button>
                                )}
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {hasPermission('lead_origin', 'view') ? lead.origin : '•••'}
                      </TableCell>
                      <TableCell>
                        {hasPermission('lead_vendor', 'view') ? (
                          <div className="flex items-center gap-2">
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
                      <TableCell>
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
                      <TableCell>
                        {hasPermission('lead_value', 'view') ? (
                          <span className="font-medium text-success">
                            {lead.dealValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                        ) : (
                          '•••'
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          <LeadSinalizarButton
                            leadId={lead.id}
                            leadNome={lead.name}
                            leadStatus={lead.status}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              openLeadModal(lead.id, false);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
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
        </CardContent>
      </Card>

        </TabsContent>
        <TabsContent value="cadastro" className="mt-0">
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
  );
}
