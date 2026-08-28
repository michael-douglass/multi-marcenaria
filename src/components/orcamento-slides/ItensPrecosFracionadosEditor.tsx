import { useState } from 'react';
import { Plus, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BRL } from '@/lib/orcamento-slide-precificacao';
import type { MarkupOrcamentoOpcaoSeed, PrecoFracionadoItem } from '@/lib/orcamento-slide-types';

interface Props {
  itens: PrecoFracionadoItem[];
  onChange: (itens: PrecoFracionadoItem[]) => void;
  /** Markups do lead que podem ser inseridos como itens fracionados. */
  markupsDisponiveis?: MarkupOrcamentoOpcaoSeed[];
  compact?: boolean;
}

function itemFromMarkup(markup: MarkupOrcamentoOpcaoSeed): PrecoFracionadoItem {
  return {
    label: markup.titulo?.trim() || 'Markup',
    valor: Number(markup.precoFinal) > 0 ? Number(markup.precoFinal) : 0,
  };
}

export function ItensPrecosFracionadosEditor({
  itens,
  onChange,
  markupsDisponiveis = [],
  compact,
}: Props) {
  /** Remonta o Select após cada escolha para poder incluir o mesmo markup de novo. */
  const [selectKey, setSelectKey] = useState(0);

  const adicionar = () => onChange([...itens, { label: '', valor: 0 }]);
  const remover = (index: number) => onChange(itens.filter((_, i) => i !== index));
  const atualizar = (index: number, patch: Partial<PrecoFracionadoItem>) => {
    const novos = [...itens];
    novos[index] = { ...novos[index], ...patch };
    onChange(novos);
  };

  const adicionarMarkup = (markupId: string) => {
    const markup = markupsDisponiveis.find((m) => m.id === markupId);
    if (!markup) return;
    onChange([...itens, itemFromMarkup(markup)]);
    setSelectKey((k) => k + 1);
  };

  const adicionarTodosMarkups = () => {
    if (markupsDisponiveis.length === 0) return;
    onChange([...itens, ...markupsDisponiveis.map(itemFromMarkup)]);
  };

  const total = itens.reduce((acc, item) => acc + (item.valor > 0 ? item.valor : 0), 0);
  const temMarkups = markupsDisponiveis.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Label className={compact ? 'text-xs' : undefined}>Itens fracionados</Label>
        <div className="flex flex-wrap items-center gap-1.5 justify-end">
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={adicionar}>
            <Plus className="h-3 w-3" />
            Adicionar item
          </Button>
          {markupsDisponiveis.length > 1 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 border-amber-500/35 text-amber-100 hover:bg-amber-500/10"
              onClick={adicionarTodosMarkups}
            >
              <Sparkles className="h-3 w-3" />
              Adicionar todos os markups
            </Button>
          )}
        </div>
      </div>

      {temMarkups && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" aria-hidden />
            <div className="min-w-0">
              <p className="text-xs font-medium text-amber-100">Adicionar markup como item</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                {markupsDisponiveis.length === 1
                  ? 'Inclui o markup do cliente na lista. Depois você pode editar o nome e o valor.'
                  : 'Escolha um markup do cliente (ou use o botão acima para incluir todos). Nome e valor ficam editáveis.'}
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <Select key={selectKey} onValueChange={adicionarMarkup}>
              <SelectTrigger className="h-8 text-xs w-full sm:flex-1" aria-label="Selecionar markup para adicionar">
                <SelectValue placeholder="Selecionar markup…" />
              </SelectTrigger>
              <SelectContent>
                {markupsDisponiveis.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.titulo} — {BRL(m.precoFinal)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {markupsDisponiveis.length === 1 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1 border-amber-500/35 text-amber-100 hover:bg-amber-500/10 shrink-0"
                onClick={() => adicionarMarkup(markupsDisponiveis[0].id)}
              >
                <Plus className="h-3 w-3" />
                Incluir markup
              </Button>
            )}
          </div>
        </div>
      )}

      {itens.length === 0 && (
        <p className="text-xs text-muted-foreground rounded-lg border border-dashed border-border/60 p-4 text-center">
          Nenhum item. Adicione ambientes, serviços ou markups com seus respectivos valores.
        </p>
      )}

      {itens.map((item, i) => (
        <div
          key={i}
          className="rounded-xl border border-border/50 bg-muted/15 p-3 flex flex-col gap-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Item {i + 1}
            </span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={() => remover(i)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground">Descrição</Label>
              <Input
                value={item.label}
                onChange={(e) => atualizar(i, { label: e.target.value })}
                placeholder="Ex.: Cozinha, Quarto, Markup cozinha..."
                className="h-9 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground">Valor (R$)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={item.valor || ''}
                onChange={(e) => atualizar(i, { valor: parseFloat(e.target.value) || 0 })}
                placeholder="0,00"
                className="h-9 text-sm tabular-nums"
              />
            </div>
          </div>
        </div>
      ))}

      {itens.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2">
          <span className="text-xs text-muted-foreground">Soma dos itens</span>
          <span className="text-sm font-semibold text-amber-100 tabular-nums">{BRL(total)}</span>
        </div>
      )}
    </div>
  );
}
