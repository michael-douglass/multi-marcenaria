import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Save, FileDown, Copy, Plus, Search, Sparkles, ChevronDown, Undo2, Trash2 } from 'lucide-react';
import { MarkupAuditorLucro } from '@/components/markup/MarkupAuditorLucro';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useMarkupCategorias, useMarkupProdutos } from '@/hooks/useMarkupProdutos';
import { useMarkupConfig, useMarkupDespesaTemplates, useMarkupServicoTemplates } from '@/hooks/useMarkupConfig';
import { useMarkupOrcamentos } from '@/hooks/useMarkupOrcamentos';
import { useSyncLeadMarkupValor } from '@/hooks/useSyncLeadMarkupValor';
import { useLeadAIMediaItems } from '@/hooks/useLeadAIMediaItems';
import { useLeadPDFs } from '@/hooks/useLeadPDFs';
import { useLeadAIAnalyses } from '@/hooks/useLeadAIAnalyses';
import { usePipelineLeadAIConfig } from '@/hooks/usePipelineLeadAIConfig';
import { PIPELINE_LEAD_AI_MODELS } from '@/lib/pipeline-lead-ai-config';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { resolveSelectedForAPIDetailed, type LeadAIAnalysisItemPayload } from '@/lib/lead-ai-media-sources';
import { invokeComposeMarkupIAStream, type MarkupIAComposeEvent } from '@/lib/markup-compose-api';
import { MarkupIAComposeOverlay } from '@/components/markup/MarkupIAComposeOverlay';
import { MarkupIAAnexosPicker } from '@/components/markup/MarkupIAAnexosPicker';
import { MarkupIAConferenciaDialog } from '@/components/markup/MarkupIAConferenciaDialog';
import { MarkupCatalogoCategoriaCard } from '@/components/markup/MarkupCatalogoCategoriaCard';
import { normalizarChecklistVerificacao } from '@/lib/markup-ia-verificacao';
import {
  aplicarComposicaoIA,
  criarModulosBaseParaComposicaoIA,
  criarSnapshotComposicaoAnterior,
  orcamentoTemComposicao,
  podeDesfazerComposicaoIA,
  resolverComposicaoAnterior,
  sincronizarResumoIADosModulos,
} from '@/lib/markup-compose';
import type { MarkupComposicaoAnterior, MarkupComposeIAResult, MarkupLinhaOrigemIA } from '@/lib/markup-types';
import { aplicarRevisaoNaComposicao, sintetizarItensExtraidos } from '@/lib/markup-extracao';
import type { MarkupItemExtraido } from '@/lib/markup-match';
import { MarkupIAResumoPanel } from '@/components/markup/MarkupIAResumoPanel';
import { MarkupLucroReaisInput } from '@/components/markup/MarkupLucroReaisInput';
import { recalcularModulos, formatarMoedaMarkup, aplicarConfiguracaoFixaNosModulos, garantirEstruturaModulos, arredondar, calcularDescontoPercentFromPrecoAlvo, calcularMargemPercentFromLucroAlvo } from '@/lib/markup-calculo';
import {
  chaveCardCatalogoMarkup,
  ordenarProdutosCardCatalogo,
  rotuloCategoriaProdutoMarkup,
  setMarkupCalculatorOpenFlag,
} from '@/lib/markup-ui';
import { calcularCustoServicoHoras } from '@/lib/markup-servicos';
import { normalizarServicosModulos, sincronizarServicosComTemplates, calcularHorasTotaisServicos, resolverServicoTemplatesEfetivos, parseAssinaturaServicoTemplates, resolverValorHoraLinhaServico } from '@/lib/markup-servicos';
import {
  criarModulosVazios,
  type MarkupLinhaDespesa,
  type MarkupLinhaProduto,
  type MarkupModulos,
  type MarkupOrcamento,
} from '@/lib/markup-types';
import { exportarMarkupPdf } from '@/lib/markup-pdf-export';
import { correspondeBuscaFlexivel } from '@/lib/markup-busca';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { podeVerMarkupResumo } from '@/lib/markup-auditor-lucro';

interface MarkupCalculatorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: number;
  leadNome?: string;
  orcamentoId?: string | null;
  /**
   * Quando true (e sem orcamentoId), cria um markup novo:
   * - se já existe um no lead, copia valor/itens do mais recente e salva com ID novo
   *   (o anterior permanece intacto);
   * - se não existe, abre formulário vazio.
   */
  forceNovo?: boolean;
  /** Atualiza o campo Orçamentos do lead na tela (sem marcar formulário sujo). */
  onPrecoFinalChange?: (valor: number) => void;
  /**
   * false = o card do lead continua clicável (Duplicar, fechar, etc.).
   * Usado quando a calculadora abre de dentro do LeadModal.
   */
  modal?: boolean;
}

function linhasServicoIguais(
  a: MarkupModulos['servicos']['linhas'],
  b: MarkupModulos['servicos']['linhas'],
): boolean {
  if (a.length !== b.length) return false;
  return a.every((linha, i) => {
    const outra = b[i];
    return (
      linha.template_id === outra.template_id &&
      linha.descricao === outra.descricao &&
      linha.horas === outra.horas &&
      linha.valor_hora === outra.valor_hora &&
      linha.ativo === outra.ativo
    );
  });
}

function sincronizarDespesasComTemplates(
  templates: { id: string; nome: string; valor_padrao: number }[],
  existentes?: MarkupLinhaDespesa[],
): MarkupLinhaDespesa[] {
  const linhasTemplate = templates.map((t) => {
    const existente = existentes?.find(
      (e) => e.template_id === t.id || e.descricao.trim() === t.nome.trim(),
    );
    const valorTemplate = Number(t.valor_padrao) || 0;

    if (existente) {
      const valorSalvo = Number(existente.valor) || 0;
      return {
        template_id: t.id,
        descricao: t.nome,
        valor: valorSalvo > 0 ? valorSalvo : valorTemplate,
        ativo: existente.ativo !== false,
      };
    }

    return {
      template_id: t.id,
      descricao: t.nome,
      valor: valorTemplate,
      ativo: true,
    };
  });

  const extras =
    existentes?.filter(
      (e) =>
        !e.template_id &&
        !templates.some((t) => t.nome.trim() === e.descricao.trim()),
    ) ?? [];

  return [...linhasTemplate, ...extras];
}

const TITULO_MARKUP_PADRAO = 'Markup';

function tituloEhPadrao(titulo?: string | null): boolean {
  const valor = titulo?.trim();
  return !valor || valor === TITULO_MARKUP_PADRAO;
}

function tituloPadraoMarkup(leadNome?: string): string {
  const nome = leadNome?.trim();
  return nome || TITULO_MARKUP_PADRAO;
}

/** Usa o nome do lead quando o título ainda é o genérico "Markup". */
function resolverTituloMarkup(leadNome: string | undefined, tituloAtual?: string | null): string {
  if (tituloEhPadrao(tituloAtual)) {
    return tituloPadraoMarkup(leadNome);
  }
  return tituloAtual!.trim();
}

function snapshotMarkupForm(input: {
  leadId: number;
  orcamentoId: string | null;
  titulo: string;
  obsRodape: string;
  modulos: MarkupModulos;
}): string {
  return JSON.stringify(input);
}

type MarkupAutoSaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

/** Evita rajada de writes na nuvem enquanto o usuário digita. */
const MARKUP_AUTO_SAVE_DEBOUNCE_MS = 2000;
/** Sync do valor no lead: mais lento que o auto-save para não competir com ele. */
const MARKUP_LEAD_SYNC_DEBOUNCE_MS = 2500;
/**
 * Após abrir/hidratar, ignora auto-save e sync de lead por este período.
 * Evita travar a UI com save em cascata só por re-sincronizar templates.
 */
const MARKUP_HYDRATION_GRACE_MS = 1200;

const MARKUP_DRAFT_PREFIX = 'markup-draft-v1';

interface MarkupLocalDraft {
  savedAt: string;
  leadId: number;
  orcamentoId: string | null;
  titulo: string;
  obsRodape: string;
  modulos: MarkupModulos;
}

function markupDraftStorageKey(leadId: number, orcamentoId: string | null): string {
  return `${MARKUP_DRAFT_PREFIX}:${leadId}:${orcamentoId ?? 'novo'}`;
}

function lerDraftLocal(leadId: number, orcamentoId: string | null): MarkupLocalDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const keys = [
      markupDraftStorageKey(leadId, orcamentoId),
      // Rascunho criado antes do primeiro id na nuvem
      ...(orcamentoId ? [markupDraftStorageKey(leadId, null)] : []),
    ];
    let melhor: MarkupLocalDraft | null = null;
    for (const key of keys) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as MarkupLocalDraft;
      if (!parsed?.modulos || parsed.leadId !== leadId) continue;
      if (!melhor || parsed.savedAt > melhor.savedAt) melhor = parsed;
    }
    return melhor;
  } catch {
    return null;
  }
}

function gravarDraftLocal(draft: MarkupLocalDraft): void {
  if (typeof window === 'undefined') return;
  try {
    const key = markupDraftStorageKey(draft.leadId, draft.orcamentoId);
    window.localStorage.setItem(key, JSON.stringify(draft));
    // Se já tem id na nuvem, limpa o rascunho "novo"
    if (draft.orcamentoId) {
      window.localStorage.removeItem(markupDraftStorageKey(draft.leadId, null));
    }
  } catch {
    // quota / private mode — ignora
  }
}

function limparDraftLocal(leadId: number, orcamentoId: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(markupDraftStorageKey(leadId, orcamentoId));
    window.localStorage.removeItem(markupDraftStorageKey(leadId, null));
  } catch {
    // ignore
  }
}

export function MarkupCalculatorSheet({
  open,
  onOpenChange,
  leadId,
  leadNome,
  orcamentoId: orcamentoIdProp,
  forceNovo = false,
  onPrecoFinalChange,
  modal = true,
}: MarkupCalculatorSheetProps) {
  const { userRole, isSuperAdmin } = useAuth();
  const podeVerResumo = podeVerMarkupResumo(userRole, isSuperAdmin);
  const { empresa, schemaEmpresa, queriesReady } = useEmpresa();
  const { config, isLoading: loadingConfig } = useMarkupConfig();
  const { config: pipelineAiConfig } = usePipelineLeadAIConfig();
  const { syncValorLead } = useSyncLeadMarkupValor();
  const { data: produtos = [], isLoading: loadingProdutos, criarProduto } = useMarkupProdutos();
  const { data: categorias = [] } = useMarkupCategorias();
  const { data: despesaTemplates = [], isLoading: loadingDespesas } = useMarkupDespesaTemplates();
  const { data: servicoTemplates = [], isLoading: loadingServicos } = useMarkupServicoTemplates();
  const { items: leadMediaItems, isLoading: leadMediaLoading } = useLeadAIMediaItems(leadId);
  const { uploadPDF: uploadAnexoIA } = useLeadPDFs(leadId);
  const { data: analises = [] } = useLeadAIAnalyses(leadId);
  const { orcamentos, salvarOrcamento, duplicarOrcamento, removerOrcamento, isLoading: loadingOrcamentos } =
    useMarkupOrcamentos(leadId);

  const [orcamentoId, setOrcamentoId] = useState<string | null>(orcamentoIdProp ?? null);
  const [titulo, setTitulo] = useState(() => tituloPadraoMarkup(leadNome));
  const [obsRodape, setObsRodape] = useState('');
  const [modulos, setModulos] = useState<MarkupModulos>(() => criarModulosVazios(config));
  const [busca, setBusca] = useState('');
  const [exportando, setExportando] = useState(false);
  const [confirmExcluirAberto, setConfirmExcluirAberto] = useState(false);
  const [compondoIA, setCompondoIA] = useState(false);
  const [composeEvents, setComposeEvents] = useState<MarkupIAComposeEvent[]>([]);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [composeItens, setComposeItens] = useState<LeadAIAnalysisItemPayload[]>([]);
  // Modelo escolhido no ponto de uso — começa vazio (usa o padrão de Markup → Configurações → IA);
  // só existe enquanto o popup está aberto, não é persistido.
  const [iaModelOverride, setIaModelOverride] = useState<string>('');
  const composeAbortRef = useRef<AbortController | null>(null);
  const [selectedMediaKeys, setSelectedMediaKeys] = useState<Set<string>>(new Set());
  const mediaSelectionInitRef = useRef(false);
  const [conferenciaAberta, setConferenciaAberta] = useState(false);
  const [itensConferencia, setItensConferencia] = useState<MarkupItemExtraido[]>([]);
  const [limitesConferencia, setLimitesConferencia] = useState<MarkupComposeIAResult['limites_anexos']>(null);
  const pendingComposeRef = useRef<MarkupComposeIAResult | null>(null);
  const lastComposeResultRef = useRef<MarkupComposeIAResult | null>(null);
  const [desfazendoComposicao, setDesfazendoComposicao] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('materiais');
  const [composicaoExpandida, setComposicaoExpandida] = useState(false);
  const [formHydrated, setFormHydrated] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const [autoSaveState, setAutoSaveState] = useState<MarkupAutoSaveState>('idle');
  /** Rascunho do preço final enquanto o usuário digita (evita o campo “pular” a cada tecla). */
  const [precoFinalDraft, setPrecoFinalDraft] = useState<string | null>(null);
  const lastSnapshotRef = useRef<string | null>(null);
  const composicaoAnteriorRef = useRef<MarkupComposicaoAnterior | null>(null);
  const lastServicoSyncRef = useRef<string | null>(null);
  const onPrecoFinalChangeRef = useRef(onPrecoFinalChange);
  const persistirMarkupRef = useRef<((silent: boolean) => Promise<unknown>) | null>(null);
  const salvarOrcamentoRef = useRef(salvarOrcamento);
  const syncValorLeadRef = useRef(syncValorLead);
  const formLiveRef = useRef({
    titulo: '',
    obsRodape: '',
    modulos: null as MarkupModulos | null,
    orcamentoId: null as string | null,
    formDirty: false,
    formHydrated: false,
  });
  /** Impede auto-saves paralelos (causa loop de “Salvando…”). */
  const autoSaveInFlightRef = useRef(false);
  const autoSaveQueuedRef = useRef(false);
  const sheetAbertoRef = useRef(open);
  /** Timestamp até o qual abertura/hidratação não dispara auto-save/sync. */
  const hydrationGraceUntilRef = useRef(0);
  const skipNextLeadPriceSyncRef = useRef(false);

  useEffect(() => {
    setMarkupCalculatorOpenFlag(open);
    sheetAbertoRef.current = open;
    return () => setMarkupCalculatorOpenFlag(false);
  }, [open]);

  useEffect(() => {
    if (mediaSelectionInitRef.current || leadMediaItems.length === 0) return;
    mediaSelectionInitRef.current = true;
    const anexos = leadMediaItems.filter((item) => item.source === 'anexo');
    const padrao = anexos.length > 0 ? anexos : leadMediaItems;
    setSelectedMediaKeys(new Set(padrao.map((item) => item.key)));
  }, [leadMediaItems]);

  const servicoTemplatesEfetivos = useMemo(
    () => resolverServicoTemplatesEfetivos(servicoTemplates, config),
    [servicoTemplates, config],
  );

  useEffect(() => {
    onPrecoFinalChangeRef.current = onPrecoFinalChange;
  }, [onPrecoFinalChange]);

  useEffect(() => {
    salvarOrcamentoRef.current = salvarOrcamento;
  }, [salvarOrcamento]);

  useEffect(() => {
    syncValorLeadRef.current = syncValorLead;
  }, [syncValorLead]);

  useEffect(() => {
    formLiveRef.current = {
      titulo,
      obsRodape,
      modulos,
      orcamentoId,
      formDirty,
      formHydrated,
    };
  }, [titulo, obsRodape, modulos, orcamentoId, formDirty, formHydrated]);

  const gravarRascunhoLocalAgora = useCallback(() => {
    const live = formLiveRef.current;
    if (!live.formHydrated || !live.modulos) return;
    gravarDraftLocal({
      savedAt: new Date().toISOString(),
      leadId,
      orcamentoId: live.orcamentoId,
      titulo: live.titulo,
      obsRodape: live.obsRodape,
      modulos: live.modulos,
    });
  }, [leadId]);

  const getFormSnapshot = useCallback(
    () =>
      snapshotMarkupForm({
        leadId,
        orcamentoId,
        titulo,
        obsRodape,
        modulos,
      }),
    [leadId, orcamentoId, titulo, obsRodape, modulos],
  );

  const aplicarOrcamentoNoFormulario = useCallback(
    (
      alvo: MarkupOrcamento | null,
      options?: { ignorarDraftLocal?: boolean; salvarComoNovo?: boolean },
    ) => {
      const valorHoraFallback = config.valor_hora_marcenaria ?? 0;
      const valorHoraPadraoAnteriores = parseAssinaturaServicoTemplates(
        lastServicoSyncRef.current,
      );
      const opcoesServicos = {
        preencherValorHoraPadrao: true,
        valorHoraPadraoAnteriores,
        valorHoraFallback,
      };

      let idFinal: string | null = alvo?.id ?? null;
      let tituloFinal: string;
      let obsFinal: string;
      let modulosFinais: MarkupModulos;
      /** Só true quando há algo que o usuário/recuperação realmente precisa gravar. */
      let precisaPersistir = false;

      if (alvo) {
        const modulosSalvos = garantirEstruturaModulos(alvo.modulos, config);
        const servicosBase = normalizarServicosModulos(
          modulosSalvos.servicos,
          servicoTemplates,
          valorHoraFallback,
        );
        const modulosSincronizados = sincronizarResumoIADosModulos(
          recalcularModulos(
            aplicarConfiguracaoFixaNosModulos(config, {
              ...modulosSalvos,
              servicos: {
                ...servicosBase,
                linhas: sincronizarServicosComTemplates(
                  servicoTemplatesEfetivos,
                  servicosBase.linhas,
                  opcoesServicos,
                ),
              },
              despesas: sincronizarDespesasComTemplates(despesaTemplates, modulosSalvos.despesas),
            }),
          ),
        );
        tituloFinal = resolverTituloMarkup(leadNome, alvo.titulo);
        obsFinal = alvo.observacoes_rodape;
        modulosFinais = modulosSincronizados;
        composicaoAnteriorRef.current = alvo.modulos.meta?.composicao_anterior ?? null;

        // Novo markup a partir do anterior: mesma composição, mas SEM o ID antigo
        // (o auto-save cria um registro novo e o anterior permanece salvo).
        if (options?.salvarComoNovo) {
          idFinal = null;
          const baseTitulo =
            tituloFinal.replace(/\s*\(cópia\)\s*$/i, '').trim() || tituloPadraoMarkup(leadNome);
          tituloFinal = `${baseTitulo} (cópia)`;
          limparDraftLocal(leadId, null);
          precisaPersistir = true;
        }
      } else {
        const base = criarModulosVazios(config);
        base.impostos = {
          percentual_imposto: config.percentual_imposto,
          taxas_financeiras: config.taxas_financeiras,
        };
        base.margem = {
          margem_lucro: config.margem_lucro,
          custo_frete: config.custo_frete_padrao,
          fator_sobras: config.fator_sobras,
          desconto_final_percent: 0,
        };
        base.despesas = sincronizarDespesasComTemplates(despesaTemplates);
        base.servicos.linhas = sincronizarServicosComTemplates(
          servicoTemplatesEfetivos,
          [],
          opcoesServicos,
        );
        modulosFinais = recalcularModulos(aplicarConfiguracaoFixaNosModulos(config, base));
        tituloFinal = tituloPadraoMarkup(leadNome);
        obsFinal = config.rodape_observacoes_padrao;
        composicaoAnteriorRef.current = null;
      }

      // Rascunho local mais recente que a nuvem = continuar de onde parou
      // (ignorado em criação explícita de novo markup para não reabrir o anterior)
      const draft = options?.ignorarDraftLocal ? null : lerDraftLocal(leadId, idFinal);
      if (draft) {
        const cloudTs = alvo?.atualizado_em ? new Date(alvo.atualizado_em).getTime() : 0;
        const draftTs = new Date(draft.savedAt).getTime();
        if (Number.isFinite(draftTs) && draftTs > cloudTs) {
          const modulosDraft = garantirEstruturaModulos(draft.modulos, config);
          const servicosDraft = normalizarServicosModulos(
            modulosDraft.servicos,
            servicoTemplates,
            valorHoraFallback,
          );
          modulosFinais = sincronizarResumoIADosModulos(
            recalcularModulos(
              aplicarConfiguracaoFixaNosModulos(config, {
                ...modulosDraft,
                servicos: {
                  ...servicosDraft,
                  linhas: sincronizarServicosComTemplates(
                    servicoTemplatesEfetivos,
                    servicosDraft.linhas,
                    opcoesServicos,
                  ),
                },
                despesas: sincronizarDespesasComTemplates(despesaTemplates, modulosDraft.despesas),
              }),
            ),
          );
          idFinal = draft.orcamentoId ?? idFinal;
          tituloFinal = resolverTituloMarkup(leadNome, draft.titulo);
          obsFinal = draft.obsRodape;
          composicaoAnteriorRef.current = draft.modulos.meta?.composicao_anterior ?? null;
          precisaPersistir = true;
        }
      }

      // Desconto final sempre inicia zerado ao abrir a calculadora.
      const descontoAnterior = modulosFinais.margem?.desconto_final_percent ?? 0;
      if (descontoAnterior !== 0) {
        modulosFinais = recalcularModulos({
          ...modulosFinais,
          margem: { ...modulosFinais.margem, desconto_final_percent: 0 },
        });
        // Ajuste só de UI na abertura — não dispara save automático.
      }

      // Snapshot = o que está na tela. Diferenças de sync de template NÃO sujam o form
      // (antes isso marcava dirty e iniciava save em loop ao abrir).
      const snapshotFinal = snapshotMarkupForm({
        leadId,
        orcamentoId: idFinal,
        titulo: tituloFinal,
        obsRodape: obsFinal,
        modulos: modulosFinais,
      });

      hydrationGraceUntilRef.current = Date.now() + MARKUP_HYDRATION_GRACE_MS;
      skipNextLeadPriceSyncRef.current = true;

      setOrcamentoId(idFinal);
      setTitulo(tituloFinal);
      setObsRodape(obsFinal);
      setModulos(modulosFinais);
      // Para forçar 1 save (rascunho local / novo markup), baseline propositalmente diferente.
      lastSnapshotRef.current = precisaPersistir ? null : snapshotFinal;
      if (servicoTemplatesEfetivos.length > 0) {
        lastServicoSyncRef.current = servicoTemplatesEfetivos
          .map((t) => `${t.id}:${t.nome}:${t.valor_hora_padrao}`)
          .join('|');
      }
      setFormDirty(precisaPersistir);
      setAutoSaveState(precisaPersistir ? 'pending' : 'idle');
      setFormHydrated(true);
    },
    [config, despesaTemplates, servicoTemplates, servicoTemplatesEfetivos, leadId, leadNome],
  );

  useEffect(() => {
    if (open) {
      lastServicoSyncRef.current = null;
    }
  }, [open, leadId]);

  useEffect(() => {
    lastServicoSyncRef.current = null;
  }, [schemaEmpresa]);

  useEffect(() => {
    if (!open) {
      setFormHydrated(false);
      setFormDirty(false);
      setAutoSaveState('idle');
      setComposicaoExpandida(false);
      lastSnapshotRef.current = null;
      composicaoAnteriorRef.current = null;
      setOrcamentoId(null);
    }
  }, [open]);

  useEffect(() => {
    if (
      !open ||
      !queriesReady ||
      loadingOrcamentos ||
      loadingConfig ||
      loadingDespesas ||
      loadingServicos ||
      formHydrated
    ) {
      return;
    }

    const criacaoExplicita = forceNovo && !orcamentoIdProp;
    // Em "Novo markup", usa o mais recente só como modelo (cópia); sem modelo → em branco.
    const alvo = orcamentoIdProp
      ? orcamentos.find((o) => o.id === orcamentoIdProp) ?? null
      : orcamentos[0] ?? null;

    aplicarOrcamentoNoFormulario(criacaoExplicita && !alvo ? null : alvo, {
      ignorarDraftLocal: criacaoExplicita,
      salvarComoNovo: criacaoExplicita && !!alvo,
    });
  }, [
    open,
    queriesReady,
    loadingOrcamentos,
    loadingConfig,
    loadingDespesas,
    loadingServicos,
    formHydrated,
    orcamentoIdProp,
    forceNovo,
    orcamentos,
    aplicarOrcamentoNoFormulario,
  ]);

  useEffect(() => {
    if (!open || !formHydrated || !queriesReady) return;

    const assinaturaTemplates = servicoTemplatesEfetivos
      .map((t) => `${t.id}:${t.nome}:${t.valor_hora_padrao}`)
      .join('|');
    if (lastServicoSyncRef.current === assinaturaTemplates) return;

    const valorHoraFallback = config.valor_hora_marcenaria ?? 0;
    const valorHoraPadraoAnteriores = parseAssinaturaServicoTemplates(lastServicoSyncRef.current);

    setModulos((prev) => {
      const prevSeguro = garantirEstruturaModulos(prev, config);
      const linhas =
        servicoTemplatesEfetivos.length > 0
          ? sincronizarServicosComTemplates(
              servicoTemplatesEfetivos,
              prevSeguro.servicos.linhas ?? [],
              {
                preencherValorHoraPadrao: true,
                valorHoraPadraoAnteriores,
                valorHoraFallback,
              },
            )
          : prevSeguro.servicos.linhas ?? [];

      const semMudanca = linhasServicoIguais(linhas, prevSeguro.servicos.linhas ?? []);

      if (semMudanca) return prevSeguro;

      return recalcularModulos(
        aplicarConfiguracaoFixaNosModulos(config, {
          ...prevSeguro,
          servicos: {
            ...prevSeguro.servicos,
            // Mantém valor/hora deste orçamento; só usa o padrão se ainda não houver
            valor_hora: prevSeguro.servicos.valor_hora || valorHoraFallback,
            linhas,
          },
        }),
      );
    });

    lastServicoSyncRef.current = assinaturaTemplates;
  }, [
    open,
    formHydrated,
    queriesReady,
    servicoTemplatesEfetivos,
    config,
  ]);

  useEffect(() => {
    if (!formHydrated) return;

    const aplicarDirty = () => {
      if (!sheetAbertoRef.current) return;
      setFormDirty(getFormSnapshot() !== lastSnapshotRef.current);
    };

    const graceRestante = hydrationGraceUntilRef.current - Date.now();
    if (graceRestante > 0) {
      const t = window.setTimeout(aplicarDirty, graceRestante + 16);
      return () => window.clearTimeout(t);
    }
    aplicarDirty();
  }, [formHydrated, getFormSnapshot]);

  const modulosSeguros = useMemo(
    () => garantirEstruturaModulos(modulos, config),
    [modulos, config],
  );

  const ordemCatalogoPorCategoria = modulosSeguros.meta?.catalogo_ordem_por_categoria;

  const produtosPorCategoria = useMemo(() => {
    const map = new Map<string, typeof produtos>();
    for (const p of produtos) {
      const key = chaveCardCatalogoMarkup(p);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return map;
  }, [produtos]);

  const qtdPorProduto = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of modulosSeguros.materiais.linhas) {
      if (l.produto_id) map.set(l.produto_id, l.quantidade);
    }
    return map;
  }, [modulosSeguros.materiais.linhas]);

  const origemPorProduto = useMemo(() => {
    const map = new Map<string, MarkupLinhaOrigemIA>();
    const prioridade = (atual?: MarkupLinhaOrigemIA, novo?: MarkupLinhaOrigemIA) => {
      const rank = (o?: string) =>
        o === 'projetista_complemento'
          ? 3
          : o === 'projetista'
            ? 2
            : o === 'cortecloud' || o === 'documento'
              ? 1
              : 0;
      return rank(atual) >= rank(novo) ? atual : novo;
    };
    for (const l of modulosSeguros.materiais.linhas) {
      if (l.produto_id && l.origem_ia) {
        map.set(l.produto_id, prioridade(map.get(l.produto_id), l.origem_ia) ?? l.origem_ia);
      }
    }
    for (const pid of modulosSeguros.meta?.resumo_ia?.produtos_origem_projetista ?? []) {
      map.set(pid, prioridade(map.get(pid), 'projetista') ?? 'projetista');
    }
    return map;
  }, [
    modulosSeguros.materiais.linhas,
    modulosSeguros.meta?.resumo_ia?.produtos_origem_projetista,
  ]);

  const catalogoPorCategoriaOrdenado = useMemo(() => {
    const entries = Array.from(produtosPorCategoria.entries()).map(([cat, items]) => {
      const ordenados = ordenarProdutosCardCatalogo(
        items,
        ordemCatalogoPorCategoria?.[cat],
        qtdPorProduto,
      );
      const temSelecionado = ordenados.some((p) => (qtdPorProduto.get(p.id) ?? 0) > 0);
      return { cat, items: ordenados, temSelecionado };
    });

    return entries.sort((a, b) => {
      if (a.temSelecionado !== b.temSelecionado) return a.temSelecionado ? -1 : 1;
      return a.cat.localeCompare(b.cat, 'pt-BR');
    });
  }, [produtosPorCategoria, qtdPorProduto, ordemCatalogoPorCategoria]);

  const linhasNaComposicao = useMemo(() => {
    // Espelha a ordem dos cards do catálogo (incluindo ordem customizada por lead).
    const rankPorProduto = new Map<string, number>();
    let rank = 0;
    for (const { items } of catalogoPorCategoriaOrdenado) {
      for (const p of items) {
        rankPorProduto.set(p.id, rank++);
      }
    }

    return modulosSeguros.materiais.linhas
      .map((linha, index) => ({ linha, index }))
      .filter(({ linha }) => linha.quantidade > 0)
      .sort((a, b) => {
        const ativoA = a.linha.ativo === false ? 1 : 0;
        const ativoB = b.linha.ativo === false ? 1 : 0;
        if (ativoA !== ativoB) return ativoA - ativoB;

        const rankA =
          a.linha.produto_id != null ? rankPorProduto.get(a.linha.produto_id) : undefined;
        const rankB =
          b.linha.produto_id != null ? rankPorProduto.get(b.linha.produto_id) : undefined;
        if (rankA != null && rankB != null && rankA !== rankB) return rankA - rankB;
        if (rankA != null && rankB == null) return -1;
        if (rankA == null && rankB != null) return 1;
        return a.linha.descricao.localeCompare(b.linha.descricao, 'pt-BR');
      });
  }, [modulosSeguros.materiais.linhas, catalogoPorCategoriaOrdenado]);

  const atualizarModulos = useCallback(
    (updater: (prev: MarkupModulos) => MarkupModulos) => {
      setModulos((prev) => {
        const prevSeguro = garantirEstruturaModulos(prev, config);
        const comConfig = aplicarConfiguracaoFixaNosModulos(config, updater(prevSeguro));
        return sincronizarResumoIADosModulos(recalcularModulos(comConfig));
      });
    },
    [config],
  );

  const onEditarTextoResumo = useCallback(
    (texto: string) => {
      atualizarModulos((prev) => ({
        ...prev,
        meta: {
          ...prev.meta,
          resumo_ia: prev.meta?.resumo_ia
            ? { ...prev.meta.resumo_ia, texto_resumo: texto }
            : undefined,
        },
      }));
    },
    [atualizarModulos],
  );

  const onToggleMaterial = useCallback(
    (produtoId: string, ativo: boolean) => {
      atualizarModulos((prev) => ({
        ...prev,
        materiais: {
          ...prev.materiais,
          linhas: prev.materiais.linhas.map((l) =>
            l.produto_id === produtoId ? { ...l, ativo } : l,
          ),
        },
      }));
    },
    [atualizarModulos],
  );

  const onToggleServico = useCallback(
    (templateId: string, ativo: boolean) => {
      atualizarModulos((prev) => ({
        ...prev,
        servicos: {
          ...prev.servicos,
          linhas: prev.servicos.linhas.map((l) =>
            l.template_id === templateId || l.descricao === templateId
              ? { ...l, ativo }
              : l,
          ),
        },
      }));
    },
    [atualizarModulos],
  );

  const onToggleDespesaResumo = useCallback(
    (index: number, ativo: boolean) => {
      atualizarModulos((prev) => {
        const despesas = [...prev.despesas];
        if (!despesas[index]) return prev;
        despesas[index] = { ...despesas[index], ativo };
        return { ...prev, despesas };
      });
    },
    [atualizarModulos],
  );

  const setQuantidadeProduto = (produtoId: string, produto: typeof produtos[0], qtd: number) => {
    atualizarModulos((prev) => {
      const linhas = [...prev.materiais.linhas];
      const idx = linhas.findIndex((l) => l.produto_id === produtoId);
      const preco = produto.preco_unitario ?? 0;
      const categoria = rotuloCategoriaProdutoMarkup(produto);
      const unidade = produto.unidade || null;

      if (qtd <= 0) {
        if (idx >= 0) linhas.splice(idx, 1);
      } else if (idx >= 0) {
        linhas[idx] = {
          ...linhas[idx],
          quantidade: qtd,
          valor_unitario: preco,
          valor_total: qtd * preco,
          variacao: produto.variacao,
          unidade,
          categoria: categoria === '—' ? linhas[idx].categoria ?? null : categoria,
        };
      } else {
        linhas.push({
          produto_id: produtoId,
          descricao: produto.nome,
          variacao: produto.variacao,
          unidade,
          categoria: categoria === '—' ? null : categoria,
          quantidade: qtd,
          valor_unitario: preco,
          valor_total: qtd * preco,
          ativo: true,
        });
      }
      return { ...prev, materiais: { ...prev.materiais, linhas } };
    });
  };

  const onReordenarCatalogoCategoria = useCallback(
    (categoriaKey: string, novaOrdemIds: string[]) => {
      atualizarModulos((prev) => ({
        ...prev,
        meta: {
          ...prev.meta,
          catalogo_ordem_por_categoria: {
            ...(prev.meta?.catalogo_ordem_por_categoria ?? {}),
            [categoriaKey]: novaOrdemIds,
          },
        },
      }));
    },
    [atualizarModulos],
  );

  const setQuantidadeLinha = (linhaIndex: number, qtd: number) => {
    atualizarModulos((prev) => {
      const linhas = [...prev.materiais.linhas];
      const linha = linhas[linhaIndex];
      if (!linha) return prev;

      if (qtd <= 0) {
        linhas.splice(linhaIndex, 1);
      } else {
        linhas[linhaIndex] = {
          ...linha,
          quantidade: qtd,
          valor_total: qtd * linha.valor_unitario,
        };
      }
      return { ...prev, materiais: { ...prev.materiais, linhas } };
    });
  };

  const precoFinal = modulosSeguros.totais.preco_final;

  const confirmarPrecoFinalEditado = useCallback(() => {
    if (precoFinalDraft == null) return;
    const bruto = modulosSeguros.totais.preco_final_bruto;
    const normalizado = precoFinalDraft.trim().replace(/\s/g, '').replace(',', '.');
    if (normalizado === '' || Number.isNaN(Number(normalizado))) {
      setPrecoFinalDraft(null);
      return;
    }
    const alvo = Math.max(0, parseFloat(normalizado));
    const pct = calcularDescontoPercentFromPrecoAlvo(bruto, alvo);
    atualizarModulos((prev) => ({
      ...prev,
      margem: { ...prev.margem, desconto_final_percent: pct },
    }));
    setPrecoFinalDraft(null);
  }, [precoFinalDraft, modulosSeguros.totais.preco_final_bruto, atualizarModulos]);

  const confirmarLucroReaisEditado = useCallback(
    (lucroAlvo: number) => {
      const custo = modulosSeguros.totais.custo_com_impostos;
      const pct = calcularMargemPercentFromLucroAlvo(custo, lucroAlvo);
      atualizarModulos((prev) => ({
        ...prev,
        margem: { ...prev.margem, margem_lucro: pct },
      }));
    },
    [modulosSeguros.totais.custo_com_impostos, atualizarModulos],
  );

  const persistirMarkup = useCallback(
    async (silent: boolean) => {
      const live = formLiveRef.current;
      const modulosAtuais = live.modulos ?? criarModulosVazios(config);
      const tituloAtual = live.titulo;
      const obsAtual = live.obsRodape;
      const idAtual = live.orcamentoId;

      const modulosParaSalvar = recalcularModulos(
        aplicarConfiguracaoFixaNosModulos(config, modulosAtuais),
      );
      const preco = modulosParaSalvar.totais.preco_final;
      const tituloParaSalvar = resolverTituloMarkup(leadNome, tituloAtual);
      const result = await salvarOrcamentoRef.current.mutateAsync({
        id: idAtual ?? undefined,
        lead_id: leadId,
        titulo: tituloParaSalvar,
        modulos: modulosParaSalvar,
        preco_final: preco,
        observacoes_rodape: obsAtual,
        status: 'rascunho',
        silent,
      });

      // Só atualiza estado da UI se a calculadora ainda estiver aberta
      if (sheetAbertoRef.current) {
        if (result.id !== idAtual) {
          setOrcamentoId(result.id);
        }
        if (tituloParaSalvar !== tituloAtual) {
          setTitulo(tituloParaSalvar);
        }
        // Evita setModulos no auto-save silencioso quando nada mudou visualmente
        // (setModulos extra re-dispara dirty e reinicia o ciclo de save).
        const modulosMudaram =
          JSON.stringify(modulosAtuais) !== JSON.stringify(modulosParaSalvar);
        if (!silent || modulosMudaram) {
          setModulos(modulosParaSalvar);
        }
        lastSnapshotRef.current = snapshotMarkupForm({
          leadId,
          orcamentoId: result.id,
          titulo: tituloParaSalvar,
          obsRodape: obsAtual,
          modulos: modulosParaSalvar,
        });
        setFormDirty(false);
        limparDraftLocal(leadId, result.id);
      }

      if (preco > 0) {
        // Atualiza o campo Orçamento no card do lead (UI) e grava no banco.
        // Vale para Salvar manual e auto-save: o debounce de preço sozinho falhava
        // quando o preço já estava na calculadora ao abrir (skip da hidratação).
        onPrecoFinalChangeRef.current?.(preco);
        try {
          await syncValorLeadRef.current(leadId, preco);
        } catch {
          // O markup já foi salvo; o sync do lead tenta de novo no próximo save.
        }
      }
      return result;
    },
    [leadId, leadNome, config],
  );

  useEffect(() => {
    persistirMarkupRef.current = persistirMarkup;
  }, [persistirMarkup]);

  // Rascunho no navegador a cada alteração (sobrevive a refresh / queda de energia)
  useEffect(() => {
    if (!open || !formHydrated || !formDirty) return;
    const graceRestante = Math.max(0, hydrationGraceUntilRef.current - Date.now());
    const timer = window.setTimeout(() => {
      gravarDraftLocal({
        savedAt: new Date().toISOString(),
        leadId,
        orcamentoId,
        titulo,
        obsRodape,
        modulos,
      });
    }, graceRestante);
    return () => window.clearTimeout(timer);
  }, [open, formHydrated, formDirty, leadId, orcamentoId, titulo, obsRodape, modulos]);

  // Auto-save na nuvem (debounce + trava anti-loop)
  useEffect(() => {
    if (!open || !formHydrated || !formDirty) return;

    setAutoSaveState((s) => (s === 'saving' ? s : 'pending'));

    const graceRestante = Math.max(0, hydrationGraceUntilRef.current - Date.now());
    const delay = graceRestante + MARKUP_AUTO_SAVE_DEBOUNCE_MS;

    const timer = window.setTimeout(() => {
      void (async () => {
        if (autoSaveInFlightRef.current) {
          autoSaveQueuedRef.current = true;
          return;
        }

        autoSaveInFlightRef.current = true;
        let iteracoes = 0;
        try {
          do {
            autoSaveQueuedRef.current = false;
            iteracoes += 1;
            if (!sheetAbertoRef.current || iteracoes > 2) break;

            const live = formLiveRef.current;
            if (!live.formHydrated || !live.modulos) {
              setAutoSaveState('idle');
              break;
            }

            const snapshot = snapshotMarkupForm({
              leadId,
              orcamentoId: live.orcamentoId,
              titulo: live.titulo,
              obsRodape: live.obsRodape,
              modulos: live.modulos,
            });

            if (lastSnapshotRef.current !== null && snapshot === lastSnapshotRef.current) {
              setFormDirty(false);
              setAutoSaveState('idle');
              break;
            }

            setAutoSaveState('saving');
            try {
              await persistirMarkupRef.current?.(true);
              if (sheetAbertoRef.current) {
                setAutoSaveState('saved');
                window.setTimeout(() => {
                  if (sheetAbertoRef.current) setAutoSaveState('idle');
                }, 2000);
              }
            } catch {
              if (sheetAbertoRef.current) setAutoSaveState('error');
              break;
            }
          } while (autoSaveQueuedRef.current && sheetAbertoRef.current);
        } finally {
          autoSaveInFlightRef.current = false;
        }
      })();
    }, delay);

    return () => window.clearTimeout(timer);
    // Intencionalmente NÃO depende de persistirMarkup: a identidade da mutation
    // mudava a cada isPending e reiniciava o timer em loop.
  }, [open, formHydrated, formDirty, leadId, orcamentoId, titulo, obsRodape, modulos]);

  // Ao sair da aba ou desligar o PC: grava local na hora e tenta nuvem
  useEffect(() => {
    if (!open) return;

    const flushSeguro = () => {
      gravarRascunhoLocalAgora();
      const live = formLiveRef.current;
      if (!live.formDirty || !live.formHydrated) return;
      if (autoSaveInFlightRef.current) return;
      void persistirMarkupRef.current?.(true).catch(() => {
        // local já está salvo
      });
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushSeguro();
    };

    window.addEventListener('beforeunload', flushSeguro);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', flushSeguro);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [open, gravarRascunhoLocalAgora]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        onOpenChange(true);
        return;
      }

      gravarRascunhoLocalAgora();
      const live = formLiveRef.current;
      const precisaSalvarNuvem =
        live.formDirty && live.formHydrated && !!persistirMarkupRef.current;
      const salvarFn = persistirMarkupRef.current;

      // Fecha na hora: o travamento vinha de esperar o save em loop.
      // Rascunho local já garante que nada se perde; a nuvem segue em segundo plano.
      onOpenChange(false);

      if (precisaSalvarNuvem && salvarFn) {
        void salvarFn(true).catch(() => {
          // Mantém rascunho local para retomar depois
        });
      }
    },
    [onOpenChange, gravarRascunhoLocalAgora],
  );

  useEffect(() => {
    if (!open || !formHydrated || precoFinal <= 0) return;
    if (skipNextLeadPriceSyncRef.current) {
      skipNextLeadPriceSyncRef.current = false;
      return;
    }
    onPrecoFinalChangeRef.current?.(precoFinal);
    const timer = window.setTimeout(() => {
      void syncValorLeadRef.current(leadId, precoFinal);
    }, MARKUP_LEAD_SYNC_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [open, formHydrated, precoFinal, leadId]);

  const handleSalvar = async () => {
    try {
      await persistirMarkup(false);
    } catch {
      toast.error('Erro ao salvar markup');
    }
  };

  const selecionarOrcamento = (id: string) => {
    if (id === orcamentoId) return;
    const alvo = orcamentos.find((o) => o.id === id);
    if (!alvo) return;
    aplicarOrcamentoNoFormulario(alvo);
  };

  const orcamentoAtual = useMemo(
    () => orcamentos.find((o) => o.id === orcamentoId) ?? orcamentos[0] ?? null,
    [orcamentos, orcamentoId],
  );

  const handleExportarPdf = async () => {
    setExportando(true);
    try {
      const orc: MarkupOrcamento = {
        id: orcamentoId ?? '',
        lead_id: leadId,
        titulo: resolverTituloMarkup(leadNome, titulo),
        status: 'rascunho',
        modulos,
        preco_final: modulos.totais.preco_final,
        observacoes_rodape: obsRodape,
      };
      await exportarMarkupPdf(orc, {
        empresaNome: empresa?.nome ?? 'Empresa',
        empresaCnpj: (empresa as Record<string, unknown> | null)?.cnpj as string | undefined,
        logoUrl: empresa?.logo_url,
        timbradoUrl: config.timbrado_url,
        clienteNome: leadNome,
      });
      toast.success('PDF exportado!');
    } catch (e) {
      toast.error('Erro ao exportar PDF', {
        description: e instanceof Error ? e.message : 'Erro desconhecido',
      });
    } finally {
      setExportando(false);
    }
  };

  const handleDuplicar = async () => {
    if (!orcamentoAtual) return;
    const copia = await duplicarOrcamento.mutateAsync(orcamentoAtual);
    aplicarOrcamentoNoFormulario({
      ...copia,
      titulo: resolverTituloMarkup(leadNome, copia.titulo),
    });
  };

  const handleExcluir = async () => {
    const idParaExcluir = orcamentoId ?? orcamentoAtual?.id;
    if (!idParaExcluir) {
      toast.error('Salve o markup antes de excluir.');
      setConfirmExcluirAberto(false);
      return;
    }

    try {
      await removerOrcamento.mutateAsync(idParaExcluir);
      limparDraftLocal(leadId, idParaExcluir);
      setConfirmExcluirAberto(false);

      const restantes = orcamentos.filter((o) => o.id !== idParaExcluir);
      if (restantes.length > 0) {
        aplicarOrcamentoNoFormulario(restantes[0]);
      } else {
        onOpenChange(false);
      }
    } catch {
      // toast já tratado no hook
    }
  };

  const aplicarResultadoComposicao = async (resultado: MarkupComposeIAResult) => {
    const modulosAtuais = garantirEstruturaModulos(modulos, config);
    const tinhaComposicao = orcamentoTemComposicao(modulosAtuais);
    const composicaoAnterior = tinhaComposicao
      ? criarSnapshotComposicaoAnterior(modulosAtuais, titulo, obsRodape)
      : null;
    composicaoAnteriorRef.current = composicaoAnterior;

    const templatesServico =
      servicoTemplates.length > 0 ? servicoTemplates : servicoTemplatesEfetivos;
    const modulosBase = criarModulosBaseParaComposicaoIA(
      config,
      despesaTemplates,
      templatesServico,
    );

    const { modulos: modulosComposicao, validacao } = aplicarComposicaoIA(
      modulosBase,
      resultado,
      produtos,
      despesaTemplates,
      templatesServico,
      config,
    );

    if (validacao.bloquearSave) {
      composicaoAnteriorRef.current = modulos.meta?.composicao_anterior ?? null;
      toast.error('Composição com IDs inválidos', {
        description: validacao.erros.slice(0, 3).join(' · '),
      });
      return;
    }

    const modulosAtualizados = recalcularModulos(
      aplicarConfiguracaoFixaNosModulos(config, modulosComposicao),
    );
    const modulosComResumo = sincronizarResumoIADosModulos(modulosAtualizados);
    const modulosComMeta: MarkupModulos = garantirEstruturaModulos(
      {
        ...modulosComResumo,
        meta: {
          ...modulosComResumo.meta,
          ...(composicaoAnterior ? { composicao_anterior: composicaoAnterior } : {}),
        },
      },
      config,
    );
    setModulos(modulosComMeta);
    setFormDirty(true);
    if (podeVerResumo) setAbaAtiva('resumo');

    const preco = modulosComMeta.totais.preco_final;
    const itensDespesa = resultado.despesas?.filter((d) => d.ativo).length ?? 0;
    const avisosTexto = [
      validacao.subtotalMateriais > 0
        ? `Materiais: ${formatarMoedaMarkup(validacao.subtotalMateriais)}`
        : null,
      ...validacao.avisos.slice(0, 2),
    ]
      .filter(Boolean)
      .join(' · ');

    if (resultado.bloqueado || (resultado.faltantes_criticos?.length ?? 0) > 0) {
      toast.warning('Composição incompleta', {
        description:
          resultado.faltantes_criticos?.slice(0, 3).join(' · ') ||
          'Faltam dobradiças, corrediças ou fitas — revise antes de enviar ao cliente.',
      });
    } else {
      toast.success(
        tinhaComposicao ? 'Nova composição com IA aplicada!' : 'Composição com IA concluída!',
        {
          description:
            avisosTexto ||
            (tinhaComposicao
              ? 'A precificação anterior foi substituída pela nova análise.'
              : `${resultado.itens_processados ?? 0} materiais · mão de obra · ${itensDespesa} despesas`),
        },
      );
    }
    const saved = await salvarOrcamento.mutateAsync({
      id: orcamentoId ?? undefined,
      lead_id: leadId,
      titulo: resolverTituloMarkup(leadNome, titulo),
      modulos: modulosComMeta,
      preco_final: preco,
      observacoes_rodape: obsRodape,
      status: 'rascunho',
      silent: true,
    });
    setOrcamentoId(saved.id);
    const tituloSalvo = resolverTituloMarkup(leadNome, titulo);
    if (tituloSalvo !== titulo) {
      setTitulo(tituloSalvo);
    }
    lastSnapshotRef.current = snapshotMarkupForm({
      leadId,
      orcamentoId: saved.id,
      titulo: tituloSalvo,
      obsRodape,
      modulos: modulosComMeta,
    });
    if (preco > 0) {
      onPrecoFinalChangeRef.current?.(preco);
      await syncValorLead(leadId, preco);
    }
  };

  const handleComporComIA = async () => {
    if (!config.markup_ia_ativo) {
      toast.error('Composição com IA desativada', {
        description: 'Ative em Markup → Configurações → IA.',
      });
      return;
    }

    if (!pipelineAiConfig?.apiKeyConfigured) {
      toast.error('Chave OpenAI não configurada', {
        description: 'Configure em Pipeline → Configurações → IA do Lead.',
      });
      return;
    }

    if (!pipelineAiConfig.ativo) {
      toast.error('IA do pipeline desativada', {
        description: 'Ative a IA do lead nas configurações do pipeline.',
      });
      return;
    }

    const selecionados = leadMediaItems.filter((item) => selectedMediaKeys.has(item.key));
    const temMidia = selecionados.length > 0;
    const temAnalise = analises.length > 0;

    if (!temMidia && !temAnalise) {
      toast.error('Nenhum material para analisar', {
        description: 'Marque PDFs ou fotos do lead acima, ou execute a análise visual da Íris.',
      });
      return;
    }

    if (leadMediaItems.length > 0 && selecionados.length === 0) {
      toast.error('Selecione os anexos', {
        description: 'Marque pelo menos um PDF ou foto já anexado no lead.',
      });
      return;
    }

    setCompondoIA(true);
    setComposeEvents([]);
    setComposeError(null);
    composeAbortRef.current?.abort();
    const abortController = new AbortController();
    composeAbortRef.current = abortController;
    try {
      const detalhe = temMidia
        ? await resolveSelectedForAPIDetailed(selecionados)
        : { payload: [], limites: { arquivosSelecionados: 0, arquivosEnviados: 0, arquivosOmitidos: 0, paginasEnviadas: 0, paginasOmitidas: 0, avisos: [] } };
      setComposeItens(detalhe.payload);

      for (const aviso of detalhe.limites.avisos) {
        toast.warning('Limite de leitura da IA', { description: aviso });
      }
      // Aviso de custo/tempo: o pipeline já dispara várias chamadas à IA por composição
      // (fidelidade + projetista + 1 por categoria de inventário + auditores + precificador);
      // com muitas páginas cada chamada fica mais cara e mais lenta, mesmo sem mudar a
      // quantidade de chamadas. Só um alerta, não bloqueia — decisão continua do usuário.
      if (detalhe.limites.paginasEnviadas > 15) {
        toast.info('Documento grande', {
          description: `${detalhe.limites.paginasEnviadas} páginas enviadas — a composição pode demorar mais e custar mais tokens de IA do que o normal.`,
        });
      }

      const resultado = await invokeComposeMarkupIAStream(
        {
          leadId,
          leadName: leadNome,
          empresaSchema: schemaEmpresa,
          itens: detalhe.payload,
          stream: true,
          signal: abortController.signal,
          model: iaModelOverride || undefined,
        },
        (event) => {
          setComposeEvents((prev) => [...prev, event]);
        },
      );

      const resultadoComLimites: MarkupComposeIAResult = {
        ...resultado,
        limites_anexos: detalhe.limites,
      };
      const extraidos = sintetizarItensExtraidos(resultadoComLimites, produtos);
      pendingComposeRef.current = resultadoComLimites;
      lastComposeResultRef.current = resultadoComLimites;
      setItensConferencia(extraidos);
      setLimitesConferencia(detalhe.limites);
      setConferenciaAberta(true);
      if (extraidos.length === 0) {
        toast.warning('Nenhum material extraído dos anexos', {
          description: 'Você ainda pode aplicar serviços e despesas, ou cancelar a conferência.',
        });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setComposeError('Composição cancelada pelo usuário.');
        toast.info('Composição com IA cancelada');
        return;
      }
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : 'Erro ao compor markup com IA';
      setComposeError(message);
      console.error('[Markup] Falha na composição com IA:', err);
      toast.error('Falha na composição com IA', { description: message });
    } finally {
      composeAbortRef.current = null;
      setCompondoIA(false);
    }
  };

  const handleCadastrarProdutoConferencia = async (payload: {
    nome: string;
    variacao: string | null;
    unidade: string;
    preco_unitario: number | null;
    categoria_id: string;
  }) => {
    const maxOrdem = produtos.reduce((acc, p) => Math.max(acc, p.ordem ?? 0), 0);
    const criado = await criarProduto.mutateAsync({
      categoria_id: payload.categoria_id,
      nome: payload.nome,
      variacao: payload.variacao,
      preco_unitario: payload.preco_unitario,
      unidade: payload.unidade,
      quantidade_padrao: 0,
      ativo: true,
      ordem: maxOrdem + 1,
    });
    if (!criado || typeof criado !== 'object' || !('id' in criado)) return null;
    const registro = criado as { id: unknown; unidade?: unknown };
    return {
      id: String(registro.id),
      unidade: typeof registro.unidade === 'string' ? registro.unidade : payload.unidade,
    };
  };

  const handleConfirmarConferencia = async () => {
    const pendente = pendingComposeRef.current;
    if (!pendente) {
      setConferenciaAberta(false);
      return;
    }
    const revisado = aplicarRevisaoNaComposicao(pendente, itensConferencia);
    setConferenciaAberta(false);
    lastComposeResultRef.current = revisado;
    pendingComposeRef.current = null;
    try {
      await aplicarResultadoComposicao(revisado);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao aplicar conferência';
      toast.error('Falha ao aplicar conferência', { description: message });
    }
  };

  const handleReabrirConferencia = () => {
    const extraidos = modulos.meta?.resumo_ia?.itens_extraidos;
    if (!extraidos?.length) {
      toast.info('Não há extração para reconferir neste markup.');
      return;
    }
    const fallback = lastComposeResultRef.current;
    pendingComposeRef.current = {
      comodos: fallback?.comodos ?? [],
      servicos:
        fallback?.servicos ??
        (modulos.servicos?.linhas ?? [])
          .filter((linha) => Boolean(linha.template_id))
          .map((linha) => ({ template_id: linha.template_id as string, horas: linha.horas })),
      despesas:
        fallback?.despesas ??
        (modulos.despesas ?? [])
          .filter((linha) => Boolean(linha.template_id))
          .map((linha) => ({
            template_id: linha.template_id as string,
            ativo: linha.ativo,
            valor: linha.valor,
          })),
      resumo_texto: fallback?.resumo_texto ?? modulos.meta?.resumo_ia?.texto_resumo ?? '',
      itens_nao_catalogados: fallback?.itens_nao_catalogados ?? modulos.meta?.resumo_ia?.itens_nao_catalogados,
      itens_extraidos: extraidos,
      limites_anexos: fallback?.limites_anexos ?? modulos.meta?.resumo_ia?.limites_anexos,
      verificacao_categorias: fallback?.verificacao_categorias ?? modulos.meta?.resumo_ia?.verificacao_categorias,
      levantamento_projetista:
        fallback?.levantamento_projetista ?? modulos.meta?.resumo_ia?.levantamento_projetista,
      produtos_origem_projetista:
        fallback?.produtos_origem_projetista ?? modulos.meta?.resumo_ia?.produtos_origem_projetista,
      bloqueado: fallback?.bloqueado ?? modulos.meta?.resumo_ia?.bloqueado,
      faltantes_criticos: fallback?.faltantes_criticos ?? modulos.meta?.resumo_ia?.faltantes_criticos,
    };
    setItensConferencia(extraidos);
    setLimitesConferencia(pendingComposeRef.current.limites_anexos ?? null);
    setConferenciaAberta(true);
  };

  const checklistAtivo = useMemo(() => {
    const checklist = normalizarChecklistVerificacao(config.markup_ia_verificacao);
    return checklist.filter((c) => c.ativo);
  }, [config.markup_ia_verificacao]);

  const categoriaIds = useMemo(
    () => checklistAtivo.map((c) => c.id),
    [checklistAtivo],
  );

  const categoriaNomes = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of checklistAtivo) map[c.id] = c.nome;
    return map;
  }, [checklistAtivo]);

  const temComposicaoIA = podeDesfazerComposicaoIA(modulosSeguros);
  const temBackupComposicao = Boolean(
    resolverComposicaoAnterior(modulosSeguros, composicaoAnteriorRef.current),
  );

  const handleDesfazerComposicaoIA = async () => {
    if (!temComposicaoIA) {
      toast.error('Não há composição da IA para desfazer');
      return;
    }

    const anterior = resolverComposicaoAnterior(modulos, composicaoAnteriorRef.current);
    if (!anterior) {
      toast.error('Backup indisponível', {
        description:
          'Este orçamento foi composto antes desta atualização. Componha novamente com IA para habilitar o desfazer.',
      });
      return;
    }

    setDesfazendoComposicao(true);
    try {
      const modulosRestaurados = recalcularModulos(
        aplicarConfiguracaoFixaNosModulos(config, anterior.modulos),
      );
      const tituloRestaurado = resolverTituloMarkup(leadNome, anterior.titulo);
      setTitulo(tituloRestaurado);
      setObsRodape(anterior.observacoes_rodape);
      setModulos(modulosRestaurados);
      composicaoAnteriorRef.current = null;
      setFormDirty(false);
      setAbaAtiva('materiais');

      const preco = modulosRestaurados.totais.preco_final;
      const saved = await salvarOrcamento.mutateAsync({
        id: orcamentoId ?? undefined,
        lead_id: leadId,
        titulo: tituloRestaurado,
        modulos: modulosRestaurados,
        preco_final: preco,
        observacoes_rodape: anterior.observacoes_rodape,
        status: 'rascunho',
        silent: true,
      });
      setOrcamentoId(saved.id);
      lastSnapshotRef.current = snapshotMarkupForm({
        leadId,
        orcamentoId: saved.id,
        titulo: tituloRestaurado,
        obsRodape: anterior.observacoes_rodape,
        modulos: modulosRestaurados,
      });
      onPrecoFinalChangeRef.current?.(preco);
      await syncValorLead(leadId, preco);
      toast.success('Composição da IA desfeita', {
        description:
          preco > 0
            ? `Preço restaurado: ${formatarMoedaMarkup(preco)}`
            : 'Orçamento restaurado ao estado anterior à composição',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao desfazer composição';
      toast.error('Falha ao desfazer composição', { description: message });
    } finally {
      setDesfazendoComposicao(false);
    }
  };

  const termoBusca = busca.trim();

  const textoBuscaProduto = (p: (typeof produtos)[0]) =>
    [p.nome, p.variacao, rotuloCategoriaProdutoMarkup(p), p.unidade].filter(Boolean).join(' ');

  const textoBuscaLinha = (linha: MarkupLinhaProduto) => {
    const produto = linha.produto_id
      ? produtos.find((p) => p.id === linha.produto_id)
      : undefined;
    const categoria =
      linha.categoria ??
      (produto ? rotuloCategoriaProdutoMarkup(produto) : null);
    const unidade = linha.unidade ?? produto?.unidade ?? null;
    return [linha.descricao, linha.variacao, categoria, unidade].filter(Boolean).join(' ');
  };

  const resolverMetaLinha = (linha: MarkupLinhaProduto) => {
    const produto = linha.produto_id
      ? produtos.find((p) => p.id === linha.produto_id)
      : undefined;
    const categoria =
      linha.categoria?.trim() ||
      (produto ? rotuloCategoriaProdutoMarkup(produto) : '—');
    const unidade = linha.unidade?.trim() || produto?.unidade || '—';
    return { categoria, unidade };
  };

  const linhasComposicaoFiltradas = termoBusca
    ? linhasNaComposicao.filter(({ linha }) =>
        correspondeBuscaFlexivel(textoBuscaLinha(linha), termoBusca),
      )
    : linhasNaComposicao;

  const tabPanelBase =
    'mt-0 min-h-0 flex-1 basis-0 overflow-x-hidden px-6 pb-6 focus-visible:outline-none data-[state=inactive]:hidden';
  const tabPanelScroll = `${tabPanelBase} overflow-y-auto overscroll-contain`;
  const tabPanelMateriais = `${tabPanelBase} flex flex-col overflow-hidden pt-3`;

  return (
    <>
    <Sheet open={open} onOpenChange={handleOpenChange} modal={modal}>
      <SheetContent
        side="right"
        overlayClassName={modal ? undefined : 'pointer-events-none bg-black/40'}
        data-markup-calculator=""
        onWheel={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
        className="w-full max-w-[min(100vw,56rem)] gap-0 p-0 sm:max-w-2xl lg:max-w-4xl flex h-full max-h-dvh flex-col overflow-hidden"
      >
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
        <MarkupIAComposeOverlay
          open={compondoIA}
          events={composeEvents}
          categoriaIds={categoriaIds}
          categoriaNomes={categoriaNomes}
          error={composeError}
          itens={composeItens}
          onCancel={() => composeAbortRef.current?.abort()}
        />
        <MarkupIAConferenciaDialog
          open={conferenciaAberta}
          itens={itensConferencia}
          produtos={produtos}
          categorias={categorias}
          limites={limitesConferencia}
          onChange={setItensConferencia}
          onConfirm={() => void handleConfirmarConferencia()}
          onCadastrarProduto={handleCadastrarProdutoConferencia}
          onCancel={() => {
            setConferenciaAberta(false);
            pendingComposeRef.current = null;
          }}
        />
        <SheetHeader className="shrink-0 min-w-0 space-y-3 border-b px-6 pb-4 pt-6 pr-12">
          <SheetTitle className="flex min-w-0 flex-wrap items-center gap-2 text-base sm:text-lg">
            <span className="shrink-0">Calculadora de Markup</span>
            {leadNome && (
              <Badge variant="secondary" className="max-w-full truncate font-normal text-xs">
                {leadNome}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription className="text-left text-xs sm:text-sm">
            Composição de custo: materiais + serviços + despesas + margem. Tudo que você digita
            salva sozinho — na nuvem e neste computador — para continuar de onde parou.
          </SheetDescription>
          {formHydrated && autoSaveState !== 'idle' && (
            <p
              className={cn(
                'text-xs pt-1',
                autoSaveState === 'error' && 'text-destructive',
                autoSaveState === 'saved' && 'text-emerald-600 dark:text-emerald-400',
                (autoSaveState === 'pending' || autoSaveState === 'saving') &&
                  'text-muted-foreground',
              )}
            >
              {autoSaveState === 'pending' && 'Preparando salvamento...'}
              {autoSaveState === 'saving' && 'Salvando automaticamente...'}
              {autoSaveState === 'saved' &&
                'Salvo — pode fechar e continuar depois de onde parou'}
              {autoSaveState === 'error' &&
                'Sem conexão com a nuvem. Seu rascunho ficou salvo neste computador.'}
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título do markup"
              className="max-w-[200px] h-8 md:text-sm"
            />
            <Button size="sm" onClick={handleSalvar} disabled={salvarOrcamento.isPending}>
              {salvarOrcamento.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Salvar
            </Button>
            {config.markup_ia_ativo && (
              <div className="inline-flex">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleComporComIA}
                  disabled={compondoIA || desfazendoComposicao || !formHydrated}
                  className="rounded-r-none border-r border-secondary-foreground/10"
                >
                  {compondoIA ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-1" />
                  )}
                  Compor com IA
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={compondoIA || desfazendoComposicao || !formHydrated}
                      className="rounded-l-none px-2"
                      aria-label="Mais opções de composição com IA"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={handleComporComIA}
                      disabled={compondoIA || desfazendoComposicao || !formHydrated}
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Compor com IA
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleDesfazerComposicaoIA}
                      disabled={
                        !temComposicaoIA || !temBackupComposicao || compondoIA || desfazendoComposicao
                      }
                    >
                      {desfazendoComposicao ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Undo2 className="h-4 w-4 mr-2" />
                      )}
                      Desfazer composição
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
            {config.markup_ia_ativo && (
              <select
                value={iaModelOverride}
                onChange={(e) => setIaModelOverride(e.target.value)}
                disabled={compondoIA || desfazendoComposicao || !formHydrated}
                aria-label="Modelo de IA para esta composição"
                title="Modelo de IA para esta composição (não altera a configuração padrão)"
                className="h-9 rounded-md border bg-background px-2 text-xs md:text-sm"
              >
                <option value="">Recomendado ({config.markup_ia_model})</option>
                {PIPELINE_LEAD_AI_MODELS.map((m) => (
                  <option key={m.value} value={m.value} title={m.description}>
                    {m.label}
                  </option>
                ))}
              </select>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportarPdf}
              disabled={exportando}
            >
              {exportando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4 mr-1" />
              )}
              PDF
            </Button>
            {orcamentoAtual && (
              <Button size="sm" variant="ghost" onClick={handleDuplicar}>
                <Copy className="h-4 w-4 mr-1" />
                Duplicar
              </Button>
            )}
            {(orcamentoId || orcamentoAtual) && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setConfirmExcluirAberto(true)}
                disabled={removerOrcamento.isPending}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Excluir
              </Button>
            )}
          </div>
          {orcamentos.length > 1 && (
            <div className="flex flex-wrap gap-1 pt-2">
              {orcamentos.map((o) => (
                <Button
                  key={o.id}
                  size="sm"
                  variant={o.id === orcamentoId ? 'default' : 'outline'}
                  className="h-7 text-xs"
                  onClick={() => selecionarOrcamento(o.id)}
                >
                  {o.titulo}
                </Button>
              ))}
            </div>
          )}
          {config.markup_ia_ativo && (
            <div className="pt-2">
              <MarkupIAAnexosPicker
                items={leadMediaItems}
                selectedKeys={selectedMediaKeys}
                onChange={setSelectedMediaKeys}
                isLoading={leadMediaLoading}
                onUpload={uploadAnexoIA}
              />
            </div>
          )}
        </SheetHeader>

        <Tabs
          value={abaAtiva === 'resumo' && !podeVerResumo ? 'materiais' : abaAtiva}
          onValueChange={(value) => {
            if (value === 'resumo' && !podeVerResumo) return;
            setAbaAtiva(value);
          }}
          className="flex min-h-0 flex-1 basis-0 flex-col overflow-hidden"
        >
          <TabsList
            className={cn(
              'mx-6 mt-3 grid h-auto w-[calc(100%-3rem)] shrink-0 grid-cols-2 gap-1',
              podeVerResumo ? 'sm:grid-cols-4' : 'sm:grid-cols-3',
            )}
          >
            <TabsTrigger value="materiais" className="px-2 py-2 text-xs sm:text-sm">
              Materiais
            </TabsTrigger>
            <TabsTrigger value="servicos" className="px-2 py-2 text-xs sm:text-sm">
              Serviços
            </TabsTrigger>
            <TabsTrigger value="despesas" className="px-2 py-2 text-xs sm:text-sm">
              Despesas
            </TabsTrigger>
            {podeVerResumo && (
              <TabsTrigger value="resumo" className="px-2 py-2 text-xs sm:text-sm">
                Resumo
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="materiais" className={tabPanelMateriais}>
            <div className="relative mb-3 shrink-0">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar produto..."
                className="h-9 pl-9"
              />
            </div>
            <div
              data-markup-catalog-scroll
              className="min-h-0 flex-1 basis-0 overflow-x-auto overflow-y-auto overscroll-contain"
            >
              {loadingProdutos ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                catalogoPorCategoriaOrdenado.map(({ cat, items }) => (
                    <MarkupCatalogoCategoriaCard
                      key={cat}
                      categoriaKey={cat}
                      produtos={items}
                      qtdPorProduto={qtdPorProduto}
                      origemPorProduto={origemPorProduto}
                      termoBusca={termoBusca}
                      textoBuscaProduto={textoBuscaProduto}
                      onReorder={onReordenarCatalogoCategoria}
                      onQuantidadeChange={setQuantidadeProduto}
                    />
                  ))
              )}
            </div>

            {linhasComposicaoFiltradas.length > 0 && (
              <Collapsible
                open={composicaoExpandida}
                onOpenChange={setComposicaoExpandida}
                className="mt-3 shrink-0 overflow-hidden rounded-lg border border-primary/20 bg-primary/5"
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-expanded={composicaoExpandida}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 shrink-0 text-primary transition-transform duration-200',
                          composicaoExpandida && 'rotate-180',
                        )}
                        aria-hidden
                      />
                      <span className="truncate text-xs font-semibold uppercase tracking-wide text-primary">
                        Na composição ({linhasComposicaoFiltradas.length})
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-primary">
                      {formatarMoedaMarkup(modulosSeguros.totais.custo_materiais)}
                    </span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="flex max-h-[min(32vh,280px)] flex-col overflow-hidden border-t border-primary/10">
                    <div
                      className="min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-contain"
                      onWheel={(event) => event.stopPropagation()}
                    >
                      <Table className="min-w-[720px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10" />
                            <TableHead>Categoria</TableHead>
                            <TableHead>Produto</TableHead>
                            <TableHead>Var.</TableHead>
                            <TableHead className="text-right">Preço</TableHead>
                            <TableHead>Un.</TableHead>
                            <TableHead className="w-28 min-w-[7rem] text-right">Qtd</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {linhasComposicaoFiltradas.map(({ linha, index }) => {
                            const { categoria, unidade } = resolverMetaLinha(linha);
                            return (
                            <TableRow
                              key={`composicao-${index}-${linha.produto_id ?? linha.descricao}`}
                              className={cn(linha.ativo === false && 'opacity-50')}
                            >
                              <TableCell>
                                {linha.produto_id && (
                                  <Checkbox
                                    checked={linha.ativo !== false}
                                    onCheckedChange={(checked) =>
                                      onToggleMaterial(linha.produto_id!, checked === true)
                                    }
                                    aria-label={`Incluir ${linha.descricao}`}
                                  />
                                )}
                              </TableCell>
                              <TableCell className="max-w-[140px] text-xs text-muted-foreground">
                                <span className="line-clamp-2">{categoria}</span>
                              </TableCell>
                              <TableCell className="max-w-[180px]">
                                <div className="flex flex-col gap-0.5">
                                  <span className="truncate text-sm font-medium">{linha.descricao}</span>
                                  {linha.origem_ia === 'projetista_complemento' && (
                                    <Badge variant="outline" className="w-fit border-sky-500/40 bg-sky-500/10 text-sky-600 text-[9px]">
                                      Complemento
                                    </Badge>
                                  )}
                                  {linha.origem_ia === 'projetista' && (
                                    <Badge variant="outline" className="w-fit border-violet-500/40 bg-violet-500/10 text-violet-600 text-[9px]">
                                      Projetista
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-xs">
                                {linha.variacao ?? '—'}
                              </TableCell>
                              <TableCell className="text-right text-sm tabular-nums">
                                {formatarMoedaMarkup(linha.valor_unitario)}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {unidade}
                              </TableCell>
                              <TableCell className="w-28 min-w-[7rem] px-2">
                                <Input
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={linha.quantidade || ''}
                                  onChange={(e) =>
                                    setQuantidadeLinha(index, parseFloat(e.target.value) || 0)
                                  }
                                  className="h-8 w-full min-w-[5.5rem] text-right tabular-nums"
                                />
                              </TableCell>
                              <TableCell className="text-right text-sm font-medium tabular-nums">
                                {formatarMoedaMarkup(linha.valor_total)}
                              </TableCell>
                            </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="shrink-0 flex items-center justify-between gap-3 border-t border-primary/15 bg-primary/10 px-3 py-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        Total dos materiais
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-primary">
                        {formatarMoedaMarkup(modulosSeguros.totais.custo_materiais)}
                      </span>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </TabsContent>

          <TabsContent value="servicos" className={cn(tabPanelScroll, 'space-y-4 pt-4')}>
            {servicoTemplatesEfetivos.length === 0 && !loadingServicos && (
              <div className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground text-center">
                Nenhum campo de mão de obra em Configurações → Parâmetros.
              </div>
            )}
            {loadingServicos && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Carregando campos de mão de obra...
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Campos definidos em <strong>Configurações → Parâmetros</strong>. O{' '}
              <strong>valor/hora</strong> pode ser ajustado no Resumo deste orçamento; as{' '}
              <strong>horas</strong> são do orçamento. Fórmula:{' '}
              <strong>horas × valor/hora = custo</strong>.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {modulosSeguros.servicos.linhas.map((linha, i) => {
                const ativo = linha.ativo !== false;
                const valorHoraLinha = resolverValorHoraLinhaServico(
                  linha,
                  modulosSeguros.servicos.valor_hora || config.valor_hora_marcenaria || 0,
                );
                const custoLinha = ativo
                  ? calcularCustoServicoHoras(linha.horas, valorHoraLinha)
                  : 0;
                const templateKey = linha.template_id ?? linha.descricao;
                return (
                  <div
                    key={linha.template_id ?? `servico-${i}`}
                    className={cn(!ativo && 'opacity-50')}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Checkbox
                        checked={ativo}
                        onCheckedChange={(checked) =>
                          onToggleServico(templateKey, checked === true)
                        }
                        aria-label={`Incluir ${linha.descricao}`}
                      />
                      <Label>{linha.descricao}</Label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Horas</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.5}
                          value={linha.horas}
                          disabled={!ativo}
                          onChange={(e) =>
                            atualizarModulos((prev) => {
                              const linhas = [...prev.servicos.linhas];
                              linhas[i] = {
                                ...linhas[i],
                                horas: parseFloat(e.target.value) || 0,
                              };
                              return {
                                ...prev,
                                servicos: { ...prev.servicos, linhas },
                              };
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Valor/hora</Label>
                        <Input
                          value={formatarMoedaMarkup(valorHoraLinha)}
                          readOnly
                          disabled
                          className="bg-muted/40"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {linha.horas}h × {formatarMoedaMarkup(valorHoraLinha)} ={' '}
                      <span className="font-medium text-foreground">
                        {formatarMoedaMarkup(custoLinha)}
                      </span>
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-1">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Total de horas</span>
                <span className="font-medium">
                  {calcularHorasTotaisServicos(modulosSeguros.servicos.linhas).toLocaleString('pt-BR', {
                    maximumFractionDigits: 1,
                  })}
                  h
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Custo mão de obra</span>
                <span className="font-semibold">
                  {formatarMoedaMarkup(modulosSeguros.totais.custo_servicos)}
                </span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="despesas" className={cn(tabPanelScroll, 'space-y-3 pt-4')}>
            {modulosSeguros.despesas.map((d, i) => (
              <div key={d.template_id ?? i} className="flex min-w-0 items-center gap-3">
                <Checkbox
                  checked={d.ativo !== false}
                  onCheckedChange={(checked) =>
                    atualizarModulos((prev) => {
                      const despesas = [...prev.despesas];
                      despesas[i] = { ...despesas[i], ativo: checked === true };
                      return { ...prev, despesas };
                    })
                  }
                />
                <span className="min-w-0 flex-1 break-words text-sm">{d.descricao}</span>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={Number.isFinite(d.valor) ? d.valor : ''}
                  disabled={d.ativo === false}
                  onChange={(e) =>
                    atualizarModulos((prev) => {
                      const despesas = [...prev.despesas];
                      despesas[i] = {
                        ...despesas[i],
                        valor: parseFloat(e.target.value) || 0,
                      };
                      return { ...prev, despesas };
                    })
                  }
                  className="w-28 h-8 text-right"
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                atualizarModulos((prev) => ({
                  ...prev,
                  despesas: [
                    ...prev.despesas,
                    { descricao: 'Outra despesa', valor: 0, ativo: true },
                  ],
                }))
              }
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar despesa
            </Button>
          </TabsContent>

          {podeVerResumo && (
          <TabsContent value="resumo" className={cn(tabPanelScroll, 'pt-4')}>
              <div className="min-w-0 space-y-4">
            <MarkupIAResumoPanel
              meta={modulosSeguros.meta}
              modulos={modulosSeguros}
              onEditarTextoResumo={onEditarTextoResumo}
              onToggleMaterial={onToggleMaterial}
              onToggleServico={onToggleServico}
              onToggleDespesa={onToggleDespesaResumo}
              onReabrirConferencia={handleReabrirConferencia}
            />
            <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-3">
              <div>
                <p className="font-medium">Parâmetros deste orçamento</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Edite aqui para este cliente. O padrão da empresa em Configurações de Markup não
                  muda — e o que você alterar fica salvo neste orçamento. Na margem, o valor em R$
                  também é editável: você diz quanto quer lucrar e a % se ajusta.
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                {(() => {
                  const t = modulosSeguros.totais;
                  const somaSobras = Math.max(0, t.custo_materiais_ajustado - t.custo_materiais);
                  // Impostos/taxas sobre os custos; margem por cima de (custos + impostos/taxas)
                  const somaImpostos = arredondar(
                    t.subtotal_custo * (modulosSeguros.impostos.percentual_imposto / 100),
                  );
                  const somaTaxas = arredondar(
                    t.subtotal_custo * (modulosSeguros.impostos.taxas_financeiras / 100),
                  );
                  const somaMargem = Math.max(0, t.preco_final_bruto - t.custo_com_impostos);

                  const ParamLabel = ({
                    htmlFor,
                    titulo,
                    soma,
                  }: {
                    htmlFor: string;
                    titulo: string;
                    soma: number;
                  }) => (
                    <label
                      className="flex items-baseline justify-between gap-2 text-muted-foreground"
                      htmlFor={htmlFor}
                    >
                      <span className="min-w-0">{titulo}</span>
                      <span className="shrink-0 font-medium tabular-nums text-foreground">
                        {formatarMoedaMarkup(soma)}
                      </span>
                    </label>
                  );

                  return (
                    <>
                <div className="space-y-1">
                  <ParamLabel
                    htmlFor="markup-param-valor-hora"
                    titulo="Valor hora marcenaria"
                    soma={t.custo_servicos}
                  />
                  <Input
                    id="markup-param-valor-hora"
                    type="number"
                    min={0}
                    step={0.01}
                    value={modulosSeguros.servicos.valor_hora}
                    onChange={(e) => {
                      const v = Math.max(0, parseFloat(e.target.value) || 0);
                      atualizarModulos((prev) => ({
                        ...prev,
                        servicos: { ...prev.servicos, valor_hora: v },
                      }));
                    }}
                    className="h-8 md:text-sm tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <ParamLabel
                    htmlFor="markup-param-sobras"
                    titulo="Fator sobras (%)"
                    soma={somaSobras}
                  />
                  <Input
                    id="markup-param-sobras"
                    type="number"
                    min={0}
                    step={0.5}
                    value={modulosSeguros.margem.fator_sobras}
                    onChange={(e) => {
                      const v = Math.max(0, parseFloat(e.target.value) || 0);
                      atualizarModulos((prev) => ({
                        ...prev,
                        materiais: { ...prev.materiais, fator_sobras: v },
                        margem: { ...prev.margem, fator_sobras: v },
                      }));
                    }}
                    className="h-8 md:text-sm tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-muted-foreground">
                    <label htmlFor="markup-param-margem" className="min-w-0">
                      Margem lucro (%)
                    </label>
                    <MarkupLucroReaisInput
                      value={somaMargem}
                      disabled={!(t.custo_com_impostos > 0)}
                      onCommit={confirmarLucroReaisEditado}
                    />
                  </div>
                  <Input
                    id="markup-param-margem"
                    type="number"
                    min={0}
                    step={0.5}
                    value={Number(Number(modulosSeguros.margem.margem_lucro).toFixed(2))}
                    onChange={(e) => {
                      const v = Math.max(0, parseFloat(e.target.value) || 0);
                      atualizarModulos((prev) => ({
                        ...prev,
                        margem: { ...prev.margem, margem_lucro: v },
                      }));
                    }}
                    className="h-8 md:text-sm tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <ParamLabel
                    htmlFor="markup-param-impostos"
                    titulo="Impostos (%)"
                    soma={somaImpostos}
                  />
                  <Input
                    id="markup-param-impostos"
                    type="number"
                    min={0}
                    step={0.5}
                    value={modulosSeguros.impostos.percentual_imposto}
                    onChange={(e) => {
                      const v = Math.max(0, parseFloat(e.target.value) || 0);
                      atualizarModulos((prev) => ({
                        ...prev,
                        impostos: { ...prev.impostos, percentual_imposto: v },
                      }));
                    }}
                    className="h-8 md:text-sm tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <ParamLabel
                    htmlFor="markup-param-taxas"
                    titulo="Taxas financeiras (%)"
                    soma={somaTaxas}
                  />
                  <Input
                    id="markup-param-taxas"
                    type="number"
                    min={0}
                    step={0.5}
                    value={modulosSeguros.impostos.taxas_financeiras}
                    onChange={(e) => {
                      const v = Math.max(0, parseFloat(e.target.value) || 0);
                      atualizarModulos((prev) => ({
                        ...prev,
                        impostos: { ...prev.impostos, taxas_financeiras: v },
                      }));
                    }}
                    className="h-8 md:text-sm tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <ParamLabel
                    htmlFor="markup-param-frete"
                    titulo="Frete (R$)"
                    soma={modulosSeguros.margem.custo_frete}
                  />
                  <Input
                    id="markup-param-frete"
                    type="number"
                    min={0}
                    step={0.01}
                    value={modulosSeguros.margem.custo_frete}
                    onChange={(e) => {
                      const v = Math.max(0, parseFloat(e.target.value) || 0);
                      atualizarModulos((prev) => ({
                        ...prev,
                        margem: { ...prev.margem, custo_frete: v },
                      }));
                    }}
                    className="h-8 md:text-sm tabular-nums"
                  />
                </div>
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="rounded-lg border divide-y text-sm">
              {[
                ['Materiais', modulosSeguros.totais.custo_materiais],
                [`Materiais + sobras (${modulosSeguros.margem.fator_sobras}%)`, modulosSeguros.totais.custo_materiais_ajustado],
                ['Mão de obra', modulosSeguros.totais.custo_servicos],
                ['Despesas', modulosSeguros.totais.custo_despesas],
                ['Frete', modulosSeguros.margem.custo_frete],
                ['Subtotal custo', modulosSeguros.totais.subtotal_custo],
                [
                  `Impostos (${modulosSeguros.impostos.percentual_imposto}%) + taxas (${modulosSeguros.impostos.taxas_financeiras}%)`,
                  modulosSeguros.totais.custo_com_impostos - modulosSeguros.totais.subtotal_custo,
                ],
                ['Custos totais (com impostos/taxas)', modulosSeguros.totais.custo_com_impostos],
              ].map(([label, val]) => (
                <div key={label as string} className="flex items-start justify-between gap-3 px-4 py-2">
                  <span className="min-w-0 flex-1 text-muted-foreground">{label}</span>
                  <span className="shrink-0 tabular-nums">{formatarMoedaMarkup(val as number)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="min-w-0 flex-1 text-muted-foreground">
                  Margem lucro ({Number(modulosSeguros.margem.margem_lucro).toFixed(2)}%) sobre custos totais
                </span>
                <MarkupLucroReaisInput
                  id="markup-resumo-lucro-reais"
                  value={Math.max(
                    0,
                    modulosSeguros.totais.preco_final_bruto - modulosSeguros.totais.custo_com_impostos,
                  )}
                  disabled={!(modulosSeguros.totais.custo_com_impostos > 0)}
                  onCommit={confirmarLucroReaisEditado}
                />
              </div>
              <div className="flex items-start justify-between gap-3 px-4 py-2">
                <span className="min-w-0 flex-1 text-muted-foreground">Preço antes do desconto</span>
                <span className="shrink-0 tabular-nums">
                  {formatarMoedaMarkup(modulosSeguros.totais.preco_final_bruto)}
                </span>
              </div>
              <div className="flex justify-between items-center px-4 py-2 gap-3">
                <span className="text-muted-foreground shrink-0">Desconto final (%)</span>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={modulosSeguros.margem.desconto_final_percent ?? 0}
                  onChange={(e) => {
                    const pct = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                    setPrecoFinalDraft(null);
                    atualizarModulos((prev) => ({
                      ...prev,
                      margem: { ...prev.margem, desconto_final_percent: pct },
                    }));
                  }}
                  className="h-8 w-24 text-right ml-auto"
                />
              </div>
              {(modulosSeguros.margem.desconto_final_percent ?? 0) > 0 && (
                <div className="flex justify-between px-4 py-2 text-amber-700 dark:text-amber-300">
                  <span>Valor do desconto</span>
                  <span>
                    −{formatarMoedaMarkup(
                      modulosSeguros.totais.preco_final_bruto - modulosSeguros.totais.preco_final,
                    )}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center gap-3 px-4 py-3 bg-primary/10 font-bold text-base">
                <span className="shrink-0">Preço final de venda</span>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={
                    precoFinalDraft ??
                    String(modulosSeguros.totais.preco_final)
                  }
                  onFocus={() => {
                    setPrecoFinalDraft(String(modulosSeguros.totais.preco_final));
                  }}
                  onChange={(e) => {
                    // Aceita digitação livre (número, vírgula, apagar tudo, etc.)
                    setPrecoFinalDraft(e.target.value);
                  }}
                  onBlur={() => {
                    confirmarPrecoFinalEditado();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="h-9 w-40 text-right ml-auto font-bold text-primary tabular-nums md:text-base"
                  aria-label="Preço final de venda editável"
                />
              </div>
            </div>

            <div>
              <Label>Observações (rodapé do PDF)</Label>
              <Textarea
                value={obsRodape}
                onChange={(e) => setObsRodape(e.target.value)}
                rows={3}
                placeholder="Condições, validade, observações para o cliente..."
              />
            </div>
              </div>
          </TabsContent>
          )}
        </Tabs>

        <div className="relative z-10 flex shrink-0 items-center gap-3 overflow-visible border-t bg-muted/30 px-6 py-3">
          <span className="shrink-0 text-sm text-muted-foreground">Preço final</span>
          <MarkupAuditorLucro
            custoMateriais={modulosSeguros.totais.custo_materiais}
            precoFinal={modulosSeguros.totais.preco_final}
          />
          <span className={cn('ml-auto text-lg font-bold text-primary')}>
            {formatarMoedaMarkup(modulosSeguros.totais.preco_final)}
          </span>
        </div>
        </div>
      </SheetContent>
    </Sheet>

    <AlertDialog open={confirmExcluirAberto} onOpenChange={setConfirmExcluirAberto}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir markup?</AlertDialogTitle>
          <AlertDialogDescription>
            {`“${titulo || orcamentoAtual?.titulo || 'Markup'}” será removido permanentemente. Essa ação não pode ser desfeita.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={removerOrcamento.isPending}
            onClick={(e) => {
              e.preventDefault();
              void handleExcluir();
            }}
          >
            {removerOrcamento.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Excluir'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
