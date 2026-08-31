import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams, useParams, useLocation } from 'react-router-dom';
import { GarboBrandLoader } from '@/components/ui/garbo-brand-loader';
import {
  ArrowLeft,
  ChevronRight,
  Users,
  MessageSquare,
  Image,
  DollarSign,
  Loader2,
  Check,
  Upload,
  Trash2,
  X,
  Cloud,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  useOrcamentoSlides,
  useOrcamentoPorId,
  useOrcamentoRascunhoAtual,
  useOrcamentoRascunhoPorId,
} from '@/hooks/useOrcamentoSlides';
import { useLeadDetail } from '@/hooks/useLeads';
import { useSyncLeadOrcamentoValor } from '@/hooks/useSyncLeadOrcamentoValor';
import { useOrcamentoSlidePerguntas } from '@/hooks/useOrcamentoSlidePerguntas';
import { useOrcamentoSlideMidias } from '@/hooks/useOrcamentoSlideMidias';
import { PrecificacaoForm } from '@/components/orcamento-slides/PrecificacaoForm';
import { LeadMidiasPicker } from '@/components/orcamento-slides/LeadMidiasPicker';
import { BibliotecaComposicaoPicker } from '@/components/orcamento-slides/BibliotecaComposicaoPicker';
import { OrcamentoDatePicker } from '@/components/orcamento-slides/OrcamentoDatePicker';
import { PrazoEntregaField } from '@/components/orcamento-slides/PrazoEntregaField';
import type {
  OrcamentoDados,
  MidiaOrigem,
  OrcamentoPrecificacao,
  OrcamentoSlideStatus,
  MidiaTipo,
  OrcamentoPergunta,
} from '@/lib/orcamento-slide-types';
import { buildMarkupSeedFromOrcamento, calcularPrecificacaoComFormas, normalizarGruposFracionados, resolverFormasPagamentoSelecoes } from '@/lib/orcamento-slide-precificacao';
import { useOrcamentoSlideFormasPagamento } from '@/hooks/useOrcamentoSlideFormasPagamento';
import { useOrcamentoSlideTemplate } from '@/hooks/useOrcamentoSlideTemplate';
import { useOrcamentoSlideBlocos } from '@/hooks/useOrcamentoSlideBlocos';
import { useLeadAIAnalyses } from '@/hooks/useLeadAIAnalyses';
import { useMarkupOrcamentos } from '@/hooks/useMarkupOrcamentos';
import { OrcamentoAnaliseIAEditor } from '@/components/orcamento-slides/OrcamentoAnaliseIAEditor';
import { chaveTextoAnaliseIa, patchTextosAnaliseIa } from '@/lib/orcamento-slide-analise-ia';
import { normalizarRelatorioAnaliseIa } from '@/lib/lead-ai-relatorio-markdown';
import type { OrcamentoSlide } from '@/lib/orcamento-slide-types';
import {
  embedMetaDados,
  identificadorRascunhoOrcamento,
  parseEtapaRascunho,
  snapshotOrcamentoForm,
  type OrcamentoEtapaRascunho,
} from '@/lib/orcamento-slide-rascunho';
import { resolveOrcamentoReturnTo } from '@/lib/orcamento-slide-navigation';
import { OrcamentoLeadCardDock } from '@/components/orcamento-slides/OrcamentoLeadCardDock';
import {
  precificacaoInicialDoLead,
  precificacaoTemValor,
} from '@/lib/orcamento-slide-lead-sync';
import {
  isLeadMidiaPdf,
  isOrcamentoProjetoPdfFile,
  pdfPageImagesToFiles,
  renderOrcamentoProjetoPdfFile,
  renderOrcamentoProjetoPdfUrl,
} from '@/lib/orcamento-slide-projeto-files';
import { OrcamentoProjetoPdfPagePickerDialog } from '@/components/orcamento-slides/OrcamentoProjetoPdfPagePickerDialog';
import { MidiaVideoThumb } from '@/components/orcamento-slides/SlideMidia';
import type { PdfPageImage } from '@/lib/pdf-render';
import { isOrcamentoMidiaVideo, isVideoFile, VIDEO_ACCEPT } from '@/lib/orcamento-slide-midia-video';
import { toast } from 'sonner';
import {
  normalizarRespostaMulti,
  normalizarRespostasFormulario,
  isPerguntaCampoDedicado,
  isPerguntaToggleImagens,
} from '@/lib/orcamento-slide-perguntas-resolver';

type Etapa = 1 | 2 | 3 | 4;

const ETAPAS = [
  { num: 1 as Etapa, label: 'Cliente', icon: Users },
  { num: 2 as Etapa, label: 'Perguntas', icon: MessageSquare },
  { num: 3 as Etapa, label: 'Visual', icon: Image },
  { num: 4 as Etapa, label: 'Precificação', icon: DollarSign },
];

function gerarIdentificador(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `ORC-${ts}-${rand}`;
}

const PREC_INICIAL: OrcamentoPrecificacao = {
  valor_integral: 0,
  parcelas: 1,
  valor_parcela: 0,
  desconto_percent: 0,
  valor_final: 0,
  forma_pagamento_id: null,
  forma_pagamento_tipo: 'a_vista',
  valor_entrada: 0,
  valor_entrega: 0,
  fracionar_precos: false,
  itens_fracionados: [],
  adicionar_markup: false,
  markup_composicao: undefined,
};

/** Detecta se uma pergunta toggle deve exibir o seletor de imagens. */
function isToggleDeImagens(pergunta: OrcamentoPergunta): boolean {
  return isPerguntaToggleImagens(pergunta);
}

/** Ao adicionar fotos, liga o toggle "Adicionar imagens do projeto?" automaticamente. */
function ativarToggleImagensNasRespostas(
  respostas: Record<string, string | string[]>,
  perguntas: OrcamentoPergunta[],
): Record<string, string | string[]> {
  const pergunta = perguntas.find(isPerguntaToggleImagens);
  if (!pergunta) return respostas;
  if (respostas[pergunta.id] === 'sim') return respostas;
  return { ...respostas, [pergunta.id]: 'sim' };
}

function midiaOrigemBadgeLabel(origem: MidiaOrigem): string {
  switch (origem) {
    case 'biblioteca':
      return 'Biblioteca';
    case 'lead_whiteboard':
      return 'Lousa';
    case 'lead_ai_render':
      return 'IA';
    case 'lead_anexo':
      return 'Anexo';
    default:
      return 'Upload';
  }
}

// ── Zona de upload de imagens reutilizável ────────────────────────────────────
interface UploadZonaProps {
  onUpload: (files: FileList | null, tipo: MidiaTipo) => void;
  isUploading: boolean;
  leadId: number | null;
  onImportar: (selecionadas: {
    midia: {
      id: string;
      origem: Exclude<MidiaOrigem, 'upload'>;
      file_url: string;
      file_name: string;
      tipo_arquivo?: 'imagem' | 'pdf' | 'video';
    };
    tipo: MidiaTipo;
  }[]) => Promise<void>;
  isImporting: boolean;
  midiasTipo: ReturnType<typeof useOrcamentoSlideMidias>['midias'];
  onRemover: (id: string, file_url: string, origem: MidiaOrigem) => void;
}

function UploadZona({
  onUpload,
  isUploading,
  leadId,
  onImportar,
  isImporting,
  midiasTipo,
  onRemover,
}: UploadZonaProps) {
  return (
    <div className="flex flex-col gap-4 pl-1">
      {/* Área de drop */}
      <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-amber-500/30 bg-amber-500/5 px-6 py-6 cursor-pointer hover:border-amber-500/60 hover:bg-amber-500/10 transition-colors">
        <Upload className="h-7 w-7 text-amber-400/70" />
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Clique ou arraste imagens, vídeos ou PDF</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            JPG, PNG, WEBP, HEIC, MP4, WebM, MOV ou PDF — PDF: cada página vira imagem · até 50 MB
          </p>
        </div>
        <input
          type="file"
          accept={`image/*,${VIDEO_ACCEPT},application/pdf,.pdf`}
          multiple
          className="sr-only"
          onChange={(e) => onUpload(e.target.files, 'projeto')}
        />
      </label>

      {isUploading && (
        <div className="flex items-center gap-2 text-sm text-amber-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Enviando mídias… (PDF/vídeo pode levar alguns segundos)
        </div>
      )}

      {/* Sempre: imagens e vídeos da pasta Biblioteca → composição de orçamento */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Composição de orçamento
          </span>
          <Badge variant="secondary" className="text-[10px]">biblioteca</Badge>
        </div>
        <BibliotecaComposicaoPicker
          isImporting={isImporting}
          onImportar={async (selecionadas) => {
            await onImportar(
              selecionadas.map(({ midia, tipo }) => ({
                midia: {
                  id: midia.sourceId,
                  origem: 'biblioteca' as const,
                  file_url: midia.file_url,
                  file_name: midia.file_name,
                  tipo_arquivo: midia.tipo === 'video' ? ('video' as const) : ('imagem' as const),
                },
                tipo,
              })),
            );
          }}
        />
      </div>

      {/* Importar do lead */}
      {leadId && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Ou importar do lead</span>
            <Badge variant="secondary" className="text-[10px]">imagens e PDF</Badge>
          </div>
          <LeadMidiasPicker
            leadId={leadId}
            onImportar={onImportar}
            isImporting={isImporting}
          />
        </div>
      )}

      {/* Grade das mídias já adicionadas */}
      {midiasTipo.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">
            {midiasTipo.length} mídia{midiasTipo.length !== 1 ? 's' : ''} adicionada{midiasTipo.length !== 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {midiasTipo.map((m) => {
              const isVideo = isOrcamentoMidiaVideo(m);
              return (
                <div
                  key={m.id}
                  className="relative group rounded-xl overflow-hidden aspect-square bg-muted"
                >
                  {isVideo ? (
                    <MidiaVideoThumb src={m.file_url} />
                  ) : (
                    <img
                      src={m.file_url}
                      alt={m.file_name}
                      className="w-full h-full object-cover"
                    />
                  )}
                  {m.origem !== 'upload' && (
                    <Badge className="absolute top-1.5 left-1.5 text-[9px] px-1 py-0" variant="secondary">
                      {midiaOrigemBadgeLabel(m.origem)}
                    </Badge>
                  )}
                  {isVideo && (
                    <Badge className="absolute bottom-1.5 left-1.5 text-[9px] px-1 py-0 bg-amber-500/90 text-black border-0">
                      Vídeo
                    </Badge>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemover(m.id, m.file_url, m.origem)}
                    className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
                    title={isVideo ? 'Remover vídeo' : 'Remover imagem'}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function NovoOrcamentoSlidePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const leadIdParam = searchParams.get('leadId');
  const leadIdFromQuery = leadIdParam ? parseInt(leadIdParam, 10) : null;
  const rascunhoParamId = searchParams.get('rascunho');
  const iniciarLimpo = searchParams.get('novo') === '1';
  const isEditMode = /\/editar\/?$/.test(location.pathname);
  const editOrcamentoId = isEditMode ? routeId : null;

  const { salvarProgressoOrcamento, salvarOrcamento } = useOrcamentoSlides();
  const { data: orcamentoExistente, isLoading: loadingOrcamento } = useOrcamentoPorId(editOrcamentoId);
  const { data: rascunhoPorId, isLoading: loadingRascunhoId } = useOrcamentoRascunhoPorId(rascunhoParamId, {
    enabled: !isEditMode && !!rascunhoParamId,
  });
  const { data: rascunhoAtual, isLoading: loadingRascunhoAtual } = useOrcamentoRascunhoAtual(leadIdFromQuery, {
    enabled: !isEditMode && !iniciarLimpo && !rascunhoParamId,
  });
  const orcamentoParaRestaurar = isEditMode
    ? orcamentoExistente
    : rascunhoParamId
      ? rascunhoPorId
      : iniciarLimpo
        ? null
        : rascunhoAtual;
  const isLoadingRestauracao = isEditMode
    ? loadingOrcamento
    : rascunhoParamId
      ? loadingRascunhoId
      : iniciarLimpo
        ? false
        : loadingRascunhoAtual;
  const { perguntas } = useOrcamentoSlidePerguntas();
  const { formas: formasPagamento } = useOrcamentoSlideFormasPagamento();
  const { template } = useOrcamentoSlideTemplate();
  const { blocos: blocosTemplate } = useOrcamentoSlideBlocos(template?.id);
  const blocosAnaliseTemplate = blocosTemplate.filter((b) => b.tipo === 'analise_ia' && b.ativo);
  const [vinculoLeadId, setVinculoLeadId] = useState<number | null>(leadIdFromQuery);
  const { data: analisesLead = [] } = useLeadAIAnalyses(vinculoLeadId);
  const ultimaAnaliseLead = analisesLead[0];
  const prefillAnaliseRef = useRef<string | null>(null);

  useEffect(() => {
    prefillAnaliseRef.current = null;
  }, [vinculoLeadId]);
  const { data: leadVinculado } = useLeadDetail(vinculoLeadId);
  const { syncValorLead } = useSyncLeadOrcamentoValor();
  const { data: markupsLead = [] } = useMarkupOrcamentos(vinculoLeadId);
  const markupsDisponiveis = useMemo(
    () => markupsLead.map((m) => buildMarkupSeedFromOrcamento(m)),
    [markupsLead],
  );
  const leadNome = leadVinculado?.nome;
  const leadValorOrcamento = Number(leadVinculado?.valor_orcamento ?? 0);

  const [etapa, setEtapa] = useState<Etapa>(leadIdFromQuery ? 2 : 1);
  const [clienteNome, setClienteNome] = useState('');
  const [identificador, setIdentificador] = useState('');
  const [statusAtual, setStatusAtual] = useState<OrcamentoSlideStatus>('rascunho');
  const [respostas, setRespostas] = useState<Record<string, string | string[]>>({});
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [formHydrated, setFormHydrated] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const [autoSaveState, setAutoSaveState] = useState<
    'idle' | 'pending' | 'saving' | 'saved' | 'error'
  >('idle');
  const [restauradoDeRascunho, setRestauradoDeRascunho] = useState(false);
  const lastSnapshotRef = useRef<string | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const marcarAlteracao = useCallback(() => {
    setFormDirty(true);
  }, []);

  useEffect(() => {
    if (!isEditMode && leadNome && !formHydrated) {
      setClienteNome((atual) => atual || leadNome);
    }
  }, [leadNome, isEditMode, formHydrated]);

  const formaAVista = formasPagamento.find((f) => f.tipo === 'a_vista') ?? formasPagamento[0] ?? null;

  // Só sugere o valor do card quando este orçamento ainda não tem total próprio.
  // Depois de salvo/editado, o card do cliente NÃO sobrescreve a precificação.
  useEffect(() => {
    if (!formHydrated || leadValorOrcamento <= 0) return;
    if (isEditMode && orcamentoExistente?.dados?.precificacao) {
      if (precificacaoTemValor(orcamentoExistente.dados.precificacao)) return;
    }
    setPrecificacao((atual) => {
      if (atual.valor_integral > 0 || precificacaoTemValor(atual)) return atual;
      return precificacaoInicialDoLead(
        leadValorOrcamento,
        atual.desconto_percent,
        formaAVista,
        atual.parcelas,
        formasPagamento,
      );
    });
  }, [
    formHydrated,
    leadValorOrcamento,
    formaAVista,
    formasPagamento,
    isEditMode,
    orcamentoExistente?.dados?.precificacao,
  ]);

  useEffect(() => {
    if (formHydrated || isLoadingRestauracao) return;
    if (isEditMode && !orcamentoExistente) return;

    if (!isEditMode && !orcamentoParaRestaurar) {
      lastSnapshotRef.current = snapshotOrcamentoForm({
        clienteNome: leadNome ?? '',
        identificador: '',
        vinculoLeadId: leadIdFromQuery,
        etapa: (leadIdFromQuery ? 2 : 1) as OrcamentoEtapaRascunho,
        respostas: {},
        precificacao: PREC_INICIAL,
        prazoEntrega: '',
        inicioExecucao: '',
        garantiaMeses: '24',
        textosBlocos: {},
        ocultarAnaliseIa: false,
        linkPublicoOculto: false,
      });
      setFormHydrated(true);
      return;
    }

    if (!orcamentoParaRestaurar) return;

    const d = orcamentoParaRestaurar.dados;
    const etapaRestaurada = parseEtapaRascunho(d);
    setOrcamentoId(orcamentoParaRestaurar.id);
    setClienteNome(orcamentoParaRestaurar.cliente_nome);
    setIdentificador(orcamentoParaRestaurar.identificador);
    setVinculoLeadId(orcamentoParaRestaurar.lead_id);
    setStatusAtual(orcamentoParaRestaurar.status);
    if (d) {
      setRespostas(d.respostas ?? {});
      setPrecificacao(d.precificacao ?? PREC_INICIAL);
      setPrazoEntrega(d.prazo_entrega ?? '');
      setInicioExecucao(d.inicio_execucao ?? '');
      setGarantiaMeses(d.garantia_meses ?? '24');
      setTextosBlocos(d.textos_blocos ?? {});
      setOcultarAnaliseIa(!!d._meta?.ocultar_analise_ia);
      setLinkPublicoOculto(!!d._meta?.link_publico_oculto);
    }
    setEtapa(etapaRestaurada);
    if (!isEditMode && orcamentoParaRestaurar.status === 'rascunho') {
      setRestauradoDeRascunho(true);
    }
    lastSnapshotRef.current = snapshotOrcamentoForm({
      clienteNome: orcamentoParaRestaurar.cliente_nome,
      identificador: orcamentoParaRestaurar.identificador,
      vinculoLeadId: orcamentoParaRestaurar.lead_id,
      etapa: etapaRestaurada,
      respostas: d?.respostas ?? {},
      precificacao: d?.precificacao ?? PREC_INICIAL,
      prazoEntrega: d?.prazo_entrega ?? '',
      inicioExecucao: d?.inicio_execucao ?? '',
      garantiaMeses: d?.garantia_meses ?? '24',
      textosBlocos: d?.textos_blocos ?? {},
      ocultarAnaliseIa: !!d?._meta?.ocultar_analise_ia,
      linkPublicoOculto: !!d?._meta?.link_publico_oculto,
    });
    setDadosCarregados(true);
    setFormHydrated(true);
  }, [
    formHydrated,
    isLoadingRestauracao,
    isEditMode,
    orcamentoExistente,
    orcamentoParaRestaurar,
    leadIdFromQuery,
    leadNome,
  ]);
  const [precificacao, setPrecificacao] = useState<OrcamentoPrecificacao>(PREC_INICIAL);
  const [prazoEntrega, setPrazoEntrega] = useState('');
  const [inicioExecucao, setInicioExecucao] = useState('');
  const [garantiaMeses, setGarantiaMeses] = useState('24');
  const [textosBlocos, setTextosBlocos] = useState<Record<string, string>>({});
  const [ocultarAnaliseIa, setOcultarAnaliseIa] = useState(false);
  const [linkPublicoOculto, setLinkPublicoOculto] = useState(false);
  const [orcamentoId, setOrcamentoId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pdfPicker, setPdfPicker] = useState<{
    pages: PdfPageImage[];
    fileName: string;
    tipo: MidiaTipo;
    loading: boolean;
    error: string | null;
  } | null>(null);
  const [pdfPickerSubmitting, setPdfPickerSubmitting] = useState(false);
  const pdfPickerResolveRef = useRef<((pageNumbers: number[] | null) => void) | null>(null);

  const { midias, uploadMidia, importarMidiaLead, removerMidia } = useOrcamentoSlideMidias(orcamentoId);

  const buildDados = useCallback((): OrcamentoDados => {
    const base: Omit<OrcamentoDados, '_meta'> = {
      respostas: normalizarRespostasFormulario(respostas, perguntas),
      precificacao: calcularPrecificacaoComFormas({
        valorIntegral: precificacao.valor_integral,
        descontoPercent: precificacao.desconto_percent,
        acrescimoPercent: precificacao.acrescimo_percent ?? 0,
        formasSelecoes: resolverFormasPagamentoSelecoes(precificacao, formasPagamento),
        formasCatalogo: formasPagamento,
        parcelasPorForma: precificacao.formas_pagamento_parcelas,
        descontosPorForma: precificacao.formas_pagamento_descontos,
        acrescimosPorForma: precificacao.formas_pagamento_acrescimos,
        observacoesPorForma: precificacao.formas_pagamento_observacoes,
        parcelasLegacy: precificacao.parcelas,
        fracionarPrecos: precificacao.fracionar_precos,
        gruposFracionados: precificacao.fracionar_precos
          ? normalizarGruposFracionados(precificacao)
          : [],
        itensFracionados: precificacao.itens_fracionados,
        exibirTotalFracionado: precificacao.exibir_total_fracionado,
        adicionarMarkup: precificacao.adicionar_markup,
        markupComposicao: precificacao.markup_composicao,
      }),
      prazo_entrega: prazoEntrega,
      inicio_execucao: inicioExecucao,
      garantia_meses: garantiaMeses,
      textos_blocos: textosBlocos,
    };
    return embedMetaDados(base, etapa, {
      ...(linkPublicoOculto ? { link_publico_oculto: true } : {}),
      ...(ocultarAnaliseIa ? { ocultar_analise_ia: true } : {}),
    });
  }, [
    respostas,
    precificacao,
    prazoEntrega,
    inicioExecucao,
    garantiaMeses,
    textosBlocos,
    etapa,
    formasPagamento,
    perguntas,
    linkPublicoOculto,
    ocultarAnaliseIa,
  ]);

  const orcamentoAnalisePreview = useMemo((): OrcamentoSlide => {
    const dados = buildDados();
    return {
      id: orcamentoId ?? 'preview',
      identificador: identificador || 'rascunho',
      lead_id: vinculoLeadId,
      cliente_nome: clienteNome,
      status: statusAtual,
      dados,
      criado_por: null,
      criado_em: orcamentoExistente?.criado_em ?? '',
      atualizado_em: orcamentoExistente?.atualizado_em ?? `local-${dados.textos_blocos[chaveTextoAnaliseIa(blocosAnaliseTemplate[0]?.id ?? '')] ?? ''}`.slice(0, 64),
    };
  }, [
    buildDados,
    orcamentoId,
    identificador,
    vinculoLeadId,
    clienteNome,
    statusAtual,
    orcamentoExistente?.criado_em,
    orcamentoExistente?.atualizado_em,
    blocosAnaliseTemplate,
    textosBlocos,
  ]);

  useEffect(() => {
    if (!formHydrated || !ultimaAnaliseLead?.conteudo?.trim() || blocosAnaliseTemplate.length === 0) {
      return;
    }

    const token = `${vinculoLeadId}:${ultimaAnaliseLead.id}`;
    if (prefillAnaliseRef.current === token) return;

    const corpoNormalizado = normalizarRelatorioAnaliseIa(ultimaAnaliseLead.conteudo);
    let preencheu = false;

    setTextosBlocos((prev) => {
      const next = { ...prev };
      for (const bloco of blocosAnaliseTemplate) {
        const key = chaveTextoAnaliseIa(bloco.id);
        if (!next[key]?.trim()) {
          next[key] = corpoNormalizado;
          preencheu = true;
        }
      }
      return preencheu ? next : prev;
    });

    if (preencheu) {
      prefillAnaliseRef.current = token;
      marcarAlteracao();
    } else {
      prefillAnaliseRef.current = token;
    }
  }, [
    formHydrated,
    vinculoLeadId,
    ultimaAnaliseLead?.id,
    ultimaAnaliseLead?.conteudo,
    blocosAnaliseTemplate,
    marcarAlteracao,
  ]);

  const handleAnaliseIaChange = (blocoId: string, values: { etiqueta: string; titulo: string; corpo: string }) => {
    setTextosBlocos((prev) => patchTextosAnaliseIa(prev, blocoId, values));
    marcarAlteracao();
  };

  const handleAnaliseIaVisivelChange = (visivel: boolean) => {
    setOcultarAnaliseIa(!visivel);
    marcarAlteracao();
  };

  const getFormSnapshot = useCallback(
    () =>
      snapshotOrcamentoForm({
        clienteNome,
        identificador,
        vinculoLeadId,
        etapa,
        respostas,
        precificacao,
        prazoEntrega,
        inicioExecucao,
        garantiaMeses,
        textosBlocos,
        ocultarAnaliseIa,
        linkPublicoOculto,
      }),
    [
      clienteNome,
      identificador,
      vinculoLeadId,
      etapa,
      respostas,
      precificacao,
      prazoEntrega,
      inicioExecucao,
      garantiaMeses,
      textosBlocos,
      ocultarAnaliseIa,
      linkPublicoOculto,
    ],
  );

  const ensureOrcamento = useCallback(async (): Promise<string> => {
    if (orcamentoId) return orcamentoId;
    const nomeCliente = clienteNome.trim() || leadNome || 'Rascunho';
    const novoIdentificador = identificador || identificadorRascunhoOrcamento(nomeCliente);
    const orc = await salvarProgressoOrcamento.mutateAsync({
      identificador: novoIdentificador,
      lead_id: vinculoLeadId,
      cliente_nome: nomeCliente,
      dados: buildDados(),
      status: 'rascunho',
    });
    setOrcamentoId(orc.id);
    setIdentificador(orc.identificador);
    return orc.id;
  }, [
    orcamentoId,
    salvarProgressoOrcamento,
    vinculoLeadId,
    clienteNome,
    leadNome,
    buildDados,
    identificador,
  ]);

  // Salvamento automático na nuvem (debounce 800ms) — sobrevive a queda do sistema
  useEffect(() => {
    if (!formHydrated) return;
    if (isEditMode && !dadosCarregados) return;

    const temConteudo =
      clienteNome.trim().length > 0 ||
      etapa > 1 ||
      Object.keys(respostas).length > 0 ||
      precificacao.valor_integral > 0;
    if (!temConteudo && !orcamentoId) return;
    if (!formDirty) return;

    setAutoSaveState((s) => (s === 'saving' ? s : 'pending'));
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(() => {
      void (async () => {
        const snapshot = getFormSnapshot();
        if (snapshot === lastSnapshotRef.current) {
          setFormDirty(false);
          setAutoSaveState('idle');
          return;
        }

        const nomeCliente = clienteNome.trim() || leadNome || 'Rascunho';
        const identificadorSalvar =
          identificador || identificadorRascunhoOrcamento(nomeCliente);
        const statusSalvar = isEditMode ? statusAtual : 'rascunho';

        setAutoSaveState('saving');
        try {
          const salvo = await salvarProgressoOrcamento.mutateAsync({
            id: orcamentoId ?? undefined,
            identificador: identificadorSalvar,
            lead_id: vinculoLeadId,
            cliente_nome: nomeCliente,
            dados: buildDados(),
            status: statusSalvar,
          });
          setOrcamentoId(salvo.id);
          if (!identificador) setIdentificador(salvo.identificador);
          lastSnapshotRef.current = snapshot;
          setFormDirty(false);
          await syncValorLead(vinculoLeadId, buildDados().precificacao);
          setAutoSaveState('saved');
          window.setTimeout(() => setAutoSaveState('idle'), 2000);
        } catch {
          setAutoSaveState('error');
        }
      })();
    }, 800);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [
    formHydrated,
    dadosCarregados,
    isEditMode,
    formDirty,
    clienteNome,
    identificador,
    vinculoLeadId,
    etapa,
    respostas,
    precificacao,
    prazoEntrega,
    inicioExecucao,
    garantiaMeses,
    textosBlocos,
    ocultarAnaliseIa,
    linkPublicoOculto,
    orcamentoId,
    statusAtual,
    leadNome,
    getFormSnapshot,
    buildDados,
    salvarProgressoOrcamento,
    syncValorLead,
  ]);

  const voltarParaOrigem = useCallback(() => {
    const destino = resolveOrcamentoReturnTo(searchParams, location.state, {
      leadId: vinculoLeadId ?? leadIdFromQuery,
    });
    navigate(destino);
  }, [navigate, searchParams, location.state, vinculoLeadId, leadIdFromQuery]);

  const handleFinalizarOrcamento = async () => {
    setIsSaving(true);
    try {
      const dados = buildDados();
      const nomeCliente = clienteNome.trim() || leadNome || 'Cliente';
      const idFinal = orcamentoId ?? await ensureOrcamento();
      const identificadorFinal = identificador || gerarIdentificador();
      await salvarOrcamento.mutateAsync({
        id: idFinal,
        identificador: identificadorFinal,
        lead_id: vinculoLeadId,
        cliente_nome: nomeCliente,
        dados,
        status: isEditMode ? statusAtual : 'pronto',
      });
      await syncValorLead(vinculoLeadId, dados.precificacao);
      voltarParaOrigem();
    } finally {
      setIsSaving(false);
    }
  };

  const openPdfPagePicker = useCallback(
    (fileName: string, tipo: MidiaTipo): Promise<number[] | null> => {
      return new Promise((resolve) => {
        pdfPickerResolveRef.current = resolve;
        setPdfPicker({
          pages: [],
          fileName,
          tipo,
          loading: true,
          error: null,
        });
      });
    },
    [],
  );

  const setPdfPickerPages = useCallback((pages: PdfPageImage[], error: string | null = null) => {
    setPdfPicker((prev) =>
      prev
        ? {
            ...prev,
            pages,
            loading: false,
            error,
          }
        : null,
    );
  }, []);

  const closePdfPagePicker = useCallback((result: number[] | null) => {
    pdfPickerResolveRef.current?.(result);
    pdfPickerResolveRef.current = null;
    setPdfPicker(null);
    setPdfPickerSubmitting(false);
  }, []);

  const handleConfirmPdfPages = async (pageNumbers: number[]) => {
    if (!pdfPicker || pageNumbers.length === 0 || pdfPicker.loading) return;
    setPdfPickerSubmitting(true);
    try {
      const id = await ensureOrcamento();
      const arquivos = pdfPageImagesToFiles(pdfPicker.pages, pdfPicker.fileName, pageNumbers);
      for (const arquivo of arquivos) {
        await uploadMidia.mutateAsync({
          file: arquivo,
          tipo: pdfPicker.tipo,
          orcId: id,
        });
      }
      setRespostas((prev) => ativarToggleImagensNasRespostas(prev, perguntas));
      marcarAlteracao();
      toast.success(
        `${arquivos.length} página${arquivos.length === 1 ? '' : 's'} salva${arquivos.length === 1 ? '' : 's'} como imagem do projeto`,
      );
      closePdfPagePicker(pageNumbers);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar páginas';
      toast.error(message);
      setPdfPickerSubmitting(false);
    }
  };

  const handleUploadFoto = async (files: FileList | null, tipo: MidiaTipo) => {
    if (!files?.length) return;
    setIsUploading(true);
    let adicionouMidia = false;
    try {
      const id = await ensureOrcamento();
      for (const file of Array.from(files)) {
        if (isOrcamentoProjetoPdfFile(file)) {
          setIsUploading(false);
          const pickerPromise = openPdfPagePicker(file.name, tipo);
          try {
            const pages = await renderOrcamentoProjetoPdfFile(file);
            setPdfPickerPages(pages);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Não foi possível ler o PDF';
            setPdfPickerPages([], message);
          }
          const pageNumbers = await pickerPromise;
          if (pageNumbers?.length) adicionouMidia = true;
          setIsUploading(true);
          continue;
        }
        if (!file.type.startsWith('image/') && !isVideoFile(file)) {
          toast.error(`Arquivo não suportado: ${file.name}`);
          continue;
        }
        await uploadMidia.mutateAsync({ file, tipo, orcId: id });
        adicionouMidia = true;
      }
      if (adicionouMidia) {
        setRespostas((prev) => ativarToggleImagensNasRespostas(prev, perguntas));
        marcarAlteracao();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao enviar arquivo';
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleImportarMidiasLead = async (
    selecionadas: {
      midia: {
        id: string;
        origem: Exclude<MidiaOrigem, 'upload'>;
        file_url: string;
        file_name: string;
        tipo_arquivo?: 'imagem' | 'pdf' | 'video';
      };
      tipo: MidiaTipo;
    }[],
  ) => {
    setIsImporting(true);
    let adicionouMidia = false;
    try {
      const id = await ensureOrcamento();
      for (const { midia, tipo } of selecionadas) {
        if (midia.tipo_arquivo === 'pdf' || isLeadMidiaPdf(midia)) {
          setIsImporting(false);
          const pickerPromise = openPdfPagePicker(midia.file_name, tipo);
          try {
            const pages = await renderOrcamentoProjetoPdfUrl(midia.file_url);
            setPdfPickerPages(pages);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Não foi possível abrir o PDF';
            setPdfPickerPages([], message);
          }
          const pageNumbers = await pickerPromise;
          if (!pageNumbers?.length) {
            throw new Error('PDF_CANCELLED');
          }
          adicionouMidia = true;
          continue;
        }
        await importarMidiaLead.mutateAsync({
          orcId: id,
          tipo,
          file_url: midia.file_url,
          file_name: midia.file_name,
          origem: midia.origem,
          source_id: midia.id,
        });
        adicionouMidia = true;
      }
      if (adicionouMidia) {
        setRespostas((prev) => ativarToggleImagensNasRespostas(prev, perguntas));
        marcarAlteracao();
      }
    } finally {
      setIsImporting(false);
    }
  };

  const handleRemoverMidia = (id: string, file_url: string, origem: MidiaOrigem) => {
    removerMidia.mutate({ id, file_url, origem });
  };

  const handleRespostaSingle = (pergId: string, valor: string) => {
    setRespostas((p) => ({ ...p, [pergId]: valor }));
    marcarAlteracao();
  };

  const handleRespostaMulti = (pergId: string, valor: string, checked: boolean) => {
    setRespostas((p) => {
      const atual = normalizarRespostaMulti(p[pergId]);
      return {
        ...p,
        [pergId]: checked ? [...atual, valor] : atual.filter((v) => v !== valor),
      };
    });
    marcarAlteracao();
  };

  const irParaEtapa = (nova: Etapa) => {
    setEtapa(nova);
    marcarAlteracao();
  };

  const podeAvancar = {
    1: clienteNome.trim().length >= 2,
    2: true,
    3: true,
    4: true,
  }[etapa];

  // Mídias do tipo projeto para mostrar na etapa 3 (galeria completa)
  const midiasProjeto = midias.filter((m) => m.tipo === 'projeto');

  if ((!formHydrated && isLoadingRestauracao) || (isEditMode && loadingOrcamento)) {
    return <GarboBrandLoader variant="fullscreen" message="Carregando orçamento…" />;
  }

  if (isEditMode && !orcamentoExistente) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4 text-center">
        <p className="text-lg font-medium">Orçamento não encontrado.</p>
        <Button variant="outline" onClick={voltarParaOrigem}>
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 md:px-6 py-3 border-b shrink-0">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={voltarParaOrigem}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-semibold text-base">
              {isEditMode ? 'Editar orçamento' : 'Novo Orçamento'}
            </h1>
            {identificador && (
              <Badge variant="secondary" className="font-mono text-[10px]">
                {identificador}
              </Badge>
            )}
          </div>
          {vinculoLeadId && leadNome && (
            <p className="text-xs text-muted-foreground truncate">
              Vinculado ao card: <span className="font-medium text-[#8d5e22]">{leadNome}</span>
            </p>
          )}
          {restauradoDeRascunho && (
            <p className="text-xs text-violet-700 flex items-center gap-1 mt-0.5">
              <Cloud className="h-3 w-3 shrink-0" />
              Rascunho restaurado — continue de onde parou
            </p>
          )}
        </div>
        {formHydrated && autoSaveState !== 'idle' && (
          <span
            className={cn(
              'text-xs shrink-0',
              autoSaveState === 'error' && 'text-destructive',
              autoSaveState === 'saved' && 'text-emerald-600 dark:text-emerald-400',
              (autoSaveState === 'pending' || autoSaveState === 'saving') && 'text-muted-foreground',
            )}
          >
            {autoSaveState === 'pending' && 'Salvando...'}
            {autoSaveState === 'saving' && 'Salvando na nuvem...'}
            {autoSaveState === 'saved' && 'Salvo'}
            {autoSaveState === 'error' && 'Erro ao salvar'}
          </span>
        )}
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-0 px-4 md:px-8 py-4 border-b shrink-0 overflow-x-auto">
        {ETAPAS.map((e, i) => (
          <div key={e.num} className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => etapa > e.num && irParaEtapa(e.num)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                etapa === e.num
                  ? 'bg-[#f3ebe1] text-[#6b3d12]'
                  : etapa > e.num
                  ? 'text-[#8d5e22] hover:bg-[#f3ebe1] cursor-pointer'
                  : 'text-muted-foreground cursor-default',
              )}
            >
              <div
                className={cn(
                  'h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                  etapa > e.num
                    ? 'bg-amber-500 text-white'
                    : etapa === e.num
                    ? 'border-2 border-[#8d5e22] text-[#8d5e22]'
                    : 'border border-border text-muted-foreground',
                )}
              >
                {etapa > e.num ? <Check className="h-3.5 w-3.5" /> : e.num}
              </div>
              <span className="hidden sm:inline">{e.label}</span>
            </button>
            {i < ETAPAS.length - 1 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground/40 mx-1" />
            )}
          </div>
        ))}
      </div>

      {/* Conteúdo */}
      <ScrollArea className="flex-1">
        <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 flex flex-col gap-6">

          {/* ── Etapa 1: Cliente ── */}
          {etapa === 1 && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="text-lg font-semibold mb-1">Dados do cliente</h2>
                <p className="text-sm text-muted-foreground">Informe o nome do cliente para o orçamento.</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Nome do cliente *</Label>
                <Input
                  value={clienteNome}
                  onChange={(e) => {
                    setClienteNome(e.target.value);
                    marcarAlteracao();
                  }}
                  placeholder="Ex.: Maria Silva"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* ── Etapa 2: Perguntas ── */}
          {etapa === 2 && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-lg font-semibold mb-1">Dados do projeto</h2>
                <p className="text-sm text-muted-foreground">
                  Responda as perguntas para personalizar a apresentação.
                </p>
              </div>

              {perguntas.filter((p) => !isPerguntaCampoDedicado(p)).map((p) => (
                <div key={p.id} className="flex flex-col gap-2">
                  <Label>
                    {p.label}
                    {p.obrigatorio && <span className="text-destructive ml-1">*</span>}
                  </Label>

                  {/* texto */}
                  {p.tipo === 'texto' && (
                    <Input
                      value={(respostas[p.id] as string) ?? ''}
                      onChange={(e) => handleRespostaSingle(p.id, e.target.value)}
                      placeholder={p.label}
                    />
                  )}

                  {/* data */}
                  {p.tipo === 'data' && (
                    <OrcamentoDatePicker
                      id={`pergunta-data-${p.id}`}
                      value={(respostas[p.id] as string) ?? ''}
                      onChange={(iso) => handleRespostaSingle(p.id, iso)}
                      placeholder="Selecionar data…"
                    />
                  )}

                  {/* numero */}
                  {p.tipo === 'numero' && (
                    <Input
                      type="number"
                      value={(respostas[p.id] as string) ?? ''}
                      onChange={(e) => handleRespostaSingle(p.id, e.target.value)}
                    />
                  )}

                  {/* select */}
                  {p.tipo === 'select' && p.opcoes && (
                    <div className="flex flex-wrap gap-2">
                      {p.opcoes.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => handleRespostaSingle(p.id, o.valor)}
                          className={cn(
                            'px-4 py-2 rounded-full text-sm border transition-colors',
                            (respostas[p.id] as string) === o.valor
                              ? 'bg-amber-500 text-white border-amber-500'
                              : 'border-border hover:border-amber-500/50 hover:bg-amber-500/5',
                          )}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* multi */}
                  {p.tipo === 'multi' && p.opcoes && (
                    <div className="flex flex-wrap gap-2">
                      {p.opcoes.map((o) => {
                        const checked = normalizarRespostaMulti(respostas[p.id]).includes(o.valor);
                        return (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => handleRespostaMulti(p.id, o.valor, !checked)}
                            className={cn(
                              'flex items-center gap-2 px-4 py-2 rounded-full text-sm border transition-colors',
                              checked
                                ? 'bg-amber-500 text-white border-amber-500'
                                : 'border-border hover:border-amber-500/50 hover:bg-amber-500/5',
                            )}
                          >
                            {checked && <Check className="h-3.5 w-3.5" />}
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* toggle — com expansão de imagens quando aplicável */}
                  {p.tipo === 'toggle' && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={(respostas[p.id] as string) === 'sim'}
                          onCheckedChange={(c) => handleRespostaSingle(p.id, c ? 'sim' : 'nao')}
                          className="data-[state=checked]:bg-amber-500"
                        />
                        <span className="text-sm text-muted-foreground">
                          {(respostas[p.id] as string) === 'sim' ? 'Sim' : 'Não'}
                        </span>
                      </div>

                      {/* Seletor de imagens inline quando toggle de imagens está ativo */}
                      {isToggleDeImagens(p) && (respostas[p.id] as string) === 'sim' && (
                        <div className="ml-1 mt-1 rounded-xl border border-[rgba(42,24,18,0.14)] bg-[#f8f4ee] p-4 flex flex-col gap-4">
                          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <Image className="h-4 w-4 text-[#8d5e22]" />
                            Escolha as imagens do projeto
                          </p>
                          <UploadZona
                            onUpload={handleUploadFoto}
                            isUploading={isUploading}
                            leadId={vinculoLeadId}
                            onImportar={handleImportarMidiasLead}
                            isImporting={isImporting}
                            midiasTipo={midiasProjeto}
                            onRemover={handleRemoverMidia}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Prazos e garantia — início primeiro, depois dias; a data de entrega é calculada */}
              <div className="border-t pt-5 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Prazo e garantia
                  </h3>
                  <p className="text-xs text-muted-foreground text-pretty">
                    Defina o início da execução e o prazo em dias. A data prevista de entrega é calculada automaticamente.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="inicio-execucao">Início da execução</Label>
                  <OrcamentoDatePicker
                    id="inicio-execucao"
                    value={inicioExecucao}
                    onChange={(iso) => {
                      setInicioExecucao(iso);
                      marcarAlteracao();
                    }}
                    placeholder="Selecionar data…"
                  />
                </div>
                <PrazoEntregaField
                  value={prazoEntrega}
                  inicioExecucaoIso={inicioExecucao}
                  onChange={(texto) => {
                    setPrazoEntrega(texto);
                    marcarAlteracao();
                  }}
                />
                <div className="flex flex-col gap-1.5">
                  <Label>Garantia (meses)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={garantiaMeses}
                    onChange={(e) => {
                      setGarantiaMeses(e.target.value);
                      marcarAlteracao();
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Etapa 3: Visual (galeria completa + upload adicional) ── */}
          {etapa === 3 && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-lg font-semibold mb-1">Imagens do orçamento</h2>
                <p className="text-sm text-muted-foreground">
                  Adicione ou ajuste as imagens que aparecerão na apresentação.
                </p>
              </div>

              <UploadZona
                onUpload={handleUploadFoto}
                isUploading={isUploading}
                leadId={vinculoLeadId}
                onImportar={handleImportarMidiasLead}
                isImporting={isImporting}
                midiasTipo={midias}
                onRemover={handleRemoverMidia}
              />

              {blocosAnaliseTemplate.length > 0 && (
                <div className="space-y-4 border-t border-border/60 pt-6">
                  <div>
                    <h3 className="text-base font-semibold">Análise de IA na apresentação</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Se o lead já tiver análise de IA, o relatório é carregado aqui automaticamente. Você pode editar tudo antes de apresentar ao cliente.
                    </p>
                  </div>
                  {blocosAnaliseTemplate.map((bloco) => (
                    <OrcamentoAnaliseIAEditor
                      key={bloco.id}
                      bloco={bloco}
                      orcamento={orcamentoAnalisePreview}
                      onChange={(values) => handleAnaliseIaChange(bloco.id, values)}
                      visivelNaApresentacao={!ocultarAnaliseIa}
                      onVisivelChange={handleAnaliseIaVisivelChange}
                      compact
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Etapa 4: Precificação ── */}
          {etapa === 4 && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-lg font-semibold mb-1">Precificação</h2>
                <p className="text-sm text-muted-foreground">
                  Define os valores que aparecem na apresentação.
                </p>
              </div>
              <PrecificacaoForm
                value={precificacao}
                leadId={vinculoLeadId}
                valorOrcamentoLead={leadValorOrcamento}
                formasPagamento={formasPagamento}
                markupsDisponiveis={markupsDisponiveis}
                onChange={(v) => {
                  setPrecificacao(v);
                  marcarAlteracao();
                }}
              />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t px-4 md:px-6 py-3 flex justify-between items-end gap-3 shrink-0 bg-background">
        <Button
          variant="outline"
          onClick={() => (etapa > 1 ? irParaEtapa((etapa - 1) as Etapa) : voltarParaOrigem())}
        >
          {etapa === 1 ? 'Cancelar' : 'Voltar'}
        </Button>

        <div className="flex flex-col items-end gap-2 min-w-0">
          {vinculoLeadId != null && (
            <OrcamentoLeadCardDock leadId={vinculoLeadId} leadNome={leadNome ?? clienteNome} />
          )}

          {etapa < 4 ? (
            <Button
              onClick={() => irParaEtapa((etapa + 1) as Etapa)}
              disabled={!podeAvancar}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Próximo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleFinalizarOrcamento}
              disabled={isSaving}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {isEditMode ? 'Salvar alterações' : 'Criar orçamento'}
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <OrcamentoProjetoPdfPagePickerDialog
        open={pdfPicker != null}
        onOpenChange={(open) => {
          if (!open && !pdfPickerSubmitting) closePdfPagePicker(null);
        }}
        pages={pdfPicker?.pages ?? []}
        fileName={pdfPicker?.fileName}
        isLoading={pdfPicker?.loading ?? false}
        error={pdfPicker?.error}
        isSubmitting={pdfPickerSubmitting}
        onConfirm={(pageNumbers) => {
          void handleConfirmPdfPages(pageNumbers);
        }}
      />
    </div>
  );
}
