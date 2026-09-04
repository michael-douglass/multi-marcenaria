import { Loader2, Search, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArquitetosPontuaGarboMural } from '@/components/financeiro/ArquitetosPontuaGarboMural';
import { PrestadorFinanceiroRow } from '@/components/financeiro/PrestadorFinanceiroRow';
import type { PrestadorFinanceiro } from '@/hooks/usePontuaGarboFinanceiro';
import { finTextTertiary } from '@/components/financeiro/financeiro-styles';

interface ArquitetosPontuaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  arquitetos: PrestadorFinanceiro[];
  totalCadastrados: number;
  isLoading: boolean;
  busca: string;
  onBuscaChange: (value: string) => void;
  selecionadoId: string | null;
  onSelecionar: (id: string) => void;
  readOnly: boolean;
}

/**
 * Menu dos arquitetos do Pontua. As duas listas longas (mural e carteira)
 * vivem aqui para o painel de métricas ficar legível na primeira tela.
 */
export function ArquitetosPontuaDialog({
  open,
  onOpenChange,
  arquitetos,
  totalCadastrados,
  isLoading,
  busca,
  onBuscaChange,
  selecionadoId,
  onSelecionar,
  readOnly,
}: ArquitetosPontuaDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-w-6xl flex-col gap-0 border-[rgba(26,16,12,0.14)] bg-[#fffaf4] p-0">
        <DialogHeader className="shrink-0 space-y-3 border-b border-[rgba(26,16,12,0.10)] px-5 py-4 sm:px-7">
          <div className="flex flex-col gap-3 pr-8 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 font-display text-2xl text-[#1a100c] sm:text-3xl">
                <Users className="h-5 w-5 text-[#6b3f12]" aria-hidden />
                Arquitetos no Pontua
              </DialogTitle>
              <DialogDescription className="mt-1 text-[#4a3428]">
                {totalCadastrados} cadastrado{totalCadastrados === 1 ? '' : 's'} no programa.
                Veja o mural de reconhecimento ou a carteira com comissões e saldos.
              </DialogDescription>
            </div>

            <div className="w-full shrink-0 sm:max-w-xs">
              <Label htmlFor="busca-arquiteto-menu" className="sr-only">
                Buscar arquiteto pelo nome ou e-mail
              </Label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b3f12]"
                  aria-hidden
                />
                <Input
                  id="busca-arquiteto-menu"
                  value={busca}
                  onChange={(e) => onBuscaChange(e.target.value)}
                  placeholder="Buscar por nome ou e-mail"
                  className="border-[rgba(26,16,12,0.18)] bg-white pl-9 text-[#1a100c] placeholder:text-[#6b5244]"
                />
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="mural" className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 px-5 pt-4 sm:px-7">
            <TabsList className="bg-[#f4e4c4]/60">
              <TabsTrigger
                value="mural"
                className="data-[state=active]:bg-[#fffaf4] data-[state=active]:text-[#6b3f12]"
              >
                Mural
              </TabsTrigger>
              <TabsTrigger
                value="carteira"
                className="data-[state=active]:bg-[#fffaf4] data-[state=active]:text-[#6b3f12]"
              >
                Carteira
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="mural" className="mt-0 min-h-0 flex-1">
            <ScrollArea className="h-full px-5 py-4 sm:px-7">
              <ArquitetosPontuaGarboMural
                embedded
                arquitetos={arquitetos}
                totalCadastrados={totalCadastrados}
                isLoading={isLoading}
                busca={busca}
                onBuscaChange={onBuscaChange}
                selecionadoId={selecionadoId}
                onSelecionar={onSelecionar}
              />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="carteira" className="mt-0 min-h-0 flex-1">
            <ScrollArea className="h-full px-5 py-4 sm:px-7">
              {isLoading ? (
                <div className="flex items-center gap-2 py-10 text-sm text-[#4a3428]">
                  <Loader2 className="h-4 w-4 animate-spin text-[#6b3f12]" aria-hidden />
                  Carregando a carteira dos arquitetos…
                </div>
              ) : arquitetos.length === 0 ? (
                <p className={`py-10 text-center text-sm ${finTextTertiary}`}>
                  {totalCadastrados === 0
                    ? 'Nenhum arquiteto cadastrado no Pontua Garbo ainda.'
                    : 'Nenhum arquiteto corresponde à busca.'}
                </p>
              ) : (
                <div className="space-y-3 pb-2">
                  {arquitetos.map((p) => (
                    <PrestadorFinanceiroRow
                      key={p.id}
                      prestador={p}
                      highlighted={selecionadoId === p.id}
                      readOnly={readOnly}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
