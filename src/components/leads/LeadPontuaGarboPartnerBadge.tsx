import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PontuaGarboPartnerBadge } from '@/hooks/usePontuaGarboPartnerLeads';
import {
  clampMonthKey,
  getCurrentMonthKeySaoPaulo,
  getTotaisDoMes,
  labelMonthKeyPt,
  rangeMesDoBadge,
  shiftMonthKey,
} from '@/lib/pontua-garbo-indicacoes-mes';

const MES_TODOS = 'todos';

interface LeadPontuaGarboPartnerBadgeProps {
  badge: PontuaGarboPartnerBadge;
  variant?: 'card' | 'modal' | 'inline';
  className?: string;
}

function CountPill({
  label,
  value,
  tone,
  compact = false,
}: {
  label: string;
  value: number;
  tone: 'aberto' | 'fechado';
  compact?: boolean;
}) {
  const isAberto = tone === 'aberto';
  return (
    <span
      className={cn(
        'inline-flex min-w-0 flex-col items-center justify-center rounded-md border backdrop-blur-[2px]',
        compact ? 'w-full px-1 py-0.5' : 'min-w-[4.5rem] px-2 py-1',
        isAberto
          ? 'border-gold/35 bg-gold/12 text-gold'
          : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
      )}
    >
      <span
        className={cn(
          'font-display font-semibold tabular-nums leading-none tracking-wide',
          compact ? 'text-xs' : 'text-sm',
        )}
      >
        {value}
      </span>
      <span
        className={cn(
          'mt-0.5 max-w-full truncate font-semibold uppercase opacity-80',
          compact ? 'text-[8px] tracking-wider' : 'text-[9px] tracking-[0.16em]',
        )}
      >
        {label}
      </span>
    </span>
  );
}

function MonthSwitcher({
  mes,
  minMes,
  maxMes,
  onChange,
  compact = false,
}: {
  mes: string;
  minMes: string;
  maxMes: string;
  onChange: (next: string) => void;
  compact?: boolean;
}) {
  const isTodos = mes === MES_TODOS;
  const canPrev = !isTodos;
  const canNext = isTodos || mes < maxMes;
  const label = isTodos ? 'Todos os meses' : labelMonthKeyPt(mes);

  return (
    <div className={cn('flex min-w-0 items-center', compact ? 'justify-between gap-0.5' : 'gap-1')}>
      <button
        type="button"
        disabled={!canPrev}
        aria-label="Período anterior"
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-md text-gold',
          'hover:bg-gold/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold',
          'disabled:pointer-events-none disabled:opacity-30',
          compact ? 'h-5 w-5' : 'h-7 w-7',
        )}
        onClick={(event) => {
          event.stopPropagation();
          if (!canPrev) return;
          onChange(mes === minMes ? MES_TODOS : shiftMonthKey(mes, -1));
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <ChevronLeft className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
      </button>
      <p
        className={cn(
          'min-w-0 flex-1 truncate text-center font-semibold uppercase text-gold',
          compact ? 'text-[9px] tracking-wider' : 'text-[11px] tracking-[0.14em]',
        )}
      >
        {label}
      </p>
      <button
        type="button"
        disabled={!canNext}
        aria-label="Próximo período"
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-md text-gold',
          'hover:bg-gold/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold',
          'disabled:pointer-events-none disabled:opacity-30',
          compact ? 'h-5 w-5' : 'h-7 w-7',
        )}
        onClick={(event) => {
          event.stopPropagation();
          if (!canNext) return;
          onChange(isTodos ? minMes : shiftMonthKey(mes, 1));
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <ChevronRight className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
      </button>
    </div>
  );
}

function useMesDoBadge(primeiroMes: string | null) {
  const mesAtual = getCurrentMonthKeySaoPaulo();
  const { minMes, maxMes } = useMemo(
    () => rangeMesDoBadge(primeiroMes, mesAtual),
    [primeiroMes, mesAtual],
  );
  const [mes, setMes] = useState(MES_TODOS);
  const mesClamped = mes === MES_TODOS ? MES_TODOS : clampMonthKey(mes, minMes, maxMes);

  return {
    mes: mesClamped,
    setMes,
    minMes,
    maxMes,
  };
}

/** Estrelinha + contagem de orçamentos que o parceiro já indicou. */
export function LeadPontuaGarboPartnerBadge({
  badge,
  variant = 'card',
  className,
}: LeadPontuaGarboPartnerBadgeProps) {
  const { mes, setMes, minMes, maxMes } = useMesDoBadge(badge.primeiroMes);
  const isTodos = mes === MES_TODOS;
  const totaisMes = isTodos
    ? { aberto: badge.aberto, fechado: badge.fechado }
    : getTotaisDoMes(badge.porMes, mes);
  const totalMes = totaisMes.aberto + totaisMes.fechado;
  const mesLabel = isTodos ? 'todos os meses' : labelMonthKeyPt(mes);
  const abertoLabel = totaisMes.aberto === 1 ? 'Aberto' : 'Abertos';

  if (variant === 'inline') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/15 px-1.5 py-0.5',
          className,
        )}
        title={`Pontua Garbo · ${totaisMes.aberto} orçamento(s) aberto(s) conosco · ${totaisMes.fechado} fechado(s)`}
      >
        <Star className="h-3 w-3 fill-gold text-gold" aria-hidden />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gold">
          {totaisMes.aberto} aberto{totaisMes.aberto === 1 ? '' : 's'} · {totaisMes.fechado} fc
        </span>
      </span>
    );
  }

  if (variant === 'card') {
    return (
      <div
        className={cn(
          'relative w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-gold/30',
          'bg-gradient-to-r from-gold/15 via-mahogany-elevated/50 to-gold/8',
          'px-1.5 py-1.5 shadow-[inset_0_1px_0_rgba(242,216,146,0.18)]',
          className,
        )}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute -right-3 -top-4 h-10 w-10 rounded-full bg-gold/20 blur-md" />
        <div className="relative flex min-w-0 flex-col gap-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
              <span className="absolute inset-0 animate-pulse rounded-full bg-gold/25" />
              <Star className="relative h-3 w-3 fill-gold text-gold drop-shadow-[0_0_6px_rgba(242,216,146,0.7)]" />
            </span>
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="truncate text-[9px] font-semibold uppercase tracking-wider text-gold">
                Pontua Garbo
              </p>
              <p className="truncate text-[10px] leading-tight text-cream-muted">
                {badge.aberto === 0
                  ? 'Nenhum orçamento aberto conosco'
                  : `${badge.aberto} orçamento${badge.aberto === 1 ? '' : 's'} aberto${badge.aberto === 1 ? '' : 's'} conosco`}
              </p>
            </div>
          </div>
          <MonthSwitcher
            compact
            mes={mes}
            minMes={minMes}
            maxMes={maxMes}
            onChange={setMes}
          />
          <div className="grid w-full min-w-0 grid-cols-2 gap-1">
            <CountPill compact label={abertoLabel} value={totaisMes.aberto} tone="aberto" />
            <CountPill compact label="Fechado" value={totaisMes.fechado} tone="fechado" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-gold/35',
        'bg-gradient-to-br from-gold/16 via-mahogany-card/40 to-mahogany-elevated/30',
        'p-3 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.45)]',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent"
        aria-hidden
      />
      <div className="pointer-events-none absolute -right-6 -top-8 h-20 w-20 rounded-full bg-gold/15 blur-2xl" />

      <div className="relative flex items-start gap-3">
        <span className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-mahogany-base/60">
          <span className="absolute inset-1 animate-pulse rounded-full bg-gold/20" />
          <Star className="relative h-5 w-5 fill-gold text-gold drop-shadow-[0_0_8px_rgba(242,216,146,0.8)]" />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="font-display text-sm tracking-wide text-gold">Parceiro Pontua Garbo</p>
            <p className="text-xs text-cream-muted leading-relaxed">
              {badge.aberto === 0
                ? 'Nenhum orçamento aberto conosco neste momento.'
                : `Tem ${badge.aberto} orçamento${badge.aberto === 1 ? '' : 's'} aberto${badge.aberto === 1 ? '' : 's'} conosco.`}
            </p>
          </div>
          <MonthSwitcher mes={mes} minMes={minMes} maxMes={maxMes} onChange={setMes} />
          <div className="flex flex-wrap items-center gap-2">
            <CountPill label={abertoLabel} value={totaisMes.aberto} tone="aberto" />
            <CountPill label="Fechado" value={totaisMes.fechado} tone="fechado" />
            <span className="text-[10px] uppercase tracking-[0.14em] text-cream-faint">
              {isTodos
                ? totalMes === 0
                  ? 'Nenhuma indicação ainda'
                  : `${totalMes} no total`
                : totalMes === 0
                  ? `Nenhuma indicação em ${mesLabel}`
                  : `${totalMes} em ${mesLabel}`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
