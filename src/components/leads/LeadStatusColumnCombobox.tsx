import { useMemo, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LeadStatusColumnDisplay, LeadStatusColumnOptionRow } from './LeadStatusColumnDisplay';
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

function scoreFunnelSearch(value: string, search: string, keywords?: string[]): number {
  const needle = normalizeSearchText(search);
  if (!needle) return 1;
  const haystack = normalizeSearchText([value, ...(keywords ?? [])].join(' '));
  return haystack.includes(needle) ? 1 : 0;
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
  const selected = value.trim();

  const groups = useMemo(() => {
    if (!options.length) return null;
    if (!options.some((opt) => opt.group)) return null;
    return groupLeadModalStatusOptions(options);
  }, [options]);

  const handleSelect = (nextStatus: string) => {
    onValueChange(nextStatus);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
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
        className={cn(
          'w-[var(--radix-popover-trigger-width)] min-w-[min(100%,22rem)] p-0 !z-[100]',
          'overflow-hidden rounded-xl border-gold-border-subtle/40',
          'bg-mahogany-elevated/95 shadow-[0_18px_48px_rgba(0,0,0,0.55)]',
        )}
        onWheel={(event) => event.stopPropagation()}
      >
        <Command
          shouldFilter
          loop
          filter={scoreFunnelSearch}
          className={cn(
            'bg-transparent text-cream-secondary',
            '[&_[cmdk-input-wrapper]]:relative [&_[cmdk-input-wrapper]]:overflow-hidden',
            '[&_[cmdk-input-wrapper]]:border-gold-border-subtle/35',
            '[&_[cmdk-input-wrapper]]:bg-gradient-to-r [&_[cmdk-input-wrapper]]:from-gold/15 [&_[cmdk-input-wrapper]]:via-mahogany-muted/50 [&_[cmdk-input-wrapper]]:to-mahogany-elevated/40',
            '[&_[cmdk-input-wrapper]_svg]:text-gold [&_[cmdk-input-wrapper]_svg]:opacity-90',
            '[&_[cmdk-group-heading]]:sticky [&_[cmdk-group-heading]]:top-0 [&_[cmdk-group-heading]]:z-[1]',
            '[&_[cmdk-group-heading]]:border-b [&_[cmdk-group-heading]]:border-gold-border-subtle/20',
            '[&_[cmdk-group-heading]]:bg-mahogany-elevated/95',
            '[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2',
            '[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold',
            '[&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.14em]',
            '[&_[cmdk-group-heading]]:text-gold/90',
          )}
        >
          <CommandInput
            placeholder="Buscar etapa do funil..."
            className="h-11 text-cream-secondary placeholder:text-cream-muted/80"
          />
          <CommandList className="max-h-[min(22rem,55vh)]">
            <CommandEmpty className="py-8 text-center text-sm text-cream-muted">
              Nenhuma etapa encontrada.
            </CommandEmpty>
            {groups
              ? [...groups.entries()].map(([group, opts]) => (
                  <CommandGroup key={group} heading={group}>
                    {opts.map((opt, index) => (
                      <FunnelColumnItem
                        key={`${group}:${opt.value}`}
                        option={opt}
                        step={index + 1}
                        selected={selected === opt.value}
                        onSelect={handleSelect}
                      />
                    ))}
                  </CommandGroup>
                ))
              : (
                  <CommandGroup>
                    {options.map((opt, index) => (
                      <FunnelColumnItem
                        key={opt.value}
                        option={opt}
                        step={index + 1}
                        selected={selected === opt.value}
                        onSelect={handleSelect}
                      />
                    ))}
                  </CommandGroup>
                )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface FunnelColumnItemProps {
  option: LeadModalStatusOption;
  step: number;
  selected: boolean;
  onSelect: (status: string) => void;
}

function FunnelColumnItem({ option, step, selected, onSelect }: FunnelColumnItemProps) {
  return (
    <CommandItem
      value={`${option.group ?? ''} ${option.label} ${option.value}`}
      keywords={[option.group ?? '', option.label, option.value]}
      onSelect={() => onSelect(option.value)}
      className={cn(
        'cursor-pointer py-2 pl-2 pr-2 text-cream-secondary',
        'data-[selected=true]:bg-gold/15 data-[selected=true]:text-cream-secondary',
        selected && 'bg-gold/10',
      )}
    >
      <Check
        className={cn('mr-2 h-4 w-4 shrink-0 text-gold', selected ? 'opacity-100' : 'opacity-0')}
        aria-hidden
      />
      <LeadStatusColumnOptionRow columnLabel={option.label} step={step} />
    </CommandItem>
  );
}
