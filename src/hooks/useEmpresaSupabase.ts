import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { isSchemaApiExposed } from '@/lib/empresa-tables';

export { isSchemaApiExposed };

/**
 * Retorna um cliente Supabase configurado para o schema correto da empresa.
 *
 * - Schema exposto na API (ex.: public): usa supabase.schema() quando aplicável
 * - Schema emp_* ainda não exposto: fallback para public + tabelas CRM-multi-empresas>...
 */
export function useEmpresaSupabase() {
  const { schemaEmpresa } = useEmpresa();

  return useMemo(() => {
    if (isSchemaApiExposed(schemaEmpresa)) {
      return supabase.schema(schemaEmpresa) as typeof supabase;
    }
    return supabase;
  }, [schemaEmpresa]);
}

/**
 * Retorna o nome da tabela correto dependendo do contexto:
 * - Schema exposto na API: nome simples (ex: 'leads')
 * - Caso contrário: nome com prefixo no public (ex: 'CRM-multi-empresas>leads<')
 */
export function useTableName() {
  const { schemaEmpresa } = useEmpresa();

  return useMemo(() => {
    return (baseTable: string, publicTable: string) => {
      if (isSchemaApiExposed(schemaEmpresa)) {
        return baseTable;
      }
      return publicTable;
    };
  }, [schemaEmpresa]);
}
