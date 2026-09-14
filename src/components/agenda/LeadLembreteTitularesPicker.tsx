import { useMemo, useState } from 'react';
import { Users, Loader2, Search } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTitularesAgenda, type TitularAgenda } from '@/hooks/useTitularesAgenda';
import { formatTitularAgendaPapel, groupTitularesAgenda } from '@/lib/agenda-titulares';
import { cn } from '@/lib/utils';

interface LeadLembreteTitularesPickerProps {
  value: string[];
  onChange: (next: string[]) => void;
  /** Usuário que marcou o lembrete — sempre permanece titular. */
  lockedUserId?: string | null;
  listClassName?: string;
  compact?: boolean;
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

function TitularRow({
  user,
  checked,
  locked,
  onToggle,
}: {
  user: TitularAgenda;
  checked: boolean;
  locked: boolean;
  onToggle: (id: string, checked: boolean) => void;
}) {
  const papel = formatTitularAgendaPapel(user.perfil_casa, user.crm_roles);
  return (
    <div className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent/50">
      <Checkbox
        id={`lembrete-titular-${user.id}`}
        checked={checked}
        disabled={locked}
        onCheckedChange={(v) => onToggle(user.id, v === true)}
      />
      <Avatar className="h-7 w-7">
        <AvatarImage src={user.avatar_url || undefined} />
        <AvatarFallback className="text-[10px]">
          {user.nome?.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <Label
        htmlFor={`lembrete-titular-${user.id}`}
        className={cn(
          'flex-1 text-sm font-normal',
          locked ? 'cursor-default' : 'cursor-pointer',
        )}
      >
        {user.nome}
        <span className="ml-1.5 text-[10px] text-muted-foreground">
          ({papel}
          {locked ? ' · quem marcou' : ''})
        </span>
      </Label>
    </div>
  );
}

/**
 * Seletor de titulares do lembrete de lead.
 * Quem criou fica travado; qualquer usuário do sistema (incluindo montadores) pode ser incluído.
 */
export function LeadLembreteTitularesPicker({
  value,
  onChange,
  lockedUserId,
  listClassName,
  compact = false,
}: LeadLembreteTitularesPickerProps) {
  const { titulares, isLoading } = useTitularesAgenda();
  const [busca, setBusca] = useState('');
  const needle = useMemo(() => normalizeBusca(busca), [busca]);

  const filtered = useMemo(
    () => titulares.filter((u) => titularMatchesSearch(u, needle)),
    [titulares, needle],
  );
  const grouped = useMemo(() => groupTitularesAgenda(filtered), [filtered]);
  const selected = useMemo(() => new Set(value.filter(Boolean)), [value]);

  const allIds = useMemo(() => titulares.map((u) => u.id), [titulares]);
  const allChecked =
    allIds.length > 0 && allIds.every((id) => selected.has(id) || id === lockedUserId);

  const toggleTodos = (checked: boolean) => {
    if (checked) {
      const next = new Set(allIds);
      if (lockedUserId) next.add(lockedUserId);
      onChange([...next]);
      return;
    }
    onChange(lockedUserId ? [lockedUserId] : []);
  };

  const toggleOne = (id: string, checked: boolean) => {
    if (lockedUserId && id === lockedUserId) return;
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    if (lockedUserId) next.add(lockedUserId);
    if (next.size === 0) return;
    onChange([...next]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground shrink-0" />
        <Label className="text-sm font-semibold">Titulares (responsáveis)</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Quem marcou o lembrete já é titular. Você pode designar qualquer usuário do sistema —
        inclusive montadores e projetistas. Só os titulares veem este lembrete na agenda.
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Carregando usuários...
        </div>
      ) : titulares.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          Nenhum usuário do sistema encontrado.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
            <Checkbox
              id="lembrete-titulares-todos"
              checked={allChecked}
              onCheckedChange={(v) => toggleTodos(v === true)}
            />
            <Label htmlFor="lembrete-titulares-todos" className="cursor-pointer font-medium text-sm">
              Todos os usuários do sistema
            </Label>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar titular pelo nome..."
              className="pl-9"
              autoComplete="off"
            />
          </div>

          <ScrollArea
            className={cn(compact ? 'h-[200px]' : 'h-[min(280px,40vh)]', 'rounded-md border', listClassName)}
          >
            <div className="p-2 space-y-3">
              {filtered.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  Nenhum usuário encontrado para “{busca.trim()}”.
                </p>
              ) : (
                <>
                  {grouped.equipe.length > 0 && (
                    <div className="space-y-1">
                      <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Equipe
                      </p>
                      {grouped.equipe.map((user) => {
                        const isLocked = !!lockedUserId && user.id === lockedUserId;
                        return (
                          <TitularRow
                            key={user.id}
                            user={user}
                            checked={selected.has(user.id) || isLocked}
                            locked={isLocked}
                            onToggle={toggleOne}
                          />
                        );
                      })}
                    </div>
                  )}

                  {grouped.montadores.length > 0 && (
                    <div className="space-y-1">
                      <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Montadores
                      </p>
                      {grouped.montadores.map((user) => {
                        const isLocked = !!lockedUserId && user.id === lockedUserId;
                        return (
                          <TitularRow
                            key={user.id}
                            user={user}
                            checked={selected.has(user.id) || isLocked}
                            locked={isLocked}
                            onToggle={toggleOne}
                          />
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}
