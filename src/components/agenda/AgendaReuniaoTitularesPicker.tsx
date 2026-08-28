import { useMemo } from 'react';
import { Users, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUsers, type DatabaseUser } from '@/hooks/useUsers';
import { isTodosTitulares } from '@/lib/agenda-reuniao-titulares';
import { cn } from '@/lib/utils';

/** Somente vendedores e administradores podem ser titulares da agenda de tarefas. */
const TITULAR_AGENDA_ROLES = new Set(['admin', 'vendedor']);

function filterTitularesAgenda(users: DatabaseUser[] | undefined): DatabaseUser[] {
  return [...(users ?? [])]
    .filter(
      (u) =>
        (u.tipo_usuario ?? 'colaborador') === 'colaborador' &&
        TITULAR_AGENDA_ROLES.has(u.role),
    )
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

interface AgendaReuniaoTitularesPickerProps {
  value: string[] | null;
  onChange: (next: string[] | null) => void;
  /** Altura da lista de usuários */
  listClassName?: string;
  compact?: boolean;
}

/**
 * Seletor de titulares da reunião.
 * "Todos" (marcado) grava null — todos os vendedores e administradores são titulares.
 * Desmarcar "Todos" e escolher pessoas grava os IDs.
 */
export function AgendaReuniaoTitularesPicker({
  value,
  onChange,
  listClassName,
  compact = false,
}: AgendaReuniaoTitularesPickerProps) {
  const { users, isLoading } = useUsers();

  const colaboradores = useMemo(() => filterTitularesAgenda(users), [users]);

  const todosAtivo = isTodosTitulares(value);
  const selected = useMemo(() => new Set(value ?? []), [value]);

  const allChecked =
    !todosAtivo &&
    colaboradores.length > 0 &&
    colaboradores.every((u) => selected.has(u.id));

  const toggleTodos = (checked: boolean) => {
    if (checked) {
      onChange(null);
      return;
    }
    // Ao sair de "todos", começa sem ninguém — usuário escolhe
    onChange([]);
  };

  const toggleOne = (id: string, checked: boolean) => {
    if (todosAtivo) {
      // Sai de "todos" e marca só este (ou nenhum se desmarcar)
      onChange(checked ? [id] : []);
      return;
    }
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);

    // Se marcou todos individualmente → volta para null (todos)
    if (colaboradores.length > 0 && colaboradores.every((u) => next.has(u.id))) {
      onChange(null);
      return;
    }
    onChange([...next]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground shrink-0" />
        <Label className="text-sm font-semibold">Titulares</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Só vendedores e administradores. Agendamentos do formulário público nascem com todos
        como titulares; depois você pode escolher quem fica responsável.
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
        <>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
            <Checkbox
              id="titulares-todos"
              checked={todosAtivo || allChecked}
              onCheckedChange={(v) => toggleTodos(v === true)}
            />
            <Label htmlFor="titulares-todos" className="cursor-pointer font-medium text-sm">
              Todos (vendedores e administradores)
            </Label>
          </div>

          <ScrollArea className={cn(compact ? 'h-[160px]' : 'h-[min(220px,35vh)]', 'rounded-md border', listClassName)}>
            <div className="p-2 space-y-1">
              {colaboradores.map((user) => {
                const checked = todosAtivo || selected.has(user.id);
                return (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent/50"
                  >
                    <Checkbox
                      id={`titular-${user.id}`}
                      checked={checked}
                      onCheckedChange={(v) => toggleOne(user.id, v === true)}
                    />
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px]">
                        {user.nome?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <Label
                      htmlFor={`titular-${user.id}`}
                      className="flex-1 cursor-pointer text-sm font-normal"
                    >
                      {user.nome}
                      <span className="ml-1.5 text-[10px] text-muted-foreground">
                        ({user.role === 'admin' ? 'admin' : 'vendedor'})
                      </span>
                    </Label>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}
