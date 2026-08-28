/**
 * Página pública de apresentação do orçamento — sem autenticação.
 * URL: /orcamento/:schema/:id
 *
 * O "schema" vem da empresa (ex.: "emp_garbo"). O cliente recebe este link
 * e pode visualizar a apresentação sem precisar de conta no CRM.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { FileX } from 'lucide-react';
import { GarboBrandLoader } from '@/components/ui/garbo-brand-loader';
import { Button } from '@/components/ui/button';
import { OrcamentoSlideApresentacao } from '@/components/orcamento-slides/OrcamentoSlideApresentacao';
import { OrcamentoSlideExportMenu } from '@/components/orcamento-slides/OrcamentoSlideExportMenu';
import { useOrcamentoSlideExport } from '@/hooks/useOrcamentoSlideExport';
import { resolverMidiasApresentacao } from '@/lib/orcamento-slide-bloco-imagens';
import { isLinkPublicoAtivo } from '@/lib/orcamento-slide-public-link';
import type {
  OrcamentoFormaPagamento,
  OrcamentoSlide,
  OrcamentoSlideTemplate,
  OrcamentoSlideBloco,
  OrcamentoSlideMidia,
  OrcamentoPergunta,
  OrcamentoCatalogoItem,
} from '@/lib/orcamento-slide-types';
const SUPABASE_URL = 'https://zzqgtclvuetemzhqzhbq.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6cWd0Y2x2dWV0ZW16aHF6aGJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ4NDQxNjAsImV4cCI6MjA2MDQyMDE2MH0.3DizjUqKh1-pXhEK0dc-SC04NI4Aksch2FhU9vR8-Pk';

function makeClient(schema: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    db: { schema },
    auth: { persistSession: false },
  });
}

interface PageData {
  orcamento: OrcamentoSlide;
  template: OrcamentoSlideTemplate | null;
  blocos: OrcamentoSlideBloco[];
  midias: OrcamentoSlideMidia[];
  midiasOrcamento: OrcamentoSlideMidia[];
  perguntas: OrcamentoPergunta[];
  catalogoFerragens: OrcamentoCatalogoItem[];
  catalogoItens: OrcamentoCatalogoItem[];
  valorOrcamentoLead: number;
  formasPagamento: OrcamentoFormaPagamento[];
}

function useOrcamentoPublico(schema: string | undefined, id: string | undefined) {
  const [data, setData] = useState<PageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const reload = useCallback(() => setReloadTick((n) => n + 1), []);

  useEffect(() => {
    if (!schema || !id) return;
    let cancelled = false;
    const atualizacaoSilenciosa = reloadTick > 0;
    if (!atualizacaoSilenciosa) {
      setIsLoading(true);
      setNotFound(false);
    }

    async function load() {
      try {
        const db = makeClient(schema!);

        // 1. Orçamento
        const { data: orc, error: orcErr } = await db
          .from('orcamento_slides')
          .select('*')
          .eq('id', id!)
          .maybeSingle();

        if (orcErr || !orc) {
          setNotFound(true);
          return;
        }

        if (!isLinkPublicoAtivo(orc as OrcamentoSlide)) {
          setNotFound(true);
          return;
        }

        // 2. Template ativo
        const { data: tpls } = await db
          .from('orcamento_slide_templates')
          .select('*')
          .eq('ativo', true)
          .order('criado_em', { ascending: true })
          .limit(1);

        const template = (tpls?.[0] ?? null) as OrcamentoSlideTemplate | null;

        // 3. Blocos do template
        let blocos: OrcamentoSlideBloco[] = [];
        if (template?.id) {
          const { data: bls } = await db
            .from('orcamento_slide_blocos')
            .select('*')
            .eq('template_id', template.id)
            .order('ordem', { ascending: true });
          blocos = (bls ?? []) as OrcamentoSlideBloco[];
        }

        // 4. Mídias do orçamento
        const { data: mds } = await db
          .from('orcamento_slide_midias')
          .select('*')
          .eq('orcamento_id', id!)
          .order('ordem', { ascending: true });

        const midiasOrc = (mds ?? []) as OrcamentoSlideMidia[];

        const { data: perguntasRaw } = await db
          .from('orcamento_slide_perguntas')
          .select('*')
          .eq('ativo', true)
          .order('ordem', { ascending: true });

        const perguntaIds = (perguntasRaw ?? []).map((p) => p.id);
        let opcoesRaw: { pergunta_id: string }[] = [];
        if (perguntaIds.length > 0) {
          const { data: opcoes } = await db
            .from('orcamento_slide_pergunta_opcoes')
            .select('*')
            .in('pergunta_id', perguntaIds)
            .order('ordem', { ascending: true });
          opcoesRaw = opcoes ?? [];
        }

        const perguntas = (perguntasRaw ?? []).map((p) => ({
          ...p,
          opcoes: opcoesRaw.filter((o) => o.pergunta_id === p.id),
        })) as OrcamentoPergunta[];

        const { data: catalogoRaw } = await db
          .from('orcamento_slide_catalogo')
          .select('*')
          .eq('ativo', true)
          .in('categoria', ['ferragem', 'mdf'])
          .order('ordem', { ascending: true });

        let valorOrcamentoLead = 0;
        const leadId = (orc as OrcamentoSlide).lead_id;
        if (leadId) {
          const { data: leadRow } = await db
            .from('leads')
            .select('valor_orcamento')
            .eq('id', leadId)
            .maybeSingle();
          valorOrcamentoLead = Number(leadRow?.valor_orcamento ?? 0);
        }

        const { data: formasRaw } = await db
          .from('orcamento_slide_formas_pagamento')
          .select('*')
          .eq('ativo', true)
          .order('ordem', { ascending: true });

        const catalogoItens = (catalogoRaw ?? []) as OrcamentoCatalogoItem[];
        setData({
          orcamento: orc as OrcamentoSlide,
          template,
          blocos,
          midias: resolverMidiasApresentacao(midiasOrc, blocos),
          midiasOrcamento: midiasOrc,
          perguntas,
          catalogoFerragens: catalogoItens.filter((c) => c.categoria === 'ferragem'),
          catalogoItens,
          valorOrcamentoLead,
          formasPagamento: (formasRaw ?? []) as OrcamentoFormaPagamento[],
        });
      } catch {
        if (!atualizacaoSilenciosa) setNotFound(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [schema, id, reloadTick]);

  useEffect(() => {
    if (!schema || !id) return;
    const db = makeClient(schema);
    const channel = db
      .channel(`orcamento-publico-${schema}-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema,
          table: 'orcamento_slides',
          filter: `id=eq.${id}`,
        },
        () => reload(),
      )
      .subscribe();

    return () => {
      void db.removeChannel(channel);
    };
  }, [schema, id, reload]);

  useEffect(() => {
    const templateId = data?.template?.id;
    if (!schema || !templateId) return;
    const db = makeClient(schema);
    const channel = db
      .channel(`orcamento-publico-blocos-${schema}-${templateId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema,
          table: 'orcamento_slide_blocos',
          filter: `template_id=eq.${templateId}`,
        },
        () => reload(),
      )
      .subscribe();

    return () => {
      void db.removeChannel(channel);
    };
  }, [schema, data?.template?.id, reload]);

  return { data, isLoading, notFound };
}

function OrcamentoPublicoConteudo({ data }: { data: PageData }) {
  const presentationProps = useMemo(
    () => ({
      orcamento: data.orcamento,
      template: data.template,
      blocos: data.blocos,
      midias: data.midias,
      perguntas: data.perguntas,
      catalogoFerragens: data.catalogoFerragens,
      catalogoItens: data.catalogoItens,
      valorOrcamentoLead: data.valorOrcamentoLead,
      formasPagamento: data.formasPagamento,
      midiasOrcamento: data.midiasOrcamento,
    }),
    [data],
  );

  const tituloExport = data.orcamento.cliente_nome || data.orcamento.identificador;
  const { exportar, isExporting, exportPortal } = useOrcamentoSlideExport({
    titulo: tituloExport,
    presentationProps,
  });

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0a0706]">
      <div
        className="z-20 flex shrink-0 items-center justify-between gap-3 px-4 py-2.5"
        style={{ background: '#2a1812', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-widest text-amber-400/80">
            Proposta comercial
          </p>
          <p className="truncate text-sm font-semibold text-white">{data.orcamento.cliente_nome}</p>
        </div>
        <OrcamentoSlideExportMenu
          label="Baixar"
          className="shrink-0"
          onExport={(viewport, format) => void exportar(viewport, format)}
          isExporting={isExporting}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-full min-h-0 w-full flex-1 flex-col">
          <OrcamentoSlideApresentacao
            orcamento={data.orcamento}
            template={data.template}
            blocos={data.blocos}
            midias={data.midias}
            perguntas={data.perguntas}
            catalogoFerragens={data.catalogoFerragens}
            catalogoItens={data.catalogoItens}
            valorOrcamentoLead={data.valorOrcamentoLead}
            formasPagamento={data.formasPagamento}
            midiasOrcamento={data.midiasOrcamento}
            className="h-full flex-1"
            embeddedInLayout
          />
        </div>
      </div>

      {exportPortal}
    </div>
  );
}

export default function OrcamentoPublicoPage() {
  const { schema, id } = useParams<{ schema: string; id: string }>();
  const { data, isLoading, notFound } = useOrcamentoPublico(schema, id);

  if (isLoading) {
    return <GarboBrandLoader variant="fullscreen" message="Carregando orçamento…" />;
  }

  if (notFound || !data) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen gap-6 text-center px-6"
        style={{ background: '#2a1812' }}
      >
        <FileX className="h-14 w-14 text-amber-400/50" />
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Orçamento não encontrado</h1>
          <p className="text-white/50 text-base">
            Este link pode ter expirado ou o orçamento foi removido.
          </p>
        </div>
      </div>
    );
  }

  return <OrcamentoPublicoConteudo data={data} />;
}
