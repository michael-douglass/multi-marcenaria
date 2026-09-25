import { useCallback, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, Lock, Send, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { LeadAIFormattedContent } from '@/lib/lead-ai-formatted-content';
import { IRIS_SKY_AGENT, IRIS_SKY_SUGGESTED_PROMPTS } from '@/lib/iris-sky-agent';
import { usePipelineLeadAIConfig } from '@/hooks/usePipelineLeadAIConfig';
import {
  useClearLeadSkyChat,
  useLeadKnowledgeMeta,
  useLeadSkyChatMessages,
  useSendLeadSkyChatMessage,
  type LeadSkyChatMessage,
} from '@/hooks/useLeadSkyChat';
import { cn } from '@/lib/utils';
import type { IrisActiveSpot } from '@/lib/iris-spot-session';
import { Crosshair, X } from 'lucide-react';

interface LeadSkyChatPanelProps {
  leadId: number;
  analiseId?: string | null;
  leadName?: string;
  leadOrigin?: string;
  hasAnalysis: boolean;
  variant?: 'embedded' | 'fullscreen';
  compactHeader?: boolean;
  className?: string;
  externalIsSending?: boolean;
  activeSpot?: IrisActiveSpot | null;
  onClearActiveSpot?: () => void;
  registerFocus?: (focus: (() => void) | null) => void;
}

function IrisAvatar({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-xs';
  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-full font-semibold text-mahogany-deep',
        'bg-gradient-to-br from-gold via-amber-300 to-gold/80 shadow-lg shadow-gold/20',
        dim,
      )}
      aria-hidden
    >
      <span className="relative z-10">Í</span>
      <div className="absolute inset-0 rounded-full bg-gold/30 blur-md" />
    </div>
  );
}

function MessageBubble({
  message,
  variant,
}: {
  message: LeadSkyChatMessage;
  variant: 'embedded' | 'fullscreen';
}) {
  const isUser = message.role === 'user';
  const time = format(new Date(message.criadoEm), 'HH:mm', { locale: ptBR });

  return (
    <div
      className={cn(
        'flex gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300',
        isUser ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      {!isUser && <IrisAvatar size="sm" />}
      <div
        className={cn(
          'max-w-[88%] min-w-0 space-y-1',
          isUser ? 'items-end' : 'items-start',
        )}
      >
        <div
          className={cn(
            'rounded-2xl px-3.5 py-2.5 shadow-sm',
            isUser
              ? 'rounded-tr-md bg-gold/20 border border-gold/30 text-cream-secondary'
              : 'rounded-tl-md bg-mahogany-elevated/90 border border-gold-border-subtle/25 text-cream-secondary',
          )}
        >
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          ) : (
            <LeadAIFormattedContent
              content={message.content}
              className={cn('text-sm', variant === 'fullscreen' && 'text-base')}
            />
          )}
        </div>
        <p
          className={cn(
            'text-[10px] tabular-nums text-cream-muted px-1',
            isUser ? 'text-right' : 'text-left',
          )}
        >
          {time}
        </p>
      </div>
    </div>
  );
}

export function LeadSkyChatPanel({
  leadId,
  analiseId,
  leadName,
  leadOrigin,
  hasAnalysis,
  variant = 'embedded',
  compactHeader = false,
  className,
  externalIsSending = false,
  activeSpot = null,
  onClearActiveSpot,
  registerFocus,
}: LeadSkyChatPanelProps) {
  const [draft, setDraft] = useState('');
  const [clearOpen, setClearOpen] = useState(false);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: messages = [], isLoading } = useLeadSkyChatMessages(leadId);
  const { config: aiConfig, isLoading: aiConfigLoading } = usePipelineLeadAIConfig();
  const { data: knowledgeMeta } = useLeadKnowledgeMeta(
    aiConfig.irisSkyKnowledgeAtivo ? leadId : null,
  );
  const sendMessage = useSendLeadSkyChatMessage();
  const clearChat = useClearLeadSkyChat(leadId);

  const isSending = sendMessage.isPending || externalIsSending;
  const chatEnabled = hasAnalysis && aiConfig.irisSkyAtivo;
  const isIndexing =
    aiConfig.irisSkyKnowledgeAtivo && knowledgeMeta?.status === 'indexing';

  const scrollMessagesToBottom = useCallback(() => {
    const viewport = messagesScrollRef.current?.closest(
      '[data-radix-scroll-area-viewport]',
    ) as HTMLElement | null;
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (isLoading || (messages.length === 0 && !isSending)) return;
    scrollMessagesToBottom();
  }, [isLoading, isSending, messages.length, scrollMessagesToBottom]);

  useEffect(() => {
    registerFocus?.(() => textareaRef.current?.focus());
    return () => registerFocus?.(null);
  }, [registerFocus]);

  const handleSend = useCallback(
    async (text?: string) => {
      const content = (text ?? draft).trim();
      if (!content || !chatEnabled || isSending) return;

      setDraft('');
      await sendMessage.mutateAsync({
        leadId,
        analiseId,
        message: content,
        leadName,
        leadOrigin,
        spotContext: activeSpot
          ? {
              mediaLabel: activeSpot.mediaLabel,
              normalizedX: activeSpot.normalizedX,
              normalizedY: activeSpot.normalizedY,
              pdfPageNumber: activeSpot.pdfPageNumber,
              spotDescription: activeSpot.spotDescription,
              ...(activeSpot.cropBase64 ? { cropBase64: activeSpot.cropBase64 } : {}),
            }
          : undefined,
      });
      textareaRef.current?.focus();
    },
    [activeSpot, analiseId, chatEnabled, draft, isSending, leadId, leadName, leadOrigin, sendMessage],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      {!compactHeader ? (
      <div className="shrink-0 border-b border-gold-border-subtle/20 px-4 py-3 sm:px-5 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <IrisAvatar />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-cream-secondary truncate">
                {IRIS_SKY_AGENT.name}
              </p>
              <p className="text-[11px] text-cream-muted truncate">{IRIS_SKY_AGENT.tagline}</p>
            </div>
          </div>
          {messages.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-cream-muted hover:text-destructive hover:bg-destructive/10"
              onClick={() => setClearOpen(true)}
              disabled={clearChat.isPending}
              aria-label="Limpar histórico do chat"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="text-[10px] gap-1 border-gold/30 text-gold bg-gold/5"
          >
            <Lock className="h-3 w-3" />
            Conversa privada
          </Badge>
          <span className="text-[10px] text-cream-muted">
            {IRIS_SKY_AGENT.subtitle}
            {knowledgeMeta?.chunkCount ? ` · ${knowledgeMeta.chunkCount} trechos indexados` : ''}
          </span>
        </div>
      </div>
      ) : (
      <div className="shrink-0 flex items-center justify-between gap-2 border-b border-gold-border-subtle/15 px-3 py-2 sm:px-4">
        <div className="flex items-center gap-2 min-w-0">
          <Badge
            variant="outline"
            className="text-[10px] gap-1 border-gold/30 text-gold bg-gold/5 shrink-0"
          >
            <Lock className="h-3 w-3" />
            Privado
          </Badge>
          <span className="text-[10px] text-cream-muted truncate">
            {IRIS_SKY_AGENT.subtitle}
            {knowledgeMeta?.chunkCount ? ` · ${knowledgeMeta.chunkCount} trechos` : ''}
          </span>
        </div>
        {messages.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-cream-muted hover:text-destructive hover:bg-destructive/10"
            onClick={() => setClearOpen(true)}
            disabled={clearChat.isPending}
            aria-label="Limpar histórico do chat"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      )}

      <ScrollArea className="min-h-0 flex-1">
        <div ref={messagesScrollRef} className="px-4 py-4 sm:px-5 space-y-4">
          {!hasAnalysis ? (
            <div className="rounded-xl border border-dashed border-gold-border-subtle/30 bg-mahogany-muted/30 px-4 py-8 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-gold/50 mb-3" />
              <p className="text-sm text-cream-muted">
                Gere uma análise visual primeiro. A Íris Sky usa o relatório para conversar com você.
              </p>
            </div>
          ) : !aiConfig.irisSkyAtivo && !aiConfigLoading ? (
            <div className="rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 px-4 py-8 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-amber-500/50 mb-3" />
              <p className="text-sm text-cream-muted">
                O chat Íris Sky está desativado. Um administrador pode reativar em Pipeline →
                Configurações → aba IA.
              </p>
            </div>
          ) : isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-[75%] rounded-2xl" />
              <Skeleton className="h-12 w-[60%] rounded-2xl ml-auto" />
              <Skeleton className="h-20 w-[80%] rounded-2xl" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex min-h-0 flex-1 flex-col justify-center gap-4 py-4">
              <div className="flex items-start gap-3">
                <IrisAvatar />
                <p className="text-sm text-cream-secondary/90 leading-relaxed pt-1">
                  Li o relatório deste lead. Clique em um ponto de qualquer anexo à esquerda — a Íris
                  identifica o trecho e pergunta o que você quer saber. Depois é só digitar aqui.
                </p>
              </div>
              <div className="space-y-2 pl-12">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold/80">
                  Sugestões
                </p>
                <div className="grid gap-2 sm:grid-cols-1">
                  {IRIS_SKY_SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void handleSend(prompt)}
                      disabled={isSending}
                      className={cn(
                        'text-left rounded-xl border border-gold-border-subtle/25 bg-mahogany-card/50',
                        'px-3.5 py-2.5 text-xs text-cream-secondary transition-all',
                        'hover:border-gold/40 hover:bg-gold/5 hover:shadow-sm hover:shadow-gold/5',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50',
                      )}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} variant={variant} />
            ))
          )}

          {isIndexing && (
            <div className="flex items-center gap-2 text-[10px] text-cream-muted px-1">
              <Loader2 className="h-3 w-3 animate-spin text-gold" />
              Indexando documentos e dados do lead…
            </div>
          )}

          {isSending && (
            <div className="flex items-center gap-2.5 animate-in fade-in duration-200">
              <IrisAvatar size="sm" />
              <div className="flex items-center gap-2 rounded-2xl rounded-tl-md border border-gold-border-subtle/25 bg-mahogany-elevated/80 px-3.5 py-2.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold/60 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
                </span>
                <span className="text-xs text-cream-muted">Íris está pensando…</span>
              </div>
            </div>
          )}

        </div>
      </ScrollArea>

      <div className="shrink-0 border-t border-gold-border-subtle/20 bg-mahogany-panel/60 px-3 py-3 sm:px-4 space-y-2">
        {activeSpot && (
          <div className="flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/5 px-2.5 py-1.5">
            <Crosshair className="h-3.5 w-3.5 shrink-0 text-gold" aria-hidden />
            <p className="min-w-0 flex-1 text-[11px] text-cream-secondary truncate">
              Ponto ativo: <span className="text-gold font-medium">{activeSpot.shortLabel}</span>
            </p>
            {onClearActiveSpot && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-cream-muted hover:text-cream-secondary"
                onClick={onClearActiveSpot}
                aria-label="Limpar ponto selecionado"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              chatEnabled
                ? activeSpot
                  ? `Pergunte sobre "${activeSpot.shortLabel}"…`
                  : 'Pergunte sobre o projeto… (Enter envia, Shift+Enter quebra linha)'
                : hasAnalysis
                  ? 'Chat Íris Sky desativado nas configurações'
                  : 'Análise necessária para conversar'
            }
            disabled={!chatEnabled || isSending}
            rows={2}
            className={cn(
              'min-h-[44px] max-h-32 resize-none text-sm',
              'bg-mahogany-muted/40 border-gold-border-subtle/30',
              'focus-visible:ring-gold/40 placeholder:text-cream-muted/60',
            )}
          />
          <Button
            type="button"
            size="icon"
            onClick={() => void handleSend()}
            disabled={!chatEnabled || !draft.trim() || isSending}
            className="h-10 w-10 shrink-0 bg-gold/90 text-mahogany-deep hover:bg-gold"
            aria-label="Enviar mensagem"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar conversa com Íris Sky?</AlertDialogTitle>
            <AlertDialogDescription>
              O histórico deste cliente será removido apenas para você. O relatório e o briefing não
              serão alterados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clearChat.mutate();
                setClearOpen(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Limpar histórico
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
