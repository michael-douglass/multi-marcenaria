import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Phone,
  Mail,
  MapPin,
  Calendar as CalIcon,
  MessageSquare,
  ExternalLink,
  FileText,
  Loader2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLeadCrmChatPreview } from '@/hooks/useLeadCrmChatPreview';
import { ChatMessageRenderer } from '@/components/leads/ChatMessageRenderer';

export interface LeadQuickPeekSummary {
  id: number;
  nome: string;
  telefone: string | null;
  email: string | null;
  empresa?: string | null;
  status: string | null;
  origem: string | null;
  regiao: string | null;
  observacoes: string | null;
  data_chegada: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: LeadQuickPeekSummary | null;
}

export function LeadQuickPeekDialog({ open, onOpenChange, lead }: Props) {
  const navigate = useNavigate();
  const { data: messages = [], isLoading: loadingChat, isError: chatError } = useLeadCrmChatPreview(
    lead?.telefone ?? null,
    open && !!lead
  );

  const goPipeline = () => {
    if (!lead) return;
    onOpenChange(false);
    navigate(`/pipeline?id=${lead.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="z-[60] flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
        aria-describedby={undefined}
      >
        <DialogHeader className="shrink-0 border-b px-4 py-3 text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4 text-primary" />
            Lead — visão rápida
          </DialogTitle>
          {lead && (
            <DialogDescription className="truncate text-sm font-medium text-foreground">
              {lead.nome}
            </DialogDescription>
          )}
        </DialogHeader>

        {!lead ? (
          <div className="p-4 text-sm text-muted-foreground">Carregando dados do lead…</div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <div className="w-full shrink-0 space-y-3 border-b md:w-[280px] md:border-b-0 md:border-r p-4">
              <div className="flex flex-wrap items-center gap-1.5">
                {lead.status && (
                  <Badge variant="secondary" className="text-[10px]">
                    {lead.status}
                  </Badge>
                )}
                {lead.origem && (
                  <Badge variant="outline" className="text-[10px]">
                    {lead.origem}
                  </Badge>
                )}
              </div>
              <div className="space-y-2 text-[11px] text-muted-foreground">
                {lead.telefone && (
                  <p className="flex items-center gap-1.5 break-all">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    {lead.telefone}
                  </p>
                )}
                {lead.email && (
                  <p className="flex items-center gap-1.5 truncate">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    {lead.email}
                  </p>
                )}
                {lead.regiao && (
                  <p className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {lead.regiao}
                  </p>
                )}
                {lead.data_chegada && (
                  <p className="flex items-center gap-1.5">
                    <CalIcon className="h-3.5 w-3.5 shrink-0" />
                    {format(parseISO(lead.data_chegada), 'dd/MM/yyyy', { locale: ptBR })}
                  </p>
                )}
                {lead.empresa && (
                  <p className="truncate text-foreground/90" title={lead.empresa}>
                    Empresa: {lead.empresa}
                  </p>
                )}
              </div>
              {lead.observacoes && (
                <div className="rounded-md border bg-muted/30 p-2">
                  <div className="mb-1 flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                    <FileText className="h-3 w-3" />
                    Observações
                  </div>
                  <p className="max-h-24 overflow-y-auto text-[11px] whitespace-pre-wrap break-words">
                    {lead.observacoes}
                  </p>
                </div>
              )}
              <Button type="button" variant="outline" size="sm" className="w-full gap-1.5" onClick={goPipeline}>
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir pipeline completo
              </Button>
              <p className="text-[10px] text-muted-foreground">
                Esta visão mostra só o CRM (últimas 120 mensagens). O pipeline completo inclui histórico unificado (n8n + CRM).
              </p>
            </div>

            <div className="flex min-h-[200px] min-w-0 flex-1 flex-col bg-muted/20 md:min-h-[320px]">
              <div className="flex items-center justify-between border-b px-3 py-2">
                <span className="text-xs font-medium text-muted-foreground">Conversa (CRM)</span>
                {loadingChat && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              </div>
              <ScrollArea className="h-[min(50vh,420px)] md:h-full md:max-h-[min(60vh,520px)]">
                <div className="space-y-2 p-3">
                  {loadingChat && (
                    <div className="space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-3/4" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  )}
                  {chatError && (
                    <p className="text-xs text-destructive">Não foi possível carregar o histórico agora.</p>
                  )}
                  {!loadingChat && !chatError && messages.length === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhuma mensagem no CRM para este número.</p>
                  )}
                  {!loadingChat &&
                    messages.map((msg) => {
                      const isFromLead = msg.tipo_remetente === 'lead';
                      return (
                        <div key={msg.id} className="rounded-md border bg-background p-2 text-xs shadow-sm">
                          <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                            <span>{isFromLead ? 'Lead' : 'Equipe / sistema'}</span>
                            <span>
                              {format(parseISO(msg.criado_em), "dd/MM HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          <ChatMessageRenderer
                            content={msg.conteudo || ''}
                            type={msg.tipo_mensagem || 'texto'}
                            urlMidia={msg.url_midia}
                            fileName={msg.file_name}
                            mimeType={msg.mime_type}
                            isFromLead={isFromLead}
                          />
                        </div>
                      );
                    })}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
