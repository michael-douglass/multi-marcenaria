import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface SidebarAttentionBadgeProps {
  count: number;
  label?: string;
  className?: string;
}

/**
 * Selo de atenção no menu — destaca quantos cards ainda precisam de olhar.
 * Motion: pop ao aparecer, bump ao mudar o número, pulso suave enquanto > 0.
 */
export function SidebarAttentionBadge({
  count,
  label = 'cards para observar',
  className,
}: SidebarAttentionBadgeProps) {
  const prevCountRef = useRef(count);
  const [bumpKey, setBumpKey] = useState(0);
  const visible = count > 0;
  const display = count > 99 ? '99+' : String(count);

  useEffect(() => {
    if (count !== prevCountRef.current && count > 0) {
      setBumpKey((k) => k + 1);
    }
    prevCountRef.current = count;
  }, [count]);

  if (!visible) return null;

  return (
    <span
      key={bumpKey}
      className={cn(
        'sidebar-attention-badge ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5',
        'text-[10px] font-bold tabular-nums leading-none tracking-tight',
        'text-[#3b1d0f] shadow-[0_0_12px_rgba(251,146,60,0.45)]',
        'ring-1 ring-amber-300/70',
        className,
      )}
      title={`${count} ${label}`}
      aria-label={`${count} ${label}`}
    >
      {display}
    </span>
  );
}
