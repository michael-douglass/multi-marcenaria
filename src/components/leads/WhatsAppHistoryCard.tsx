import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  RefreshCw,
  Ban,
  Maximize2,
  Minimize2,
  MessageCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useLeadWhatsAppHistory } from '@/hooks/useLeadWhatsAppHistory';
import { useUiPreferences } from '@/hooks/useUiPreferences';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ChatMessageRenderer } from './ChatMessageRenderer';
import { WhatsAppMessageInput } from './WhatsAppMessageInput';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
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

interface WhatsAppHistoryCardProps {
  telefone: string;
  leadName: string;
  vendorName?: string;
  showInput?: boolean;
}

export function WhatsAppHistoryCard({
  telefone,
  leadName,
  vendorName,
  showInput = true,
}: WhatsAppHistoryCardProps) {
  const isMobile = useIsMobile();
  const { preferences, updatePreferences } = useUiPreferences();
  const isMinimized = preferences.minimizeLeadWhatsappHistory;
  const { data, isLoading, refreshHistory } = useLeadWhatsAppHistory(telefone, !isMinimized);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isNegativando, setIsNegativando] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isNegativado, setIsNegativado] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const scrollToBottom = () => {
    // Só rola dentro do card — scrollIntoView puxava o modal inteiro para baixo.
    if (!scrollAreaRef.current) return;
    requestAnimationFrame(() => {
      if (!scrollAreaRef.current) return;
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    });
  };

  useEffect(() => {
    const checkNegativacao = async () => {
      if (!telefone) return;

      const telefoneClean = telefone.replace(/\D/g, '').trim();
      if (!telefoneClean) return;

      try {
        const telefoneNumero = BigInt(telefoneClean);
        const { data: existing, error } = await supabase
          .from('CRM-multi-empresas>negativacao_numeros<')
          .select('id')
          .eq('numeroTelefone', Number(telefoneNumero))
          .maybeSingle();

        if (error) {
          setIsNegativado(false);
          return;
        }
        setIsNegativado(!!existing);
      } catch {
        setIsNegativado(false);
      }
    };

    void checkNegativacao();
  }, [telefone]);

  useEffect(() => {
    if (!isMinimized && data?.messages?.length) {
      const timer = setTimeout(scrollToBottom, 100);
      return () => clearTimeout(timer);
    }
  }, [data?.messages, isExpanded, isMinimized]);

  const handleNegativarNumero = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const telefoneClean = telefone?.replace(/\D/g, '').trim();
    if (!telefoneClean || telefoneClean.length < 8) {
      toast.error('Número de telefone inválido');
      return;
    }

    setIsNegativando(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) throw new Error('Usuário não autenticado');

      const { data: result, error } = await supabase.functions.invoke('adicionar-numero-negativado', {
        body: { numeroTelefone: telefoneClean },
      });

      if (error) throw error;
      if (result?.success) {
        toast.success(result?.alreadyExists ? 'Número já estava negativado' : 'Número negativado');
      } else {
        throw new Error(result?.error || 'Erro ao negativar');
      }

      setShowConfirmDialog(false);
      setTimeout(async () => {
        const { data: existing } = await supabase
          .from('CRM-multi-empresas>negativacao_numeros<')
          .select('id')
          .eq('numeroTelefone', parseInt(telefoneClean, 10))
          .maybeSingle();
        setIsNegativado(!!existing);
      }, 2000);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao negativar número';
      toast.error(message);
    } finally {
      setIsNegativando(false);
    }
  };

  const formatTime = (msg: { id: number | string; criado_em?: string }) => {
    if (msg.criado_em) {
      return new Date(msg.criado_em).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    if (typeof msg.id === 'number') {
      return new Date(msg.id * 1000).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return '';
  };

  const getOriginBadge = (origem?: string) => {
    if (!origem || origem === 'n8n') return null;
    return (
      <Badge
        variant="outline"
        className={cn(
          'text-[9px] px-1 py-0 ml-1 shrink-0',
          origem === 'crm'
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
        )}
      >
        {origem === 'crm' ? 'CRM' : 'WH'}
      </Badge>
    );
  };

  const toggleExpanded = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExpanded((v) => !v);
  };

  const toggleMinimized = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isMinimized) {
      setIsExpanded(false);
    }
    void updatePreferences({ minimizeLeadWhatsappHistory: !isMinimized });
  };

  const expandFromHeader = () => {
    if (isMinimized) {
      void updatePreferences({ minimizeLeadWhatsappHistory: false });
    }
  };

  const handleMessageSent = () => {
    setTimeout(() => {
      refreshHistory();
      scrollToBottom();
    }, 500);
  };

  const expandedHeight = isMobile
    ? 'min-h-[200px] h-[min(260px,34dvh)]'
    : 'min-h-[280px] h-[min(420px,48vh)]';

  const cardContent = (
    <Card
      className={cn(
        'flex w-full min-w-0 max-w-full flex-col overflow-hidden border-[#d1d7db] bg-background transition-all duration-300',
        isExpanded ? 'h-full shadow-2xl' : 'shadow-md ring-1 ring-black/5',
        isMinimized ? 'h-auto' : expandedHeight,
      )}
    >
      <CardHeader
        className={cn(
          'shrink-0 space-y-0 border-b p-0',
          'bg-gradient-to-r from-[#075E54] to-[#128C7E]',
          'dark:from-[#1F2C34] dark:to-[#2A3942]',
          isMinimized && 'cursor-pointer border-b-0',
        )}
        onClick={isMinimized ? expandFromHeader : undefined}
        onKeyDown={
          isMinimized
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  expandFromHeader();
                }
              }
            : undefined
        }
        role={isMinimized ? 'button' : undefined}
        tabIndex={isMinimized ? 0 : undefined}
        aria-expanded={!isMinimized}
      >
        <div className="flex flex-col gap-2 p-3 sm:p-3.5">
          <div className="flex items-start justify-between gap-2 min-w-0">
            <div className="flex min-w-0 flex-1 items-start gap-2.5">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20"
                aria-hidden
              >
                <MessageCircle className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-white/75">
                  Histórico WhatsApp
                </p>
                <p className="mt-0.5 text-sm font-semibold leading-snug text-white break-words line-clamp-2">
                  {leadName}
                </p>
                {vendorName && (
                  <p className="mt-0.5 text-[11px] text-white/70 truncate">{vendorName}</p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-0.5">
              {isNegativado && (
                <Badge
                  variant="destructive"
                  className="mr-1 hidden h-6 px-1.5 text-[10px] sm:inline-flex"
                >
                  <Ban className="mr-0.5 h-3 w-3" />
                  Neg.
                </Badge>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={toggleMinimized}
                className="h-9 w-9 text-white hover:bg-white/15 hover:text-white"
                title={isMinimized ? 'Expandir histórico' : 'Minimizar histórico'}
              >
                {isMinimized ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
              </Button>
              {!isMinimized && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={toggleExpanded}
                    className="h-9 w-9 text-white hover:bg-white/15 hover:text-white"
                    title={isExpanded ? 'Recolher' : 'Tela cheia'}
                  >
                    {isExpanded ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowConfirmDialog(true);
                    }}
                    disabled={isNegativando || !telefone}
                    className="h-9 w-9 text-red-200 hover:bg-red-500/20 hover:text-white"
                    title="Negativar número"
                  >
                    {isNegativando ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Ban className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      refreshHistory();
                    }}
                    disabled={isLoading}
                    className="h-9 w-9 text-white hover:bg-white/15 hover:text-white"
                    title="Atualizar"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>

          {isNegativado && (
            <Badge variant="destructive" className="w-fit text-xs sm:hidden">
              <Ban className="mr-1 h-3 w-3" />
              Número negativado
            </Badge>
          )}
        </div>
      </CardHeader>

      {!isMinimized && (
        <>
      <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col p-0">
        <div
          ref={scrollAreaRef}
          className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#e5ddd5]"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />

          <div className="relative flex min-w-0 flex-col gap-2 p-3 sm:p-4">
            {isLoading ? (
              <div className="flex min-h-[120px] items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-[#667781]" />
              </div>
            ) : !data?.messages?.length ? (
              <div className="flex min-h-[120px] w-full items-center justify-center px-4 py-6">
                <div className="max-w-[240px] text-center">
                  <p className="text-sm font-medium text-[#3b4a54]">Nenhuma conversa encontrada</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#667781]">
                    Quando houver mensagens com este número, elas aparecerão aqui.
                  </p>
                </div>
              </div>
            ) : (
              data.messages.map((msg, index) => {
                const isLead = msg.type === 'human';
                return (
                  <div
                    key={`${msg.id}-${index}`}
                    className={cn('flex w-full min-w-0', isLead ? 'justify-start' : 'justify-end')}
                  >
                    <div
                      className="relative max-w-[min(85%,280px)] overflow-hidden rounded-lg shadow-sm sm:max-w-[75%]"
                      style={{
                        padding: '10px 12px',
                        backgroundColor: isLead ? '#ffffff' : '#dcf8c6',
                        borderTopLeftRadius: isLead ? 4 : undefined,
                        borderTopRightRadius: isLead ? undefined : 4,
                      }}
                    >
                      <div className="min-w-0 overflow-hidden text-[#111B21]">
                        <ChatMessageRenderer
                          content={msg.content}
                          type={msg.tipo_mensagem || 'texto'}
                          urlMidia={msg.url_midia}
                          fileName={msg.file_name}
                          mimeType={msg.mime_type}
                          isFromLead={isLead}
                        />
                        <div className="mt-1 flex flex-wrap items-center justify-end gap-1">
                          <span className="text-[10px] text-[#667781]">{formatTime(msg)}</span>
                          {getOriginBadge(msg.origem)}
                          {!isLead && (
                            <svg viewBox="0 0 16 11" width="14" height="10" className="text-[#53BDEB]">
                              <path
                                fill="currentColor"
                                d="M11.071.653a.75.75 0 0 1 1.058-.07l.07.07L15.35 3.804a.75.75 0 0 1 .07 1.058l-.07.07-9.151 9.15a.75.75 0 0 1-1.058.071l-.07-.07-5.15-5.15a.75.75 0 0 1 .99-1.128l.07.07L5.5 12.394 14.35 3.544l-.07-.07-3.151-3.15a.75.75 0 0 1-.07-1.058z"
                              />
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div className="h-px shrink-0" aria-hidden />
          </div>
        </div>
      </CardContent>

      {showInput && (
        <div className="shrink-0 border-t border-[#d1d7db] bg-[#f0f2f5] p-2 dark:bg-card sm:p-3">
          <WhatsAppMessageInput
            telefone={telefone}
            leadName={leadName}
            onMessageSent={handleMessageSent}
            autoFocus={isExpanded}
          />
        </div>
      )}
        </>
      )}

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-[min(100vw-2rem,28rem)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar negativação</AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              Deseja negativar o número <strong>{telefone}</strong>? Este contato deixa de receber
              mensagens automáticas da IA.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel type="button" disabled={isNegativando} className="w-full sm:w-auto">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={handleNegativarNumero}
              disabled={isNegativando}
              className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
            >
              {isNegativando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ban className="mr-2 h-4 w-4" />}
              Negativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );

  if (isExpanded && !isMinimized) {
    return createPortal(
      <div className="fixed inset-0 z-[9999]">
        <div
          className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
          onClick={toggleExpanded}
          aria-hidden
        />
        <div className="absolute inset-0 flex flex-col p-0 sm:inset-3 sm:rounded-xl sm:overflow-hidden">
          {cardContent}
        </div>
      </div>,
      document.body,
    );
  }

  return cardContent;
}
