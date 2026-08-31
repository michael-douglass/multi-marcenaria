import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil } from 'lucide-react';
import { GarboBrandLoader } from '@/components/ui/garbo-brand-loader';
import { Button } from '@/components/ui/button';
import { useOrcamentoPorId, useOrcamentoSlides } from '@/hooks/useOrcamentoSlides';
import { useOrcamentoSlideTemplate } from '@/hooks/useOrcamentoSlideTemplate';
import { useOrcamentoSlideBlocos } from '@/hooks/useOrcamentoSlideBlocos';
import { useOrcamentoSlideMidias } from '@/hooks/useOrcamentoSlideMidias';
import { useOrcamentoSlidePerguntas } from '@/hooks/useOrcamentoSlidePerguntas';
import { useOrcamentoSlideCatalogo } from '@/hooks/useOrcamentoSlideCatalogo';
import { useOrcamentoSlideFormasPagamento } from '@/hooks/useOrcamentoSlideFormasPagamento';
import { useLeadDetail } from '@/hooks/useLeads';
import { useOrcamentoSlideRealtime } from '@/hooks/useOrcamentoSlideRealtime';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { OrcamentoSlideApresentacao } from '@/components/orcamento-slides/OrcamentoSlideApresentacao';
import { OrcamentoSlideExportMenu } from '@/components/orcamento-slides/OrcamentoSlideExportMenu';
import { OrcamentoAnaliseIAEditor } from '@/components/orcamento-slides/OrcamentoAnaliseIAEditor';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { patchTextosAnaliseIa } from '@/lib/orcamento-slide-analise-ia';
import { useOrcamentoSlideExport } from '@/hooks/useOrcamentoSlideExport';
import { resolverMidiasApresentacao } from '@/lib/orcamento-slide-bloco-imagens';
import type {
  OrcamentoFormaPagamento,
  OrcamentoSlide,
  OrcamentoSlideBloco,
  OrcamentoSlideMidia,
  OrcamentoSlideTemplate,
  OrcamentoCatalogoItem,
  OrcamentoPergunta,
} from '@/lib/orcamento-slide-types';
interface ApresentarOrcamentoSlidePageProps {
  orcamentoId?: string;
  /** Se informado, o Voltar fecha a visualização em vez de sair da página. */
  onVoltar?: () => void;
}

interface ConteudoProps {
  orcamento: OrcamentoSlide;
  orcamentoLocal: OrcamentoSlide;
  onOrcamentoLocalChange: (next: OrcamentoSlide) => void;
  template: OrcamentoSlideTemplate | null;
  blocos: OrcamentoSlideBloco[];
  midiasApresentacao: OrcamentoSlideMidia[];
  midias: OrcamentoSlideMidia[];
  perguntas: OrcamentoPergunta[];
  catalogoFerragens: OrcamentoCatalogoItem[];
  catalogoItens: OrcamentoCatalogoItem[];
  valorOrcamentoLead: number;
  formasPagamento: OrcamentoFormaPagamento[];
  onVoltar: () => void;
}

function ApresentarOrcamentoSlideConteudo({
  orcamento,
  orcamentoLocal,
  onOrcamentoLocalChange,
  template,
  blocos,
  midiasApresentacao,
  midias,
  perguntas,
  catalogoFerragens,
  catalogoItens,
  valorOrcamentoLead,
  formasPagamento,
  onVoltar,
}: ConteudoProps) {
  const { salvarOrcamento } = useOrcamentoSlides();
  const [editorOpen, setEditorOpen] = useState(false);

  const blocosAnalise = useMemo(
    () => blocos.filter((b) => b.tipo === 'analise_ia' && b.ativo),
    [blocos],
  );

  const presentationOrcamento = orcamentoLocal;

  const presentationProps = useMemo(
    () => ({
      orcamento: presentationOrcamento,
      template,
      blocos,
      midias: midiasApresentacao,
      perguntas,
      catalogoFerragens,
      catalogoItens,
      valorOrcamentoLead,
      formasPagamento,
      midiasOrcamento: midias,
    }),
    [
      presentationOrcamento,
      template,
      blocos,
      midiasApresentacao,
      perguntas,
      catalogoFerragens,
      catalogoItens,
      valorOrcamentoLead,
      formasPagamento,
      midias,
    ],
  );

  const { exportar, isExporting, exportPortal } = useOrcamentoSlideExport({
    titulo: orcamento.cliente_nome || orcamento.identificador,
    presentationProps,
  });

  const salvarTextosAnalise = useCallback(
    async (blocoId: string, values: { etiqueta: string; titulo: string; corpo: string }) => {
      const textos_blocos = patchTextosAnaliseIa(orcamentoLocal.dados.textos_blocos ?? {}, blocoId, values);
      const next: OrcamentoSlide = {
        ...orcamentoLocal,
        dados: { ...orcamentoLocal.dados, textos_blocos },
      };
      onOrcamentoLocalChange(next);
      await salvarOrcamento.mutateAsync({
        id: next.id,
        identificador: next.identificador,
        lead_id: next.lead_id,
        cliente_nome: next.cliente_nome,
        status: next.status,
        dados: next.dados,
      });
    },
    [onOrcamentoLocalChange, orcamentoLocal, salvarOrcamento],
  );

  const salvarVisibilidadeAnalise = useCallback(
    async (visivel: boolean) => {
      const next: OrcamentoSlide = {
        ...orcamentoLocal,
        dados: {
          ...orcamentoLocal.dados,
          _meta: {
            ...orcamentoLocal.dados._meta,
            ocultar_analise_ia: !visivel,
          },
        },
      };
      onOrcamentoLocalChange(next);
      await salvarOrcamento.mutateAsync({
        id: next.id,
        identificador: next.identificador,
        lead_id: next.lead_id,
        cliente_nome: next.cliente_nome,
        status: next.status,
        dados: next.dados,
      });
    },
    [onOrcamentoLocalChange, orcamentoLocal, salvarOrcamento],
  );

  const analiseVisivelNaApresentacao = !presentationOrcamento.dados?._meta?.ocultar_analise_ia;

  return (
    <div className="paper-dark-surface flex h-[100dvh] max-h-[100dvh] min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#0a0706]">
      <div
        className="flex items-center justify-between px-4 py-2 shrink-0 z-10"
        style={{ background: '#2a1812', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={onVoltar}
          className="text-white/70 hover:text-white hover:bg-white/10 gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>

        <div className="flex items-center gap-2">
          <span className="text-white/60 text-sm font-medium hidden sm:block">
            {orcamento.cliente_nome}
          </span>
          {blocosAnalise.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditorOpen(true)}
              className="h-8 border-amber-500/40 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Editar análise IA
            </Button>
          )}
          <OrcamentoSlideExportMenu
            onExport={(viewport, format) => void exportar(viewport, format)}
            isExporting={isExporting}
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
          <OrcamentoSlideApresentacao
            orcamento={presentationOrcamento}
            template={template}
            blocos={blocos}
            midias={midiasApresentacao}
            perguntas={perguntas}
            catalogoFerragens={catalogoFerragens}
            catalogoItens={catalogoItens}
            valorOrcamentoLead={valorOrcamentoLead}
            formasPagamento={formasPagamento}
            midiasOrcamento={midias}
            className="h-full flex-1"
            embeddedInLayout
          />
        </div>
      </div>

      {exportPortal}

      <Sheet open={editorOpen} onOpenChange={setEditorOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto bg-background">
          <SheetHeader>
            <SheetTitle>Editar análise na apresentação</SheetTitle>
            <SheetDescription>
              Ajuste etiqueta, título e todo o texto que o cliente verá no slide de análise de IA.
              Use o interruptor para ocultar o slide deste orçamento sem apagar o conteúdo.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {blocosAnalise.map((bloco) => (
              <OrcamentoAnaliseIAEditor
                key={bloco.id}
                bloco={bloco}
                orcamento={presentationOrcamento}
                onChange={(values) => void salvarTextosAnalise(bloco.id, values)}
                visivelNaApresentacao={analiseVisivelNaApresentacao}
                onVisivelChange={(visivel) => void salvarVisibilidadeAnalise(visivel)}
              />
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function resolveOrcamentoId(paramId: string | undefined, pathname: string, propId?: string) {
  return (
    propId ??
    paramId ??
    pathname.match(/^\/orcamento-slides\/([^/]+)\/apresentar\/?$/)?.[1]
  );
}

export default function ApresentarOrcamentoSlidePage({
  orcamentoId: orcamentoIdProp,
  onVoltar: onVoltarProp,
}: ApresentarOrcamentoSlidePageProps = {}) {
  const { id: paramId } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const voltar = useCallback(() => {
    if (onVoltarProp) {
      onVoltarProp();
      return;
    }
    navigate(-1);
  }, [navigate, onVoltarProp]);
  const queryClient = useQueryClient();
  const { schemaEmpresa } = useEmpresa();
  const orcamentoId = resolveOrcamentoId(paramId, location.pathname, orcamentoIdProp);

  const { data: orcamento, isLoading: loadingOrc, isError, error } = useOrcamentoPorId(orcamentoId);
  const { template, isLoading: loadingTpl } = useOrcamentoSlideTemplate();
  const { blocos, isLoading: loadingBlocos } = useOrcamentoSlideBlocos(template?.id);

  const invalidarOrcamento = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: ['orcamento-slide-por-id', schemaEmpresa, orcamentoId],
    });
  }, [queryClient, schemaEmpresa, orcamentoId]);

  const invalidarBlocos = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: ['orcamento-slide-blocos', schemaEmpresa, template?.id],
    });
  }, [queryClient, schemaEmpresa, template?.id]);

  useOrcamentoSlideRealtime({
    orcamentoId,
    templateId: template?.id,
    schema: schemaEmpresa,
    onOrcamentoChange: invalidarOrcamento,
    onBlocosChange: invalidarBlocos,
    enabled: !!orcamentoId,
  });
  const { midias, isLoading: loadingMidias } = useOrcamentoSlideMidias(orcamentoId);
  const { perguntas, isLoading: loadingPerguntas } = useOrcamentoSlidePerguntas();
  const { itens: catalogoFerragens, isLoading: loadingCatalogoFerragens } = useOrcamentoSlideCatalogo('ferragem');
  const { itens: catalogoMdf, isLoading: loadingCatalogoMdf } = useOrcamentoSlideCatalogo('mdf');
  const catalogoItens = useMemo(
    () => [...catalogoFerragens, ...catalogoMdf],
    [catalogoFerragens, catalogoMdf],
  );
  const { data: leadVinculado } = useLeadDetail(orcamento?.lead_id);
  const { formas: formasPagamento } = useOrcamentoSlideFormasPagamento();
  const valorOrcamentoLead = Number(leadVinculado?.valor_orcamento ?? 0);

  const midiasApresentacao = useMemo(
    () => resolverMidiasApresentacao(midias, blocos),
    [midias, blocos],
  );

  const [orcamentoLocal, setOrcamentoLocal] = useState<OrcamentoSlide | null>(null);

  useEffect(() => {
    if (!orcamento) return;
    setOrcamentoLocal((prev) => {
      if (!prev || prev.id !== orcamento.id) return orcamento;
      return orcamento;
    });
  }, [orcamento]);

  const isLoading =
    loadingOrc || loadingTpl || loadingBlocos || loadingMidias || loadingPerguntas || loadingCatalogoFerragens || loadingCatalogoMdf;

  if (isLoading) {
    return <GarboBrandLoader variant="fullscreen" message="Preparando apresentação…" />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#2a1812] text-white gap-4 px-4 text-center">
        <p className="text-xl">Erro ao carregar o orçamento.</p>
        <p className="text-sm text-white/60">{error instanceof Error ? error.message : 'Tente novamente.'}</p>
        <Button variant="outline" onClick={voltar}>
          Voltar
        </Button>
      </div>
    );
  }

  if (!orcamento) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#2a1812] text-white gap-4">
        <p className="text-xl">Orçamento não encontrado.</p>
        <Button variant="outline" onClick={voltar}>
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <ApresentarOrcamentoSlideConteudo
      orcamento={orcamento}
      orcamentoLocal={orcamentoLocal ?? orcamento}
      onOrcamentoLocalChange={setOrcamentoLocal}
      template={template}
      blocos={blocos}
      midiasApresentacao={midiasApresentacao}
      midias={midias}
      perguntas={perguntas}
      catalogoFerragens={catalogoFerragens}
      catalogoItens={catalogoItens}
      valorOrcamentoLead={valorOrcamentoLead}
      formasPagamento={formasPagamento}
      onVoltar={voltar}
    />
  );
}
