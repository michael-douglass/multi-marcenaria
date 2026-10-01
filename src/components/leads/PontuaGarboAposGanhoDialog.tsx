import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trophy } from 'lucide-react';
import {
  calcComissaoPontuaGarbo,
  formatComissaoPontuaGarbo,
  parsePontuaPercentualInput,
  PONTUA_GARBO_PERCENTUAL_PADRAO,
} from '@/lib/pontua-garbo';

interface PontuaGarboAposGanhoDialogProps {
  open: boolean;
  partnerName: string;
  /** Valor já fechado da venda (ou orçamento, se a venda não tiver valor). */
  baseValue: number;
  /** % sugerido ao abrir (padrão do campo). */
  suggestedPercentual?: number;
  onConfirm: (percentual: number) => void;
  onCancel: () => void;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Quando o lead já está ganho e alguém vincula um parceiro Pontua Garbo,
 * pergunta quanto (%) pontuar antes de gravar.
 */
export function PontuaGarboAposGanhoDialog({
  open,
  partnerName,
  baseValue,
  suggestedPercentual = PONTUA_GARBO_PERCENTUAL_PADRAO,
  onConfirm,
  onCancel,
}: PontuaGarboAposGanhoDialogProps) {
  const [percentualInput, setPercentualInput] = useState(String(suggestedPercentual));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setPercentualInput(String(suggestedPercentual));
    setError('');
  }, [open, suggestedPercentual]);

  const percentual = parsePontuaPercentualInput(percentualInput);
  const previewComissao =
    baseValue > 0 && percentual > 0
      ? calcComissaoPontuaGarbo(baseValue, percentual)
      : null;

  const handleConfirm = () => {
    if (!percentualInput.trim() || Number.isNaN(parseFloat(percentualInput.replace(',', '.')))) {
      setError('Informe um percentual válido (0 a 100).');
      return;
    }
    if (percentual <= 0) {
      setError('A pontuação precisa ser maior que 0%.');
      return;
    }
    onConfirm(percentual);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md" data-pontua-garbo-dialog="">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-600" />
            Pontuar parceiro
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-1 pt-1 text-sm text-muted-foreground">
              <p>
                Este orçamento já está <strong className="text-foreground">ganho</strong>.
                Quanto você quer pontuar{' '}
                <strong className="text-foreground">{partnerName}</strong>?
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {baseValue > 0 && (
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Base da comissão:{' '}
              <strong className="text-foreground">{formatCurrency(baseValue)}</strong>
              {' '}(valor da venda / orçamento ganho)
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="pontua-apos-ganho-pct">Percentual de pontuação *</Label>
            <div className="flex items-center gap-2">
              <Input
                id="pontua-apos-ganho-pct"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={percentualInput}
                onChange={(e) => {
                  setPercentualInput(e.target.value);
                  setError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirm();
                  }
                }}
                className="w-28"
                autoFocus
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          {previewComissao != null && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                <Trophy className="h-3.5 w-3.5" />
                Comissão estimada
              </div>
              <p>
                {percentual}% sobre {formatCurrency(baseValue)}:{' '}
                <strong>{formatComissaoPontuaGarbo(baseValue, percentual)}</strong>
              </p>
              <p className="text-amber-800/90">
                Ao confirmar, a comissão entra em{' '}
                <strong>aguardando liberação</strong> no Financeiro e o custo vai para{' '}
                <strong>Contas a Pagar</strong> como{' '}
                <strong>{partnerName} — Pontua Garbo</strong>.
              </p>
            </div>
          )}

          {baseValue <= 0 && (
            <p className="text-xs text-muted-foreground">
              Não há valor de venda/orçamento neste card. A pontuação (%) será salva;
              a comissão em R$ aparece quando o valor estiver preenchido.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm}>
            <Trophy className="mr-2 h-4 w-4" />
            Confirmar pontuação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
