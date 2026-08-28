import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Lead } from '@/types/selletos';
import {
  leadMatchesSearchQuery,
  sortLeadsBySearchRelevance,
} from '@/lib/lead-search';

const MAX_RESULTS = 25;

interface PipelineLeadSearchProps {
  leads: Lead[];
  value: string;
  onChange: (value: string) => void;
  onSelectLead: (leadId: number) => void;
  disabled?: boolean;
}

export function PipelineLeadSearch({
  leads,
  value,
  onChange,
  onSelectLead,
  disabled,
}: PipelineLeadSearchProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const term = value.trim();
    if (!term) return [];
    const matched = leads.filter((lead) => leadMatchesSearchQuery(lead, term));
    return sortLeadsBySearchRelevance(matched, term).slice(0, MAX_RESULTS);
  }, [leads, value]);

  useEffect(() => {
    setActiveIndex(0);
    setOpen(value.trim().length > 0);
  }, [value, results.length]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const handleSelect = (leadId: number) => {
    onSelectLead(leadId);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const lead = results[activeIndex];
      if (lead) handleSelect(lead.id);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showDropdown = open && value.trim().length > 0;

  return (
    <div ref={containerRef} className="relative w-full sm:w-96">
      <Search className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        lang="pt-BR"
        placeholder="Buscar nome, telefone, cidade, empresa..."
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => value.trim() && setOpen(true)}
        onKeyDown={handleKeyDown}
        className="pl-10 pr-10 text-sm"
        aria-label="Buscar leads em todo o sistema"
        aria-expanded={showDropdown}
        aria-autocomplete="list"
        role="combobox"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 z-10 h-7 w-7 -translate-y-1/2"
          onClick={() => {
            onChange('');
            setOpen(false);
          }}
          aria-label="Limpar busca"
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      {showDropdown && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-[10040] max-h-80 overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
          role="listbox"
        >
          {results.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              Nenhum lead encontrado em todo o sistema.
            </p>
          ) : (
            <>
              <p className="border-b border-border/80 px-3 py-2 text-[11px] text-muted-foreground">
                {results.length >= MAX_RESULTS
                  ? `Primeiros ${MAX_RESULTS} resultados — refine a busca`
                  : `${results.length} lead${results.length === 1 ? '' : 's'} encontrado${results.length === 1 ? '' : 's'} (todo o CRM)`}
              </p>
              <ul className="py-1">
                {results.map((lead, index) => (
                  <li key={lead.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === activeIndex}
                      className={cn(
                        'flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent',
                        index === activeIndex && 'bg-accent',
                      )}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => handleSelect(lead.id)}
                    >
                      <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium truncate">{lead.name}</span>
                        <span className="block text-xs text-muted-foreground truncate">
                          {[lead.phone, lead.regiao, lead.status].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
