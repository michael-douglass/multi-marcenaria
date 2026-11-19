/**
 * Página pública de apresentação do orçamento — sem autenticação.
 * URL: /orcamento/:schema/:id
 *
 * O ":schema" da URL é mantido só por compatibilidade com links antigos; os dados vêm da RPC
 * `orcamento_publico_obter`, que resolve a empresa pelo próprio orçamento.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { FileX } from 'lucide-react';
import { BrandLoader } from '@/components/ui/brand-loader';
import { Button } from '@/components/ui/button';
import { OrcamentoSlideApresentacao } from '@/components/orcamento-slides/OrcamentoSlideApresentacao';
import {
  EmpresaPublicaProvider,
  type EmpresaDadosLegaisFonte,
} from '@/components/orcamento-slides/EmpresaDadosLegais';
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
// Projeto Supabase vem do ambiente (mesmas variáveis de src/lib/supabase.ts).
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

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
  /** Empresa dona do orçamento (razão social, CNPJ…), do RPC público. */
  empresa: EmpresaDadosLegaisFonte | null;
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
        // Uma RPC devolve tudo, já filtrado pela empresa do orçamento (isolamento multi-empresa).
        // Ela retorna null se o orçamento não existir, o link estiver oculto ou a empresa bloqueada.
        const db = makeClient('public');
        const { data: res, error } = await db.rpc('orcamento_publico_obter', { p_id: id! });
        if (cancelled) return;
        if (error || !res) {
          setNotFound(true);
          return;
        }
        const r = res as {
          orcamento: OrcamentoSlide;
          template: OrcamentoSlideTemplate | null;
          blocos: OrcamentoSlideBloco[];
          midias: OrcamentoSlideMidia[];
          perguntas: OrcamentoPergunta[];
          catalogo: OrcamentoCatalogoItem[];
          formas_pagamento: OrcamentoFormaPagamento[];
          valor_orcamento_lead: number | string | null;
          empresa?: EmpresaDadosLegaisFonte | null;
        };
        if (!isLinkPublicoAtivo(r.orcamento)) {
          setNotFound(true);
          return;
        }
        const blocos = r.blocos ?? [];
        const midiasOrc = r.midias ?? [];
        const catalogoItens = r.catalogo ?? [];
        setData({
          orcamento: r.orcamento,
          template: r.template,
          blocos,
          midias: resolverMidiasApresentacao(midiasOrc, blocos),
          midiasOrcamento: midiasOrc,
          perguntas: r.perguntas ?? [],
          catalogoFerragens: catalogoItens.filter((c) => c.categoria === 'ferragem'),
          catalogoItens,
          valorOrcamentoLead: Number(r.valor_orcamento_lead ?? 0),
          formasPagamento: r.formas_pagamento ?? [],
          empresa: r.empresa ?? null,
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

  // Atualização periódica: com o isolamento por empresa, o anon não recebe eventos realtime do CRM.
  useEffect(() => {
    if (!id) return;
    const t = window.setInterval(reload, 30_000);
    return () => window.clearInterval(t);
  }, [id, reload]);

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
    <EmpresaPublicaProvider empresa={data.empresa}>
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
    </EmpresaPublicaProvider>
  );
}

export default function OrcamentoPublicoPage() {
  const { schema, id } = useParams<{ schema: string; id: string }>();
  const { data, isLoading, notFound } = useOrcamentoPublico(schema, id);

  if (isLoading) {
    return <BrandLoader variant="fullscreen" message="Carregando orçamento…" />;
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
