import { Copy, Phone } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import type { PrestadorFinanceiro } from '@/hooks/usePontuaGarboFinanceiro';
import {
  formatTelefonePrestador,
  iniciaisNomeArquiteto,
  telefonePrestadorDigits,
  telefonePrestadorHref,
  tituloReconhecidoPontuaGarbo,
} from '@/lib/pontua-garbo-arquiteto';
import { finArquitetoSeal } from '@/components/financeiro/financeiro-styles';

interface ArquitetoContatoDialogProps {
  arquiteto: PrestadorFinanceiro | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArquitetoContatoDialog({
  arquiteto,
  open,
  onOpenChange,
}: ArquitetoContatoDialogProps) {
  const telefoneFormatado = formatTelefonePrestador(arquiteto?.telefone);
  const telefoneHref = telefonePrestadorHref(arquiteto?.telefone);
  const telefoneDigits = telefonePrestadorDigits(arquiteto?.telefone);
  const titulo = tituloReconhecidoPontuaGarbo(arquiteto?.titulo);

  const handleCopiarTelefone = async () => {
    if (!telefoneDigits) return;
    try {
      await navigator.clipboard.writeText(telefoneDigits);
      toast({ title: 'Telefone copiado' });
    } catch {
      toast({
        title: 'Não foi possível copiar',
        description: 'Copie o número manualmente.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-[rgba(26,16,12,0.14)] bg-[#fffaf4] text-[#1a100c] sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl italic text-[#1a100c]">
            Dados do prestador
          </DialogTitle>
          <DialogDescription className="text-[#4a3428]">
            Nome completo e telefone cadastrados no Pontua Garbo.
          </DialogDescription>
        </DialogHeader>

        {arquiteto && (
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <Avatar className="h-14 w-14 shrink-0 ring-2 ring-[rgba(107,63,18,0.28)]">
                {arquiteto.avatarUrl && <AvatarImage src={arquiteto.avatarUrl} alt="" />}
                <AvatarFallback className="bg-[#f4e4c4] font-display text-base text-[#6b3f12]">
                  {iniciaisNomeArquiteto(arquiteto.nome)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b3f12]">
                  Nome completo
                </p>
                <p className="break-words font-display text-2xl leading-tight text-[#1a100c]">
                  {arquiteto.nome}
                </p>
                <span className={finArquitetoSeal}>{titulo}</span>
              </div>
            </div>

            <div className="rounded-xl border border-[rgba(26,16,12,0.12)] bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b3f12]">
                Telefone
              </p>
              {telefoneFormatado && telefoneHref ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <a
                    href={telefoneHref}
                    className="font-display text-xl leading-tight text-[#1a100c] underline-offset-4 hover:underline"
                  >
                    {telefoneFormatado}
                  </a>
                  <div className="ml-auto flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 border-[rgba(107,63,18,0.35)] bg-transparent text-[#6b3f12] hover:bg-[#f4e4c4]"
                      onClick={handleCopiarTelefone}
                      aria-label="Copiar telefone"
                      title="Copiar telefone"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      className="h-9 w-9 bg-[#6b3f12] text-[#fffaf4] hover:bg-[#8d5e22]"
                      asChild
                    >
                      <a href={telefoneHref} aria-label="Ligar para o prestador" title="Ligar">
                        <Phone className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-[#6b5244]">Telefone não cadastrado</p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
