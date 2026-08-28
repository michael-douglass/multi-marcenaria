import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Bell,
  CalendarCheck,
  CalendarPlus,
  CheckCircle2,
  MoreHorizontal,
  Share2,
  Trash2,
  XCircle,
} from 'lucide-react';
import { LeadSinalizarButton } from '@/components/leads/LeadSinalizarButton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface LeadMeetingInfo {
  data_hora_inicio: string;
}

interface LeadModalFooterProps {
  formId: string;
  leadId?: number | null;
  leadName?: string;
  leadStatus?: string | null;
  isEditable: boolean;
  isSubmitting: boolean;
  currentUserRole: string;
  leadMeeting?: LeadMeetingInfo | null;
  onClose: () => void;
  onMarkAsWon: () => void;
  onMarkAsLost: () => void;
  onDelete: () => void;
  onScheduleMeeting: () => void;
  onLembrete: () => void;
  onShare: () => void;
  isNewLead: boolean;
  /** Exibe botão Salvar (ex.: lead existente só após clicar no lápis de algum campo) */
  showSaveButton?: boolean;
  hideDelete?: boolean;
}

function ActionRow({
  children,
  onClick,
  variant = 'default',
  className,
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'primary' | 'amber';
  className?: string;
}) {
  const variants = {
    default: 'border-border hover:bg-muted/80',
    destructive: 'border-destructive/30 text-destructive hover:bg-destructive/10',
    primary: 'border-primary/40 text-primary hover:bg-primary/10',
    amber: 'border-amber-500/40 text-amber-800 hover:bg-amber-50 dark:text-amber-200 dark:hover:bg-amber-950/40',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-sm font-medium transition-colors active:scale-[0.99]',
        variants[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function LeadModalFooter({
  formId,
  leadId,
  leadName,
  leadStatus,
  isEditable,
  isSubmitting,
  currentUserRole,
  leadMeeting,
  onClose,
  onMarkAsWon,
  onMarkAsLost,
  onDelete,
  onScheduleMeeting,
  onLembrete,
  onShare,
  isNewLead,
  showSaveButton = isEditable,
  hideDelete = false,
}: LeadModalFooterProps) {
  const isMobile = useIsMobile();
  const [actionsOpen, setActionsOpen] = useState(false);

  const canEditSales =
    Boolean(leadId) && isEditable && (currentUserRole === 'ADMIN' || currentUserRole === 'VENDEDOR');
  const canDelete = Boolean(leadId) && isEditable && currentUserRole === 'ADMIN' && !hideDelete;
  const hasSecondaryActions =
    canEditSales || canDelete || (leadId && !leadMeeting) || Boolean(leadId);

  const closeActions = (fn: () => void) => () => {
    setActionsOpen(false);
    fn();
  };

  const meetingBanner = leadMeeting ? (
    <div className="flex items-center gap-2 mb-3 p-2.5 bg-primary/10 rounded-lg border border-primary/20">
      <CalendarCheck className="h-4 w-4 text-primary shrink-0" />
      <span className="text-xs sm:text-sm font-medium text-primary leading-snug">
        Reunião: {format(new Date(leadMeeting.data_hora_inicio), "dd/MM 'às' HH:mm", { locale: ptBR })}
      </span>
    </div>
  ) : null;

  const desktopButtons = (
    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:justify-end w-full min-w-0">
      {canEditSales && (
        <Button
          type="button"
          variant="outline"
          onClick={onMarkAsLost}
          disabled={isSubmitting}
          className="w-full sm:w-auto text-xs sm:text-sm"
        >
          <XCircle className="h-4 w-4 mr-2" />
          Marcar como Perdido
        </Button>
      )}
      {canDelete && (
        <Button
          type="button"
          variant="destructive"
          onClick={onDelete}
          disabled={isSubmitting}
          className="w-full sm:w-auto text-xs sm:text-sm"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Excluir
        </Button>
      )}
      {leadId && isEditable && (
        <Button
          type="button"
          variant="default"
          onClick={onMarkAsWon}
          disabled={isSubmitting}
          className="w-full sm:w-auto text-xs sm:text-sm"
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Marcar como Ganho
        </Button>
      )}
      {leadId && isEditable && !leadMeeting && (
        <Button
          type="button"
          variant="outline"
          onClick={onScheduleMeeting}
          disabled={isSubmitting}
          className="w-full sm:w-auto text-xs sm:text-sm border-primary/50 text-primary hover:bg-primary/10"
        >
          <CalendarPlus className="h-4 w-4 mr-2" />
          Agendar Reunião
        </Button>
      )}
      {leadId && (
        <Button
          type="button"
          variant="outline"
          onClick={onLembrete}
          disabled={isSubmitting}
          className="w-full sm:w-auto text-xs sm:text-sm border-amber-500/50 text-amber-700 hover:bg-amber-50"
        >
          <Bell className="h-4 w-4 mr-2" />
          Lembrete
        </Button>
      )}
      {leadId && (
        <LeadSinalizarButton
          leadId={leadId}
          leadNome={leadName || 'Lead'}
          leadStatus={leadStatus}
          size="default"
          className="w-full sm:w-auto h-9 text-xs sm:text-sm px-3"
        />
      )}
      <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting} className="w-full sm:w-auto">
        Cancelar
      </Button>
      {showSaveButton && (
        <Button type="submit" form={formId} disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting ? 'Salvando...' : isNewLead ? 'Criar Lead' : 'Salvar'}
        </Button>
      )}
    </div>
  );

  if (!isMobile) {
    return (
      <div className="bg-background border-t px-4 py-3 shrink-0">
        {meetingBanner}
        {desktopButtons}
      </div>
    );
  }

  return (
    <div className="bg-background/95 backdrop-blur-sm border-t px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shrink-0 shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.12)]">
      {meetingBanner}

      <div className="flex gap-2 items-stretch">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isSubmitting}
          className="flex-1 h-11 text-sm"
        >
          Cancelar
        </Button>

        {showSaveButton && (
          <Button type="submit" form={formId} disabled={isSubmitting} className="flex-1 h-11 text-sm font-semibold">
            {isSubmitting ? '...' : isNewLead ? 'Criar' : 'Salvar'}
          </Button>
        )}

        {hasSecondaryActions && (
          <Sheet open={actionsOpen} onOpenChange={setActionsOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                className="h-11 w-12 shrink-0 px-0"
                aria-label="Abrir menu de ações"
              >
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="rounded-t-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] max-h-[85dvh]"
            >
              <SheetHeader className="text-left pb-2">
                <SheetTitle className="text-base">Ações do lead</SheetTitle>
                <SheetDescription className="text-xs truncate">{leadName || 'Lead'}</SheetDescription>
              </SheetHeader>

              <div className="grid gap-2 pt-2 overflow-y-auto max-h-[60dvh]">
                {leadId && isEditable && (
                  <ActionRow onClick={closeActions(onMarkAsWon)} variant="primary">
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                    Marcar como Ganho
                  </ActionRow>
                )}
                {canEditSales && (
                  <ActionRow onClick={closeActions(onMarkAsLost)}>
                    <XCircle className="h-5 w-5 shrink-0" />
                    Marcar como Perdido
                  </ActionRow>
                )}
                {leadId && isEditable && !leadMeeting && (
                  <ActionRow onClick={closeActions(onScheduleMeeting)} variant="primary">
                    <CalendarPlus className="h-5 w-5 shrink-0" />
                    Agendar Reunião
                  </ActionRow>
                )}
                {leadId && (
                  <ActionRow onClick={closeActions(onLembrete)} variant="amber">
                    <Bell className="h-5 w-5 shrink-0" />
                    Marcar lembrete
                  </ActionRow>
                )}
                {leadId && (
                  <div className="w-full" onClick={() => setActionsOpen(false)}>
                    <LeadSinalizarButton
                      leadId={leadId}
                      leadNome={leadName || 'Lead'}
                      leadStatus={leadStatus}
                      className="w-full h-11 text-sm justify-center"
                    />
                  </div>
                )}
                {leadId && (
                  <ActionRow onClick={closeActions(onShare)}>
                    <Share2 className="h-5 w-5 shrink-0" />
                    Compartilhar link
                  </ActionRow>
                )}
                {canDelete && (
                  <ActionRow onClick={closeActions(onDelete)} variant="destructive">
                    <Trash2 className="h-5 w-5 shrink-0" />
                    Excluir lead
                  </ActionRow>
                )}
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>

      {hasSecondaryActions && (
        <p className="text-[10px] text-center text-muted-foreground mt-2">
          Toque em <span className="font-medium">⋯</span> para ganho, perda, reunião e mais
        </p>
      )}
    </div>
  );
}
