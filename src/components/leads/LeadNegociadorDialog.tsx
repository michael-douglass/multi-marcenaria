import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileDown, Handshake, Loader2, AlertTriangle, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { arredondar, formatarMoedaMarkup } from '@/lib/markup-calculo';
import { useMarkupOrcamentos } from '@/hooks/useMarkupOrcamentos';
import { useLeadNegociacoes } from '@/hooks/useLeadNegociacoes';
import { useLeadNegociadorConfig } from '@/hooks/useLeadNegociadorConfig';
import { useMarkupConfig } from '@/hooks/useMarkupConfig';
import { useEmpresa } from '@/contexts/EmpresaContext';
import {
  ajustarFatiaSemRedistribuir,
  calcularPisoNegociador,
  dividirValorNegociado,
  percentuaisFromFatias,
  reaisFromPercentualFatia,
  somarCustosEPrecos,
  type NegociadorDivisao,
  type NegociadorSplitCampo,
} from '@/lib/negociador-calculo';
import { exportarNegociadorPdf } from '@/lib/negociador-pdf-export';

interface LeadNegociadorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: number;
  leadNome?: string;
  /** Atualiza o campo "Valor do orçamento" no card do lead após salvar. */
  onValorNegociadoSalvo?: (valor: number) => void;
}

function sanitizeMoneyDraft(raw: string): string {
  const s = raw.replace(',', '.');
  let out = '';
  let seenDot = false;
  for (const ch of s) {
    if (ch >= '0' && ch <= '9') out += ch;
    else if (ch === '.' && !seenDot) {
      out += '.';
      seenDot = true;
    }
  }
  return out;
}

function parseMoneyDraft(raw: string): number | null {
  const n = Number(String(raw).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Separa o preço em reais (inteiro) e centavos para destaque visual. */
function splitMoedaBr(valor: number): { inteiro: string; centavos: string } {
  const n = Math.max(0, Number(valor) || 0);
  const cents = Math.round(n * 100);
  const inteiroNum = Math.floor(cents / 100);
  const centavos = String(cents % 100).padStart(2, '0');
  const inteiro = new Intl.NumberFormat('pt-BR').format(inteiroNum);
  return { inteiro, centavos };
}

/** Quanto sobra até o piso: 1 = longe (preço atual), 0 = no piso. */
function folgaAtePiso(valor: number, piso: number, teto: number): number {
  if (!(teto > piso)) return valor <= piso + 0.005 ? 0 : 1;
  return Math.max(0, Math.min(1, (valor - piso) / (teto - piso)));
}

type NegociadorTom = 'folga' | 'atencao' | 'alerta' | 'piso';

/**
 * Vermelho só nos últimos 10% do caminho até o piso
 * (folga ≤ 0,10 = preço a encostar no mínimo).
 */
function tomPorFolga(folga: number): NegociadorTom {
  if (folga <= 0.1) return 'piso';
  if (folga <= 0.25) return 'alerta';
  if (folga <= 0.45) return 'atencao';
  return 'folga';
}

const TOM_UI: Record<
  NegociadorTom,
  {
    section: string;
    metricNegociado: string;
    metricNegociadoValue: string;
    metricPiso: string;
    metricPisoValue: string;
    fatia: string;
    fatiaInput: string;
    hint: string;
    hintLabel: string;
  }
> = {
  folga: {
    section: 'border-[#c4963a]/30 bg-white',
    metricNegociado: 'border-emerald-500/30 bg-emerald-50/80',
    metricNegociadoValue: 'text-emerald-800',
    metricPiso: 'border-[#c4963a]/25 bg-[#fffaf3]',
    metricPisoValue: 'text-[#8d5e22]',
    fatia: 'border-[#c4963a]/25 bg-[#fffaf3]',
    fatiaInput: 'border-[#c4963a]/35 bg-white text-[#2a1812]',
    hint: 'text-[#6b5344]',
    hintLabel: 'Há folga até o custo da obra com impostos.',
  },
  atencao: {
    section: 'border-amber-500/45 bg-amber-50/40',
    metricNegociado: 'border-amber-500/45 bg-amber-50',
    metricNegociadoValue: 'text-amber-900',
    metricPiso: 'border-amber-500/35 bg-amber-50/70',
    metricPisoValue: 'text-amber-800',
    fatia: 'border-amber-500/40 bg-amber-50/70',
    fatiaInput: 'border-amber-500/40 bg-white text-amber-950',
    hint: 'text-amber-900',
    hintLabel: 'Atenção: o valor está se aproximando do custo da obra com impostos.',
  },
  alerta: {
    section: 'border-orange-500/50 bg-orange-50/50',
    metricNegociado: 'border-orange-500/50 bg-orange-50',
    metricNegociadoValue: 'text-orange-900',
    metricPiso: 'border-orange-500/40 bg-orange-50/80',
    metricPisoValue: 'text-orange-800',
    fatia: 'border-orange-500/45 bg-orange-50/80',
    fatiaInput: 'border-orange-500/45 bg-white text-orange-950',
    hint: 'text-orange-950',
    hintLabel: 'Quase no custo da obra com impostos — pouca margem restante.',
  },
  piso: {
    section: 'border-red-500/55 bg-red-50/55',
    metricNegociado: 'border-red-500/55 bg-red-50',
    metricNegociadoValue: 'text-red-800',
    metricPiso: 'border-red-500/45 bg-red-50/90',
    metricPisoValue: 'text-red-700',
    fatia: 'border-red-500/50 bg-red-50/85',
    fatiaInput: 'border-red-500/50 bg-white text-red-950',
    hint: 'text-red-800',
    hintLabel: 'A menos de 10% do custo da obra com impostos — limite próximo.',
  },
};

export function LeadNegociadorDialog({
  open,
  onOpenChange,
  leadId,
  leadNome,
  onValorNegociadoSalvo,
}: LeadNegociadorDialogProps) {
  const { efetiva } = useLeadNegociadorConfig(leadId);
  const { config: markupConfig } = useMarkupConfig();
  const { empresa } = useEmpresa();
  const { orcamentos, isLoading: loadingOrcamentos } = useMarkupOrcamentos(leadId);
  const { negociacaoFechada, salvarNegociacao } = useLeadNegociacoes(leadId);

  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set());
  const [valorNegociado, setValorNegociado] = useState(0);
  const [fatias, setFatias] = useState<NegociadorDivisao>({
    valorMaterial: 0,
    valorMaoObra: 0,
    valorLucro: 0,
  });
  const [draftTotal, setDraftTotal] = useState('');
  const [editandoTotal, setEditandoTotal] = useState(false);
  const [draftMaterial, setDraftMaterial] = useState('');
  const [draftMaoObra, setDraftMaoObra] = useState('');
  const [draftLucro, setDraftLucro] = useState('');
  const [draftPctMaterial, setDraftPctMaterial] = useState('');
  const [draftPctMaoObra, setDraftPctMaoObra] = useState('');
  const [draftPctLucro, setDraftPctLucro] = useState('');
  const [observacao, setObservacao] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [exportandoPdf, setExportandoPdf] = useState(false);

  const margemMinima = efetiva.margemMinimaPercent;
  const splitsConfig = efetiva.splits;

  const orcamentosSelecionados = useMemo(
    () => orcamentos.filter((o) => selecionados.has(o.id)),
    [orcamentos, selecionados],
  );

  const somas = useMemo(
    () => somarCustosEPrecos(orcamentosSelecionados),
    [orcamentosSelecionados],
  );

  const piso = useMemo(
    () => calcularPisoNegociador(somas.custoMaterial, margemMinima),
    [somas.custoMaterial, margemMinima],
  );

  const splitsAtuais = useMemo(
    () => percentuaisFromFatias(fatias, valorNegociado),
    [fatias, valorNegociado],
  );

  const aplicarTotal = (total: number, splits = splitsConfig) => {
    // Sem trava de piso: só impede valor negativo.
    const limitado = arredondar(Math.max(0, Number(total) || 0));
    const next = dividirValorNegociado(limitado, splits);
    syncDraftsFromFatias(limitado, next);
  };

  const syncDraftsFromFatias = (total: number, next: NegociadorDivisao) => {
    const pct = percentuaisFromFatias(next, total);
    setValorNegociado(total);
    setFatias(next);
    setDraftTotal(String(total));
    setDraftMaterial(String(next.valorMaterial));
    setDraftMaoObra(String(next.valorMaoObra));
    setDraftLucro(String(next.valorLucro));
    setDraftPctMaterial(String(pct.material));
    setDraftPctMaoObra(String(pct.maoObra));
    setDraftPctLucro(String(pct.lucro));
  };

  // Ao abrir: pré-seleciona markups e carrega última negociação ou preço atual.
  useEffect(() => {
    if (!open) {
      setInitialized(false);
      setEditandoTotal(false);
      return;
    }
    if (loadingOrcamentos || initialized) return;

    const idsSalvos = negociacaoFechada?.orcamento_ids ?? [];
    const idsDisponiveis = new Set(orcamentos.map((o) => o.id));
    const idsIniciais =
      idsSalvos.length > 0
        ? idsSalvos.filter((id) => idsDisponiveis.has(id))
        : orcamentos.map((o) => o.id);

    const next = new Set(idsIniciais);
    setSelecionados(next);

    const somaInicial = somarCustosEPrecos(orcamentos.filter((o) => next.has(o.id)));

    if (negociacaoFechada && idsIniciais.length > 0) {
      const total = arredondar(Math.max(0, Number(negociacaoFechada.valor_negociado) || 0));
      const loaded: NegociadorDivisao = {
        valorMaterial: Number(negociacaoFechada.valor_material) || 0,
        valorMaoObra: Number(negociacaoFechada.valor_mao_obra) || 0,
        valorLucro: Number(negociacaoFechada.valor_lucro) || 0,
      };
      const somaFatias = arredondar(
        loaded.valorMaterial + loaded.valorMaoObra + loaded.valorLucro,
      );
      if (somaFatias > 0) {
        // Mantém proporção salva no total.
        const fator = total / somaFatias;
        const scaled: NegociadorDivisao = {
          valorMaterial: arredondar(loaded.valorMaterial * fator),
          valorMaoObra: arredondar(loaded.valorMaoObra * fator),
          valorLucro: 0,
        };
        scaled.valorLucro = arredondar(total - scaled.valorMaterial - scaled.valorMaoObra);
        syncDraftsFromFatias(total, scaled);
      } else {
        const div = dividirValorNegociado(total, {
          material: negociacaoFechada.pct_material,
          maoObra: negociacaoFechada.pct_mao_obra,
          lucro: negociacaoFechada.pct_lucro,
        });
        syncDraftsFromFatias(total, div);
      }
    } else {
      const total = arredondar(Math.max(0, somaInicial.precoOriginal));
      const div = dividirValorNegociado(total, splitsConfig);
      syncDraftsFromFatias(total, div);
    }

    setObservacao(negociacaoFechada?.observacao ?? '');
    setInitialized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na abertura
  }, [open, loadingOrcamentos, initialized, orcamentos, negociacaoFechada, margemMinima]);

  // Ao marcar/desmarcar markup: total e fatias voltam ao preço da seleção atual.
  const selectionKey = useMemo(
    () => Array.from(selecionados).sort().join(','),
    [selecionados],
  );
  const prevSelectionKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      prevSelectionKeyRef.current = null;
      return;
    }
    if (!initialized) return;

    // Na 1ª vez após abrir, só registra a seleção (não sobrescreve valor já carregado).
    if (prevSelectionKeyRef.current === null) {
      prevSelectionKeyRef.current = selectionKey;
      return;
    }
    if (prevSelectionKeyRef.current === selectionKey) return;
    prevSelectionKeyRef.current = selectionKey;

    if (selecionados.size === 0 || somas.precoOriginal <= 0) {
      syncDraftsFromFatias(0, {
        valorMaterial: 0,
        valorMaoObra: 0,
        valorLucro: 0,
      });
      return;
    }

    aplicarTotal(somas.precoOriginal, splitsConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialized, selectionKey, somas.precoOriginal]);

  const toggleOrcamento = (id: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSlider = (values: number[]) => {
    const raw = values[0] ?? valorNegociado;
    aplicarTotal(raw, splitsAtuais);
  };

  const commitTotal = (raw: string) => {
    const n = parseMoneyDraft(raw);
    if (n == null) {
      setDraftTotal(String(valorNegociado));
      return;
    }
    aplicarTotal(n, splitsAtuais);
  };

  const commitFatiaReais = (campo: NegociadorSplitCampo, raw: string) => {
    const n = parseMoneyDraft(raw);
    if (n == null) {
      syncDraftsFromFatias(valorNegociado, fatias);
      return;
    }
    const resultado = ajustarFatiaSemRedistribuir(campo, n, fatias);
    syncDraftsFromFatias(resultado.total, resultado.fatias);
  };

  const commitFatiaPercentual = (campo: NegociadorSplitCampo, raw: string) => {
    const n = parseMoneyDraft(raw);
    if (n == null) {
      syncDraftsFromFatias(valorNegociado, fatias);
      return;
    }
    const reais = reaisFromPercentualFatia(n, valorNegociado);
    commitFatiaReais(campo, String(reais));
  };

  const handleResetPrecoAtual = () => {
    if (selecionados.size === 0 || somas.precoOriginal <= 0) return;
    aplicarTotal(somas.precoOriginal, splitsConfig);
    toast.success('Valores restaurados', {
      description: `Voltou ao preço atual: ${formatarMoedaMarkup(somas.precoOriginal)}.`,
    });
  };

  const handleSalvar = async () => {
    if (selecionados.size === 0) {
      toast.error('Escolha ao menos um markup');
      return;
    }
    if (somas.custoMaterial <= 0) {
      toast.error('Sem custo de material', {
        description: 'Os markups escolhidos precisam ter material na composição.',
      });
      return;
    }

    const pct = percentuaisFromFatias(fatias, valorNegociado);
    await salvarNegociacao.mutateAsync({
      id: negociacaoFechada?.id,
      lead_id: leadId,
      orcamento_ids: Array.from(selecionados),
      custo_material: somas.custoMaterial,
      preco_original: somas.precoOriginal,
      margem_minima_percent: margemMinima,
      piso,
      valor_negociado: valorNegociado,
      pct_material: pct.material,
      pct_mao_obra: pct.maoObra,
      pct_lucro: pct.lucro,
      valor_material: fatias.valorMaterial,
      valor_mao_obra: fatias.valorMaoObra,
      valor_lucro: fatias.valorLucro,
      status: 'fechada',
      observacao: observacao.trim() || null,
    });
    onValorNegociadoSalvo?.(valorNegociado);
    onOpenChange(false);
  };

  const handleExportarPdf = async () => {
    if (selecionados.size === 0 || valorNegociado <= 0) {
      toast.error('Selecione markups e defina um valor para exportar');
      return;
    }
    setExportandoPdf(true);
    try {
      const pct = percentuaisFromFatias(fatias, valorNegociado);
      const logo =
        markupConfig.timbrado_url?.trim() ||
        empresa?.logo_url?.trim() ||
        '/garbo-logo.png';
      await exportarNegociadorPdf(
        {
          valorNegociado,
          piso,
          margemMinimaPercent: margemMinima,
          custoMaterial: somas.custoMaterial,
          precoOriginal: somas.precoOriginal,
          valorMaterial: fatias.valorMaterial,
          valorMaoObra: fatias.valorMaoObra,
          valorLucro: fatias.valorLucro,
          pctMaterial: pct.material,
          pctMaoObra: pct.maoObra,
          pctLucro: pct.lucro,
          observacao,
          markupsTitulos: orcamentosSelecionados.map((o) => o.titulo || 'Markup'),
        },
        {
          empresaNome: empresa?.nome || 'Garbo Movelaria',
          empresaRazaoSocial: empresa?.razao_social ?? null,
          empresaCnpj: empresa?.cnpj ?? null,
          logoUrl: logo,
          clienteNome: leadNome || null,
        },
      );
      toast.success('PDF gerado!', {
        description: 'Orçamento da negociação com razão social e CNPJ da empresa.',
      });
    } catch (e) {
      toast.error('Não foi possível gerar o PDF', {
        description: e instanceof Error ? e.message : 'Tente novamente.',
      });
    } finally {
      setExportandoPdf(false);
    }
  };

  // Barra: do zero (livre) até o preço atual — o custo da obra é só referência visual.
  const sliderMin = 0;
  const sliderMax = Math.max(somas.precoOriginal, valorNegociado, piso, 1);
  const sliderDisabled = selecionados.size === 0 || somas.precoOriginal <= 0;
  const jaNoPrecoAtual =
    selecionados.size > 0 &&
    somas.precoOriginal > 0 &&
    Math.abs(valorNegociado - somas.precoOriginal) < 0.02;

  const folga = folgaAtePiso(valorNegociado, piso, Math.max(piso, somas.precoOriginal));
  const abaixoDoCusto = valorNegociado < piso - 0.005;
  const tom =
    selecionados.size === 0 ? 'folga' : abaixoDoCusto ? 'piso' : tomPorFolga(folga);
  const tomUi = TOM_UI[tom];
  const descontoVsAtual =
    somas.precoOriginal > 0
      ? Math.max(0, ((somas.precoOriginal - valorNegociado) / somas.precoOriginal) * 100)
      : 0;
  const valorDesconto = Math.max(0, arredondar(somas.precoOriginal - valorNegociado));
  const temDesconto = valorDesconto > 0.02;
  const precoTotalSplit = splitMoedaBr(valorNegociado);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'negociador-dialog flex flex-col gap-0 overflow-hidden p-0',
          'border-[#c4963a]/40 bg-[#fffcf8] text-[#2a1812]',
          'w-[calc(100vw-0.75rem)] max-w-2xl',
          'h-[min(96dvh,100%)] max-h-[96dvh]',
          'sm:h-[min(90dvh,880px)] sm:max-h-[90dvh]',
        )}
      >
        <div className="relative flex h-full min-h-0 flex-col">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(242,216,146,0.22),_transparent_55%)]"
          />

          <DialogHeader className="relative z-10 shrink-0 space-y-1 border-b border-[#c4963a]/25 bg-[#fffaf3]/95 px-4 py-3 sm:px-6 sm:py-4">
            <DialogTitle className="flex items-center gap-2 pr-8 font-display text-[#8d5e22]">
              <Handshake className="h-5 w-5" aria-hidden />
              Negociador
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6b5344] sm:text-sm">
              {leadNome
                ? `Negocie o preço com ${leadNome}. Ajuste o total e cada fatia (material, mão de obra e lucro).`
                : 'Escolha os markups, ajuste o valor e as fatias, salve ou exporte em PDF.'}
            </DialogDescription>
          </DialogHeader>

          <div className="relative z-10 min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain bg-[#fffcf8]/90 px-4 py-3 sm:space-y-5 sm:px-6 sm:py-4">
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-[#8d5e22]">Markups para negociar</h3>
              {loadingOrcamentos ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-[#8d5e22]" />
                </div>
              ) : orcamentos.length === 0 ? (
                <p className="rounded-lg border border-[#c4963a]/30 bg-[#fffaf3] px-3 py-4 text-sm text-[#6b5344]">
                  Este lead ainda não tem markup. Crie um na aba Detalhes → Markup.
                </p>
              ) : (
                <ul className="max-h-[min(28vh,220px)] space-y-2 overflow-y-auto overscroll-contain pr-0.5 sm:max-h-[min(32vh,280px)]">
                  {orcamentos.map((o) => {
                    const custo = Number(o.modulos?.totais?.custo_materiais ?? 0);
                    const checked = selecionados.has(o.id);
                    return (
                      <li key={o.id}>
                        <label
                          className={cn(
                            'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                            checked
                              ? 'border-[#c4963a] bg-[#f2d892]/25 shadow-sm'
                              : 'border-[#c4963a]/25 bg-white hover:border-[#c4963a]/50 hover:bg-[#fffaf3]',
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleOrcamento(o.id)}
                            className="mt-0.5 border-[#c4963a]/60 data-[state=checked]:border-[#8d5e22] data-[state=checked]:bg-[#8d5e22] data-[state=checked]:text-white"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-semibold text-[#2a1812]">
                                {o.titulo || 'Markup'}
                              </span>
                              <Badge
                                variant="outline"
                                className="border-[#c4963a]/40 bg-[#fffaf3] text-[10px] text-[#8d5e22]"
                              >
                                {o.status}
                              </Badge>
                            </div>
                            <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-[#6b5344]">
                              <span>
                                Preço {formatarMoedaMarkup(Number(o.preco_final) || 0)}
                              </span>
                              <span>Taxas e encargos {formatarMoedaMarkup(custo)}</span>
                              {o.atualizado_em ? (
                                <span>
                                  {format(new Date(o.atualizado_em), "dd/MM/yyyy HH:mm", {
                                    locale: ptBR,
                                  })}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section
              className={cn(
                'space-y-4 rounded-xl border p-3 shadow-sm transition-colors duration-300 sm:p-4',
                tomUi.section,
                selecionados.size === 0 && 'opacity-55',
              )}
            >
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <Metric label="Preço atual" value={formatarMoedaMarkup(somas.precoOriginal)} />
                <Metric
                  label="Custo da obra com impostos"
                  hint={`Margem ${margemMinima}%`}
                  value={formatarMoedaMarkup(piso)}
                  className={tomUi.metricPiso}
                  valueClassName={tomUi.metricPisoValue}
                />
                <Metric
                  label="Desconto"
                  hint={temDesconto ? `${descontoVsAtual.toFixed(1)}% a menos` : 'Sem redução'}
                  value={temDesconto ? formatarMoedaMarkup(valorDesconto) : 'R$ 0,00'}
                  className={tomUi.metricNegociado}
                  valueClassName={tomUi.metricNegociadoValue}
                />
              </div>

              {selecionados.size > 0 && sliderMax > piso ? (
                <p
                  className={cn(
                    'flex items-center gap-1.5 text-[11px] font-medium transition-colors duration-300',
                    tomUi.hint,
                  )}
                  aria-live="polite"
                >
                  {tom !== 'folga' ? (
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  ) : null}
                  <span>
                    {abaixoDoCusto
                      ? 'Abaixo do custo da obra com impostos — referência, sem trava.'
                      : tom === 'piso' && folga <= 0.005
                        ? 'No custo da obra com impostos — referência do limite.'
                        : tomUi.hintLabel}
                  </span>
                </p>
              ) : null}

              {somas.precoOriginal > 0 && piso > somas.precoOriginal ? (
                <div className="flex items-start gap-2 rounded-md border border-amber-600/35 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden />
                  <span>
                    O preço atual já está abaixo do custo da obra com impostos. Você ainda
                    pode negociar livremente — o custo serve só como referência.
                  </span>
                </div>
              ) : null}

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm font-semibold text-[#2a1812] sm:text-base">
                    Valor negociado (total)
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleResetPrecoAtual}
                    disabled={sliderDisabled || jaNoPrecoAtual}
                    className="h-7 gap-1.5 border-[#c4963a]/40 px-2 text-[11px] text-[#8d5e22] hover:bg-[#f2d892]/25"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                    Resetar ao preço atual
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <Slider
                    min={sliderMin}
                    max={sliderMax || 1}
                    step={0.01}
                    value={[Math.max(0, Math.min(sliderMax, valorNegociado))]}
                    onValueChange={handleSlider}
                    disabled={sliderDisabled}
                    aria-label="Barra do valor negociado até o preço atual"
                    className={cn(
                      'py-1 transition-colors duration-300',
                      '[&_[data-orientation=horizontal]>span:first-child]:h-2.5',
                      tom === 'piso' &&
                        '[&_[role=slider]]:border-red-700 [&_[data-orientation=horizontal]_span:first-child_span]:bg-red-500',
                      tom === 'alerta' &&
                        '[&_[role=slider]]:border-orange-700 [&_[data-orientation=horizontal]_span:first-child_span]:bg-orange-500',
                      tom === 'atencao' &&
                        '[&_[role=slider]]:border-amber-700 [&_[data-orientation=horizontal]_span:first-child_span]:bg-amber-500',
                      tom === 'folga' &&
                        '[&_[role=slider]]:border-[#8d5e22] [&_[data-orientation=horizontal]_span:first-child_span]:bg-[#c4963a]',
                    )}
                  />
                  <div className="flex items-start justify-between gap-3 text-[10px] sm:text-[11px]">
                    <div className="min-w-0 text-left">
                      <p className="font-semibold uppercase tracking-wide text-[#6b5344]">
                        Custo da obra com impostos
                      </p>
                      <p className="font-bold tabular-nums text-[#8d5e22]">
                        {formatarMoedaMarkup(piso)}
                      </p>
                      <p className="text-[10px] text-[#6b5344]/80">referência (sem trava)</p>
                    </div>
                    <div className="min-w-0 text-right">
                      <p className="font-semibold uppercase tracking-wide text-[#6b5344]">
                        Preço atual
                      </p>
                      <p className="font-bold tabular-nums text-[#2a1812]">
                        {formatarMoedaMarkup(somas.precoOriginal)}
                      </p>
                    </div>
                  </div>
                </div>

                {selecionados.size > 0 && temDesconto ? (
                  <div
                    className={cn(
                      'flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors duration-300 sm:text-sm',
                      tom === 'piso' && 'border-red-500/40 bg-red-50 text-red-900',
                      tom === 'alerta' && 'border-orange-500/40 bg-orange-50 text-orange-950',
                      tom === 'atencao' && 'border-amber-500/40 bg-amber-50 text-amber-950',
                      tom === 'folga' && 'border-emerald-500/35 bg-emerald-50 text-emerald-900',
                    )}
                    aria-live="polite"
                  >
                    <span>Você está abaixando o preço em</span>
                    <span className="tabular-nums">
                      {formatarMoedaMarkup(valorDesconto)}
                      <span className="ml-1.5 opacity-80">({descontoVsAtual.toFixed(1)}%)</span>
                    </span>
                  </div>
                ) : null}
                <div
                  className={cn(
                    'relative rounded-xl border-2 p-1.5 transition-colors duration-300 sm:p-2',
                    tom === 'piso' && 'border-red-500/60 bg-red-50/80 shadow-[0_0_0_3px_rgba(239,68,68,0.12)]',
                    tom === 'alerta' && 'border-orange-500/55 bg-orange-50/70 shadow-[0_0_0_3px_rgba(249,115,22,0.1)]',
                    tom === 'atencao' && 'border-amber-500/50 bg-amber-50/60 shadow-[0_0_0_3px_rgba(245,158,11,0.1)]',
                    tom === 'folga' && 'border-[#c4963a]/45 bg-[#fffaf3] shadow-[0_0_0_3px_rgba(196,150,58,0.08)]',
                  )}
                >
                  {editandoTotal ? (
                    <>
                      <span
                        className={cn(
                          'absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-bold sm:text-lg',
                          tomUi.metricNegociadoValue,
                        )}
                      >
                        R$
                      </span>
                      <Input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        autoFocus
                        disabled={sliderDisabled}
                        value={draftTotal}
                        onChange={(e) => setDraftTotal(sanitizeMoneyDraft(e.target.value))}
                        onBlur={(e) => {
                          commitTotal(e.target.value);
                          setEditandoTotal(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitTotal((e.target as HTMLInputElement).value);
                            setEditandoTotal(false);
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            setDraftTotal(String(valorNegociado));
                            setEditandoTotal(false);
                          }
                        }}
                        aria-label="Valor negociado total"
                        className={cn(
                          'h-16 border-0 bg-transparent pl-12 pr-3 text-3xl font-extrabold tracking-tight tabular-nums shadow-none',
                          'focus-visible:ring-0 sm:h-[4.5rem] sm:text-4xl',
                          tomUi.metricNegociadoValue,
                        )}
                      />
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={sliderDisabled}
                      onClick={() => {
                        setDraftTotal(String(valorNegociado));
                        setEditandoTotal(true);
                      }}
                      className={cn(
                        'flex w-full items-baseline gap-1.5 rounded-lg px-3 py-2 text-left',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c4963a]',
                      )}
                      aria-label={`Valor negociado total ${formatarMoedaMarkup(valorNegociado)}. Clique para editar.`}
                    >
                      <span
                        className={cn(
                          'text-lg font-bold sm:text-xl',
                          tomUi.metricNegociadoValue,
                        )}
                      >
                        R$
                      </span>
                      <span
                        className={cn(
                          'text-4xl font-black leading-none tracking-tight tabular-nums sm:text-5xl',
                          tomUi.metricNegociadoValue,
                        )}
                      >
                        {precoTotalSplit.inteiro}
                      </span>
                      <span
                        className={cn(
                          'text-xl font-bold leading-none tabular-nums sm:text-2xl',
                          tomUi.metricNegociadoValue,
                          'opacity-80',
                        )}
                      >
                        ,{precoTotalSplit.centavos}
                      </span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-[#6b5344]">
                  Sem trava de preço: ajuste o total ou as fatias até o valor que quiser. O custo
                  da obra com impostos é só referência visual. Editar uma fatia subtrai (ou
                  soma) só dela no total.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-[#8d5e22]">
                  Divisão do valor — edite em R$ ou %
                </h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <FatiaInput
                    id="neg-fatia-mat"
                    label="Material"
                    value={draftMaterial}
                    percentValue={draftPctMaterial}
                    barColor={
                      tom === 'piso'
                        ? 'bg-red-500'
                        : tom === 'alerta'
                          ? 'bg-orange-500'
                          : tom === 'atencao'
                            ? 'bg-amber-500'
                            : 'bg-[#c4963a]'
                    }
                    percent={splitsAtuais.material}
                    disabled={sliderDisabled}
                    shellClassName={tomUi.fatia}
                    inputClassName={tomUi.fatiaInput}
                    onChange={(v) => setDraftMaterial(sanitizeMoneyDraft(v))}
                    onChangePercent={(v) => setDraftPctMaterial(sanitizeMoneyDraft(v))}
                    onCommit={(v) => commitFatiaReais('material', v)}
                    onCommitPercent={(v) => commitFatiaPercentual('material', v)}
                  />
                  <FatiaInput
                    id="neg-fatia-mo"
                    label="Mão de obra"
                    value={draftMaoObra}
                    percentValue={draftPctMaoObra}
                    barColor={
                      tom === 'piso'
                        ? 'bg-red-600'
                        : tom === 'alerta'
                          ? 'bg-orange-600'
                          : tom === 'atencao'
                            ? 'bg-amber-600'
                            : 'bg-[#8d5e22]'
                    }
                    percent={splitsAtuais.maoObra}
                    disabled={sliderDisabled}
                    shellClassName={tomUi.fatia}
                    inputClassName={tomUi.fatiaInput}
                    onChange={(v) => setDraftMaoObra(sanitizeMoneyDraft(v))}
                    onChangePercent={(v) => setDraftPctMaoObra(sanitizeMoneyDraft(v))}
                    onCommit={(v) => commitFatiaReais('maoObra', v)}
                    onCommitPercent={(v) => commitFatiaPercentual('maoObra', v)}
                  />
                  <FatiaInput
                    id="neg-fatia-luc"
                    label="Lucro"
                    value={draftLucro}
                    percentValue={draftPctLucro}
                    barColor={
                      tom === 'piso'
                        ? 'bg-red-700'
                        : tom === 'alerta'
                          ? 'bg-orange-700'
                          : tom === 'atencao'
                            ? 'bg-amber-700'
                            : 'bg-emerald-600'
                    }
                    percent={splitsAtuais.lucro}
                    disabled={sliderDisabled}
                    shellClassName={tomUi.fatia}
                    inputClassName={tomUi.fatiaInput}
                    onChange={(v) => setDraftLucro(sanitizeMoneyDraft(v))}
                    onChangePercent={(v) => setDraftPctLucro(sanitizeMoneyDraft(v))}
                    onCommit={(v) => commitFatiaReais('lucro', v)}
                    onCommitPercent={(v) => commitFatiaPercentual('lucro', v)}
                  />
                </div>
                <p className="text-[11px] text-[#6b5344]">
                  Ao reduzir uma fatia (R$ ou %), as outras ficam iguais e o valor é subtraído
                  do total negociado — sem redistribuir.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="negociador-obs" className="text-[#2a1812]">
                  Observação (opcional)
                </Label>
                <Textarea
                  id="negociador-obs"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Ex.: cliente pediu 10% de desconto no fechamento"
                  className="min-h-[64px] border-[#c4963a]/35 bg-[#fffaf3] text-[#2a1812] placeholder:text-[#6b5344]/70 sm:min-h-[72px]"
                />
              </div>
            </section>
          </div>

          <DialogFooter className="relative z-10 shrink-0 flex-col gap-2 border-t border-[#c4963a]/25 bg-[#fffaf3]/95 px-4 py-3 sm:flex-row sm:justify-between sm:px-6 sm:py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-[#c4963a]/40 text-[#2a1812] hover:bg-[#f2d892]/20"
            >
              Cancelar
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleExportarPdf()}
                disabled={
                  exportandoPdf ||
                  selecionados.size === 0 ||
                  valorNegociado <= 0
                }
                className="border-[#c4963a]/50 text-[#8d5e22] hover:bg-[#f2d892]/25"
              >
                {exportandoPdf ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Gerando PDF...
                  </>
                ) : (
                  <>
                    <FileDown className="mr-1.5 h-4 w-4" />
                    Exportar PDF
                  </>
                )}
              </Button>
              <Button
                type="button"
                onClick={() => void handleSalvar()}
                disabled={
                  salvarNegociacao.isPending ||
                  selecionados.size === 0 ||
                  somas.custoMaterial <= 0
                }
                className="bg-[#8d5e22] text-[#fffaf3] hover:bg-[#6f4a1c]"
              >
                {salvarNegociacao.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar negociação'
                )}
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Metric({
  label,
  hint,
  value,
  className,
  valueClassName,
}: {
  label: string;
  hint?: string;
  value: string;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-[#c4963a]/25 bg-[#fffaf3] px-2.5 py-2 transition-colors duration-300',
        className,
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b5344]">{label}</p>
      {hint ? (
        <p className="text-[10px] text-[#6b5344]/80">{hint}</p>
      ) : null}
      <p
        className={cn(
          'mt-0.5 text-sm font-bold tabular-nums text-[#2a1812] transition-colors duration-300',
          valueClassName,
        )}
      >
        {value}
      </p>
    </div>
  );
}

function FatiaInput({
  id,
  label,
  value,
  percentValue,
  percent,
  barColor,
  disabled,
  shellClassName,
  inputClassName,
  onChange,
  onChangePercent,
  onCommit,
  onCommitPercent,
}: {
  id: string;
  label: string;
  value: string;
  percentValue: string;
  percent: number;
  barColor: string;
  disabled?: boolean;
  shellClassName?: string;
  inputClassName?: string;
  onChange: (raw: string) => void;
  onChangePercent: (raw: string) => void;
  onCommit: (raw: string) => void;
  onCommitPercent: (raw: string) => void;
}) {
  return (
    <div
      className={cn(
        'space-y-2 rounded-xl border-2 border-[#c4963a]/25 bg-[#fffaf3] p-3 shadow-sm transition-colors duration-300',
        shellClassName,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-[#6b5344]">
          {label}
        </Label>
        <div className="relative w-[4.75rem] shrink-0">
          <Input
            id={`${id}-pct`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            disabled={disabled}
            value={percentValue}
            onChange={(e) => onChangePercent(e.target.value)}
            onBlur={(e) => onCommitPercent(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onCommitPercent((e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).blur();
              }
            }}
            className={cn(
              'h-8 pr-6 text-center text-xs font-bold tabular-nums transition-colors duration-300',
              inputClassName ?? 'border-[#c4963a]/35 bg-white text-[#2a1812]',
            )}
            aria-label={`${label} em porcentagem`}
          />
          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-[#6b5344]">
            %
          </span>
        </div>
      </div>

      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#6b5344]">
          R$
        </span>
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onCommit(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onCommit((e.target as HTMLInputElement).value);
              (e.target as HTMLInputElement).blur();
            }
          }}
          className={cn(
            'h-12 border-2 pl-10 text-lg font-extrabold tabular-nums tracking-tight transition-colors duration-300 sm:h-14 sm:text-xl',
            inputClassName ?? 'border-[#c4963a]/35 bg-white text-[#2a1812]',
          )}
          aria-label={`${label} em reais`}
        />
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-[#efe6d8]">
        <div
          className={cn('h-full rounded-full transition-all duration-300', barColor)}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
    </div>
  );
}
