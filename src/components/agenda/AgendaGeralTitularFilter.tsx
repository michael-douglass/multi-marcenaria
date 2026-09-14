import { Users } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AgendaTitularCombobox } from '@/components/agenda/AgendaTitularCombobox';
import { useAuth } from '@/contexts/AuthContext';
import { useTitularesAgenda } from '@/hooks/useTitularesAgenda';
import type { AgendaGeralAdminTitularFilter } from '@/hooks/useAgendaGeral';

interface AgendaGeralTitularFilterProps {
  filter: AgendaGeralAdminTitularFilter;
  onModeChange: (mode: 'all' | 'self' | 'provider', titularId?: string) => void;
  isSaving: boolean;
}

export function AgendaGeralTitularFilter({
  filter,
  onModeChange,
  isSaving,
}: AgendaGeralTitularFilterProps) {
  const { user } = useAuth();
  const { titulares } = useTitularesAgenda();

  const handleModeChange = (mode: 'all' | 'self' | 'provider') => {
    if (mode === 'provider') {
      const currentId = filter.filter_titular_id;
      const stillValid = !!(currentId && titulares.some((u) => u.id === currentId));
      const pick = stillValid
        ? currentId!
        : titulares.find((u) => u.id !== user?.id)?.id ?? titulares[0]?.id;
      if (!pick) return;
      onModeChange('provider', pick);
      return;
    }
    onModeChange(mode);
  };

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
        <AgendaTitularCombobox
          value={filter.filter_titular_id ?? ''}
          onChange={(id) => onModeChange('provider', id)}
          disabled={isSaving}
          placeholder="Buscar titular (equipe ou montador)..."
          className="min-w-[220px] flex-1 sm:max-w-md"
        />
      )}
    </div>
  );
}
