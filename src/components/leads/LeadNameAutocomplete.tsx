import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn, formatInternationalPhone } from '@/lib/utils';
import { useBuscaLeads } from '@/hooks/useBuscaLeads';
import {
  leadMatchesSearchQuery,
  sortLeadsBySearchRelevance,
} from '@/lib/lead-search';
import type { Lead } from '@/types/selletos';

const MAX_RESULTS = 12;
const MIN_CHARS = 2;
const DEBOUNCE_MS = 280;

export interface LeadContactSuggestion {
  id: number;
  name: string;
  email: string;
  phone: string;
  company?: string;
  status?: string;
  regiao?: string;
  origin?: string;
}

interface LeadNameAutocompleteProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onSelectLead: (lead: LeadContactSuggestion) => void;
  /** Ao editar um lead, não sugerir ele mesmo na lista. */
  excludeLeadId?: number | null;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  placeholder?: string;
}

function toSearchLead(suggestion: LeadContactSuggestion): Lead {
  return {
    id: suggestion.id,
    name: suggestion.name,
    email: suggestion.email,
    phone: suggestion.phone,
    company: suggestion.company,
    origin: '',
    vendor: '',
    status: (suggestion.status as Lead['status']) || 'Novo Lead',
    dateArrived: '',
    updatedAt: '',
    dealValue: 0,
    budgetValue: 0,
    regiao: suggestion.regiao,
  };
}

export function LeadNameAutocomplete({
  id,
  value,
  onChange,
  onSelectLead,
  excludeLeadId,
  disabled,
  required,
  className,
  placeholder = 'Digite para buscar leads cadastrados...',
}: LeadNameAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  /** Evita reabrir a lista logo após selecionar um lead (o valor muda e ainda dá match). */
  const suppressOpenRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(value.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value]);

  const { data: remoteRows = [], isFetching } = useBuscaLeads(debouncedTerm, {
    excludeLeadId,
  });

  const results = useMemo(() => {
    const term = value.trim();
    if (term.length < MIN_CHARS) return [];

    const suggestions: LeadContactSuggestion[] = remoteRows.map((row) => ({
      id: row.id,
      name: row.nome,
      email: row.email?.trim() ?? '',
      phone: formatInternationalPhone(row.telefone ?? ''),
      company: row.empresa?.trim() || undefined,
      status: row.status,
      regiao: row.regiao ?? undefined,
      origin: row.origem?.trim() || undefined,
    }));

    const asLeads = suggestions.map(toSearchLead);
    const matched = asLeads.filter((lead) => leadMatchesSearchQuery(lead, term));
    const sorted = sortLeadsBySearchRelevance(matched, term).slice(0, MAX_RESULTS);
    const byId = new Map(suggestions.map((s) => [s.id, s]));
    const unique: LeadContactSuggestion[] = [];
    const seen = new Set<number>();
    for (const lead of sorted) {
      if (seen.has(lead.id)) continue;
      seen.add(lead.id);
      const suggestion = byId.get(lead.id);
      if (suggestion) unique.push(suggestion);
    }
    return unique;
  }, [remoteRows, value]);

  const showDropdown = open && value.trim().length >= MIN_CHARS;

  const updateCoords = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 280),
    });
  }, []);

  useLayoutEffect(() => {
    if (!showDropdown) return;
    updateCoords();
    const onReposition = () => updateCoords();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [showDropdown, results.length, updateCoords]);

  useEffect(() => {
    setActiveIndex(0);
    if (suppressOpenRef.current) {
      suppressOpenRef.current = false;
      setOpen(false);
      return;
    }
    if (value.trim().length >= MIN_CHARS) setOpen(true);
  }, [value, results.length]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const handleSelect = (lead: LeadContactSuggestion) => {
    suppressOpenRef.current = true;
    onSelectLead(lead);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || results.length === 0) {
      if (e.key === 'Escape') setOpen(false);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      const lead = results[activeIndex];
      if (lead) {
        e.preventDefault();
        handleSelect(lead);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full min-w-0">
      <Input
        ref={inputRef}
        id={id}
        value={value}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={showDropdown}
        aria-controls={showDropdown ? 'lead-name-suggestions' : undefined}
        role="combobox"
        className={cn('w-full max-w-full', className)}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          if (value.trim().length >= MIN_CHARS) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />

      {showDropdown &&
        createPortal(
          <div
            ref={listRef}
            id="lead-name-suggestions"
            data-lead-name-autocomplete=""
            role="listbox"
            className="fixed z-[10050] max-h-72 overflow-y-auto rounded-lg border border-gold-border-subtle/30 bg-mahogany-panel text-popover-foreground shadow-xl shadow-black/40"
            style={{
              top: coords.top,
              left: coords.left,
              width: coords.width,
            }}
          >
            {isFetching && results.length === 0 ? (
              <p className="flex items-center gap-2 px-3 py-4 text-sm text-cream-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando leads...
              </p>
            ) : results.length === 0 ? (
              <p className="px-3 py-4 text-sm text-cream-muted">
                Nenhum lead cadastrado encontrado. Continue digitando para criar um novo.
              </p>
            ) : (
              <>
                <p className="border-b border-gold-border-subtle/20 px-3 py-2 text-[11px] text-cream-muted">
                  {results.length >= MAX_RESULTS
                    ? `Primeiros ${MAX_RESULTS} — refine a busca`
                    : `${results.length} lead${results.length === 1 ? '' : 's'} encontrado${results.length === 1 ? '' : 's'}`}
                  {' · '}
                  clique para preencher contato
                </p>
                <ul className="py-1">
                  {results.map((lead, index) => (
                    <li key={lead.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={index === activeIndex}
                        className={cn(
                          'flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-gold/10',
                          index === activeIndex && 'bg-gold/10',
                        )}
                        onMouseEnter={() => setActiveIndex(index)}
                        onMouseDown={(e) => {
                          // Evita blur do input antes do clique registrar a seleção.
                          e.preventDefault();
                        }}
                        onClick={() => handleSelect(lead)}
                      >
                        <User className="mt-0.5 h-4 w-4 shrink-0 text-cream-muted" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-foreground/95">
                            {lead.name}
                          </span>
                          <span className="block truncate text-xs text-cream-muted">
                            {[
                              lead.phone || null,
                              lead.email || null,
                              lead.company || null,
                              lead.status || null,
                            ]
                              .filter(Boolean)
                              .join(' · ') || 'Sem telefone/e-mail'}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
