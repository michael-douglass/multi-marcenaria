import { useQuery } from '@tanstack/react-query';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase';
import { useEmpresaTable } from '@/hooks/useEmpresaTable';
import { resolveMarketingMediasConfig, resolveScopedTableName, PUBLIC_WHITEBOARD } from '@/lib/empresa-tables';
import { isMissingDbRelationError } from '@/lib/supabase-missing-relation';
import type { LeadMidiaDisponivel } from '@/lib/orcamento-slide-types';
import {
  aiRenderToLeadMidia,
  listUnsyncedAiRenders,
} from '@/lib/lead-ai-render-attachments';
import type { LeadAIRender } from '@/hooks/useLeadAIRenders';

interface DBLeadAIRender {
  id: string;
  lead_id: number;
  input_snapshot: { label?: string };
  output_public_url: string;
  criado_em: string;
}

function adaptRenderRow(row: DBLeadAIRender): LeadAIRender {
  return {
    id: row.id,
    leadId: row.lead_id,
    inputSnapshot: {
      source: 'anexo',
      id: '',
      label: row.input_snapshot?.label ?? 'Projeto',
    },
    analiseTexto: '',
    outputStoragePath: '',
    outputPublicUrl: row.output_public_url,
    visionModel: '',
    imageModel: '',
    criadoPor: null,
    criadoEm: row.criado_em,
  };
}

export function useLeadMidiasParaOrcamento(leadId: number | null | undefined) {
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const mediasConfig = resolveMarketingMediasConfig(schemaEmpresa);
  const { lead_ai_renders: rendersTable } = useEmpresaTable();

  return useQuery({
    queryKey: ['lead-midias-para-orcamento', schemaEmpresa, leadId],
    enabled: queriesReady && !!leadId,
    queryFn: async (): Promise<LeadMidiaDisponivel[]> => {
      const result: LeadMidiaDisponivel[] = [];
      const urlsExistentes = new Set<string>();

      // Anexos do lead (imagens + PDFs → PDF vira páginas-imagem ao importar)
      try {
        const { data: medias } = await db
          .from(mediasConfig.mediasTable as 'marketing_medias')
          .select('id, file_url, file_name, criado_em, tipo, folder_id')
          .eq('lead_id', leadId!)
          .in('tipo', ['imagem', 'pdf'])
          .order('criado_em', { ascending: false });

        for (const m of medias ?? []) {
          const url = m.file_url as string;
          urlsExistentes.add(url);
          const isPdf = (m.tipo as string) === 'pdf';
          result.push({
            id: m.id as string,
            origem: 'lead_anexo',
            file_url: url,
            file_name: (m.file_name as string) || (isPdf ? 'documento.pdf' : 'imagem'),
            criado_em: m.criado_em as string,
            preview_label: isPdf ? 'PDF' : 'Anexo',
            tipo_arquivo: isPdf ? 'pdf' : 'imagem',
            folder_id: (m.folder_id as string | null) ?? null,
          });
        }
      } catch {
        // ignore if table doesn't exist for this schema
      }

      // Fotos da lousa digital (schema emp_* ou public master)
      try {
        const whiteboardTable = resolveScopedTableName(
          schemaEmpresa,
          'lead_whiteboard_images',
          PUBLIC_WHITEBOARD.images,
        );
        const { data: lousa } = await db
          .from(whiteboardTable as 'lead_whiteboard_images')
          .select('id, file_url, file_name, criado_em')
          .eq('lead_id', leadId!)
          .order('criado_em', { ascending: false });

        for (const l of lousa ?? []) {
          const url = l.file_url as string;
          if (urlsExistentes.has(url)) continue;
          urlsExistentes.add(url);
          result.push({
            id: l.id as string,
            origem: 'lead_whiteboard',
            file_url: url,
            file_name: (l.file_name as string) || 'lousa',
            criado_em: l.criado_em as string,
            preview_label: 'Lousa',
            tipo_arquivo: 'imagem',
            folder_id: null,
          });
        }
      } catch {
        // ignore
      }

      // Renderizações de IA ainda não sincronizadas como anexo (histórico antigo)
      try {
        const { data: renders, error: rendersError } = await db
          .from(rendersTable)
          .select('id, lead_id, input_snapshot, output_public_url, criado_em')
          .eq('lead_id', leadId!)
          .order('criado_em', { ascending: false });

        if (!rendersError && renders?.length) {
          const adapted = (renders as DBLeadAIRender[]).map(adaptRenderRow);
          const mediasFileNames = result
            .filter((m) => m.origem === 'lead_anexo')
            .map((m) => ({ file_name: m.file_name }));

          for (const render of listUnsyncedAiRenders(adapted, mediasFileNames)) {
            if (urlsExistentes.has(render.outputPublicUrl)) continue;
            urlsExistentes.add(render.outputPublicUrl);
            result.push(aiRenderToLeadMidia(render));
          }
        }
      } catch (err) {
        if (!isMissingDbRelationError(err)) {
          // ignore silenciosamente se tabela não existir
        }
      }

      return result.sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());
    },
  });
}
