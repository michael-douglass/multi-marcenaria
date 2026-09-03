import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  collectLeadModalLiveHits,
  mergeLeadSearchHits,
  searchLeadModalCatalog,
  type LeadSearchHit,
} from '@/lib/lead-modal-search';
import type { LeadNavVisibility } from './lead-modal-nav';
import { LeadModalSearchAura } from './LeadModalSearchAura';

interface LeadModalSearchProps extends LeadNavVisibility {
  onJump: (hit: LeadSearchHit) => void;
}

export function LeadModalSearch({ onJump, ...visibility }: LeadModalSearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const hits = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const catalog = searchLeadModalCatalog(trimmed, { showIa: true, ...visibility });
    const liveRoot = document.querySelector('[data-lead-modal-scroll="true"]');
    const live = liveRoot ? collectLeadModalLiveHits(liveRoot, trimmed) : [];
    return mergeLeadSearchHits([...catalog, ...live]);
  }, [query, visibility.hideContratos, visibility.hideMarkup, visibility.hideOrcamentos, visibility.hideWhatsapp, visibility.showIa]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root || !(event.target instanceof Node)) return;
      if (!root.contains(event.target)) {
        setOpen(false);
        setFocused(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const go = (hit: LeadSearchHit) => {
    onJump(hit);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const showList = open && query.trim().length > 0;

  return (
    <div
      ref={rootRef}
      className={cn(
        'lead-modal-search relative z-50 shrink-0',
        (focused || query) && 'lead-modal-search--open',
      )}
    >
      <div className="lead-modal-search__shell relative overflow-hidden rounded-md">
        <LeadModalSearchAura focused={focused || query.length > 0} />
        <Search className="lead-modal-search__icon pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          value={query}
          autoComplete="off"
          spellCheck={false}
          placeholder="Ir para…"
          aria-label="Buscar campo ou seção do card"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && hits[activeIndex] ? `${listId}-${hits[activeIndex].key}` : undefined}
          className="lead-modal-search__input relative z-[1] h-8 w-[7.25rem] bg-transparent pl-7 pr-2 text-[12px] outline-none sm:h-8 sm:w-[8.5rem]"
          onFocus={() => {
            setFocused(true);
            setOpen(true);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              setQuery('');
              setOpen(false);
              event.currentTarget.blur();
              return;
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((i) => Math.min(i + 1, Math.max(hits.length - 1, 0)));
              return;
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
              return;
            }
            if (event.key === 'Enter') {
              event.preventDefault();
              const hit = hits[activeIndex] ?? hits[0];
              if (hit) go(hit);
            }
          }}
        />
      </div>
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Resultados no card"
          className="lead-modal-search__list absolute right-0 top-[calc(100%+6px)] z-[60] max-h-[min(18rem,42vh)] w-[min(18.5rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border p-1"
        >
          {hits.length === 0 ? (
            <li className="lead-modal-search__empty px-2.5 py-2 text-[12px]">Nada encontrado neste card</li>
          ) : (
            hits.map((hit, index) => (
              <li key={hit.key} role="presentation">
                <button
                  type="button"
                  id={`${listId}-${hit.key}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  className={cn(
                    'lead-modal-search__item flex w-full flex-col items-start rounded-md px-2.5 py-1.5 text-left',
                    index === activeIndex && 'is-active',
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => go(hit)}
                >
                  <span className="text-[12px] font-semibold leading-tight">{hit.label}</span>
                  {hit.hint && (
                    <span className="mt-0.5 line-clamp-1 text-[10px] opacity-70">{hit.hint}</span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
