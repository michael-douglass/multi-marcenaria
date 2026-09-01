import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { mapTitularAgendaRow, type TitularAgenda } from '@/lib/agenda-titulares';

export type { TitularAgenda };

export function useTitularesAgenda() {
  const { data: titulares = [], isLoading } = useQuery({
    queryKey: ['titulares-agenda'],
    queryFn: async (): Promise<TitularAgenda[]> => {
      const { data, error } = await supabase.rpc('movelaria_listar_titulares_agenda');
      if (error) throw error;
      return (data ?? []).map((row) => mapTitularAgendaRow(row as Record<string, unknown>));
    },
  });

  return { titulares, isLoading };
}
