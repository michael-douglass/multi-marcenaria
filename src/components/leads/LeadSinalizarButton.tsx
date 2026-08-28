import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Flag } from 'lucide-react';
import { LeadSinalizarDialog } from '@/components/leads/LeadSinalizarDialog';
import { useAuth } from '@/contexts/AuthContext';
import { canShowLeadSinalizarButton } from '@/lib/lead-sinalizar-access';
import { cn } from '@/lib/utils';

interface LeadSinalizarButtonProps {
  leadId: number;
  leadNome: string;
  leadStatus?: string | null;
  className?: string;
  size?: 'sm' | 'default';
}

export function LeadSinalizarButton({
  leadId,
  leadNome,
  leadStatus,
  className,
  size = 'sm',
}: LeadSinalizarButtonProps) {
  const [open, setOpen] = useState(false);
  const { tipoUsuario } = useAuth();

  if (!canShowLeadSinalizarButton(tipoUsuario)) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={size}
        className={cn(
          'h-6 sm:h-7 text-[10px] sm:text-xs px-2 min-w-0 overflow-hidden border-amber-500/50 text-amber-800 hover:bg-amber-50 dark:text-amber-200 dark:hover:bg-amber-950/40',
          className,
        )}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Flag className="h-3 w-3 mr-1 shrink-0" />
        <span className="truncate">Sinalizar</span>
      </Button>

      <LeadSinalizarDialog
        open={open}
        onOpenChange={setOpen}
        leadId={leadId}
        leadNome={leadNome}
        leadStatus={leadStatus}
      />
    </>
  );
}
