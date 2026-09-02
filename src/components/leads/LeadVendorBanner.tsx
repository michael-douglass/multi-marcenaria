import { useRef } from 'react';
import { Check, ChevronDown, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface LeadVendorOption {
  id: string;
  nome: string;
}

interface LeadVendorBannerProps {
  vendor?: string | null;
  /** Visual do card do kanban (compacto) ou do cabeçalho do modal */
  variant?: 'card' | 'header';
  className?: string;
  /** Admin (ou quem tem permissão) pode trocar o vendedor pela faixa */
  canEdit?: boolean;
  vendors?: LeadVendorOption[];
  isLoadingVendors?: boolean;
  isSaving?: boolean;
  /** null = Sem vendedor; string = nome do vendedor escolhido */
  onVendorChange?: (vendorName: string | null) => void;
}

/** Normaliza o texto do vendedor para exibição na faixa. */
export function resolveLeadVendorLabel(vendor?: string | null): string {
  const trimmed = vendor?.trim() ?? '';
  if (
    !trimmed ||
    trimmed === 'Sem vendedor' ||
    trimmed === 'Sem vendedor atribuído'
  ) {
    return 'Sem vendedor';
  }
  return trimmed;
}

/**
 * Faixa no topo do card/modal indicando o vendedor responsável pelo lead.
 * Quando `canEdit`, ao clicar abre lista para trocar o responsável.
 */
export function LeadVendorBanner({
  vendor,
  variant = 'card',
  className,
  canEdit = false,
  vendors = [],
  isLoadingVendors = false,
  isSaving = false,
  onVendorChange,
}: LeadVendorBannerProps) {
  const label = resolveLeadVendorLabel(vendor);
  const hasVendor = label !== 'Sem vendedor';
  const editable = Boolean(canEdit && onVendorChange);
  const selectedItemRef = useRef<HTMLDivElement | null>(null);

  const shellClass = cn(
    'flex min-w-0 items-center gap-1.5 border-b w-full text-left',
    variant === 'card' &&
      cn(
        'px-2.5 py-1.5',
        hasVendor
          ? 'border-primary/25 bg-primary/15 text-primary'
          : 'border-border/70 bg-muted/70 text-muted-foreground',
      ),
    variant === 'header' &&
      cn(
        'px-4 sm:px-6 py-1.5',
        hasVendor
          ? 'border-[color:var(--lead-line)] bg-[color:var(--lead-panel)] text-[color:var(--lead-gold)]'
          : 'border-[color:var(--lead-line)] bg-[color:var(--lead-inset)]/70 text-[color:var(--lead-muted)]',
      ),
    editable &&
      'cursor-pointer transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
    isSaving && 'opacity-70 pointer-events-none',
    className,
  );

  const content = (
    <>
      <UserRound
        className={cn(
          'shrink-0 opacity-90',
          variant === 'card' ? 'h-3 w-3' : 'h-3.5 w-3.5',
        )}
        aria-hidden
      />
      <span
        className={cn(
          'min-w-0 flex-1 truncate font-semibold tracking-wide',
          variant === 'card' ? 'text-[10px] leading-tight' : 'text-[11px] sm:text-xs',
        )}
      >
        <span className="font-medium opacity-75">Vendedor: </span>
        {isSaving ? 'Salvando…' : label}
      </span>
      {editable && (
        <ChevronDown
          className={cn(
            'shrink-0 opacity-70',
            variant === 'card' ? 'h-3 w-3' : 'h-3.5 w-3.5',
          )}
          aria-hidden
        />
      )}
    </>
  );

  const title = editable
    ? 'Clique para alterar o vendedor responsável'
    : hasVendor
      ? `Vendedor responsável: ${label}`
      : 'Sem vendedor responsável';

  if (!editable) {
    return (
      <div
        className={shellClass}
        title={title}
        aria-label={hasVendor ? `Vendedor responsável: ${label}` : 'Sem vendedor responsável'}
      >
        {content}
      </div>
    );
  }

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open) return;
        // Lista longa: leva o vendedor atual para a área visível
        requestAnimationFrame(() => {
          selectedItemRef.current?.scrollIntoView({ block: 'nearest' });
        });
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={shellClass}
          title={title}
          aria-label={`Vendedor: ${label}. Abrir lista para alterar`}
          disabled={isSaving}
        >
          {content}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        // Acima do Dialog (z-50), igual a outros menus do LeadModal
        className="z-[110] min-w-[12rem] max-h-[min(20rem,50vh)] overflow-y-auto"
      >
        {isLoadingVendors ? (
          <DropdownMenuItem disabled>Carregando vendedores…</DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem
              ref={!hasVendor ? selectedItemRef : undefined}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onVendorChange?.(null);
              }}
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <Check
                  className={cn('h-3.5 w-3.5 shrink-0', hasVendor && 'opacity-0')}
                  aria-hidden
                />
                <span className="truncate">Sem vendedor</span>
              </span>
            </DropdownMenuItem>
            {vendors.length === 0 ? (
              <DropdownMenuItem disabled>Nenhum vendedor encontrado</DropdownMenuItem>
            ) : (
              vendors.map((u) => {
                const selected = label === u.nome;
                return (
                  <DropdownMenuItem
                    key={u.id}
                    ref={selected ? selectedItemRef : undefined}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!selected) onVendorChange?.(u.nome);
                    }}
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <Check
                        className={cn('h-3.5 w-3.5 shrink-0', !selected && 'opacity-0')}
                        aria-hidden
                      />
                      <span className="truncate">{u.nome}</span>
                    </span>
                  </DropdownMenuItem>
                );
              })
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
