import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar as CalendarIcon, Link, ListTodo, User, Bell, LayoutGrid } from 'lucide-react';
import { AgendaCreateMenu } from '@/components/agenda/AgendaCreateMenu';
import { LeadLembretesTab } from '@/components/agenda/LeadLembretesTab';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AgendaCalendar } from '@/components/agenda/AgendaCalendar';
import { AgendaTaskList } from '@/components/agenda/AgendaTaskList';
import { EditReuniaoDialog } from '@/components/agenda/EditReuniaoDialog';
import { AgendaConfigPanel } from '@/components/agenda/AgendaConfigPanel';
import { AgendaPessoalTab } from '@/components/agenda/AgendaPessoalTab';
import { AgendaGeralTab } from '@/components/agenda/AgendaGeralTab';
import { useAgenda, AgendaReuniao } from '@/hooks/useAgenda';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { linkPublicoAgenda } from '@/lib/agenda-public-link';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

export default function Agenda() {
  const [searchParams] = useSearchParams();
  const getInitialTab = () => {
    const t = searchParams.get('tab');
    if (t === 'geral' || t === 'lembretes' || t === 'pessoal' || t === 'tarefas') return t;
    return 'geral';
  };
  const [activeTab, setActiveTab] = useState(getInitialTab());
  
  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'geral' || t === 'lembretes' || t === 'pessoal' || t === 'tarefas') {
      setActiveTab(t);
    }
  }, [searchParams]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [editingReuniao, setEditingReuniao] = useState<AgendaReuniao | null>(null);
  const [dateFilterMode, setDateFilterMode] = useState<'reuniao' | 'marcacao'>('reuniao');
  const [marcacaoDate, setMarcacaoDate] = useState<Date | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const {
    config,
    reunioes,
    loading,
    updateReuniao,
    updateConfig,
    getReunioesPendentes,
    getReunioesHoje,
  } = useAgenda();
  const { empresa, schemaEmpresa } = useEmpresa();

  const pendentes = getReunioesPendentes();
  const hoje = getReunioesHoje();
  const publicosCount = reunioes.filter((r) => r.tipo === 'publico').length;

  const publicUrl = config?.slug
    ? linkPublicoAgenda(config.slug, { empresaSlug: empresa?.slug, schemaEmpresa })
    : '';

  const handleUpdateStatus = async (id: string, status: 'confirmado' | 'concluido' | 'cancelado') => {
    const updates: any = { status };
    if (status === 'concluido') updates.concluido_em = new Date().toISOString();
    if (status === 'cancelado') updates.cancelado_em = new Date().toISOString();
    if (status === 'confirmado') updates.confirmado_em = new Date().toISOString();
    
    await updateReuniao.mutateAsync({ id, ...updates });
    
    // Disparar webhook de conclusão se configurado
    if (status === 'concluido') {
      try {
        await supabase.functions.invoke('agenda-disparar-conclusao', {
          body: { reuniao_id: id }
        });
      } catch (e) {
        console.log('Webhook de conclusão não disparado:', e);
      }
    }
  };

  const handleEditReuniao = (reuniao: AgendaReuniao) => {
    setEditingReuniao(reuniao);
  };

  const handleSaveEdit = async (id: string, updates: Partial<AgendaReuniao>) => {
    await updateReuniao.mutateAsync({ id, ...updates });
    setEditingReuniao(null);
  };

  const handleUpdateTitulares = async (id: string, titularIds: string[] | null) => {
    await updateReuniao.mutateAsync({ id, titular_ids: titularIds });
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[400px]" />
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <CalendarIcon className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Agenda</h1>
        </div>
        <AgendaCreateMenu initialDate={selectedDate || undefined} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-4">
          <TabsTrigger value="geral" className="min-w-0 gap-2 whitespace-normal px-2 py-2 text-xs sm:text-sm">
            <LayoutGrid className="h-4 w-4" />
            Agenda Geral
          </TabsTrigger>
          <TabsTrigger value="tarefas" className="min-w-0 gap-2 whitespace-normal px-2 py-2 text-xs sm:text-sm">
            <ListTodo className="h-4 w-4" />
            Agenda de Tarefas
          </TabsTrigger>
          <TabsTrigger value="lembretes" className="min-w-0 gap-2 whitespace-normal px-2 py-2 text-xs sm:text-sm">
            <Bell className="h-4 w-4" />
            Lembrete de Leads
          </TabsTrigger>
          <TabsTrigger value="pessoal" className="min-w-0 gap-2 whitespace-normal px-2 py-2 text-xs sm:text-sm">
            <User className="h-4 w-4" />
            Agenda Pessoal
          </TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="mt-6">
          <AgendaGeralTab onSelectedDateChange={setSelectedDate} />
        </TabsContent>

        <TabsContent value="tarefas" className="mt-6 space-y-6">
          {/* Header da aba tarefas */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Badge variant="secondary">
                {reunioes.length} reuniões
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <AgendaConfigPanel
                config={config}
                reunioes={reunioes}
                onUpdateConfig={(updates) => updateConfig.mutate(updates)}
                publicUrl={publicUrl}
              />
            </div>
          </div>

          {/* Link público destacado */}
          {publicUrl && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="py-3 px-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Link className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Link Público para Agendamentos:</span>
                  <code className="text-sm bg-background px-2 py-1 rounded border">
                    {publicUrl}
                  </code>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(publicUrl);
                  }}
                >
                  Copiar Link
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Resumo rápido */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="py-4">
                <div className="text-2xl font-bold">{hoje.length}</div>
                <div className="text-sm text-muted-foreground">Reuniões hoje</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="text-2xl font-bold text-amber-600">{pendentes.length}</div>
                <div className="text-sm text-muted-foreground">Pendentes</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="text-2xl font-bold text-blue-600">{publicosCount}</div>
                <div className="text-sm text-muted-foreground">Agendamentos públicos</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="text-2xl font-bold">{config?.duracao_minutos || 60}min</div>
                <div className="text-sm text-muted-foreground">Duração padrão</div>
              </CardContent>
            </Card>
          </div>

          {/* Layout principal - 2 colunas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Calendário */}
            <div className="space-y-4">
              <AgendaCalendar
                reunioes={reunioes}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />

              {/* Resumo abaixo do calendário */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ListTodo className="h-4 w-4" />
                    Resumo
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <p className="text-muted-foreground">
                    {pendentes.length} tarefa(s) pendente(s)
                  </p>
                  <p className="text-muted-foreground">
                    {publicosCount} agendamento(s) público(s)
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Lista de tarefas */}
            <div className="space-y-3">
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar por nome, telefone ou nome do responsável"
              />

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Filtrar tarefas do dia por:
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant={dateFilterMode === 'reuniao' ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setDateFilterMode('reuniao');
                      setMarcacaoDate(null);
                    }}
                  >
                    Data da reunião
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant={dateFilterMode === 'marcacao' ? 'default' : 'outline'}
                        size="sm"
                        className="text-xs"
                        onClick={() => setDateFilterMode('marcacao')}
                      >
                        {dateFilterMode === 'marcacao' && marcacaoDate
                          ? format(marcacaoDate, "dd/MM/yyyy", { locale: ptBR })
                          : 'Data da marcação'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="single"
                        selected={marcacaoDate || undefined}
                        onSelect={(date) => {
                          if (date) {
                            setMarcacaoDate(date);
                            setDateFilterMode('marcacao');
                            setSelectedDate(date);
                          }
                        }}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <AgendaTaskList
                reunioes={reunioes}
                selectedDate={selectedDate}
                onUpdateStatus={handleUpdateStatus}
                onEdit={handleEditReuniao}
                onUpdateTitulares={handleUpdateTitulares}
                filterMode={dateFilterMode}
                searchTerm={searchTerm}
                agendaConfigId={config?.id}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="lembretes" className="mt-6">
          <LeadLembretesTab />
        </TabsContent>

        <TabsContent value="pessoal" className="mt-6">
          <AgendaPessoalTab />
        </TabsContent>
      </Tabs>

      {/* Dialog de edição */}
      <EditReuniaoDialog
        reuniao={editingReuniao}
        isOpen={!!editingReuniao}
        onClose={() => setEditingReuniao(null)}
        onSave={handleSaveEdit}
        isLoading={updateReuniao.isPending}
        reunioes={reunioes}
        config={config}
      />
    </div>
  );
}
