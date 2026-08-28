import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import type { Lancamento } from '@/hooks/usePontuaGarboFinanceiro';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { finRowBase, finTextSecondary, finTextTertiary } from '@/components/financeiro/financeiro-styles';

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface PrestadorLancamentosListProps {
  lancamentos: Lancamento[];
  onExcluir: (id: string) => void;
  isExcluindo: boolean;
  readOnly?: boolean;
}

export function PrestadorLancamentosList({
  lancamentos,
  onExcluir,
  isExcluindo,
  readOnly,
}: PrestadorLancamentosListProps) {
  const [excluirId, setExcluirId] = useState<string | null>(null);
  const alvo = lancamentos.find((l) => l.id === excluirId);

  if (lancamentos.length === 0) return null;

  return (
    <>
      <div className="border-t px-5 py-3 space-y-2">
        <p className={`text-xs font-medium ${finTextTertiary} uppercase tracking-wider`}>
          Movimentações (retiradas e ajustes)
        </p>
        {!readOnly && (
          <p className={`text-xs ${finTextSecondary}`}>
            Ao excluir, o valor volta para o saldo do prestador automaticamente.
          </p>
        )}
        <div className="space-y-2">
          {lancamentos.map((l) => (
            <div
              key={l.id}
              className={`flex items-center justify-between gap-3 px-3 py-2.5 text-sm ${finRowBase}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className={
                      l.tipo === 'ajuste'
                        ? 'text-sky-300 border-sky-500/40 bg-sky-500/10 text-[10px]'
                        : 'text-red-300 border-red-500/40 bg-red-500/10 text-[10px]'
                    }
                  >
                    {l.tipo === 'ajuste' ? 'Ajuste' : 'Retirada'}
                  </Badge>
                  <span className="font-semibold text-amber-400">{BRL(Number(l.valor))}</span>
                </div>
                {l.descricao && (
                  <p className={`${finTextSecondary} truncate text-xs mt-0.5`}>{l.descricao}</p>
                )}
                <p className={`${finTextTertiary} text-xs`}>
                  {new Date(l.criado_em).toLocaleString('pt-BR')}
                </p>
              </div>
              {!readOnly && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 border-red-500/40 text-red-300 hover:bg-red-500/15 shrink-0"
                  disabled={isExcluindo}
                  onClick={() => setExcluirId(l.id)}
                >
                  <Trash2 className="h-3 w-3" />
                  Excluir
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <AlertDialog open={!!excluirId} onOpenChange={(o) => !o && setExcluirId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir movimentação?</AlertDialogTitle>
            <AlertDialogDescription>
              {alvo && (
                <>
                  {alvo.tipo === 'ajuste' ? 'Ajuste' : 'Retirada'} de {BRL(Number(alvo.valor))}. O saldo
                  do prestador será recalculado.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={isExcluindo}
              onClick={() => {
                if (excluirId) {
                  onExcluir(excluirId);
                  setExcluirId(null);
                }
              }}
            >
              {isExcluindo && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
