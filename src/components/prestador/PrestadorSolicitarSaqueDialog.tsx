import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TIPO_PIX_LABELS, useSalvarChavePixPrestador, type TipoChavePix } from '@/hooks/usePrestadorPerfil';
import { chavePixIgualPerfil } from '@/lib/prestador-pix-perfil';
import { parseValorMonetarioBr, validarValorSaquePontuaGarbo } from '@/lib/pontua-garbo-saque';
import { toast } from 'sonner';

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

/** Aguarda o usuário parar de digitar antes de salvar a chave PIX no perfil. */
const PIX_SAVE_DEBOUNCE_MS = 700;

interface PrestadorSolicitarSaqueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saldoDisponivel: number;
  isPending?: boolean;
  defaultChavePix?: string | null;
  defaultTipoChavePix?: string | null;
  onConfirm: (input: { valor: number; chave_pix: string; tipo_chave_pix: string }) => void;
}

export function PrestadorSolicitarSaqueDialog({
  open,
  onOpenChange,
  saldoDisponivel,
  isPending = false,
  defaultChavePix,
  defaultTipoChavePix,
  onConfirm,
}: PrestadorSolicitarSaqueDialogProps) {
  const [valor, setValor] = useState('');
  const [chavePix, setChavePix] = useState('');
  const [tipoChave, setTipoChave] = useState<TipoChavePix>('cpf');
  const [pixSalvaNoPerfil, setPixSalvaNoPerfil] = useState(false);
  const salvarChavePix = useSalvarChavePixPrestador();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ultimaPixSalvaRef = useRef<{ chave: string; tipo: TipoChavePix } | null>(null);

  useEffect(() => {
    if (!open) return;
    setValor('');
    setChavePix(defaultChavePix ?? '');
    setTipoChave((defaultTipoChavePix ?? 'cpf') as TipoChavePix);
    const chaveInicial = (defaultChavePix ?? '').trim();
    const tipoInicial = (defaultTipoChavePix ?? 'cpf') as TipoChavePix;
    ultimaPixSalvaRef.current = chaveInicial
      ? { chave: chaveInicial, tipo: tipoInicial }
      : null;
    setPixSalvaNoPerfil(!!chaveInicial);
  }, [open, defaultChavePix, defaultTipoChavePix]);

  const pixJaPersistida = useCallback(
    (chave: string, tipo: TipoChavePix) => {
      const trimmed = chave.trim();
      if (!trimmed) return false;
      const ultima = ultimaPixSalvaRef.current;
      if (ultima && ultima.chave === trimmed && ultima.tipo === tipo) return true;
      return chavePixIgualPerfil(trimmed, tipo, defaultChavePix, defaultTipoChavePix);
    },
    [defaultChavePix, defaultTipoChavePix],
  );

  const persistirPixNoPerfil = useCallback(
    async (opts?: { silencioso?: boolean }) => {
      const trimmed = chavePix.trim();
      if (!trimmed) return;
      if (pixJaPersistida(trimmed, tipoChave)) {
        setPixSalvaNoPerfil(true);
        return;
      }
      await salvarChavePix.mutateAsync({
        chave_pix: trimmed,
        tipo_chave_pix: tipoChave,
      });
      ultimaPixSalvaRef.current = { chave: trimmed, tipo: tipoChave };
      setPixSalvaNoPerfil(true);
      if (!opts?.silencioso) {
        toast.success('Chave PIX salva no seu perfil');
      }
    },
    [chavePix, tipoChave, pixJaPersistida, salvarChavePix],
  );

  useEffect(() => {
    if (!open) return;
    const trimmed = chavePix.trim();
    if (!trimmed) {
      setPixSalvaNoPerfil(false);
      return;
    }
    if (pixJaPersistida(trimmed, tipoChave)) {
      setPixSalvaNoPerfil(true);
      return;
    }

    setPixSalvaNoPerfil(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      persistirPixNoPerfil({ silencioso: true }).catch(() => {
        toast.error('Não foi possível salvar a chave PIX no perfil');
      });
    }, PIX_SAVE_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [chavePix, tipoChave, open, pixJaPersistida, persistirPixNoPerfil]);

  const handleChavePixBlur = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    persistirPixNoPerfil({ silencioso: true }).catch(() => {
      toast.error('Não foi possível salvar a chave PIX no perfil');
    });
  };

  const handleConfirm = async () => {
    const v = parseValorMonetarioBr(valor);
    if (v === null) {
      toast.error('Informe um valor válido');
      return;
    }
    if (!chavePix.trim()) {
      toast.error('Informe a chave PIX');
      return;
    }
    const check = validarValorSaquePontuaGarbo(saldoDisponivel, v);
    if (!check.ok) {
      toast.error(check.message);
      return;
    }
    try {
      await persistirPixNoPerfil({ silencioso: true });
      onConfirm({ valor: v, chave_pix: chavePix.trim(), tipo_chave_pix: tipoChave });
    } catch {
      toast.error('Não foi possível salvar a chave PIX no perfil');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wide text-foreground">
            Solicitar saque
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Disponível para sacar agora:{' '}
            <span className="font-semibold text-emerald-700">{BRL(saldoDisponivel)}</span>. O
            administrador precisa liberar o pagamento; até lá o valor fica reservado e some dos
            cards.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label className="text-foreground/80">Valor (R$)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder={`Até ${BRL(saldoDisponivel)}`}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-foreground/80">Chave PIX</Label>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Ao digitar, salvamos no seu perfil para reutilizar nos próximos saques.
            </p>
            <div className="flex gap-2">
              <Select
                value={tipoChave}
                onValueChange={(v) => {
                  setTipoChave(v as TipoChavePix);
                  setPixSalvaNoPerfil(false);
                }}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(TIPO_PIX_LABELS) as [TipoChavePix, string][]).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={chavePix}
                onChange={(e) => {
                  setChavePix(e.target.value);
                  setPixSalvaNoPerfil(false);
                }}
                onBlur={handleChavePixBlur}
                placeholder="Sua chave PIX"
                className="flex-1"
                required
              />
            </div>
            {(salvarChavePix.isPending || pixSalvaNoPerfil) && chavePix.trim() && (
              <p className="text-[11px] flex items-center gap-1 text-muted-foreground">
                {salvarChavePix.isPending ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Salvando no perfil…
                  </>
                ) : (
                  <>
                    <Check className="h-3 w-3 text-emerald-600" />
                    Chave salva no perfil
                  </>
                )}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isPending || salvarChavePix.isPending || saldoDisponivel <= 0}
            className="bg-emerald-700 text-white hover:bg-emerald-800"
          >
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar saque
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
