import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DollarSign, Trophy } from 'lucide-react';
import {
  calcComissaoPontuaGarbo,
  formatComissaoPontuaGarbo,
} from '@/lib/pontua-garbo';
import type { LeadPontuaGarboSaleInfo } from '@/hooks/useLeadPontuaGarboSaleInfo';

interface SaleValueDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: number) => void;
  leadName: string;
  /** Valor do orçamento — pré-carregado no campo */
  budgetValue?: number;
  pontuaGarbo?: LeadPontuaGarboSaleInfo | null;
}

function formatCurrencyInput(val: string) {
  const numbers = val.replace(/\D/g, '');
  if (!numbers) return '';
  const numValue = parseInt(numbers, 10) / 100;
  return numValue.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseCurrencyInput(val: string): number {
  return parseFloat(val.replace(/[^\d,]/g, '').replace(',', '.'));
}

function formatInitialValue(amount: number): string {
  if (!amount || amount <= 0) return '';
  return amount.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function SaleValueDialog({
  isOpen,
  onClose,
  onConfirm,
  leadName,
  budgetValue = 0,
  pontuaGarbo = null,
}: SaleValueDialogProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [showPontuaConfirm, setShowPontuaConfirm] = useState(false);
  const [pendingValue, setPendingValue] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setValue(formatInitialValue(budgetValue));
    setError('');
    setShowPontuaConfirm(false);
    setPendingValue(null);
  }, [isOpen, budgetValue]);

  const resetAndClose = () => {
    setValue('');
    setError('');
    setShowPontuaConfirm(false);
    setPendingValue(null);
    onClose();
  };

  const valoresDiferem = (saleValue: number) =>
    budgetValue > 0 && Math.abs(saleValue - budgetValue) >= 0.01;

  const tryConfirm = (numValue: number) => {
    if (pontuaGarboAtivo && valoresDiferem(numValue)) {
      setPendingValue(numValue);
      setShowPontuaConfirm(true);
      return;
    }
    onConfirm(numValue);
    resetAndClose();
  };

  const handleConfirm = () => {
    const numValue = parseCurrencyInput(value);

    if (!value || Number.isNaN(numValue) || numValue <= 0) {
      setError('Digite um valor válido maior que R$ 0,00');
      return;
    }

    tryConfirm(numValue);
  };

  const handlePontuaConfirmOk = () => {
    if (pendingValue == null) return;
    onConfirm(pendingValue);
    resetAndClose();
  };

  const previewSale = parseCurrencyInput(value);
  const pontuaGarboAtivo = Boolean(pontuaGarbo && pontuaGarbo.percentual > 0);

  const previewComissao =
    pontuaGarboAtivo && previewSale > 0 && !Number.isNaN(previewSale)
      ? calcComissaoPontuaGarbo(previewSale, pontuaGarbo!.percentual)
      : null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && resetAndClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-success" />
              Registrar Valor da Venda
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Informe o valor da venda para o lead{' '}
              <span className="font-semibold text-foreground">{leadName}</span>
            </p>

            {budgetValue > 0 && (
              <p className="text-xs text-muted-foreground rounded-md border bg-muted/40 px-3 py-2">
                Orçamento do lead:{' '}
                <strong className="text-foreground">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(budgetValue)}
                </strong>
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="saleValue">Valor da Venda *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  R$
                </span>
                <Input
                  id="saleValue"
                  value={value}
                  onChange={(e) => {
                    setValue(formatCurrencyInput(e.target.value));
                    setError('');
                  }}
                  placeholder="0,00"
                  className="pl-10"
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            {pontuaGarboAtivo && previewComissao != null && previewSale > 0 && !Number.isNaN(previewSale) && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                  <Trophy className="h-3.5 w-3.5" />
                  Pontua Garbo — {pontuaGarbo.prestadorNome}
                </div>
                <p>
                  Comissão ({pontuaGarbo.percentual}% sobre o valor da venda):{' '}
                  <strong>{formatComissaoPontuaGarbo(previewSale, pontuaGarbo.percentual)}</strong>
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={resetAndClose}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleConfirm}>
              <DollarSign className="h-4 w-4 mr-2" />
              Confirmar Venda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showPontuaConfirm} onOpenChange={setShowPontuaConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-600" />
              Comissão do prestador alterada
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground pt-1">
                <p>
                  O valor da venda é diferente do orçamento. A comissão do Programa Pontua Garbo será
                  recalculada sobre o <strong className="text-foreground">valor da venda</strong>.
                </p>
                {pontuaGarboAtivo && pontuaGarbo && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950 space-y-2">
                    <p>
                      O prestador <strong>{pontuaGarbo.prestadorNome}</strong> iria receber{' '}
                      <strong>{formatComissaoPontuaGarbo(budgetValue, pontuaGarbo.percentual)}</strong>{' '}
                      ({pontuaGarbo.percentual}% sobre o orçamento).
                    </p>
                    <p>
                      Devido à alteração, o prestador irá receber{' '}
                      <strong className="text-amber-900">
                        {formatComissaoPontuaGarbo(pendingValue ?? 0, pontuaGarbo.percentual)}
                      </strong>{' '}
                      ({pontuaGarbo.percentual}% sobre{' '}
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                        pendingValue ?? 0,
                      )}
                      ).
                    </p>
                  </div>
                )}
                <p className="text-xs">
                  Ao confirmar, o valor será atualizado no sistema do prestador.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowPontuaConfirm(false)}>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handlePontuaConfirmOk}>OK, confirmar venda</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
