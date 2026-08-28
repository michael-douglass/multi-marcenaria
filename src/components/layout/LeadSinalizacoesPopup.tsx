import { X, Flag, Clock, ExternalLink, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { floatingPopupMaxHeightStyle, floatingPopupPositionClass } from '@/lib/floating-ui-layout';
import type { LeadSinalizacao } from '@/hooks/useLeadSinalizacoes';

interface LeadSinalizacoesPopupProps {
  sinalizacoes: LeadSinalizacao[];
  isOpen: boolean;
  onMinimize: () => void;
  onFechar: (id: string) => void;
  onFecharTodas: () => void;
  onAbrirLead: (leadId: number) => void;
}

export function LeadSinalizacoesPopup({
  sinalizacoes,
  isOpen,
  onMinimize,
  onFechar,
  onFecharTodas,
  onAbrirLead,
}: LeadSinalizacoesPopupProps) {
  if (!isOpen) return null;

  return (
    <div
      className={cn(
        floatingPopupPositionClass,
        'w-[min(360px,calc(100vw-2rem))] h-[min(420px,calc(100vh-8.5rem))]',
        'bg-background/95 backdrop-blur-md border border-amber-500/40 rounded-xl shadow-xl',
        'flex flex-col duration-300 animate-in slide-in-from-right-5 fade-in',
      )}
      style={floatingPopupMaxHeightStyle}
      role="dialog"
      aria-label="Leads sinalizados"
    >
      <div className="flex items-center justify-between p-2.5 border-b bg-amber-500/15 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-amber-500 rounded-full">
            <Flag className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-semibold text-xs">Leads sinalizados</span>
          <Badge variant="secondary" className="h-5 px-1.5 text-xs">
            {sinalizacoes.length}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          {sinalizacoes.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[10px] px-2"
              onClick={onFecharTodas}
            >
              Fechar todos
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onMinimize();
            }}
            title="Ocultar painel"
            aria-label="Ocultar painel de sinalizações"
          >
            <Minus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {sinalizacoes.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground p-6">
          <p className="text-sm text-center">Nenhuma sinalização pendente</p>
        </div>
      ) : (
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-2 space-y-2">
            {sinalizacoes.map((item) => (
              <div
                key={item.id}
                className="relative rounded-lg border border-amber-500/30 bg-card/90 p-3 shadow-sm"
              >
                <button
                  type="button"
                  className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted"
                  title="Fechar (não aparece novamente)"
                  onClick={() => onFechar(item.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>

                <p className="font-semibold text-sm pr-8 truncate">{item.lead_nome}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  <Badge
                    variant="secondary"
                    className="text-[10px] h-5 bg-amber-500/15 text-amber-900 dark:text-amber-100"
                  >
                    {item.enviado_para_todos ? 'Para todos os titulares' : 'Para você (titular)'}
                  </Badge>
                  {item.lead_status && (
                    <Badge variant="outline" className="text-[10px] h-5">
                      {item.lead_status}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Sinalizado por <strong>{item.sinalizado_por_nome}</strong>
                </p>
                {item.mensagem?.trim() && (
                  <p className="text-sm mt-2 rounded-md border border-amber-500/25 bg-amber-500/10 px-2.5 py-2 text-foreground whitespace-pre-wrap break-words">
                    {item.mensagem.trim()}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(item.criado_em), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </p>

                <Button
                  size="sm"
                  className="w-full mt-3 h-8 gap-1.5"
                  onClick={() => {
                    onFechar(item.id);
                    onAbrirLead(item.lead_id);
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Entrar no card
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
