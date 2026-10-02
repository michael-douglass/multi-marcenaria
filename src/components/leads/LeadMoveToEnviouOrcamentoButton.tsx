import { useState, type MouseEvent } from 'react';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useLeads } from '@/hooks/useLeads';
import {
  PIPELINE_STATUS_ENVIOU_ORCAMENTO,
  isLeadStatusEnviouOrcamento,
} from '@/lib/pipeline-status-options';
import { cn } from '@/lib/utils';

interface LeadMoveToEnviouOrcamentoButtonProps {
  leadId: number;
  currentStatus?: string | null;
  /** Após mover com sucesso — útil para sincronizar o formulário do modal. */
  onMoved?: (status: string) => void;
  disabled?: boolean;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  variant?: 'outline' | 'secondary' | 'ghost' | 'default';
  className?: string;
  /** Texto curto no card fechado. */
  compact?: boolean;
}

/**
 * Atalho para enviar o lead direto à coluna "Enviou orçamento" do Pipeline.
 */
export function LeadMoveToEnviouOrcamentoButton({
  leadId,
  currentStatus,
  onMoved,
  disabled = false,
  size = 'default',
  variant = 'outline',
  className,
  compact = false,
}: LeadMoveToEnviouOrcamentoButtonProps) {
  const { updateLead } = useLeads({ fetchLeads: false });
  const [isMoving, setIsMoving] = useState(false);
  const alreadyThere = isLeadStatusEnviouOrcamento(currentStatus);

  if (alreadyThere) return null;

  const handleClick = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isMoving || disabled) return;

    setIsMoving(true);
    try {
      await updateLead.mutateAsync({
        id: leadId,
        updates: { status: PIPELINE_STATUS_ENVIOU_ORCAMENTO },
        silent: true,
      });
      onMoved?.(PIPELINE_STATUS_ENVIOU_ORCAMENTO);
      toast.success('Lead movido', {
        description: `Coluna: ${PIPELINE_STATUS_ENVIOU_ORCAMENTO}`,
      });
    } catch (error) {
      console.error('Erro ao mover lead para Enviou orçamento:', error);
    } finally {
      setIsMoving(false);
    }
  };

  const label = compact ? 'Orç. enviado' : 'Orçamento enviado';

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={disabled || isMoving}
      onClick={handleClick}
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(className)}
      title={`Mover para a coluna ${PIPELINE_STATUS_ENVIOU_ORCAMENTO}`}
      aria-label={`Mover lead para ${PIPELINE_STATUS_ENVIOU_ORCAMENTO}`}
    >
      <Send className={cn('shrink-0 opacity-80', compact ? 'h-3 w-3 mr-1' : 'h-4 w-4 mr-1.5')} />
      <span className="truncate">{isMoving ? 'Movendo…' : label}</span>
    </Button>
  );
}
