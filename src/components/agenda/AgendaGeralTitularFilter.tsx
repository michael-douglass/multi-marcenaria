import { Users } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import type { AgendaGeralAdminTitularFilter } from '@/hooks/useAgendaGeral';
import type { DatabaseUser } from '@/hooks/useUsers';

interface AgendaGeralTitularFilterProps {
  filter: AgendaGeralAdminTitularFilter;
  users: DatabaseUser[] | undefined;
  onModeChange: (mode: 'all' | 'self' | 'provider', titularId?: string) => void;
  isSaving: boolean;
}

export function AgendaGeralTitularFilter({
  filter,
  users,
  onModeChange,
  isSaving,
}: AgendaGeralTitularFilterProps) {
  const { user } = useAuth();

  const handleModeChange = (mode: 'all' | 'self' | 'provider') => {
    if (mode === 'provider') {
      const currentId = filter.filter_titular_id;
      const stillValid = !!(currentId && users?.some((u) => u.id === currentId));
      const pick = stillValid
        ? currentId!
        : users?.find((u) => u.id !== user?.id)?.id ?? users?.[0]?.id;
      if (!pick) return;
      onModeChange('provider', pick);
      return;
    }
    onModeChange(mode);
  };

  const sortedUsers = [...(users ?? [])].sort((a, b) =>
    a.nome.localeCompare(b.nome, 'pt-BR'),
  );

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed bg-muted/40 px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
        <Users className="h-3.5 w-3.5" />
        <span className="font-medium">Titularidade:</span>
      </div>

      <Select
        value={filter.filter_mode}
        onValueChange={(v) => handleModeChange(v as 'all' | 'self' | 'provider')}
        disabled={isSaving}
      >
        <SelectTrigger className="h-7 w-auto min-w-[160px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os usuários</SelectItem>
          <SelectItem value="self">Somente os meus</SelectItem>
          <SelectItem value="provider">Somente de um usuário…</SelectItem>
        </SelectContent>
      </Select>

      {filter.filter_mode === 'provider' && (
        <Select
          value={filter.filter_titular_id ?? ''}
          onValueChange={(id) => onModeChange('provider', id)}
          disabled={isSaving}
        >
          <SelectTrigger className="h-7 w-auto min-w-[180px] text-xs">
            <SelectValue placeholder="Selecionar usuário" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {sortedUsers.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.nome}
                {u.id === user?.id ? ' (eu)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
