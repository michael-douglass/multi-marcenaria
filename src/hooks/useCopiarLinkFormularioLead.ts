import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase, useTableName } from '@/hooks/useEmpresaSupabase';
import { resolveLeadsQueryConfig } from '@/lib/empresa-tables';
import { patchLeadInAllCaches } from '@/lib/leads-cache';
import {
  gerarTokenFormOrcamento,
  linkPublicoFormInicioOrcamento,
} from '@/lib/orcamento-form-public-link';

/**
 * Gera (se preciso) e copia o link público do formulário do lead.
 * O cliente abre sem login; ao enviar, o CRM cria um contrato em rascunho neste card.
 */
export function useCopiarLinkFormularioLead(leadId: number) {
  const queryClient = useQueryClient();
  const { schemaEmpresa } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = useTableName();
  const leadsConfig = resolveLeadsQueryConfig(schemaEmpresa);
  const [isCopiando, setIsCopiando] = useState(false);

  const copiar = async () => {
    if (!schemaEmpresa || isCopiando) return;
    setIsCopiando(true);
    try {
      const leadsTable = table('leads', leadsConfig.leadsTable);
      const { data: leadRow, error: leadErr } = await db
        .from(leadsTable)
        .select('id, token_form_orcamento')
        .eq('id', leadId)
        .maybeSingle();
      if (leadErr) throw leadErr;

      let token =
        (leadRow as { token_form_orcamento?: string | null } | null)?.token_form_orcamento ?? null;
      if (!token) {
        token = gerarTokenFormOrcamento();
        const { error: updErr } = await db
          .from(leadsTable)
          .update({ token_form_orcamento: token })
          .eq('id', leadId);
        if (updErr) throw updErr;
        patchLeadInAllCaches(queryClient, leadId, {
          token_form_orcamento: token,
        });
      }

      const url = linkPublicoFormInicioOrcamento(schemaEmpresa, token);
      await navigator.clipboard.writeText(url);
      toast.success('Link público do formulário copiado!', {
        description:
          'Envie ao cliente: ele preenche sem cadastro e o contrato em rascunho aparece neste card.',
      });
    } catch (e) {
      toast.error('Não foi possível gerar o link', {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setIsCopiando(false);
    }
  };

  return {
    copiar,
    isCopiando,
    podeCopiar: !!schemaEmpresa,
  };
}
