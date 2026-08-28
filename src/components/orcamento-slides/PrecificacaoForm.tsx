import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, Copy, GripVertical, Layers, Percent, Plus, Sparkles, Trash2, Wallet } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

function formatValorOrcamentoDisplay(value: number): string {
  if (!value || value <= 0) return '';
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseValorOrcamentoDisplay(display: string): number {
  const numbers = display.replace(/\D/g, '');
  if (!numbers) return 0;
  return parseInt(numbers, 10) / 100;
}

function maskValorOrcamentoInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return (parseInt(digits, 10) / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
import {
  BRL,
  OBSERVACAO_FORMA_PAGAMENTO_MAX,
  calcularDespesasRestanteMarkup,
  calcularPrecificacaoComFormas,
  criarFormaPagamentoSelecao,
  criarGrupoPrecosFracionados,
  espelharGruposFracionadosLegado,
  markupComposicaoTemConteudo,
  montarComposicaoMarkupComDespesasRestante,
  normalizarGruposFracionados,
  normalizarMarkupComposicao,
  opcoesPagamentoApresentacao,
  ordenarFormasPagamentoParaEdicao,
  resolverAcrescimoFormaPagamento,
  resolverAjustePercentualDoValorFinal,
  resolverDescontoFormaPagamento,
  resolverFormasPagamentoSelecoes,
  resolverValorFormaPagamento,
  somaMarkupComposicao,
} from '@/lib/orcamento-slide-precificacao';
import type {
  FormaPagamentoSelecao,
  GrupoPrecosFracionados,
  MarkupOrcamentoOpcaoSeed,
  OrcamentoFormaPagamento,
  OrcamentoPrecificacao,
} from '@/lib/orcamento-slide-types';
import { ItensPrecosFracionadosEditor } from '@/components/orcamento-slides/ItensPrecosFracionadosEditor';
import { MarkupComposicaoEditor } from '@/components/orcamento-slides/MarkupComposicaoEditor';
import { PrecificacaoOpcaoCard } from '@/components/orcamento-slides/PrecificacaoOpcaoCard';

interface Props {
  value: OrcamentoPrecificacao;
  onChange: (v: OrcamentoPrecificacao) => void;
  leadId?: number | null;
  valorOrcamentoLead?: number;
  formasPagamento?: OrcamentoFormaPagamento[];
  /** Markups do lead disponíveis para importar na composição. */
  markupsDisponiveis?: MarkupOrcamentoOpcaoSeed[];
}

interface FormaPagamentoCardProps {
  forma: OrcamentoFormaPagamento;
  selecaoId: string;
  ativa: boolean;
  indiceSelecionada: number;
  permiteReordenar: boolean;
  descontoForma: number;
  acrescimoForma: number;
  valorFinalForma: number;
  parcelasForma: number;
  observacaoForma: string;
  opcaoPreview: ReturnType<typeof opcoesPagamentoApresentacao>[number] | undefined;
  value: OrcamentoPrecificacao;
  onAlternar: () => void;
  onDuplicar?: () => void;
  onAtualizarObservacao: (texto: string) => void;
  onRecalcular: (
    patch: Partial<{
      valorIntegral: number;
      descontoPercent: number;
      acrescimoPercent: number;
      formasSelecoes: FormaPagamentoSelecao[];
      parcelasPorForma: Record<string, number>;
      descontosPorForma: Record<string, number>;
      acrescimosPorForma: Record<string, number>;
      parcelasLegacy: number;
      sincronizarDescontosFormas: boolean;
    }>,
  ) => void;
}

function FormaPagamentoCard({
  forma,
  selecaoId,
  ativa,
  indiceSelecionada,
  permiteReordenar,
  descontoForma,
  acrescimoForma,
  valorFinalForma,
  parcelasForma,
  observacaoForma,
  opcaoPreview,
  value,
  onAlternar,
  onDuplicar,
  onAtualizarObservacao,
  onRecalcular,
}: FormaPagamentoCardProps) {
  const sortable = useSortable({
    id: selecaoId,
    disabled: !ativa || !permiteReordenar,
  });

  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };

  const [valorFinalDisplay, setValorFinalDisplay] = useState(() =>
    formatValorOrcamentoDisplay(valorFinalForma),
  );
  const [editandoValorFinal, setEditandoValorFinal] = useState(false);

  useEffect(() => {
    if (editandoValorFinal) return;
    setValorFinalDisplay(formatValorOrcamentoDisplay(valorFinalForma));
  }, [valorFinalForma, editandoValorFinal]);

  const aplicarValorFinalDigitado = (display: string) => {
    const valorDesejado = parseValorOrcamentoDisplay(display);
    const ajuste = resolverAjustePercentualDoValorFinal(value.valor_integral, valorDesejado);
    onRecalcular({
      descontosPorForma: {
        ...(value.formas_pagamento_descontos ?? {}),
        [selecaoId]: ajuste.descontoPercent,
      },
      acrescimosPorForma: {
        ...(value.formas_pagamento_acrescimos ?? {}),
        [selecaoId]: ajuste.acrescimoPercent,
      },
    });
  };

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      className={cn(
        'rounded-2xl border transition-all',
        ativa
          ? 'border-amber-500/45 bg-gradient-to-br from-amber-500/[0.07] to-transparent shadow-sm shadow-amber-950/20'
          : 'border-border/70 bg-card/20',
        sortable.isDragging && 'z-10 opacity-90 shadow-lg ring-2 ring-amber-500/30',
      )}
    >
      <div className="flex items-stretch">
        {ativa && permiteReordenar && (
          <button
            type="button"
            className="touch-none shrink-0 px-2 text-muted-foreground/50 hover:text-muted-foreground cursor-grab active:cursor-grabbing self-center"
            aria-label={`Arrastar ${forma.nome} para mudar a ordem no slide`}
            {...sortable.attributes}
            {...sortable.listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onAlternar}
          className={cn('w-full px-4 py-3 text-left', ativa && permiteReordenar && 'pl-0')}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">{forma.nome}</p>
                {ativa && indiceSelecionada === 0 && (
                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/35 text-[10px] px-1.5 py-0">
                    1ª no slide
                  </Badge>
                )}
              </div>
              {forma.descricao && (
                <p className="text-xs text-muted-foreground mt-0.5">{forma.descricao}</p>
              )}
            </div>
            {ativa ? (
              <Check className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
            ) : (
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Ativar</span>
            )}
          </div>
        </button>
        {ativa && onDuplicar && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicar();
            }}
            className="shrink-0 self-center mr-3 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/30 text-amber-200/90 hover:bg-amber-500/10 transition-colors"
            aria-label={`Duplicar ${forma.nome}`}
            title="Duplicar esta forma"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {ativa && (
        <div className="px-4 pb-4 flex flex-col gap-3 border-t border-amber-500/15 pt-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Desconto (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={descontoForma || ''}
                onChange={(e) => {
                  const desconto = parseFloat(e.target.value) || 0;
                  onRecalcular({
                    descontosPorForma: {
                      ...(value.formas_pagamento_descontos ?? {}),
                      [selecaoId]: desconto,
                    },
                    acrescimosPorForma: {
                      ...(value.formas_pagamento_acrescimos ?? {}),
                      [selecaoId]: desconto > 0 ? 0 : acrescimoForma,
                    },
                  });
                }}
                placeholder="0"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Acréscimo (%)</Label>
              <Input
                type="number"
                min={0}
                max={200}
                step={0.5}
                value={acrescimoForma || ''}
                onChange={(e) => {
                  const acrescimo = parseFloat(e.target.value) || 0;
                  onRecalcular({
                    acrescimosPorForma: {
                      ...(value.formas_pagamento_acrescimos ?? {}),
                      [selecaoId]: acrescimo,
                    },
                    descontosPorForma: {
                      ...(value.formas_pagamento_descontos ?? {}),
                      [selecaoId]: acrescimo > 0 ? 0 : descontoForma,
                    },
                  });
                }}
                placeholder="0"
              />
              {forma.tipo === 'parcelado' && (
                <p className="text-[11px] text-muted-foreground">
                  Útil para taxa/juros no parcelado (ex.: +5%).
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Valor final</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-200/80 text-sm font-medium pointer-events-none">
                R$
              </span>
              <Input
                inputMode="decimal"
                value={valorFinalDisplay}
                onFocus={() => setEditandoValorFinal(true)}
                onBlur={() => {
                  setEditandoValorFinal(false);
                  setValorFinalDisplay(formatValorOrcamentoDisplay(valorFinalForma));
                }}
                onChange={(e) => {
                  const masked = maskValorOrcamentoInput(e.target.value);
                  setValorFinalDisplay(masked);
                  aplicarValorFinalDigitado(masked);
                }}
                placeholder="0,00"
                className="h-10 pl-10 font-serif font-bold text-amber-100 border-amber-500/25 bg-amber-500/8"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Digite o valor desejado: se for menor que o total, calcula o desconto; se for maior, o acréscimo.
            </p>
          </div>

          {forma.tipo === 'parcelado' && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Parcelas</Label>
              <Input
                type="number"
                min={2}
                max={120}
                step={1}
                value={parcelasForma || ''}
                onChange={(e) => {
                  const parcelas = parseInt(e.target.value, 10) || 2;
                  onRecalcular({
                    parcelasLegacy: parcelas,
                    parcelasPorForma: {
                      ...(value.formas_pagamento_parcelas ?? {}),
                      [selecaoId]: parcelas,
                    },
                  });
                }}
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={`obs-forma-${selecaoId}`} className="text-xs text-muted-foreground">
                Observação (aparece no slide)
              </Label>
              <span className="text-[10px] tabular-nums text-muted-foreground/80">
                {observacaoForma.length}/{OBSERVACAO_FORMA_PAGAMENTO_MAX}
              </span>
            </div>
            <Textarea
              id={`obs-forma-${selecaoId}`}
              value={observacaoForma}
              maxLength={OBSERVACAO_FORMA_PAGAMENTO_MAX}
              rows={2}
              placeholder="Ex.: Condição especial válida até o fim do mês."
              onChange={(e) => onAtualizarObservacao(e.target.value)}
              className="min-h-[64px] resize-y text-sm border-amber-500/20 bg-background/40"
            />
            <p className="text-[11px] text-muted-foreground">
              Texto livre sob o preço desta forma na apresentação, no PDF e na filmagem.
            </p>
          </div>

          {opcaoPreview && (
            <PrecificacaoOpcaoCard
              opcao={opcaoPreview}
              paleta={{
                primaria: '#2a1812',
                secundaria: '#c9a07b',
                tituloFont: 'Playfair Display',
                corpoFont: 'Inter',
              }}
              variant="form-preview"
            />
          )}
        </div>
      )}
    </div>
  );
}

export function PrecificacaoForm({
  value,
  onChange,
  leadId,
  valorOrcamentoLead = 0,
  formasPagamento = [],
  markupsDisponiveis = [],
}: Props) {
  const selecoes = useMemo(
    () => resolverFormasPagamentoSelecoes(value, formasPagamento),
    [value, formasPagamento],
  );
  const idsSelecionados = useMemo(() => selecoes.map((s) => s.id), [selecoes]);

  const opcoesPreview = useMemo(
    () => opcoesPagamentoApresentacao(value, formasPagamento),
    [value, formasPagamento],
  );

  const { ativas: formasAtivas, catalogo: formasCatalogo } = useMemo(
    () => ordenarFormasPagamentoParaEdicao(formasPagamento, selecoes),
    [formasPagamento, selecoes],
  );

  const gruposFracionados = useMemo(
    () => (value.fracionar_precos ? normalizarGruposFracionados(value) : []),
    [value],
  );

  const permiteReordenar = idsSelecionados.length > 1;

  const markupSelecionadoInicial =
    (value.markup_orcamento_id &&
      markupsDisponiveis.find((m) => m.id === value.markup_orcamento_id)?.id) ||
    markupsDisponiveis[0]?.id ||
    '';

  const [markupSelecionadoId, setMarkupSelecionadoId] = useState(markupSelecionadoInicial);

  useEffect(() => {
    if (
      markupSelecionadoId &&
      markupsDisponiveis.some((m) => m.id === markupSelecionadoId)
    ) {
      return;
    }
    const next =
      (value.markup_orcamento_id &&
        markupsDisponiveis.find((m) => m.id === value.markup_orcamento_id)?.id) ||
      markupsDisponiveis[0]?.id ||
      '';
    setMarkupSelecionadoId(next);
  }, [markupsDisponiveis, markupSelecionadoId, value.markup_orcamento_id]);

  const markupSeed = useMemo(
    () => markupsDisponiveis.find((m) => m.id === markupSelecionadoId) ?? markupsDisponiveis[0] ?? null,
    [markupsDisponiveis, markupSelecionadoId],
  );

  const temMarkupSeed = markupComposicaoTemConteudo(markupSeed);
  const totalMarkup = somaMarkupComposicao(value.markup_composicao);
  const totalOrcamentoRef = Math.max(
    0,
    value.valor_integral || Number(markupSeed?.precoFinal) || valorOrcamentoLead || 0,
  );

  const [valorIntegralDisplay, setValorIntegralDisplay] = useState(() =>
    formatValorOrcamentoDisplay(value.valor_integral),
  );

  useEffect(() => {
    setValorIntegralDisplay(formatValorOrcamentoDisplay(value.valor_integral));
  }, [value.valor_integral]);

  const leadSugereValorDiferente =
    valorOrcamentoLead > 0 && Math.abs(value.valor_integral - valorOrcamentoLead) >= 0.01;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const recalcular = (
    patch: Partial<{
      valorIntegral: number;
      descontoPercent: number;
      acrescimoPercent: number;
      formasSelecoes: FormaPagamentoSelecao[];
      parcelasPorForma: Record<string, number>;
      descontosPorForma: Record<string, number>;
      acrescimosPorForma: Record<string, number>;
      parcelasLegacy: number;
      sincronizarDescontosFormas: boolean;
      fracionarPrecos: boolean;
      gruposFracionados: GrupoPrecosFracionados[];
    }>,
  ) => {
    const valorIntegral = patch.valorIntegral ?? value.valor_integral;
    const descontoPercent = patch.descontoPercent ?? value.desconto_percent;
    const acrescimoPercent = patch.acrescimoPercent ?? value.acrescimo_percent ?? 0;
    const formasSelecoes = patch.formasSelecoes ?? selecoes;
    const formasIds = formasSelecoes.map((s) => s.id);

    let descontosPorForma = patch.descontosPorForma ?? value.formas_pagamento_descontos ?? {};
    if (patch.sincronizarDescontosFormas) {
      descontosPorForma = Object.fromEntries(
        formasIds.map((id) => [id, descontoPercent]),
      );
    }

    const fracionarPrecos = patch.fracionarPrecos ?? !!value.fracionar_precos;
    const grupos =
      patch.gruposFracionados ??
      (fracionarPrecos ? normalizarGruposFracionados(value) : []);

    onChange(
      calcularPrecificacaoComFormas({
        valorIntegral,
        descontoPercent,
        acrescimoPercent,
        formasSelecoes,
        formasCatalogo: formasPagamento,
        parcelasPorForma: patch.parcelasPorForma ?? value.formas_pagamento_parcelas,
        descontosPorForma,
        acrescimosPorForma: patch.acrescimosPorForma ?? value.formas_pagamento_acrescimos,
        observacoesPorForma: value.formas_pagamento_observacoes,
        parcelasLegacy: patch.parcelasLegacy ?? value.parcelas,
        fracionarPrecos,
        gruposFracionados: grupos,
        itensFracionados: grupos[0]?.itens,
        exibirTotalFracionado: grupos[0]?.exibir_total !== false,
        adicionarMarkup: value.adicionar_markup,
        markupComposicao: value.markup_composicao,
        markupOrcamentoId: value.markup_orcamento_id,
      }),
    );
  };

  const handleReordenarFormas = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = idsSelecionados.indexOf(String(active.id));
    const newIndex = idsSelecionados.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    recalcular({ formasSelecoes: arrayMove(selecoes, oldIndex, newIndex) });
  };

  const patchPrecificacao = (patch: Partial<OrcamentoPrecificacao>) => {
    onChange({ ...value, ...patch });
  };

  const aplicarSeedMarkup = (opcao?: MarkupOrcamentoOpcaoSeed | null) => {
    const seed = opcao ?? markupSeed;
    if (!seed) return;
    const totalRef =
      value.valor_integral > 0
        ? value.valor_integral
        : Number(seed.precoFinal) > 0
          ? Number(seed.precoFinal)
          : valorOrcamentoLead > 0
            ? valorOrcamentoLead
            : 0;
    patchPrecificacao({
      adicionar_markup: true,
      markup_orcamento_id: seed.id,
      markup_composicao: montarComposicaoMarkupComDespesasRestante({
        materiais: seed.materiais ?? 0,
        servicos: seed.servicos ?? 0,
        totalOrcamento: totalRef,
      }),
    });
  };

  const ativarMarkup = (checked: boolean) => {
    if (!checked) {
      patchPrecificacao({
        adicionar_markup: false,
        markup_composicao: undefined,
        markup_orcamento_id: null,
      });
      return;
    }

    const seed = markupSeed;
    const totalRef =
      value.valor_integral > 0
        ? value.valor_integral
        : Number(seed?.precoFinal) > 0
          ? Number(seed!.precoFinal)
          : valorOrcamentoLead > 0
            ? valorOrcamentoLead
            : 0;

    const composicao = temMarkupSeed && seed
      ? montarComposicaoMarkupComDespesasRestante({
          materiais: seed.materiais ?? 0,
          servicos: seed.servicos ?? 0,
          totalOrcamento: totalRef,
        })
      : markupComposicaoTemConteudo(value.markup_composicao) && totalRef > 0
        ? montarComposicaoMarkupComDespesasRestante({
            materiais: value.markup_composicao?.materiais ?? 0,
            servicos: value.markup_composicao?.servicos ?? 0,
            totalOrcamento: totalRef,
          })
        : normalizarMarkupComposicao({
            materiais: value.markup_composicao?.materiais ?? 0,
            servicos: value.markup_composicao?.servicos ?? 0,
            despesas: value.markup_composicao?.despesas ?? 0,
          });

    patchPrecificacao({
      adicionar_markup: true,
      markup_composicao: composicao,
      markup_orcamento_id: seed?.id ?? value.markup_orcamento_id ?? null,
    });
  };

  const aplicarSelecoes = (
    novasSelecoes: FormaPagamentoSelecao[],
    extras?: {
      parcelasPorForma?: Record<string, number>;
      descontosPorForma?: Record<string, number>;
      acrescimosPorForma?: Record<string, number>;
      observacoesPorForma?: Record<string, string>;
    },
  ) => {
    onChange(
      calcularPrecificacaoComFormas({
        valorIntegral: value.valor_integral,
        descontoPercent: value.desconto_percent,
        acrescimoPercent: value.acrescimo_percent ?? 0,
        formasSelecoes: novasSelecoes,
        formasCatalogo: formasPagamento,
        parcelasPorForma: extras?.parcelasPorForma ?? value.formas_pagamento_parcelas,
        descontosPorForma: extras?.descontosPorForma ?? value.formas_pagamento_descontos,
        acrescimosPorForma: extras?.acrescimosPorForma ?? value.formas_pagamento_acrescimos,
        observacoesPorForma: extras?.observacoesPorForma ?? value.formas_pagamento_observacoes,
        parcelasLegacy: value.parcelas,
        fracionarPrecos: value.fracionar_precos,
        gruposFracionados: value.fracionar_precos ? normalizarGruposFracionados(value) : [],
        itensFracionados: value.itens_fracionados,
        exibirTotalFracionado: value.exibir_total_fracionado,
        adicionarMarkup: value.adicionar_markup,
        markupComposicao: value.markup_composicao,
        markupOrcamentoId: value.markup_orcamento_id,
      }),
    );
  };

  const removerSelecao = (selecaoId: string) => {
    const novasSelecoes = selecoes.filter((s) => s.id !== selecaoId);
    const parcelasPorForma = { ...(value.formas_pagamento_parcelas ?? {}) };
    const descontosPorForma = { ...(value.formas_pagamento_descontos ?? {}) };
    const acrescimosPorForma = { ...(value.formas_pagamento_acrescimos ?? {}) };
    const observacoesPorForma = { ...(value.formas_pagamento_observacoes ?? {}) };
    delete parcelasPorForma[selecaoId];
    delete descontosPorForma[selecaoId];
    delete acrescimosPorForma[selecaoId];
    delete observacoesPorForma[selecaoId];
    aplicarSelecoes(novasSelecoes, {
      parcelasPorForma,
      descontosPorForma,
      acrescimosPorForma,
      observacoesPorForma,
    });
  };

  const adicionarDoCatalogo = (forma: OrcamentoFormaPagamento) => {
    const nova = criarFormaPagamentoSelecao(forma.id);
    const parcelasPorForma = { ...(value.formas_pagamento_parcelas ?? {}) };
    const descontosPorForma = { ...(value.formas_pagamento_descontos ?? {}) };
    const acrescimosPorForma = { ...(value.formas_pagamento_acrescimos ?? {}) };
    if (forma.tipo === 'parcelado') {
      parcelasPorForma[nova.id] = forma.parcelas_padrao;
    }
    descontosPorForma[nova.id] = value.desconto_percent ?? 0;
    acrescimosPorForma[nova.id] = value.acrescimo_percent ?? 0;
    aplicarSelecoes([...selecoes, nova], {
      parcelasPorForma,
      descontosPorForma,
      acrescimosPorForma,
    });
  };

  const duplicarSelecao = (selecao: FormaPagamentoSelecao, forma: OrcamentoFormaPagamento) => {
    const nova = criarFormaPagamentoSelecao(selecao.forma_id);
    const parcelasPorForma = { ...(value.formas_pagamento_parcelas ?? {}) };
    const descontosPorForma = { ...(value.formas_pagamento_descontos ?? {}) };
    const acrescimosPorForma = { ...(value.formas_pagamento_acrescimos ?? {}) };
    const observacoesPorForma = { ...(value.formas_pagamento_observacoes ?? {}) };

    descontosPorForma[nova.id] = descontosPorForma[selecao.id] ?? value.desconto_percent ?? 0;
    acrescimosPorForma[nova.id] = acrescimosPorForma[selecao.id] ?? value.acrescimo_percent ?? 0;
    if (forma.tipo === 'parcelado') {
      parcelasPorForma[nova.id] =
        parcelasPorForma[selecao.id] ?? forma.parcelas_padrao;
    }
    if (observacoesPorForma[selecao.id]) {
      observacoesPorForma[nova.id] = observacoesPorForma[selecao.id];
    }

    const idx = selecoes.findIndex((s) => s.id === selecao.id);
    const novas =
      idx >= 0
        ? [...selecoes.slice(0, idx + 1), nova, ...selecoes.slice(idx + 1)]
        : [...selecoes, nova];

    aplicarSelecoes(novas, {
      parcelasPorForma,
      descontosPorForma,
      acrescimosPorForma,
      observacoesPorForma,
    });
  };

  const atualizarObservacaoForma = (selecaoId: string, texto: string) => {
    const cortado = texto.slice(0, OBSERVACAO_FORMA_PAGAMENTO_MAX);
    const atuais = { ...(value.formas_pagamento_observacoes ?? {}) };
    if (!cortado.trim()) {
      delete atuais[selecaoId];
    } else {
      atuais[selecaoId] = cortado;
    }
    const filtradas: Record<string, string> = {};
    for (const id of idsSelecionados) {
      if (atuais[id] != null && atuais[id] !== '') filtradas[id] = atuais[id];
    }
    patchPrecificacao({ formas_pagamento_observacoes: filtradas });
  };

  const atualizarGruposFracionados = (grupos: GrupoPrecosFracionados[]) => {
    patchPrecificacao(espelharGruposFracionadosLegado(grupos, true));
  };

  useEffect(() => {
    if (!value.adicionar_markup || totalOrcamentoRef <= 0) return;
    const atual = value.markup_composicao;
    if (!atual) return;

    const esperada = calcularDespesasRestanteMarkup({
      materiais: atual.materiais ?? 0,
      servicos: atual.servicos ?? 0,
      totalOrcamento: totalOrcamentoRef,
    });

    if (Math.abs((atual.despesas ?? 0) - esperada) < 0.009) return;

    onChange({
      ...value,
      markup_composicao: montarComposicaoMarkupComDespesasRestante({
        materiais: atual.materiais ?? 0,
        servicos: atual.servicos ?? 0,
        totalOrcamento: totalOrcamentoRef,
      }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    value.adicionar_markup,
    totalOrcamentoRef,
    value.markup_composicao?.materiais,
    value.markup_composicao?.servicos,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-amber-500/35 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-4 flex flex-col gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-10 w-10 rounded-full bg-amber-500/15 ring-1 ring-amber-400/25 flex items-center justify-center shrink-0">
            <Wallet className="h-5 w-5 text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <Label htmlFor="valor-total-orcamento" className="text-sm font-medium">
              Valor total do orçamento
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5 mb-2">
              Este valor fica salvo neste orçamento. Alterar o campo Orçamentos no card do cliente
              não muda o que já foi definido aqui.
            </p>
            <div className="relative max-w-sm">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-200/80 text-sm font-medium">
                R$
              </span>
              <Input
                id="valor-total-orcamento"
                inputMode="decimal"
                value={valorIntegralDisplay}
                onChange={(e) => {
                  const masked = maskValorOrcamentoInput(e.target.value);
                  setValorIntegralDisplay(masked);
                  recalcular({ valorIntegral: parseValorOrcamentoDisplay(masked) });
                }}
                placeholder="0,00"
                className="pl-10 h-12 text-2xl font-serif font-bold text-amber-100 border-amber-500/35 bg-amber-500/5"
              />
            </div>
          </div>
        </div>

        {leadSugereValorDiferente && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-background/30 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Sugestão do card do cliente</p>
              <p className="text-sm font-medium text-amber-100/90">{BRL(valorOrcamentoLead)}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-amber-500/40 text-amber-100 hover:bg-amber-500/10 shrink-0"
              onClick={() => recalcular({ valorIntegral: valorOrcamentoLead })}
            >
              Usar {BRL(valorOrcamentoLead)}
            </Button>
          </div>
        )}

        {value.valor_integral > 0 && !leadSugereValorDiferente && valorOrcamentoLead > 0 && (
          <Badge className="w-fit bg-emerald-600/20 text-emerald-400 border-emerald-500/30 gap-1 py-1.5">
            <Check className="h-3.5 w-3.5" />
            Igual ao card do cliente
          </Badge>
        )}
      </div>

      <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.08] via-card/40 to-transparent p-4 flex flex-col gap-4 motion-safe:transition-[border-color,box-shadow] motion-safe:duration-300">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-full bg-amber-500/15 ring-1 ring-amber-400/20 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-amber-400" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <Label htmlFor="adicionar-markup" className="text-sm font-semibold cursor-pointer text-balance">
                Adicionar Markup
              </Label>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed text-pretty">
                Antes do preço: Materiais e Serviços; Despesas fecha o restante até o total do orçamento.
              </p>
            </div>
          </div>
          <Switch
            id="adicionar-markup"
            checked={!!value.adicionar_markup}
            onCheckedChange={ativarMarkup}
          />
        </div>

        {value.adicionar_markup && (
          <>
            <MarkupComposicaoEditor
              value={value.markup_composicao}
              totalOrcamento={totalOrcamentoRef}
              onChange={(composicao) =>
                patchPrecificacao({
                  markup_composicao: normalizarMarkupComposicao(composicao),
                })
              }
            />

            <div className="flex flex-col gap-2 pt-1">
              {markupsDisponiveis.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <Label htmlFor="markup-import-select" className="text-xs text-muted-foreground">
                      Markup do cliente
                    </Label>
                    <Select
                      value={markupSelecionadoId || undefined}
                      onValueChange={(id) => {
                        setMarkupSelecionadoId(id);
                        const opcao = markupsDisponiveis.find((m) => m.id === id);
                        if (opcao) aplicarSeedMarkup(opcao);
                      }}
                    >
                      <SelectTrigger id="markup-import-select" className="w-full">
                        <SelectValue placeholder="Selecione um markup" />
                      </SelectTrigger>
                      <SelectContent>
                        {markupsDisponiveis.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.titulo} — {BRL(m.precoFinal)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-amber-500/35 text-amber-100 hover:bg-amber-500/10 shrink-0"
                    disabled={!markupSeed}
                    onClick={() => aplicarSeedMarkup()}
                  >
                    Importar selecionado
                  </Button>
                </div>
              )}
              {totalMarkup > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-border/60 w-full sm:w-auto"
                  onClick={() => recalcular({ valorIntegral: totalMarkup })}
                >
                  Usar total ({BRL(totalMarkup)}) como valor integral
                </Button>
              )}
            </div>
            {markupsDisponiveis.length === 0 && leadId == null && (
              <p className="text-xs text-muted-foreground">
                Sem markup no card — preencha os valores manualmente.
              </p>
            )}
            {markupsDisponiveis.length === 0 && leadId != null && (
              <p className="text-xs text-muted-foreground">
                Nenhum markup neste lead — preencha os valores manualmente ou crie um no card.
              </p>
            )}
          </>
        )}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/40 p-4 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-full bg-amber-500/12 flex items-center justify-center shrink-0">
              <Layers className="h-5 w-5 text-amber-400" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <Label htmlFor="fracionar-precos" className="text-sm font-semibold cursor-pointer">
                Fracionar preços
              </Label>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Exibe blocos no slide com valores por ambiente ou serviço. Você pode ter vários cards.
              </p>
            </div>
          </div>
          <Switch
            id="fracionar-precos"
            checked={!!value.fracionar_precos}
            onCheckedChange={(checked) => {
              if (!checked) {
                patchPrecificacao({
                  fracionar_precos: false,
                  grupos_fracionados: [],
                  itens_fracionados: [],
                  exibir_total_fracionado: undefined,
                });
                return;
              }
              const grupos =
                gruposFracionados.length > 0
                  ? gruposFracionados
                  : [criarGrupoPrecosFracionados()];
              patchPrecificacao(espelharGruposFracionadosLegado(grupos, true));
            }}
          />
        </div>

        {value.fracionar_precos && (
          <div className="flex flex-col gap-4">
            {gruposFracionados.map((grupo, grupoIndex) => (
              <div
                key={grupo.id}
                className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.06] to-transparent p-3 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                    <Label className="text-xs text-muted-foreground">
                      Card {grupoIndex + 1} — título no slide (opcional)
                    </Label>
                    <Input
                      value={grupo.titulo ?? ''}
                      placeholder={grupoIndex === 0 ? 'Ex.: Por ambiente' : 'Ex.: Serviços extras'}
                      onChange={(e) => {
                        const titulo = e.target.value;
                        atualizarGruposFracionados(
                          gruposFracionados.map((g) =>
                            g.id === grupo.id
                              ? { ...g, titulo: titulo.trim() ? titulo : undefined }
                              : g,
                          ),
                        );
                      }}
                      className="h-9"
                    />
                  </div>
                  {gruposFracionados.length > 1 && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Remover card ${grupoIndex + 1}`}
                      onClick={() =>
                        atualizarGruposFracionados(
                          gruposFracionados.filter((g) => g.id !== grupo.id),
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <ItensPrecosFracionadosEditor
                  itens={grupo.itens}
                  onChange={(itens) =>
                    atualizarGruposFracionados(
                      gruposFracionados.map((g) => (g.id === grupo.id ? { ...g, itens } : g)),
                    )
                  }
                  markupsDisponiveis={markupsDisponiveis}
                />

                <div className="flex items-start justify-between gap-4 pt-2 border-t border-border/40">
                  <div className="min-w-0">
                    <Label
                      htmlFor={`exibir-total-fracionado-${grupo.id}`}
                      className="text-sm font-medium cursor-pointer"
                    >
                      Mostrar soma total neste card
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Soma os itens deste card na apresentação.
                    </p>
                  </div>
                  <Switch
                    id={`exibir-total-fracionado-${grupo.id}`}
                    checked={grupo.exibir_total !== false}
                    onCheckedChange={(checked) =>
                      atualizarGruposFracionados(
                        gruposFracionados.map((g) =>
                          g.id === grupo.id ? { ...g, exibir_total: checked } : g,
                        ),
                      )
                    }
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5 border-amber-500/30 text-amber-100 hover:bg-amber-500/10"
                    onClick={() =>
                      atualizarGruposFracionados([
                        ...gruposFracionados.slice(0, grupoIndex + 1),
                        criarGrupoPrecosFracionados({
                          titulo: grupo.titulo ? `${grupo.titulo} (cópia)` : undefined,
                          itens: grupo.itens.map((i) => ({ ...i })),
                          exibir_total: grupo.exibir_total,
                        }),
                        ...gruposFracionados.slice(grupoIndex + 1),
                      ])
                    }
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Duplicar card
                  </Button>
                </div>
              </div>
            ))}

            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full sm:w-auto gap-1.5 border-dashed border-amber-500/35 text-amber-100 hover:bg-amber-500/10"
              onClick={() =>
                atualizarGruposFracionados([
                  ...gruposFracionados,
                  criarGrupoPrecosFracionados(),
                ])
              }
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar outro fracionamento
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border/50 bg-muted/15 p-4">
        <div className="flex flex-col gap-1.5 max-w-sm">
          <Label className="flex items-center gap-1.5">
            <Percent className="h-3.5 w-3.5 text-amber-400" />
            Desconto padrão (%)
          </Label>
          <p className="text-xs text-muted-foreground -mt-0.5">
            Aplica o mesmo desconto a todas as formas selecionadas. Depois você pode ajustar cada uma
            (desconto ou acréscimo). O total do orçamento (acima) é a base do cálculo.
          </p>
          <Input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={value.desconto_percent || ''}
            onChange={(e) =>
              recalcular({
                descontoPercent: parseFloat(e.target.value) || 0,
                sincronizarDescontosFormas: true,
              })
            }
            placeholder="0"
          />
        </div>
      </div>

      {formasPagamento.length > 0 && (
        <div className="flex flex-col gap-3">
          <div>
            <Label>Formas de pagamento</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ative as opções, ajuste desconto/acréscimo e use o ícone de copiar para repetir a mesma
              forma (ex.: 2× à vista). Pode deixar todas desmarcadas. Com duas ou mais ativas, arraste
              pelo ícone ⋮⋮ para a ordem no slide.
            </p>
          </div>

          {formasAtivas.length > 0 && (
            <DndContext sensors={sensors} onDragEnd={handleReordenarFormas}>
              <SortableContext
                items={idsSelecionados}
                strategy={verticalListSortingStrategy}
              >
                <div className="grid grid-cols-1 gap-3">
                  {formasAtivas.map(({ selecao, forma }, indiceSelecionada) => {
                    const descontoForma = resolverDescontoFormaPagamento(value, selecao.id);
                    const acrescimoForma = resolverAcrescimoFormaPagamento(value, selecao.id);
                    const valorFinalForma = resolverValorFormaPagamento(value, selecao.id);
                    const parcelasForma =
                      value.formas_pagamento_parcelas?.[selecao.id] ?? forma.parcelas_padrao;
                    const observacaoForma = value.formas_pagamento_observacoes?.[selecao.id] ?? '';
                    const opcaoPreview = opcoesPreview.find((o) => o.formaId === selecao.id);

                    return (
                      <FormaPagamentoCard
                        key={selecao.id}
                        forma={forma}
                        selecaoId={selecao.id}
                        ativa
                        indiceSelecionada={indiceSelecionada}
                        permiteReordenar={permiteReordenar}
                        descontoForma={descontoForma}
                        acrescimoForma={acrescimoForma}
                        valorFinalForma={valorFinalForma}
                        parcelasForma={parcelasForma}
                        observacaoForma={observacaoForma}
                        opcaoPreview={opcaoPreview}
                        value={value}
                        onAlternar={() => removerSelecao(selecao.id)}
                        onDuplicar={() => duplicarSelecao(selecao, forma)}
                        onAtualizarObservacao={(texto) =>
                          atualizarObservacaoForma(selecao.id, texto)
                        }
                        onRecalcular={recalcular}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}

          <div className="flex flex-col gap-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/80">
              Adicionar do catálogo
            </p>
            <div className="grid grid-cols-1 gap-2">
              {formasCatalogo.map((forma) => (
                <button
                  key={`catalogo-${forma.id}`}
                  type="button"
                  onClick={() => adicionarDoCatalogo(forma)}
                  className="rounded-2xl border border-border/70 bg-card/20 px-4 py-3 text-left transition-colors hover:border-amber-500/35 hover:bg-amber-500/[0.04]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{forma.nome}</p>
                      {forma.descricao && (
                        <p className="text-xs text-muted-foreground mt-0.5">{forma.descricao}</p>
                      )}
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                      Ativar
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border/60 bg-gradient-to-b from-muted/40 to-muted/10 p-4 flex flex-col gap-3">
        <Label className="text-muted-foreground">Prévia do slide e PDF</Label>
        <p className="text-xs text-muted-foreground -mt-1">
          É assim que o cliente verá na apresentação e no PDF exportado.
        </p>
        {opcoesPreview.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma forma de pagamento selecionada — o slide de preço mostra só o valor, sem opções.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {opcoesPreview.map((opcao) => (
              <PrecificacaoOpcaoCard
                key={opcao.formaId}
                opcao={opcao}
                paleta={{
                  primaria: '#2a1812',
                  secundaria: '#c9a07b',
                  tituloFont: 'Playfair Display',
                  corpoFont: 'Inter',
                }}
                variant={opcoesPreview.length === 1 ? 'slide-hero' : 'form-preview'}
              />
            ))}
          </div>
        )}
        {leadId && value.valor_integral > 0 && (
          <p className="text-xs text-muted-foreground pt-1">
            Ao salvar, o card do cliente pode receber uma sugestão com o menor valor final das formas —
            mas o total deste orçamento continua sendo o que você definiu acima.
          </p>
        )}
      </div>
    </div>
  );
}
