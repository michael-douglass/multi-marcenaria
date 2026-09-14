import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronsUpDown, Loader2, Search, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTitularesAgenda, type TitularAgenda } from '@/hooks/useTitularesAgenda';
import {
  formatTitularAgendaPapel,
  groupTitularesAgenda,
} from '@/lib/agenda-titulares';
import { cn } from '@/lib/utils';

interface AgendaTitularComboboxProps {
  value: string;
  onChange: (userId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Mantido por compatibilidade com o dialog flutuante da agenda. */
  elevated?: boolean;
  className?: string;
}

function normalizeBusca(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}

function titularMatchesSearch(user: TitularAgenda, needle: string): boolean {
  if (!needle) return true;
  const papel = formatTitularAgendaPapel(user.perfil_casa, user.crm_roles);
  return normalizeBusca(`${user.nome} ${papel}`).includes(needle);
}

/**
 * Seletor único de titular com busca.
 * Abre a lista no fluxo do formulário (sem portal) para digitar dentro de Dialog.
 */
export function AgendaTitularCombobox({
  value,
  onChange,
  placeholder = 'Selecione o titular',
  disabled = false,
  elevated: _elevated = false,
  className,
}: AgendaTitularComboboxProps) {
  void _elevated;
  const { titulares, isLoading } = useTitularesAgenda();
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => titulares.find((u) => u.id === value) ?? null,
    [titulares, value],
  );

  const filtered = useMemo(() => {
    const needle = normalizeBusca(busca);
    return titulares.filter((u) => titularMatchesSearch(u, needle));
  }, [titulares, busca]);

  const grouped = useMemo(() => groupTitularesAgenda(filtered), [filtered]);
  const flatOptions = useMemo(
    () => [...grouped.equipe, ...grouped.montadores],
    [grouped],
  );

  useEffect(() => {
    if (!open) return;
    setBusca('');
    const selectedIdx = flatOptions.findIndex((u) => u.id === value);
    setActiveIndex(selectedIdx >= 0 ? selectedIdx : 0);
    const timer = window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(timer);
    // Só ao abrir
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intencional
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex((current) => {
      if (flatOptions.length === 0) return 0;
      return Math.min(current, flatOptions.length - 1);
    });
  }, [flatOptions.length, open]);

  useEffect(() => {
    if (!open) return;
    const active = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open, flatOptions]);

  useEffect(() => {
    if (!open) return;
    const onDocPointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
      setOpen(false);
      setBusca('');
    };
    document.addEventListener('mousedown', onDocPointer);
    document.addEventListener('touchstart', onDocPointer);
    return () => {
      document.removeEventListener('mousedown', onDocPointer);
      document.removeEventListener('touchstart', onDocPointer);
    };
  }, [open]);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setBusca('');
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (flatOptions.length === 0) return;
      setActiveIndex((current) => (current + 1) % flatOptions.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (flatOptions.length === 0) return;
      setActiveIndex((current) => (current - 1 + flatOptions.length) % flatOptions.length);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const user = flatOptions[activeIndex];
      if (user) pick(user.id);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setBusca('');
    }
  };

  let flatIndex = -1;

  return (
    <div ref={rootRef} className={cn('space-y-2', className)} data-agenda-titular-picker="">
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        disabled={disabled || isLoading}
        className={cn(
          'h-10 w-full justify-between font-normal',
          !selected && 'text-muted-foreground',
        )}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="flex min-w-0 items-center gap-2 truncate text-left">
          {isLoading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              Carregando usuários...
            </>
          ) : selected ? (
            <>
              <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{selected.nome}</span>
            </>
          ) : (
            <>
              <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              {placeholder}
            </>
          )}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      {open && (
        <div className="overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              ref={inputRef}
              type="text"
              value={busca}
              onChange={(event) => {
                setBusca(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Buscar titular pelo nome..."
              className="h-11 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-autocomplete="list"
              aria-controls="agenda-titular-list"
              role="combobox"
              aria-expanded={open}
              aria-activedescendant={
                flatOptions[activeIndex]
                  ? `agenda-titular-option-${flatOptions[activeIndex].id}`
                  : undefined
              }
            />
          </div>

          <ScrollArea className="h-[min(240px,35vh)]">
            <div
              ref={listRef}
              id="agenda-titular-list"
              role="listbox"
              aria-label="Titulares"
              className="p-1"
            >
              {isLoading ? (
                <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando...
                </p>
              ) : flatOptions.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {busca.trim()
                    ? `Nenhum usuário encontrado para “${busca.trim()}”.`
                    : 'Nenhum usuário encontrado.'}
                </p>
              ) : (
                <>
                  {grouped.equipe.length > 0 && (
                    <div className="py-1">
                      <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Equipe
                      </p>
                      {grouped.equipe.map((user) => {
                        flatIndex += 1;
                        const index = flatIndex;
                        const isActive = index === activeIndex;
                        const isCurrent = user.id === value;
                        const papel = formatTitularAgendaPapel(user.perfil_casa, user.crm_roles);
                        return (
                          <button
                            key={user.id}
                            type="button"
                            id={`agenda-titular-option-${user.id}`}
                            role="option"
                            aria-selected={isActive}
                            data-active={isActive ? 'true' : 'false'}
                            className={cn(
                              'flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none',
                              'hover:bg-accent hover:text-accent-foreground',
                              isActive && 'bg-accent text-accent-foreground',
                            )}
                            onMouseEnter={() => setActiveIndex(index)}
                            onMouseDown={(event) => {
                              // Evita o botão “roubar” o foco do campo de busca antes do clique.
                              event.preventDefault();
                              pick(user.id);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4 shrink-0',
                                isCurrent ? 'opacity-100' : 'opacity-0',
                              )}
                            />
                            <Avatar className="mr-2 h-6 w-6 shrink-0">
                              <AvatarImage src={user.avatar_url || undefined} />
                              <AvatarFallback className="text-[10px]">
                                {user.nome?.charAt(0).toUpperCase() || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <span className="min-w-0 flex-1 truncate">
                              {user.nome}
                              <span className="ml-1.5 text-[10px] text-muted-foreground">
                                ({papel})
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {grouped.montadores.length > 0 && (
                    <div className="py-1">
                      <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Montadores
                      </p>
                      {grouped.montadores.map((user) => {
                        flatIndex += 1;
                        const index = flatIndex;
                        const isActive = index === activeIndex;
                        const isCurrent = user.id === value;
                        const papel = formatTitularAgendaPapel(user.perfil_casa, user.crm_roles);
                        return (
                          <button
                            key={user.id}
                            type="button"
                            id={`agenda-titular-option-${user.id}`}
                            role="option"
                            aria-selected={isActive}
                            data-active={isActive ? 'true' : 'false'}
                            className={cn(
                              'flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none',
                              'hover:bg-accent hover:text-accent-foreground',
                              isActive && 'bg-accent text-accent-foreground',
                            )}
                            onMouseEnter={() => setActiveIndex(index)}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              pick(user.id);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4 shrink-0',
                                isCurrent ? 'opacity-100' : 'opacity-0',
                              )}
                            />
                            <Avatar className="mr-2 h-6 w-6 shrink-0">
                              <AvatarImage src={user.avatar_url || undefined} />
                              <AvatarFallback className="text-[10px]">
                                {user.nome?.charAt(0).toUpperCase() || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <span className="min-w-0 flex-1 truncate">
                              {user.nome}
                              <span className="ml-1.5 text-[10px] text-muted-foreground">
                                ({papel})
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

/** Resolve o nome do titular a partir da lista completa do sistema. */
export function findTitularAgendaNome(
  titulares: TitularAgenda[] | undefined,
  userId: string | null | undefined,
  fallback = 'Você',
): string {
  if (!userId) return fallback;
  return titulares?.find((u) => u.id === userId)?.nome || fallback;
}
