import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Send, CalendarDays, Users, Loader2, MessageSquare, FileText } from 'lucide-react';
import { AgendaReuniao } from '@/hooks/useAgenda';
import { useAgendaWebhook } from '@/hooks/useAgendaWebhook';
import { useTemplatesDisparo } from '@/hooks/useTemplatesDisparo';
import { format, isSameDay, parseISO, startOfToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface WebhookTestDispatchProps {
  reunioes: AgendaReuniao[];
  webhookConfigured: boolean;
}

export function WebhookTestDispatch({ reunioes, webhookConfigured }: WebhookTestDispatchProps) {
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedReunioes, setSelectedReunioes] = useState<string[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [dispatching, setDispatching] = useState(false);
  
  const { dispararLembrete } = useAgendaWebhook();
  const { data: templates, isLoading: loadingTemplates } = useTemplatesDisparo();

  // Filter reuniões by selected date
  const reunioesDodia = useMemo(() => {
    if (!selectedDate) return [];
    
    return reunioes.filter((r) => {
      const reuniaoDate = parseISO(r.data_hora_inicio);
      return isSameDay(reuniaoDate, selectedDate) && 
             r.convidado_whatsapp && 
             (r.status === 'pendente' || r.status === 'confirmado');
    });
  }, [reunioes, selectedDate]);

  // Get dates that have reuniões (for calendar highlighting)
  const datasComReunioes = useMemo(() => {
    const dates = new Set<string>();
    reunioes.forEach((r) => {
      if (r.convidado_whatsapp && (r.status === 'pendente' || r.status === 'confirmado')) {
        dates.add(format(parseISO(r.data_hora_inicio), 'yyyy-MM-dd'));
      }
    });
    return dates;
  }, [reunioes]);

  const toggleReuniao = (id: string) => {
    setSelectedReunioes((prev) => 
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const toggleTodos = () => {
    if (selectedReunioes.length === reunioesDodia.length) {
      setSelectedReunioes([]);
    } else {
      setSelectedReunioes(reunioesDodia.map((r) => r.id));
    }
  };

  const handleDispatch = async () => {
    if (selectedReunioes.length === 0) {
      toast.warning('Selecione pelo menos uma reunião para disparar');
      return;
    }

    if (!selectedTemplateId) {
      toast.warning('Selecione um template de mensagem');
      return;
    }

    setDispatching(true);
    let successCount = 0;
    let errorCount = 0;

    for (const reuniaoId of selectedReunioes) {
      try {
        await dispararLembrete.mutateAsync({ 
          reuniao_id: reuniaoId, 
          modo: 'manual',
          template_id: parseInt(selectedTemplateId)
        });
        successCount++;
      } catch (error) {
        errorCount++;
        console.error('Erro ao disparar para:', reuniaoId, error);
      }
    }

    setDispatching(false);
    
    if (successCount > 0 && errorCount === 0) {
      toast.success(`${successCount} mensagem(ns) disparada(s) com sucesso!`);
    } else if (successCount > 0 && errorCount > 0) {
      toast.warning(`${successCount} enviado(s), ${errorCount} erro(s)`);
    }

    // Reset selection
    setSelectedReunioes([]);
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedReunioes([]);
  };

  const selectedTemplate = templates?.find(t => t.id.toString() === selectedTemplateId);

  if (!webhookConfigured) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Send className="h-4 w-4" />
          Testar Disparo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-5 w-5 text-primary" />
            Teste de Disparo de Webhook
          </DialogTitle>
          <DialogDescription className="text-xs">
            Selecione um template, data e reuniões para disparar
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4">
          <div className="space-y-4 pb-4">
            {/* Template Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Template de Mensagem
              </Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={loadingTemplates ? "Carregando..." : "Selecione um template"} />
                </SelectTrigger>
                <SelectContent>
                  {templates?.map((template) => (
                    <SelectItem key={template.id} value={template.id.toString()}>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {template.titulo || `Template #${template.id}`}
                      </div>
                    </SelectItem>
                  ))}
                  {templates?.length === 0 && (
                    <div className="py-2 px-2 text-sm text-muted-foreground text-center">
                      Nenhum template encontrado
                    </div>
                  )}
                </SelectContent>
              </Select>
              {selectedTemplate?.mensagem && (
                <div className="p-2 bg-muted/50 rounded-md text-xs text-muted-foreground max-h-20 overflow-auto">
                  {selectedTemplate.mensagem.substring(0, 150)}
                  {selectedTemplate.mensagem.length > 150 && '...'}
                </div>
              )}
            </div>

            {/* Calendar */}
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                locale={ptBR}
                className="rounded-md border"
                modifiers={{
                  hasReunioes: (date) => datasComReunioes.has(format(date, 'yyyy-MM-dd')),
                }}
                modifiersStyles={{
                  hasReunioes: {
                    fontWeight: 'bold',
                    backgroundColor: 'hsl(var(--primary) / 0.1)',
                    color: 'hsl(var(--primary))',
                  },
                }}
                fromDate={startOfToday()}
              />
            </div>

            {/* Reuniões List */}
            {selectedDate && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Reuniões em {format(selectedDate, "dd/MM", { locale: ptBR })}
                  </Label>
                  {reunioesDodia.length > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs h-7 px-2"
                      onClick={toggleTodos}
                    >
                      {selectedReunioes.length === reunioesDodia.length ? 'Desmarcar todos' : 'Selecionar todos'}
                    </Button>
                  )}
                </div>

                {reunioesDodia.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Nenhuma reunião com WhatsApp nesta data
                  </p>
                ) : (
                  <ScrollArea className="max-h-48 rounded-md border">
                    <div className="p-2 space-y-2">
                      {reunioesDodia.map((reuniao) => (
                        <div 
                          key={reuniao.id}
                          className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                          onClick={() => toggleReuniao(reuniao.id)}
                        >
                          <Checkbox
                            id={reuniao.id}
                            checked={selectedReunioes.includes(reuniao.id)}
                            onCheckedChange={() => toggleReuniao(reuniao.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {reuniao.convidado_nome || 'Sem nome'}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {format(parseISO(reuniao.data_hora_inicio), 'HH:mm')}
                              </Badge>
                              <span className="text-xs text-muted-foreground truncate">
                                {reuniao.convidado_whatsapp}
                              </span>
                            </div>
                            {reuniao.lembrete_enviado_em && (
                              <p className="text-xs text-amber-600 mt-1">
                                Já enviado em {format(parseISO(reuniao.lembrete_enviado_em), 'dd/MM HH:mm')}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer with action button */}
        {selectedDate && reunioesDodia.length > 0 && (
          <div className="p-4 border-t bg-muted/30 shrink-0">
            <Button 
              className="w-full gap-2" 
              onClick={handleDispatch}
              disabled={selectedReunioes.length === 0 || !selectedTemplateId || dispatching}
            >
              {dispatching ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Disparando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Disparar para {selectedReunioes.length} selecionado(s)
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
