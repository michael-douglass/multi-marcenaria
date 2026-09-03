import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function draftingIconClass(opts?: {
  compact?: boolean;
  active?: boolean;
  danger?: boolean;
}) {
  return cn(
    'shrink-0 text-[#fff6ea] hover:bg-gold/15 hover:text-gold disabled:opacity-40',
    opts?.compact ? 'h-8 w-8' : 'h-9 w-9',
    opts?.active && 'bg-gold/20 text-gold ring-1 ring-gold/50',
    opts?.danger && 'text-red-200/90 hover:bg-destructive/25 hover:text-red-100',
  );
}

export function DraftingGroup({
  label,
  children,
  className,
  /** No celular, ocupa a linha inteira e deixa os ícones quebrarem. */
  fullOnMobile = false,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  fullOnMobile?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-1',
        fullOnMobile
          ? 'w-full basis-full sm:w-auto sm:basis-auto sm:shrink-0'
          : 'shrink-0',
        fullOnMobile &&
          'rounded-lg border border-gold/20 bg-black/25 p-1.5 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0',
        className,
      )}
    >
      <span className="whitespace-nowrap font-display px-0.5 text-[10px] font-normal uppercase tracking-[0.18em] text-gold sm:text-[11px] sm:tracking-[0.2em]">
        {label}
      </span>
      <div
        className={cn(
          'flex items-center gap-0.5',
          fullOnMobile ? 'flex-wrap sm:flex-nowrap' : 'flex-nowrap',
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Faixa de ferramentas da lousa.
 * Celular: quebra em linhas (tudo à vista, sem “sumir” para o lado).
 * Desktop: uma linha com scroll fino se precisar.
 */
export function DraftingRail({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        'flex w-full items-end gap-x-2.5 gap-y-2.5',
        'flex-wrap',
        'sm:flex-nowrap sm:gap-3 sm:overflow-x-auto sm:overscroll-x-contain sm:pb-0.5 sm:[scrollbar-width:thin]',
      )}
    >
      {children}
    </div>
  );
}

export function DraftingDivider() {
  return (
    <div
      className="mb-0.5 hidden h-8 w-px shrink-0 self-end bg-gold/25 sm:block"
      aria-hidden
    />
  );
}

export function DraftingHint({ children }: { children: ReactNode }) {
  return (
    <span className="max-w-[16rem] rounded-md border border-gold/35 bg-[#120c09]/90 px-2 py-1 text-xs leading-tight text-[#fff6ea]">
      {children}
    </span>
  );
}

const LOUSA_TIPS: { title: string; body: string }[] = [
  { title: 'Inserir foto', body: 'Ícone de câmera — galeria, câmera ou arquivo do projeto.' },
  { title: 'Disquete', body: 'Salva a foto com os riscos nos anexos e limpa a lousa.' },
  { title: 'Medição', body: 'Dois pontos na reta, três no arco. Toque no número para editar.' },
  { title: 'Zoom', body: 'Dois cliques na foto ajustam. No celular, pinça com dois dedos.' },
  { title: 'Linha reta', body: 'Clique e arraste. Recolha a barra se precisar de mais espaço.' },
];

export function LousaUsageTips({ isMobile }: { isMobile: boolean }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {LOUSA_TIPS.map((tip) => (
        <li
          key={tip.title}
          className="rounded-lg border border-gold/15 bg-[#120c09]/55 px-2.5 py-2"
        >
          <p className="font-display text-[10px] uppercase tracking-[0.16em] text-gold">
            {tip.title}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-[#d4bc9f]">{tip.body}</p>
        </li>
      ))}
      {isMobile && (
        <li className="rounded-lg border border-gold/15 bg-[#120c09]/55 px-2.5 py-2 sm:col-span-2">
          <p className="font-display text-[10px] uppercase tracking-[0.16em] text-gold">
            Tela cheia
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-[#d4bc9f]">
            No celular, abra em tela cheia para desenhar com mais folga.
          </p>
        </li>
      )}
    </ul>
  );
}
