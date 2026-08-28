import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Atalho } from './useAtalhos';

// Templates de texto que podem ser usados para disparos de reunião
export function useTemplatesDisparo() {
  return useQuery({
    queryKey: ['templates-disparo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_multiempresas_atalhos')
        .select('*')
        .not('mensagem', 'is', null)
        .is('url_audio', null)
        .is('url_pdf', null)
        .is('url_img', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar templates de disparo:', error);
        throw error;
      }

      return data as Atalho[];
    },
  });
}

// Variáveis disponíveis para templates de reunião
export const VARIAVEIS_REUNIAO = [
  { key: '{{nome}}', label: 'Nome do Convidado', description: 'Nome de quem agendou a reunião' },
  { key: '{{telefone}}', label: 'Telefone', description: 'Número de WhatsApp do convidado' },
  { key: '{{titulo}}', label: 'Título da Reunião', description: 'Título/nome da reunião agendada' },
  { key: '{{data}}', label: 'Data', description: 'Data da reunião (ex: 20/01/2026)' },
  { key: '{{horario}}', label: 'Horário', description: 'Horário da reunião (ex: 14:30)' },
  { key: '{{reuniao_id}}', label: 'ID da Reunião', description: 'Identificador único da reunião' },
] as const;

// Substituir variáveis no template
export function substituirVariaveis(
  template: string,
  dados: {
    nome?: string | null;
    telefone?: string | null;
    titulo?: string | null;
    data?: string | null;
    horario?: string | null;
    reuniao_id?: string | null;
  }
): string {
  let resultado = template;
  
  resultado = resultado.replace(/\{\{nome\}\}/g, dados.nome || 'Visitante');
  resultado = resultado.replace(/\{\{telefone\}\}/g, dados.telefone || '');
  resultado = resultado.replace(/\{\{titulo\}\}/g, dados.titulo || 'Reunião');
  resultado = resultado.replace(/\{\{data\}\}/g, dados.data || '');
  resultado = resultado.replace(/\{\{horario\}\}/g, dados.horario || '');
  resultado = resultado.replace(/\{\{reuniao_id\}\}/g, dados.reuniao_id || '');
  
  return resultado;
}
