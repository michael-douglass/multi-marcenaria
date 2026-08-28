import { useRef, useState } from 'react';
import { ImageDown, Loader2, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  baixarArteSaldoReceberJpg,
  fileSafeArteName,
  type SaldoReceberArteOpts,
} from '@/lib/saldo-receber-arte-print';

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface SaldoReceberArteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opts: SaldoReceberArteOpts | null;
}

export function SaldoReceberArteDialog({
  open,
  onOpenChange,
  opts,
}: SaldoReceberArteDialogProps) {
  const arteRef = useRef<HTMLDivElement>(null);
  const [baixando, setBaixando] = useState(false);

  if (!opts) return null;

  const nomeDisplay = opts.nomeEmpresa?.trim() || 'Empresa';
  const razaoDisplay = opts.razaoSocial?.trim() || nomeDisplay;
  const valorFormatado = BRL(opts.valorSaldo);
  const dataEmissao = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const handleBaixar = async () => {
    const el = arteRef.current;
    if (!el) {
      toast.error('Prévia ainda não carregou. Feche e abra de novo.');
      return;
    }

    setBaixando(true);
    try {
      await baixarArteSaldoReceberJpg(
        el,
        `saldo-receber-${fileSafeArteName(opts.prestadorNome)}.jpg`,
        opts.logoUrl,
      );
      toast.success('Imagem baixada');
    } catch (err) {
      console.error('[saldo-receber-arte]', err);
      toast.error('Não foi possível gerar a imagem. Tente novamente.');
    } finally {
      setBaixando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px] gap-0 overflow-hidden border-amber-800/40 bg-[#0c0a08] p-0 text-foreground sm:rounded-xl">
        <DialogHeader className="space-y-1 border-b border-amber-900/40 px-5 py-4 text-left pr-12">
          <DialogTitle className="font-display text-lg text-amber-50">
            Prévia da imagem
          </DialogTitle>
          <DialogDescription className="text-amber-200/60">
            Confira a arte abaixo. Se estiver ok, clique em Baixar imagem.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[min(70vh,640px)] overflow-y-auto bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,#3a2f1a_0%,transparent_55%),#0c0a08] px-4 py-6 sm:px-8">
          <div
            ref={arteRef}
            className="saldo-arte-preview relative mx-auto w-full max-w-[560px] overflow-hidden rounded-sm shadow-[0_0_0_1px_rgba(201,162,39,0.35),0_24px_64px_rgba(0,0,0,0.55)] motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-500"
            style={{
              fontFamily: "'Raleway', 'DM Sans', system-ui, sans-serif",
              color: '#14100a',
              backgroundColor: '#e8d9b8',
            }}
          >
            {/* Fundo — papel mais encorpado para o JPG não sair lavado */}
            <div
              data-arte-bg
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(201,162,39,0.38) 0%, transparent 55%), radial-gradient(ellipse 40% 35% at 90% 85%, rgba(31,107,69,0.16) 0%, transparent 50%), linear-gradient(165deg, #f3e6c8 0%, #e4d0a4 45%, #d4bc7a 100%)',
              }}
            />
            <div
              data-arte-grain
              className="pointer-events-none absolute inset-0 opacity-[0.05]"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
              }}
            />

            {/* Moldura */}
            <div className="pointer-events-none absolute inset-2.5 z-[3] rounded-sm border-2 border-[rgba(138,107,20,0.65)]" />
            <div className="pointer-events-none absolute left-2.5 top-2.5 z-[4] h-[18px] w-[18px] border-l-[3px] border-t-[3px] border-[#8a6b14]" />
            <div className="pointer-events-none absolute bottom-2.5 right-2.5 z-[4] h-[18px] w-[18px] border-b-[3px] border-r-[3px] border-[#8a6b14]" />
            <div className="pointer-events-none absolute right-2.5 top-2.5 z-[4] h-[18px] w-[18px] border-r-[3px] border-t-[3px] border-[#8a6b14]" />
            <div className="pointer-events-none absolute bottom-2.5 left-2.5 z-[4] h-[18px] w-[18px] border-b-[3px] border-l-[3px] border-[#8a6b14]" />

            <div className="relative z-[2] px-8 py-10 text-center sm:px-11 sm:py-12">
              <p
                className="mb-4 text-[10px] font-semibold uppercase tracking-[0.28em]"
                style={{ color: '#6b5210' }}
              >
                Comunicado oficial
              </p>

              <div
                className="mx-auto mb-5 h-[2px] w-[120px]"
                style={{
                  background: 'linear-gradient(90deg, transparent, #8a6b14, transparent)',
                }}
              />

              <h2
                className="mb-5 text-[1.75rem] font-semibold italic leading-tight tracking-wide sm:text-[2rem]"
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  color: '#14100a',
                }}
              >
                {opts.prestadorNome}
              </h2>

              <p
                className="mx-auto max-w-[380px] text-[15px] leading-relaxed"
                style={{ color: '#3a3228' }}
              >
                Olá, você tem a seguinte quantia a retirar no{' '}
                <strong className="font-semibold" style={{ color: '#6b5210' }}>
                  Pontua Garbo
                </strong>
                :
              </p>

              <div className="relative mx-auto my-6 inline-block px-9 py-4">
                <div
                  className="absolute inset-x-0 top-0 h-[2px]"
                  style={{
                    background: 'linear-gradient(90deg, transparent, #8a6b14, transparent)',
                  }}
                />
                <div
                  className="absolute inset-x-0 bottom-0 h-[2px]"
                  style={{
                    background: 'linear-gradient(90deg, transparent, #8a6b14, transparent)',
                  }}
                />
                <p
                  className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.22em]"
                  style={{ color: '#6b5210' }}
                >
                  Valor disponível
                </p>
                <p
                  data-arte-valor
                  className="text-4xl font-bold leading-none sm:text-5xl"
                  style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    color: '#145c38',
                  }}
                >
                  {valorFormatado}
                </p>
              </div>

              <p className="text-[13px] font-medium" style={{ color: '#3f372c' }}>
                Retire seu saldo no programa{' '}
                <strong className="font-semibold" style={{ color: '#6b5210' }}>
                  Pontua Garbo
                </strong>
              </p>

              <div
                className="mx-auto mt-7 h-[2px] w-[120px]"
                style={{
                  background: 'linear-gradient(90deg, transparent, #8a6b14, transparent)',
                }}
              />

              {/* Timbre */}
              <div className="mt-9 flex flex-col items-center gap-2.5">
                <div
                  className="flex h-[112px] w-[112px] -rotate-6 flex-col items-center justify-center gap-1 rounded-full border-[3px] border-double border-[rgba(61,46,8,0.7)] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_6px_18px_rgba(90,64,10,0.35),0_0_0_4px_rgba(232,217,184,0.95),0_0_0_5px_rgba(138,107,20,0.55)]"
                  style={{
                    background:
                      'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.35) 0%, transparent 45%), linear-gradient(145deg, #e4d090 0%, #c9a227 48%, #8a6b14 100%)',
                  }}
                  title="Timbre da empresa"
                >
                  {opts.logoUrl ? (
                    <img
                      data-arte-logo
                      src={opts.logoUrl}
                      alt=""
                      className="max-h-[42px] max-w-[72px] object-contain"
                    />
                  ) : null}
                  <span
                    className="max-w-[88px] text-center text-[8px] font-bold uppercase leading-tight tracking-wide"
                    style={{ wordBreak: 'break-word', color: '#2a1f06' }}
                  >
                    {nomeDisplay}
                  </span>
                </div>
                <p
                  className="text-[9px] font-semibold uppercase tracking-[0.16em]"
                  style={{ color: '#5c4e38' }}
                >
                  Timbre · {nomeDisplay}
                </p>
              </div>

              <p className="mt-4 text-[10px] leading-relaxed" style={{ color: '#5c5346' }}>
                {razaoDisplay}
                {opts.cnpj ? ` · CNPJ ${opts.cnpj}` : ''}
                <br />
                Emitido em {dataEmissao}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row justify-end gap-2 border-t border-amber-900/40 bg-[#12100c] px-5 py-4 sm:space-x-0">
          <Button
            type="button"
            variant="outline"
            className="border-amber-800/50 text-amber-100/80 hover:bg-amber-500/10"
            onClick={() => onOpenChange(false)}
            disabled={baixando}
          >
            <X className="mr-1.5 h-3.5 w-3.5" />
            Fechar
          </Button>
          <Button
            type="button"
            className="gap-1.5 bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 text-[#1a1510] hover:from-amber-200 hover:via-amber-400 hover:to-amber-600 motion-safe:transition-transform motion-safe:active:scale-[0.97]"
            onClick={() => void handleBaixar()}
            disabled={baixando}
          >
            {baixando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImageDown className="h-4 w-4" />
            )}
            {baixando ? 'Gerando…' : 'Baixar imagem'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
