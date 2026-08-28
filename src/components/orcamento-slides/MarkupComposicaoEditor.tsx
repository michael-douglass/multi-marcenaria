import { Calculator } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  aplicarPercentualMarkupComposicao,
  BRL,
  calcularDespesasRestanteMarkup,
  montarComposicaoMarkupComDespesasRestante,
  normalizarMarkupComposicao,
  patchMarkupComposicao,
  percentualSobreTotal,
  somaMarkupComposicao,
  type MarkupCustoChave,
} from '@/lib/orcamento-slide-precificacao';
import type { MarkupComposicaoPrecificacao } from '@/lib/orcamento-slide-types';
import { cn } from '@/lib/utils';

interface Props {
  value?: MarkupComposicaoPrecificacao | null;
  onChange: (value: MarkupComposicaoPrecificacao) => void;
  /**
   * Total do orçamento (card / preço final do markup).
   * Despesas = total − (materiais + serviços) ao editar os valores em R$.
   */
  totalOrcamento?: number;
  className?: string;
}

interface CampoMarkupProps {
  id: string;
  label: string;
  valor: number;
  percentual: number;
  percentualEditavel: boolean;
  valorReadOnly?: boolean;
  placeholder: string;
  onValorChange: (bruto: string) => void;
  onPercentualChange: (bruto: string) => void;
}

function CampoMarkupComPercentual({
  id,
  label,
  valor,
  percentual,
  percentualEditavel,
  valorReadOnly,
  placeholder,
  onValorChange,
  onPercentualChange,
}: CampoMarkupProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-border/50 bg-background/40 p-3">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <Label
          htmlFor={id}
          className="text-[11px] uppercase tracking-wide text-muted-foreground truncate"
        >
          {label}
        </Label>
        <div className="relative w-[4.25rem] shrink-0">
          <Input
            id={`${id}-pct`}
            name={`${id}-pct`}
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step={0.01}
            autoComplete="off"
            value={percentualEditavel ? (percentual || '') : ''}
            onChange={(e) => onPercentualChange(e.target.value)}
            disabled={!percentualEditavel}
            placeholder="0"
            className={cn(
              'h-7 px-2 pr-6 text-xs tabular-nums focus-visible:ring-amber-500/40',
              !percentualEditavel && 'bg-muted/30 cursor-default opacity-70',
            )}
            aria-label={`${label} em percentual do total`}
          />
          <span
            className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground"
            aria-hidden="true"
          >
            %
          </span>
        </div>
      </div>
      <Input
        id={id}
        name={id}
        type="number"
        inputMode="decimal"
        min={0}
        step={0.01}
        autoComplete="off"
        value={valor || ''}
        onChange={(e) => onValorChange(e.target.value)}
        readOnly={valorReadOnly}
        placeholder={placeholder}
        className={cn(
          'h-10 w-full min-w-0 text-sm tabular-nums focus-visible:ring-amber-500/40',
          valorReadOnly && 'bg-muted/30 cursor-default',
        )}
        aria-describedby={valorReadOnly ? `${id}-hint` : undefined}
      />
    </div>
  );
}

export function MarkupComposicaoEditor({
  value,
  onChange,
  totalOrcamento = 0,
  className,
}: Props) {
  const composicao = normalizarMarkupComposicao(value);
  const somaAtual = somaMarkupComposicao(composicao);
  const temTotalRef = totalOrcamento > 0;
  /** Base para % e para redistribuir: total do card, senão a soma dos três. */
  const totalBase = temTotalRef ? totalOrcamento : somaAtual;
  const podeEditarPercentual = totalBase > 0;

  const despesasCalculada = temTotalRef
    ? calcularDespesasRestanteMarkup({
        materiais: composicao.materiais,
        servicos: composicao.servicos,
        totalOrcamento,
      })
    : composicao.despesas;

  const materiaisExibidos = composicao.materiais;
  const servicosExibidos = composicao.servicos;
  const despesasExibidas = temTotalRef ? despesasCalculada : composicao.despesas;

  const pctMateriais = percentualSobreTotal(materiaisExibidos, totalBase);
  const pctServicos = percentualSobreTotal(servicosExibidos, totalBase);
  const pctDespesas = percentualSobreTotal(despesasExibidas, totalBase);

  const atualizarValor = (chave: MarkupCustoChave, bruto: string) => {
    const novoValor = Math.max(0, parseFloat(bruto) || 0);

    if (temTotalRef && (chave === 'materiais' || chave === 'servicos')) {
      const materiais = chave === 'materiais' ? novoValor : composicao.materiais;
      const servicos = chave === 'servicos' ? novoValor : composicao.servicos;
      onChange(
        montarComposicaoMarkupComDespesasRestante({
          materiais,
          servicos,
          totalOrcamento,
        }),
      );
      return;
    }

    onChange(
      patchMarkupComposicao(composicao, {
        [chave]: novoValor,
      }),
    );
  };

  const atualizarPercentual = (chave: MarkupCustoChave, bruto: string) => {
    if (!(totalBase > 0)) return;
    const pct = Math.min(100, Math.max(0, parseFloat(bruto) || 0));
    onChange(
      aplicarPercentualMarkupComposicao({
        chave,
        percentual: pct,
        totalBase,
        composicaoAtual: {
          ...composicao,
          despesas: despesasExibidas,
        },
      }),
    );
  };

  return (
    <div className={cn('flex flex-col gap-4 min-w-0 w-full overflow-hidden', className)}>
      <p className="text-xs text-muted-foreground leading-relaxed text-pretty">
        {temTotalRef
          ? `Cada % é a fatia do total (${BRL(totalOrcamento)}). Ao mudar um %, os outros se reajustam para fechar 100%.`
          : 'Valor em R$ e % do total. Ao mudar um %, os outros se reajustam.'}
      </p>

      <div className="grid grid-cols-1 gap-3 min-w-0 sm:grid-cols-3">
        <CampoMarkupComPercentual
          id="markup-materiais"
          label="Materiais"
          valor={materiaisExibidos}
          percentual={pctMateriais}
          percentualEditavel={podeEditarPercentual}
          placeholder="0,00"
          onValorChange={(v) => atualizarValor('materiais', v)}
          onPercentualChange={(v) => atualizarPercentual('materiais', v)}
        />

        <CampoMarkupComPercentual
          id="markup-servicos"
          label="Serviços"
          valor={servicosExibidos}
          percentual={pctServicos}
          percentualEditavel={podeEditarPercentual}
          placeholder="0,00"
          onValorChange={(v) => atualizarValor('servicos', v)}
          onPercentualChange={(v) => atualizarPercentual('servicos', v)}
        />

        <CampoMarkupComPercentual
          id="markup-despesas"
          label="Despesas"
          valor={despesasExibidas}
          percentual={pctDespesas}
          percentualEditavel={podeEditarPercentual}
          valorReadOnly={temTotalRef}
          placeholder="0,00"
          onValorChange={(v) => atualizarValor('despesas', v)}
          onPercentualChange={(v) => atualizarPercentual('despesas', v)}
        />
      </div>

      {temTotalRef && (
        <p id="markup-despesas-hint" className="text-[11px] text-muted-foreground">
          Despesas em R$ fecha o total. Você também pode editar o % de qualquer item.
        </p>
      )}

      <div
        id="markup-composicao-total"
        className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/[0.04] to-transparent px-4 py-3"
        aria-live="polite"
      >
        <div className="flex min-w-0 items-center gap-2">
          <Calculator className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
          <span className="text-sm text-muted-foreground">Total</span>
        </div>
        <span className="shrink-0 text-base font-semibold tabular-nums text-amber-100">
          {BRL(temTotalRef ? totalOrcamento : somaAtual)}
        </span>
      </div>
    </div>
  );
}
