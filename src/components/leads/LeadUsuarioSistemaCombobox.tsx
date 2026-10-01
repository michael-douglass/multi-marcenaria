import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronsUpDown, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { normalizeSearchText } from '@/lib/lead-search';
import { cn } from '@/lib/utils';

export interface LeadUsuarioSistemaOption {
  id: string;
  nome: string;
  tipo_usuario?: string | null;
  titulo?: string | null;
}

interface LeadUsuarioSistemaComboboxProps {
  value: string;
  users: LeadUsuarioSistemaOption[];
  onValueChange: (userId: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

function userMatchesSearch(user: LeadUsuarioSistemaOption, needle: string): boolean {
  if (!needle) return true;
  return normalizeSearchText(`${user.nome} ${user.titulo ?? ''}`).includes(needle);
}

/**
 * Seletor de usuário do sistema com busca por nome.
 * Lista inline (sem portal) para funcionar bem dentro do Dialog do lead.
 */
export function LeadUsuarioSistemaCombobox({
  value,
  users,
  onValueChange,
  disabled = false,
  placeholder = 'Selecionar usuário...',
  className,
}: LeadUsuarioSistemaComboboxProps) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => users.find((u) => u.id === value) ?? null,
    [users, value],
  );

  const filtered = useMemo(() => {
    const needle = normalizeSearchText(busca);
    return users.filter((u) => userMatchesSearch(u, needle));
  }, [users, busca]);

  /** Índice 0 = opção "limpar seleção"; demais = usuários filtrados. */
  const totalOptions = filtered.length + 1;

  useEffect(() => {
    if (!open) return;
    setBusca('');
    const selectedIdx = value
      ? filtered.findIndex((u) => u.id === value)
      : -1;
    setActiveIndex(selectedIdx >= 0 ? selectedIdx + 1 : 0);
    const timer = window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(timer);
    // Só ao abrir
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intencional
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex((current) => Math.min(current, Math.max(totalOptions - 1, 0)));
  }, [totalOptions, open]);

  useEffect(() => {
    if (!open) return;
    const active = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open, filtered]);

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
    onValueChange(id);
    setOpen(false);
    setBusca('');
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (totalOptions === 0) return;
      setActiveIndex((current) => (current + 1) % totalOptions);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (totalOptions === 0) return;
      setActiveIndex((current) => (current - 1 + totalOptions) % totalOptions);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (activeIndex === 0) {
        pick('');
        return;
      }
      const user = filtered[activeIndex - 1];
      if (user) pick(user.id);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setBusca('');
    }
  };

  const listId = 'lead-usuario-sistema-list';

  return (
    <div ref={rootRef} className={cn('w-full min-w-0 space-y-2', className)}>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        className={cn(
          'h-10 w-full min-w-0 max-w-full justify-between overflow-hidden font-normal',
          !selected && 'text-muted-foreground',
        )}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="flex min-w-0 items-center gap-2 overflow-hidden text-left">
          <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {selected ? (
            <span className="truncate">{selected.nome}</span>
          ) : (
            <span className="truncate">{placeholder}</span>
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
              placeholder="Buscar usuário pelo nome..."
              className="h-11 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-autocomplete="list"
              aria-controls={listId}
              role="combobox"
              aria-expanded={open}
              aria-activedescendant={
                activeIndex === 0
                  ? 'lead-usuario-option-none'
                  : filtered[activeIndex - 1]
                    ? `lead-usuario-option-${filtered[activeIndex - 1].id}`
                    : undefined
              }
            />
          </div>

          <ScrollArea className="h-[min(240px,35vh)]">
            <div
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label="Usuários do sistema"
              className="p-1"
            >
              <button
                type="button"
                id="lead-usuario-option-none"
                role="option"
                aria-selected={activeIndex === 0}
                data-active={activeIndex === 0 ? 'true' : 'false'}
                className={cn(
                  'flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none',
                  'hover:bg-accent hover:text-accent-foreground',
                  activeIndex === 0 && 'bg-accent text-accent-foreground',
                )}
                onMouseEnter={() => setActiveIndex(0)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  pick('');
                }}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4 shrink-0',
                    !value ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <span className="text-muted-foreground">-- Selecionar usuário --</span>
              </button>

              {filtered.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {busca.trim()
                    ? `Nenhum usuário encontrado para “${busca.trim()}”.`
                    : 'Nenhum usuário disponível.'}
                </p>
              ) : (
                filtered.map((user, index) => {
                  const optionIndex = index + 1;
                  const isActive = optionIndex === activeIndex;
                  const isCurrent = user.id === value;
                  return (
                    <button
                      key={user.id}
                      type="button"
                      id={`lead-usuario-option-${user.id}`}
                      role="option"
                      aria-selected={isActive}
                      data-active={isActive ? 'true' : 'false'}
                      className={cn(
                        'flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none',
                        'hover:bg-accent hover:text-accent-foreground',
                        isActive && 'bg-accent text-accent-foreground',
                      )}
                      onMouseEnter={() => setActiveIndex(optionIndex)}
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
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">{user.nome}</span>
                        {user.tipo_usuario === 'prestador_servico' && user.titulo && (
                          <span className="text-[10px] text-muted-foreground">{user.titulo}</span>
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
