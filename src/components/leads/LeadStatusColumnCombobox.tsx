import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LeadStatusColumnDisplay } from './LeadStatusColumnDisplay';
import {
  groupLeadModalStatusOptions,
  type LeadModalStatusOption,
  type LeadStatusDisplayInfo,
} from '@/lib/pipeline-status-options';
import { normalizeSearchText } from '@/lib/lead-search';
import { cn } from '@/lib/utils';

interface LeadStatusColumnComboboxProps {
  value: string;
  options: LeadModalStatusOption[];
  displayInfo: LeadStatusDisplayInfo;
  placeholder: string;
  onValueChange: (status: string) => void;
  disabled?: boolean;
}

interface FlatFunnelOption {
  option: LeadModalStatusOption;
  group: string | null;
  step: number;
}

function optionMatchesSearch(option: LeadModalStatusOption, needle: string): boolean {
  if (!needle) return true;
  const haystack = normalizeSearchText(
    [option.group ?? '', option.label, option.value].join(' '),
  );
  return haystack.includes(needle);
}

export function LeadStatusColumnCombobox({
  value,
  options,
  displayInfo,
  placeholder,
  onValueChange,
  disabled = false,
}: LeadStatusColumnComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selected = value.trim();

  const flatOptions = useMemo((): FlatFunnelOption[] => {
    if (!options.length) return [];
    const hasGroups = options.some((opt) => opt.group);
    if (!hasGroups) {
      return options.map((option, index) => ({
        option,
        group: null,
        step: index + 1,
      }));
    }

    const groups = groupLeadModalStatusOptions(options);
    const rows: FlatFunnelOption[] = [];
    for (const [group, opts] of groups.entries()) {
      opts.forEach((option, index) => {
        rows.push({ option, group, step: index + 1 });
      });
    }
    return rows;
  }, [options]);

  const filteredOptions = useMemo(() => {
    const needle = normalizeSearchText(search);
    return flatOptions.filter((row) => optionMatchesSearch(row.option, needle));
  }, [flatOptions, search]);

  useEffect(() => {
    if (!open) return;
    const selectedIdx = flatOptions.findIndex((row) => row.option.value === selected);
    setActiveIndex(selectedIdx >= 0 ? selectedIdx : 0);
  }, [open, flatOptions, selected]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex((current) => {
      if (filteredOptions.length === 0) return 0;
      return Math.min(current, filteredOptions.length - 1);
    });
  }, [filteredOptions.length, open]);

  useEffect(() => {
    if (!open) return;
    const active = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open, filteredOptions]);

  const handleSelect = (nextStatus: string) => {
    onValueChange(nextStatus);
    setOpen(false);
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (filteredOptions.length === 0) return;
      setActiveIndex((current) => (current + 1) % filteredOptions.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (filteredOptions.length === 0) return;
      setActiveIndex((current) => (current - 1 + filteredOptions.length) % filteredOptions.length);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const row = filteredOptions[activeIndex];
      if (row) handleSelect(row.option.value);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
  };

  let lastGroup: string | null | undefined = undefined;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) {
          // Dentro do card do lead: o Dialog não “rouba” o foco da busca.
          setPortalContainer(document.querySelector<HTMLElement>('[data-lead-card]'));
          setSearch('');
        } else {
          setSearch('');
        }
        setOpen(next);
      }}
      modal={false}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-label="Coluna no funil"
          disabled={disabled}
          className={cn(
            'flex items-center justify-between rounded-md border px-3 text-base ring-offset-background',
            'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 md:text-sm',
            'h-auto min-h-12 w-full min-w-0 max-w-full py-2',
            'border-gold-border-subtle/30 bg-mahogany-muted/20',
            'hover:border-gold-border-subtle/50 focus:ring-gold/30',
            open && 'border-gold/45 ring-2 ring-gold/25 ring-offset-2',
          )}
        >
          <span className="min-w-0 flex-1 text-left" style={{ pointerEvents: 'none' }}>
            {selected ? (
              <LeadStatusColumnDisplay info={displayInfo} compact />
            ) : (
              <span className="text-cream-muted">{placeholder}</span>
            )}
          </span>
          <ChevronDown
            className={cn(
              'ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform duration-200',
              open && 'rotate-180 opacity-80',
            )}
            aria-hidden
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        collisionPadding={16}
        portalContainer={portalContainer}
        data-lead-funnel-column-picker=""
        className={cn(
          'w-[var(--radix-popover-trigger-width)] min-w-[min(100%,22rem)] p-0 !z-[100]',
          'overflow-hidden rounded-xl border border-[rgba(242,216,146,0.4)]',
          'shadow-[0_18px_48px_rgba(0,0,0,0.55)]',
        )}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() => {
            inputRef.current?.focus({ preventScroll: true });
          });
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
        }}
        onWheel={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[rgba(242,216,146,0.28)] bg-gradient-to-r from-[rgba(196,150,58,0.18)] via-[rgba(72,48,36,0.55)] to-[rgba(42,24,18,0.4)] px-3">
          <Search className="h-4 w-4 shrink-0 text-[color:var(--funnel-picker-gold,#f2d892)] opacity-90" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleSearchKeyDown}
            placeholder="Buscar etapa do funil..."
            className="h-11 w-full bg-transparent text-base outline-none md:text-sm"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-autocomplete="list"
            aria-controls="lead-funnel-column-list"
            role="combobox"
            aria-expanded={open}
            aria-activedescendant={
              filteredOptions[activeIndex]
                ? `lead-funnel-option-${filteredOptions[activeIndex].option.value}`
                : undefined
            }
          />
        </div>

        <div
          ref={listRef}
          id="lead-funnel-column-list"
          role="listbox"
          aria-label="Colunas do funil"
          className="max-h-[min(22rem,55vh)] overflow-y-auto overflow-x-hidden p-1"
        >
          {filteredOptions.length === 0 ? (
            <p className="py-8 text-center text-sm text-[color:var(--funnel-picker-cream-muted,#e2c9a8)]">
              Nenhuma etapa encontrada.
            </p>
          ) : (
            filteredOptions.map((row, index) => {
              const showHeading = Boolean(row.group) && row.group !== lastGroup;
              lastGroup = row.group;
              const isActive = index === activeIndex;
              const isCurrent = selected === row.option.value;

              return (
                <div key={`${row.group ?? 'all'}:${row.option.value}`}>
                  {showHeading && (
                    <div
                      data-funnel-picker-heading=""
                      className="sticky top-0 z-[1] border-b border-[rgba(242,216,146,0.2)] bg-[rgba(42,24,18,0.95)] px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    >
                      {row.group}
                    </div>
                  )}
                  <button
                    type="button"
                    id={`lead-funnel-option-${row.option.value}`}
                    role="option"
                    aria-selected={isActive}
                    data-funnel-picker-item=""
                    data-active={isActive ? 'true' : 'false'}
                    data-current={isCurrent ? 'true' : 'false'}
                    className={cn(
                      'flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-2 text-left text-sm outline-none',
                      'hover:bg-[rgba(196,150,58,0.2)]',
                    )}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => handleSelect(row.option.value)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0 text-[color:var(--funnel-picker-gold,#f2d892)]',
                        isCurrent ? 'opacity-100' : 'opacity-0',
                      )}
                      aria-hidden
                    />
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        data-funnel-picker-step=""
                        aria-hidden
                        className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md border bg-[rgba(72,48,36,0.5)] px-1 font-mono text-[10px] font-semibold tabular-nums"
                      >
                        {row.step}
                      </span>
                      <span className="min-w-0 truncate font-medium">{row.option.label}</span>
                    </span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
