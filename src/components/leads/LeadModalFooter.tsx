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
import { LeadMoveToEnviouOrcamentoButton } from '@/components/leads/LeadMoveToEnviouOrcamentoButton';
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
  /** Sincroniza o status do formulário após o atalho "Orçamento enviado". */
  onMovedToEnviouOrcamento?: (status: string) => void;
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

function FooterDivider({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'hidden sm:block h-7 w-px shrink-0 bg-[var(--lead-line,rgba(80,52,24,0.22))] self-center',
        className,
      )}
    />
  );
}

function FooterCluster({
  children,
  label,
  className,
}: {
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'lead-modal-footer-cluster flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0',
        className,
      )}
      role="group"
      aria-label={label}
    >
      {children}
    </div>
  );
}

const footerBtnBase =
  'lead-modal-footer-btn h-10 rounded-lg text-xs sm:text-sm font-medium tracking-wide transition-[transform,box-shadow,background-color,border-color,color] duration-200 ease-out active:scale-[0.98] disabled:opacity-50';

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
  onMovedToEnviouOrcamento,
  isNewLead,
  showSaveButton = isEditable,
  hideDelete = false,
}: LeadModalFooterProps) {
  const isMobile = useIsMobile();
  const [actionsOpen, setActionsOpen] = useState(false);

  const canEditSales =
    Boolean(leadId) && isEditable && (currentUserRole === 'ADMIN' || currentUserRole === 'VENDEDOR');
  const canDelete = Boolean(leadId) && isEditable && currentUserRole === 'ADMIN' && !hideDelete;
  const canMoveToEnviouOrcamento = Boolean(leadId) && isEditable;
  const hasSecondaryActions =
    canEditSales ||
    canDelete ||
    canMoveToEnviouOrcamento ||
    (leadId && !leadMeeting) ||
    Boolean(leadId);

  const closeActions = (fn: () => void) => () => {
    setActionsOpen(false);
    fn();
  };

  const meetingBanner = leadMeeting ? (
    <div className="lead-modal-footer-banner flex items-center gap-2 mb-3 p-2.5 rounded-lg">
      <CalendarCheck className="h-4 w-4 text-[var(--lead-gold,#5a3a12)] shrink-0" />
      <span className="text-xs sm:text-sm font-medium text-[var(--lead-soft,#1c120c)] leading-snug">
        Reunião:{' '}
        {format(new Date(leadMeeting.data_hora_inicio), "dd/MM 'às' HH:mm", { locale: ptBR })}
      </span>
    </div>
  ) : null;

  const desktopButtons = (
    <div className="lead-modal-footer-toolbar flex flex-col gap-3 w-full min-w-0 lg:flex-row lg:items-center lg:justify-between">
      {/* Ferramentas do dia a dia */}
      <FooterCluster label="Ferramentas" className="order-2 lg:order-1">
        {leadId && isEditable && !leadMeeting && (
          <Button
            type="button"
            variant="outline"
            onClick={onScheduleMeeting}
            disabled={isSubmitting}
            className={cn(footerBtnBase, 'lead-modal-footer-btn--tool')}
          >
            <CalendarPlus className="h-4 w-4 mr-1.5 opacity-80" />
            Reunião
          </Button>
        )}
        {leadId && (
          <Button
            type="button"
            variant="outline"
            onClick={onLembrete}
            disabled={isSubmitting}
            className={cn(footerBtnBase, 'lead-modal-footer-btn--amber')}
          >
            <Bell className="h-4 w-4 mr-1.5 opacity-80" />
            Lembrete
          </Button>
        )}
        {canMoveToEnviouOrcamento && leadId && (
          <LeadMoveToEnviouOrcamentoButton
            leadId={leadId}
            currentStatus={leadStatus}
            disabled={isSubmitting}
            onMoved={onMovedToEnviouOrcamento}
            className={cn(footerBtnBase, 'lead-modal-footer-btn--orcamento')}
          />
        )}
      </FooterCluster>

      <div className="order-1 lg:order-2 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-2.5 min-w-0 sm:justify-end">
        {/* Resultado da venda */}
        {(canEditSales || (leadId && isEditable) || canDelete) && (
          <>
            <FooterCluster label="Resultado" className="sm:justify-end">
              {canEditSales && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onMarkAsLost}
                  disabled={isSubmitting}
                  className={cn(footerBtnBase, 'lead-modal-footer-btn--lost')}
                >
                  <XCircle className="h-4 w-4 mr-1.5 opacity-80" />
                  Perdido
                </Button>
              )}
              {canDelete && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onDelete}
                  disabled={isSubmitting}
                  className={cn(footerBtnBase, 'lead-modal-footer-btn--danger')}
                  aria-label="Excluir lead"
                >
                  <Trash2 className="h-4 w-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">Excluir</span>
                </Button>
              )}
              {leadId && isEditable && (
                <Button
                  type="button"
                  onClick={onMarkAsWon}
                  disabled={isSubmitting}
                  className={cn(footerBtnBase, 'lead-modal-footer-btn--won')}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  Ganho
                </Button>
              )}
            </FooterCluster>
            <FooterDivider />
          </>
        )}

        {/* Fechar / gravar */}
        <FooterCluster label="Formulário" className="sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className={cn(footerBtnBase, 'lead-modal-footer-btn--ghost')}
          >
            Cancelar
          </Button>
          {showSaveButton && (
            <Button
              type="submit"
              form={formId}
              disabled={isSubmitting}
              className={cn(footerBtnBase, 'lead-modal-footer-btn--save min-w-[7.5rem]')}
            >
              {isSubmitting ? 'Salvando…' : isNewLead ? 'Criar Lead' : 'Salvar'}
            </Button>
          )}
        </FooterCluster>
      </div>
    </div>
  );

  if (!isMobile) {
    return (
      <div className="lead-modal-footer bg-transparent px-1 py-1 sm:px-0 sm:py-0 shrink-0">
        {meetingBanner}
        {desktopButtons}
      </div>
    );
  }

  return (
    <div className="lead-modal-footer lead-modal-footer--mobile bg-transparent px-0 py-0 shrink-0">
      {meetingBanner}

      <div className="flex gap-2 items-stretch">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isSubmitting}
          className={cn(footerBtnBase, 'lead-modal-footer-btn--ghost flex-1 h-11')}
        >
          Cancelar
        </Button>

        {showSaveButton && (
          <Button
            type="submit"
            form={formId}
            disabled={isSubmitting}
            className={cn(footerBtnBase, 'lead-modal-footer-btn--save flex-1 h-11 font-semibold')}
          >
            {isSubmitting ? '…' : isNewLead ? 'Criar' : 'Salvar'}
          </Button>
        )}

        {hasSecondaryActions && (
          <Sheet open={actionsOpen} onOpenChange={setActionsOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                className={cn(footerBtnBase, 'lead-modal-footer-btn--tool h-11 w-12 shrink-0 px-0')}
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
                {canMoveToEnviouOrcamento && leadId && (
                  <div className="w-full" onClick={() => setActionsOpen(false)}>
                    <LeadMoveToEnviouOrcamentoButton
                      leadId={leadId}
                      currentStatus={leadStatus}
                      disabled={isSubmitting}
                      onMoved={onMovedToEnviouOrcamento}
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
        <p className="text-[10px] text-center text-[var(--lead-faint,#5c4334)] mt-2 opacity-80">
          Toque em <span className="font-medium">⋯</span> para ganho, perda, orçamento enviado e mais
        </p>
      )}
    </div>
  );
}
