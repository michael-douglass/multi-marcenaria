import { useState, useMemo } from 'react';
import { format, isSameDay, isToday, isBefore, addDays, startOfDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Ban, Bell, Send, Users } from 'lucide-react';
import { Calendar, Clock, User, MessageSquare, Check, X, Video, Phone, Mail, FileText, Pencil, FileBarChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { resolveBrandLogo, resolveBrandName } from '@/lib/app-branding';
import { AgendaReuniao, MetadataCapturada } from '@/hooks/useAgenda';
import { useAgendaFormFields } from '@/hooks/useAgendaFormFields';
import { useAgendaWebhook } from '@/hooks/useAgendaWebhook';
import { useRelatoriosReunioesByReuniao, type RelatorioReuniaoRow } from '@/hooks/useRelatoriosReunioes';
import { useUsers } from '@/hooks/useUsers';
import { MetadataCapturedDisplay } from './MetadataCapturedDisplay';
import { FormResponseFieldsList } from './FormResponseFieldsList';
import { AgendaReuniaoTitularesPicker } from './AgendaReuniaoTitularesPicker';
import {
  buildFormResponseDisplayItems,
  parseRespostaFormulario,
  summarizeFormResponses,
} from '@/lib/agenda-form-field-utils';
import {
  formatTitularesLabel,
  normalizeTitularIdsForSave,
} from '@/lib/agenda-reuniao-titulares';

interface AgendaTaskListProps {
  reunioes: AgendaReuniao[];
  selectedDate: Date | null;
  onUpdateStatus: (id: string, status: 'confirmado' | 'concluido' | 'cancelado') => void;
  onEdit?: (reuniao: AgendaReuniao) => void;
  onUpdateTitulares?: (id: string, titularIds: string[] | null) => void;
  filterMode?: 'reuniao' | 'marcacao';
  searchTerm?: string;
  agendaConfigId?: string | null;
}

const statusConfig = {
  pendente: { label: 'Pendente', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  confirmado: { label: 'Confirmado', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  concluido: { label: 'Concluído', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
};

// Labels amigáveis para campos do formulário — removido: usa definições do banco

/** Botão de relatório isolado: o estado da mutation fica só aqui, evitando re-render do card */
function RelatorioAulaExperimentalButton({ reuniaoId }: { reuniaoId: string }) {
  const { dispararRelatorioAulaExperimental, isDisparandoRelatorio } = useAgendaWebhook();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground hover:text-sky-600 hover:bg-sky-100"
          onClick={(e) => {
            e.stopPropagation();
            dispararRelatorioAulaExperimental.mutate(reuniaoId);
          }}
          disabled={isDisparandoRelatorio}
          title="Relatório de aula experimental"
        >
          <FileBarChart className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Relatório de aula experimental</TooltipContent>
    </Tooltip>
  );
}

export function AgendaTaskList({ reunioes, selectedDate, onUpdateStatus, onEdit, onUpdateTitulares, filterMode = 'reuniao', searchTerm, agendaConfigId }: AgendaTaskListProps) {
  const { empresa } = useEmpresa();
  const brandLogo = resolveBrandLogo(empresa?.logo_url);
  const brandName = resolveBrandName(empresa?.nome);
  const now = new Date();
  const [selectedReuniao, setSelectedReuniao] = useState<AgendaReuniao | null>(null);
  const [relatorioEmLeitura, setRelatorioEmLeitura] = useState<RelatorioReuniaoRow | null>(null);
  const [titularesDraft, setTitularesDraft] = useState<string[] | null>(null);
  const [savingTitulares, setSavingTitulares] = useState(false);
  const { dispararLembrete, isDisparando } = useAgendaWebhook();
  const { fields: formFieldDefs } = useAgendaFormFields(agendaConfigId ?? undefined);
  const { users } = useUsers();
  const normalizedSearchTerm = (searchTerm ?? '').trim().toLowerCase();
  const respostaParsedSelected = useMemo(
    () => parseRespostaFormulario(selectedReuniao?.resposta_formulario ?? null),
    [selectedReuniao?.resposta_formulario]
  );
  const formResponseItemsSelected = useMemo(
    () => buildFormResponseDisplayItems(selectedReuniao?.resposta_formulario ?? null, formFieldDefs),
    [selectedReuniao?.resposta_formulario, formFieldDefs],
  );

  // Mantém o rascunho de titulares alinhado à reunião aberta
  const openReuniaoDetail = (reuniao: AgendaReuniao) => {
    setSelectedReuniao(reuniao);
    setTitularesDraft(reuniao.titular_ids ?? null);
  };

  const telefonesDoCard = useMemo(() => {
    const list: (string | null | undefined)[] = [];
    if (selectedReuniao?.convidado_whatsapp) list.push(selectedReuniao.convidado_whatsapp);
    const telForm = respostaParsedSelected?.telefone;
    if (telForm) list.push(telForm);
    return list;
  }, [selectedReuniao?.convidado_whatsapp, respostaParsedSelected?.telefone]);
  const { data: relatoriosReunioes = [], isLoading: loadingRelatorios } = useRelatoriosReunioesByReuniao(
    selectedReuniao?.id ?? null,
    telefonesDoCard
  );

  const matchesSearchTerm = (reuniao: AgendaReuniao) => {
    if (!normalizedSearchTerm) return true;

    const respostaParsed = parseRespostaFormulario(reuniao.resposta_formulario);
    const nomeResponsavel = respostaParsed?.nome_responsavel ?? '';
    const telefoneFormulario = respostaParsed?.telefone ?? '';
    const nomeFormulario = respostaParsed?.nome_aluno ?? '';

    const searchableFields = [
      reuniao.convidado_nome ?? '',
      reuniao.convidado_whatsapp ?? '',
      nomeResponsavel,
      telefoneFormulario,
      nomeFormulario,
    ];

    return searchableFields.some((field) => field.toLowerCase().includes(normalizedSearchTerm));
  };

  // Filtrar reuniões do dia selecionado (excluir canceladas - elas vão para o card próprio)
  const reunioesDoDia = useMemo(() => {
    if (!selectedDate) return [];

    return reunioes.filter((r) => {
      if (r.status === 'cancelado') return false;
      if (!matchesSearchTerm(r)) return false;

      // Modo padrão: filtra pela data da reunião (data_hora_inicio)
      if (filterMode === 'reuniao') {
        return isSameDay(new Date(r.data_hora_inicio), selectedDate);
      }

      // Modo alternativo: filtrar pela data em que a reunião foi marcada (metadata.hora_marcacao)
      const horaMarcacao = (r.metadata_capturada as MetadataCapturada | null)?.hora_marcacao;
      if (!horaMarcacao) return false;

      const dataMarcacao =
        typeof horaMarcacao === 'string'
          ? parseISO(horaMarcacao)
          : new Date(horaMarcacao as unknown as string);

      if (isNaN(dataMarcacao.getTime())) return false;

      return isSameDay(dataMarcacao, selectedDate);
    });
  }, [reunioes, selectedDate, filterMode, normalizedSearchTerm]);

  // Próximas pendentes (a partir do dia seguinte) - sem limite, mostra todas
  const amanha = startOfDay(addDays(new Date(), 1));
  const proximasPendentes = useMemo(
    () =>
      reunioes
        .filter((r) => {
          const dataReuniao = new Date(r.data_hora_inicio);
          return (r.status === 'pendente' || r.status === 'confirmado') && dataReuniao >= amanha && matchesSearchTerm(r);
        })
        .sort((a, b) => new Date(a.data_hora_inicio).getTime() - new Date(b.data_hora_inicio).getTime()),
    [reunioes, amanha, normalizedSearchTerm]
  );

  // Reuniões canceladas (ordenadas por data de cancelamento/atualização, mais recentes primeiro)
  const reunioesCanceladas = useMemo(() => 
    reunioes
      .filter((r) => r.status === 'cancelado' && matchesSearchTerm(r))
      .sort((a, b) => new Date(b.atualizado_em).getTime() - new Date(a.atualizado_em).getTime()),
    [reunioes, normalizedSearchTerm]
  );

  const ReuniaoCard = ({ reuniao }: { reuniao: AgendaReuniao }) => {
    const dataReuniao = new Date(reuniao.data_hora_inicio);
    const isPast = isBefore(dataReuniao, now);
    const statusInfo = statusConfig[reuniao.status];
    const formPreview = summarizeFormResponses(
      buildFormResponseDisplayItems(reuniao.resposta_formulario, formFieldDefs),
    );
    const titularesLabel = formatTitularesLabel(reuniao.titular_ids, users);

    return (
      <Card 
        className={cn(
          'mb-2 cursor-pointer hover:shadow-md transition-shadow', 
          isPast && reuniao.status !== 'concluido' && 'opacity-60'
        )}
        onClick={() => openReuniaoDetail(reuniao)}
      >
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div 
              className="flex-1 min-w-0 cursor-pointer"
              onClick={() => openReuniaoDetail(reuniao)}
            >
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary" className={cn('text-xs', statusInfo.color)}>
                  {statusInfo.label}
                </Badge>
                {reuniao.tipo === 'publico' && (
                  <Badge variant="outline" className="text-xs">
                    Público
                  </Badge>
                )}
              </div>
              
              <h4 className="font-medium text-sm truncate">{reuniao.titulo}</h4>
              
              {/* Data da reunião em destaque */}
              <div className="flex items-center gap-1 mt-1 text-xs font-medium text-primary">
                <Calendar className="h-3 w-3" />
                <span>{format(dataReuniao, "d 'de' MMM", { locale: ptBR })}</span>
              </div>
              
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(dataReuniao, 'HH:mm')}
                </span>
                <span>{reuniao.duracao_minutos}min</span>
              </div>

              {reuniao.convidado_nome && (
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span className="truncate">{reuniao.convidado_nome}</span>
                </div>
              )}

              {reuniao.convidado_whatsapp && (
                <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                  <MessageSquare className="h-3 w-3" />
                  <span>{reuniao.convidado_whatsapp}</span>
                </div>
              )}

              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <Users className="h-3 w-3 shrink-0" />
                <span className="truncate">Titulares: {titularesLabel}</span>
              </div>

              {reuniao.link_video_conferencia && (
                <a
                  href={reuniao.link_video_conferencia}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 mt-1 text-xs text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Video className="h-3 w-3" />
                  <span>Entrar na reunião</span>
                </a>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <RelatorioAulaExperimentalButton reuniaoId={reuniao.id} />
              {onEdit && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(reuniao);
                  }}
                  title="Editar reunião"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              {(reuniao.status === 'pendente' || reuniao.status === 'confirmado') && (
                <>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateStatus(reuniao.id, 'concluido');
                    }}
                    title="Marcar como concluído"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateStatus(reuniao.id, 'cancelado');
                    }}
                    title="Cancelar"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {formPreview && (
            <div className="mt-2 p-2 bg-muted rounded text-xs line-clamp-2">
              <span className="font-medium">Formulário: </span>
              {formPreview}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Componente do Dialog de detalhes
  const ReuniaoDetailDialog = () => {
    if (!selectedReuniao) return null;

    const dataReuniao = new Date(selectedReuniao.data_hora_inicio);
    const statusInfo = statusConfig[selectedReuniao.status];
    const titularesSalvos = normalizeTitularIdsForSave(selectedReuniao.titular_ids, false);
    const titularesAtuais = normalizeTitularIdsForSave(titularesDraft, false);
    const titularesAlterados =
      JSON.stringify(titularesSalvos ?? null) !== JSON.stringify(titularesAtuais ?? null);

    const handleSaveTitulares = async () => {
      if (!onUpdateTitulares || !selectedReuniao) return;
      setSavingTitulares(true);
      try {
        const next = normalizeTitularIdsForSave(titularesDraft, false);
        await onUpdateTitulares(selectedReuniao.id, next);
        setSelectedReuniao({ ...selectedReuniao, titular_ids: next });
      } finally {
        setSavingTitulares(false);
      }
    };

    return (
      <Dialog open={!!selectedReuniao} onOpenChange={() => setSelectedReuniao(null)}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col overflow-hidden" aria-describedby={undefined}>
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Detalhes da Reunião
            </DialogTitle>
          </DialogHeader>

          {/* Scroll nativo (mais confiável dentro do Dialog, especialmente no mobile) */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-4 touch-pan-y">
            <div className="space-y-4 pb-4">
            {/* Status e tipo */}
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className={cn('text-sm', statusInfo.color)}>
                {statusInfo.label}
              </Badge>
              {selectedReuniao.tipo === 'publico' && (
                <Badge variant="outline">Agendamento Público</Badge>
              )}
            </div>

            {/* Título */}
            <div>
              <h3 className="font-semibold text-lg">{selectedReuniao.titulo}</h3>
              {selectedReuniao.descricao && (
                <p className="text-sm text-muted-foreground mt-1">{selectedReuniao.descricao}</p>
              )}
            </div>

            <Separator />

            {/* Data e hora */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Data</p>
                  <p className="text-sm text-muted-foreground">
                    {format(dataReuniao, "EEEE, d 'de' MMMM", { locale: ptBR })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Horário</p>
                  <p className="text-sm text-muted-foreground">
                    {format(dataReuniao, 'HH:mm')} ({selectedReuniao.duracao_minutos}min)
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Titulares */}
            <div className="space-y-3">
              <AgendaReuniaoTitularesPicker
                value={titularesDraft}
                onChange={setTitularesDraft}
                compact
              />
              {onUpdateTitulares && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full"
                  disabled={!titularesAlterados || savingTitulares}
                  onClick={() => void handleSaveTitulares()}
                >
                  {savingTitulares ? 'Salvando titulares...' : 'Salvar titulares'}
                </Button>
              )}
            </div>

            <Separator />

            {/* Informações do convidado */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <User className="h-4 w-4" />
                Informações do Convidado
              </h4>

              {selectedReuniao.convidado_nome && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedReuniao.convidado_nome}</span>
                </div>
              )}

              {selectedReuniao.convidado_whatsapp && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a 
                    href={`https://wa.me/${selectedReuniao.convidado_whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {selectedReuniao.convidado_whatsapp}
                  </a>
                </div>
              )}

              {selectedReuniao.convidado_email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a 
                    href={`mailto:${selectedReuniao.convidado_email}`}
                    className="text-primary hover:underline"
                  >
                    {selectedReuniao.convidado_email}
                  </a>
                </div>
              )}
            </div>

            {/* Link de videoconferência */}
            {selectedReuniao.link_video_conferencia && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                    <Video className="h-4 w-4" />
                    Videoconferência
                  </h4>
                  <a
                    href={selectedReuniao.link_video_conferencia}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline break-all"
                  >
                    {selectedReuniao.link_video_conferencia}
                  </a>
                </div>
              </>
            )}

            {/* Resposta do formulário */}
            {formResponseItemsSelected.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <FileText className="h-4 w-4" />
                    Respostas do Formulário
                  </h4>
                  <FormResponseFieldsList items={formResponseItemsSelected} />
                </div>
              </>
            )}

            {/* Observações */}
            {selectedReuniao.observacoes && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold mb-2">Observações</h4>
                  <p className="text-sm text-muted-foreground">{selectedReuniao.observacoes}</p>
                </div>
              </>
            )}

            {/* Informações Capturadas do Lead */}
            {selectedReuniao.metadata_capturada && Object.keys(selectedReuniao.metadata_capturada).length > 0 && (
              <MetadataCapturedDisplay metadata={selectedReuniao.metadata_capturada} />
            )}

            {/* Relatório de reuniões - dados da tabela CRM-multi-empresas>relatorios_reunioes< */}
            <Separator />
            <div className="flex flex-col gap-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <FileBarChart className="h-4 w-4" />
                Relatório de reuniões
              </h4>
              <div className="rounded-lg border bg-muted/30 overflow-hidden">
                <div className="p-3 border-b bg-muted/50 flex justify-center">
                  <img src={brandLogo} alt={brandName} className="h-8 object-contain" />
                </div>
                <div className="p-3 space-y-3 max-h-[240px] overflow-y-auto">
                  {loadingRelatorios ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
                  ) : relatoriosReunioes.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum relatório registrado para esta reunião.</p>
                  ) : (
                    relatoriosReunioes.map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => setRelatorioEmLeitura(row)}
                        className="w-full text-left rounded-md border bg-background p-3 text-sm space-y-1 hover:bg-muted/50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        {row.criado_em && (
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(row.criado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        )}
                        {row.relatorio_reunioes ? (
                          <pre className="whitespace-pre-wrap font-sans text-xs break-words line-clamp-3">
                            {row.relatorio_reunioes}
                          </pre>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                        <span className="text-xs text-primary mt-1 inline-block">Clique para ler completo</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Status do Lembrete */}
            {selectedReuniao.convidado_whatsapp && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Bell className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Lembrete</span>
                    {selectedReuniao.lembrete_enviado_em ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        Enviado em {format(new Date(selectedReuniao.lembrete_enviado_em), "dd/MM 'às' HH:mm")}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Não enviado</Badge>
                    )}
                  </div>
                  {(selectedReuniao.status === 'pendente' || selectedReuniao.status === 'confirmado') && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isDisparando}
                          onClick={() => {
                            dispararLembrete.mutate({
                              reuniao_id: selectedReuniao.id,
                              modo: 'manual'
                            });
                          }}
                        >
                          <Send className="h-4 w-4 mr-1" />
                          {isDisparando ? 'Enviando...' : 'Enviar Lembrete'}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Disparar lembrete manualmente para {selectedReuniao.convidado_whatsapp}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </>
            )}
            </div>
          </div>

          {/* Footer com botões de ação - Editar em qualquer status; Concluído/Cancelar só pendente/confirmado */}
          <div className="shrink-0 pt-4 border-t mt-2">
            <div className="flex flex-wrap gap-2">
              {onEdit && (
                <Button
                  variant="outline"
                  className="flex-1 min-w-[120px]"
                  onClick={() => {
                    onEdit(selectedReuniao);
                    setSelectedReuniao(null);
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              )}
              {(selectedReuniao.status === 'pendente' || selectedReuniao.status === 'confirmado') && (
                <>
                  <Button
                    className="flex-1 min-w-[120px] bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      onUpdateStatus(selectedReuniao.id, 'concluido');
                      setSelectedReuniao(null);
                    }}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Concluído
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1 min-w-[100px]"
                    onClick={() => {
                      onUpdateStatus(selectedReuniao.id, 'cancelado');
                      setSelectedReuniao(null);
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="space-y-4">
      {/* Dialog de detalhes */}
      <ReuniaoDetailDialog />

      {/* Popup de leitura do relatório */}
      <Dialog open={!!relatorioEmLeitura} onOpenChange={(open) => !open && setRelatorioEmLeitura(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden" aria-describedby={undefined}>
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileBarChart className="h-5 w-5" />
              Relatório de reunião
            </DialogTitle>
          </DialogHeader>
          {relatorioEmLeitura && (
            <>
              <div className="shrink-0 flex justify-center py-3 border-b bg-muted/30">
                <img src={brandLogo} alt={brandName} className="h-10 object-contain" />
              </div>
              {relatorioEmLeitura.criado_em && (
                <p className="text-sm text-muted-foreground shrink-0">
                  {format(new Date(relatorioEmLeitura.criado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
              <div className="flex-1 min-h-0 overflow-y-auto rounded-md border bg-muted/20 p-4 mt-2">
                {relatorioEmLeitura.relatorio_reunioes ? (
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed break-words">
                    {relatorioEmLeitura.relatorio_reunioes}
                  </pre>
                ) : (
                  <p className="text-muted-foreground">Sem conteúdo.</p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Tarefas do dia selecionado */}
      {selectedDate && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {isToday(selectedDate) ? 'Tarefas de Hoje' : format(selectedDate, "d 'de' MMMM", { locale: ptBR })}
              {reunioesDoDia.length > 0 && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  {reunioesDoDia.length} tarefa(s)
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {reunioesDoDia.length > 0 ? (
              <ScrollArea className="h-[320px]">
                <div className="space-y-2 pr-3">
                  {reunioesDoDia.map((reuniao) => (
                    <ReuniaoCard key={reuniao.id} reuniao={reuniao} />
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                {filterMode === 'marcacao'
                  ? 'Nenhuma reunião marcada neste dia'
                  : 'Nenhuma reunião agendada para este dia'}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Próximas pendentes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Próximas Pendentes
            {proximasPendentes.length > 0 && (
              <Badge variant="secondary" className="ml-auto text-xs">
                {proximasPendentes.length} tarefa(s)
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          {proximasPendentes.length > 0 ? (
            <ScrollArea className="h-[320px]">
              <div className="space-y-2 pr-3">
                {proximasPendentes.map((reuniao) => (
                  <ReuniaoCard key={reuniao.id} reuniao={reuniao} />
                ))}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma reunião pendente
            </p>
          )}
        </CardContent>
      </Card>

      {/* Tarefas Canceladas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Ban className="h-4 w-4 text-red-500" />
            Tarefas Canceladas
            {reunioesCanceladas.length > 0 && (
              <Badge variant="destructive" className="ml-auto text-xs">
                {reunioesCanceladas.length} tarefa(s)
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          {reunioesCanceladas.length > 0 ? (
            <ScrollArea className="h-[280px]">
              <div className="space-y-2 pr-3">
                {reunioesCanceladas.map((reuniao) => (
                  <ReuniaoCard key={reuniao.id} reuniao={reuniao} />
                ))}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma reunião cancelada
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}