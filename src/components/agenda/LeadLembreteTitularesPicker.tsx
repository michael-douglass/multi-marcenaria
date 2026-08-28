import { useMemo } from 'react';
import { Users, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUsers, type DatabaseUser } from '@/hooks/useUsers';
import { cn } from '@/lib/utils';

/** Somente vendedores e administradores podem ser titulares de lembrete. */
const TITULAR_LEMBRETE_ROLES = new Set(['admin', 'vendedor']);

function filterTitularesLembrete(users: DatabaseUser[] | undefined): DatabaseUser[] {
  return [...(users ?? [])]
    .filter(
      (u) =>
        (u.tipo_usuario ?? 'colaborador') === 'colaborador' &&
        TITULAR_LEMBRETE_ROLES.has(u.role),
    )
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

interface LeadLembreteTitularesPickerProps {
  value: string[];
  onChange: (next: string[]) => void;
  /** Usuário que marcou o lembrete — sempre permanece titular. */
  lockedUserId?: string | null;
  listClassName?: string;
  compact?: boolean;
}

/**
 * Seletor de titulares do lembrete de lead.
 * Quem criou fica travado na lista; outros colaboradores podem ser adicionados.
 */
export function LeadLembreteTitularesPicker({
  value,
  onChange,
  lockedUserId,
  listClassName,
  compact = false,
}: LeadLembreteTitularesPickerProps) {
  const { users, isLoading } = useUsers();

  const colaboradores = useMemo(() => filterTitularesLembrete(users), [users]);
  const selected = useMemo(() => new Set(value.filter(Boolean)), [value]);

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
        Quem marcou o lembrete já é titular. Você pode incluir mais pessoas — só titulares veem este
        lembrete.
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Carregando colaboradores...
        </div>
      ) : colaboradores.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          Nenhum vendedor ou administrador encontrado.
        </p>
      ) : (
        <ScrollArea
          className={cn(compact ? 'h-[160px]' : 'h-[min(220px,35vh)]', 'rounded-md border', listClassName)}
        >
          <div className="p-2 space-y-1">
            {colaboradores.map((user) => {
              const isLocked = !!lockedUserId && user.id === lockedUserId;
              const checked = selected.has(user.id) || isLocked;
              return (
                <div
                  key={user.id}
                  className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent/50"
                >
                  <Checkbox
                    id={`lembrete-titular-${user.id}`}
                    checked={checked}
                    disabled={isLocked}
                    onCheckedChange={(v) => toggleOne(user.id, v === true)}
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
                      isLocked ? 'cursor-default' : 'cursor-pointer',
                    )}
                  >
                    {user.nome}
                    <span className="ml-1.5 text-[10px] text-muted-foreground">
                      ({user.role === 'admin' ? 'admin' : 'vendedor'}
                      {isLocked ? ' · quem marcou' : ''})
                    </span>
                  </Label>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
