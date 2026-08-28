import type { QueryClient } from '@tanstack/react-query';

/** Limpa cache de dados que dependem da empresa ativa (leads, kanban, usuários, etc.). */
export function invalidateEmpresaScopedQueries(queryClient: QueryClient) {
  const keys = [
    'leads',
    'kanban-config-pages',
    'lead-origins',
    'regioes',
    'pipeline-custom-stages',
    'unread-messages',
    'leads-meetings',
    'lead-single-enriched',
    'users',
    'usuarios',
    'agenda',
    'lead-custom-fields',
  ];
  keys.forEach((key) => {
    queryClient.invalidateQueries({ queryKey: [key] });
  });
}
