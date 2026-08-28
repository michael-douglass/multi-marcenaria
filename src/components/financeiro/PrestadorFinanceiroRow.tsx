import { useEffect, useState } from 'react';
import { usePontuaGarboFinanceiro, type PrestadorFinanceiro } from '@/hooks/usePontuaGarboFinanceiro';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Loader2,
  ArrowDownToLine,
  Check,
  Sparkles,
  Undo2,
  ImageDown,
} from 'lucide-react';
import { PrestadorLancamentosList } from '@/components/financeiro/PrestadorLancamentosList';
import { COMISSAO_LIBERACAO_LABEL_AGUARDANDO } from '@/lib/pontua-garbo-comissao-liberacao';
import {
  useLiberarComissaoPontuaGarbo,
  useReverterComissaoLiberacao,
  type LiberarComissaoInput,
} from '@/hooks/usePontuaGarboComissaoLiberacao';
import type { ComissaoLead } from '@/hooks/usePontuaGarboFinanceiro';
import { validarValorSaquePontuaGarbo } from '@/lib/pontua-garbo-saque';
import type { SaldoReceberArteOpts } from '@/lib/saldo-receber-arte-print';
import { SaldoReceberArteDialog } from '@/components/financeiro/SaldoReceberArteDialog';
import {
  formatBRLPontua,
  iniciaisNomeArquiteto,
  tituloReconhecidoPontuaGarbo,
} from '@/lib/pontua-garbo-arquiteto';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  finArquitetoSeal,
  finCardMuted,
  finRowBase,
  finRowHighlight,
  finTextSecondary,
  finTextTertiary,
  finBadgePendente,
} from '@/components/financeiro/financeiro-styles';

type DialogMode = { type: 'saque' | 'ajuste'; prestador: PrestadorFinanceiro } | null;

function LancamentoDialog({
  mode,
  onClose,
  onConfirm,
  isPending,
}: {
  mode: DialogMode;
  onClose: () => void;
  onConfirm: (valor: number, descricao: string) => void;
  isPending: boolean;
}) {
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');

  if (!mode) return null;

  const isSaque = mode.type === 'saque';
  const title = isSaque ? 'Registrar Retirada' : 'Registrar Ajuste';
  const placeholder = isSaque
    ? 'Ex: Pagamento referente ao mês de junho'
    : 'Ex: Correção de comissão (+) ou desconto (-)';

  const handleConfirm = () => {
    const n = parseFloat(valor.replace(',', '.'));
    if (!isFinite(n) || n === 0) return;
    onConfirm(isSaque ? Math.abs(n) : n, descricao);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isSaque ? <ArrowDownToLine className="h-4 w-4 text-red-500" /> : <Plus className="h-4 w-4 text-blue-500" />}
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="rounded-lg border border-amber-800/40 bg-background/50 px-4 py-3">
            <p className="text-sm font-medium text-foreground">{mode.prestador.nome}</p>
            <p className={finTextTertiary}>{tituloReconhecidoPontuaGarbo(mode.prestador.titulo)}</p>
          </div>

          <div className="space-y-1.5">
            <Label>
              {isSaque ? 'Valor retirado (R$)' : 'Valor do ajuste (R$)'}
            </Label>
            <Input
              type="number"
              step="0.01"
              placeholder={isSaque ? '0,00' : '+100,00 ou -50,00'}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
            {!isSaque && (
              <p className={finTextTertiary}>
                Use valor positivo para adicionar ao saldo ou negativo para descontar.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Descrição (opcional)</Label>
            <Textarea
              rows={2}
              placeholder={placeholder}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button
              onClick={handleConfirm}
              disabled={isPending || !valor}
              variant={isSaque ? 'destructive' : 'default'}
            >
              {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LeadComissaoRow({
  lead,
  prestadorId,
  onLiberar,
  isLiberando,
  onReverterLiberacao,
  isRevertendo,
  readOnly,
}: {
  lead: ComissaoLead;
  prestadorId: string;
  onLiberar: (input: LiberarComissaoInput) => void;
  isLiberando: boolean;
  onReverterLiberacao: (input: { liberacaoId: string; leadId: number; fieldId: string }) => void;
  isRevertendo: boolean;
  readOnly?: boolean;
}) {
  const aguardando = lead.comissaoAguardandoLiberacao;
  return (
    <div
      className={`flex items-center justify-between gap-3 px-3 py-2.5 text-sm ${
        aguardando ? finRowHighlight : finRowBase
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium">{lead.leadNome}</p>
          {aguardando && (
            <Badge variant="outline" className={`shrink-0 ${finBadgePendente}`}>
              <Sparkles className="mr-0.5 h-3 w-3" />
              {COMISSAO_LIBERACAO_LABEL_AGUARDANDO}
            </Badge>
          )}
          {lead.comissaoLiberada && (
            <Badge
              variant="outline"
              className="shrink-0 border-green-500/50 bg-green-500/15 text-[10px] text-green-300"
            >
              Comissão liberada
            </Badge>
          )}
        </div>
        <p className={`${finTextSecondary} truncate`}>
          {lead.fieldNome} · {lead.leadStatus}
          {lead.vendaGanha && !aguardando && !lead.comissaoLiberada && (
            <span className="font-medium text-green-400"> · Venda ganha</span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="text-right">
          <p className={finTextTertiary}>
            {formatBRLPontua(lead.valorOrcamento)} × {lead.percentual}%
          </p>
          <p className="font-semibold text-amber-400">{formatBRLPontua(lead.comissao)}</p>
        </div>
        {!readOnly && aguardando && (
          <Button
            size="sm"
            className="h-8 gap-1 bg-amber-600 text-xs text-white hover:bg-amber-700"
            disabled={isLiberando}
            onClick={() =>
              onLiberar({
                liberacaoId: lead.liberacaoId ?? null,
                leadId: lead.leadId,
                fieldId: lead.fieldId,
                prestadorId,
                valorComissao: lead.comissao,
                percentual: lead.percentual,
                valorBase: lead.valorOrcamento,
              })
            }
          >
            <Check className="h-3 w-3" />
            Liberar
          </Button>
        )}
        {!readOnly && lead.comissaoLiberada && lead.liberacaoId && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 border-amber-500/45 text-xs text-amber-200 hover:bg-amber-500/15"
            disabled={isRevertendo}
            onClick={() =>
              onReverterLiberacao({
                liberacaoId: lead.liberacaoId!,
                leadId: lead.leadId,
                fieldId: lead.fieldId,
              })
            }
          >
            <Undo2 className="h-3 w-3" />
            Desfazer
          </Button>
        )}
      </div>
    </div>
  );
}

interface PrestadorFinanceiroRowProps {
  prestador: PrestadorFinanceiro;
  highlighted: boolean;
  readOnly?: boolean;
}

export function PrestadorFinanceiroRow({ prestador, highlighted, readOnly }: PrestadorFinanceiroRowProps) {
  const [open, setOpen] = useState(false);
  const { createLancamento, deleteLancamento } = usePontuaGarboFinanceiro();
  const liberar = useLiberarComissaoPontuaGarbo();
  const reverterLiberacao = useReverterComissaoLiberacao();
  const { empresa } = useEmpresa();
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [arteOpts, setArteOpts] = useState<SaldoReceberArteOpts | null>(null);

  const temSaldoAReceber = prestador.saldoParaSacar > 0;
  const titulo = tituloReconhecidoPontuaGarbo(prestador.titulo);

  useEffect(() => {
    if (highlighted) setOpen(true);
  }, [highlighted]);

  const handleConfirm = (valor: number, descricao: string) => {
    if (!dialogMode) return;
    if (dialogMode.type === 'saque') {
      const check = validarValorSaquePontuaGarbo(prestador.saldoParaSacar, valor);
      if (!check.ok) {
        toast.error(check.message);
        return;
      }
    }
    createLancamento.mutate(
      { prestadorId: prestador.id, tipo: dialogMode.type, valor, descricao },
      { onSuccess: () => setDialogMode(null) },
    );
  };

  const handleAbrirPreviaArte = () => {
    setArteOpts({
      prestadorNome: prestador.nome,
      valorSaldo: prestador.saldoParaSacar,
      logoUrl: empresa?.logo_url,
      nomeEmpresa: empresa?.nome,
      razaoSocial: empresa?.razao_social,
      cnpj: empresa?.cnpj,
    });
  };

  return (
    <>
      <LancamentoDialog
        mode={dialogMode}
        onClose={() => setDialogMode(null)}
        onConfirm={handleConfirm}
        isPending={createLancamento.isPending}
      />

      <SaldoReceberArteDialog
        open={arteOpts !== null}
        onOpenChange={(next) => {
          if (!next) setArteOpts(null);
        }}
        opts={arteOpts}
      />

      <Collapsible open={open} onOpenChange={setOpen}>
        <div
          id={`arquiteto-${prestador.id}`}
          className={cn(
            'scroll-mt-24 rounded-xl border bg-card transition-colors hover:bg-background/40',
            highlighted
              ? 'border-[#f2d892]/70 ring-1 ring-[#f2d892]/30'
              : 'border-amber-900/50',
          )}
        >
          <CollapsibleTrigger asChild>
            <div className="flex cursor-pointer select-none items-center gap-4 px-5 py-4">
              <Avatar className="hidden h-10 w-10 shrink-0 ring-1 ring-[#f2d892]/35 sm:flex">
                {prestador.avatarUrl && <AvatarImage src={prestador.avatarUrl} alt="" />}
                <AvatarFallback className="bg-[#3d2418] text-xs text-[#f2d892]">
                  {iniciaisNomeArquiteto(prestador.nome)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-display text-base font-semibold">{prestador.nome}</span>
                  <span className={finArquitetoSeal}>{titulo}</span>
                  <span className={`shrink-0 text-xs ${finTextTertiary}`}>
                    {prestador.leads.length} lead{prestador.leads.length !== 1 ? 's' : ''}
                  </span>
                  {prestador.totalAguardandoLiberacao > 0 && (
                    <Badge className="shrink-0 bg-amber-500 text-[10px] text-white">
                      {formatBRLPontua(prestador.totalAguardandoLiberacao)} a liberar
                    </Badge>
                  )}
                </div>
                {prestador.email && (
                  <p className={`mt-0.5 truncate ${finTextTertiary}`}>{prestador.email}</p>
                )}
              </div>

              <div className="hidden shrink-0 items-center gap-6 text-right sm:flex">
                <div>
                  <p className={finTextTertiary}>Comissão</p>
                  <p className="text-sm font-medium text-amber-400">{formatBRLPontua(prestador.totalComissao)}</p>
                </div>
                {prestador.totalAjustes !== 0 && (
                  <div>
                    <p className={finTextTertiary}>Ajustes</p>
                    <p className={`text-sm font-medium ${prestador.totalAjustes >= 0 ? 'text-sky-400' : 'text-orange-400'}`}>
                      {prestador.totalAjustes >= 0 ? '+' : ''}{formatBRLPontua(prestador.totalAjustes)}
                    </p>
                  </div>
                )}
                <div>
                  <p className={finTextTertiary}>Retirado</p>
                  <p className="text-sm font-medium text-amber-200/70">{formatBRLPontua(prestador.totalRetirado)}</p>
                </div>
                <div>
                  <p className={finTextTertiary}>Saldo</p>
                  <p className={`text-sm font-bold ${temSaldoAReceber ? 'text-green-400' : 'text-amber-200/60'}`}>
                    {formatBRLPontua(prestador.saldoParaSacar)}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {temSaldoAReceber && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 border-green-500/45 text-xs text-green-300 motion-safe:transition-transform motion-safe:active:scale-[0.96] hover:bg-green-500/15 hover:text-green-100"
                    onClick={handleAbrirPreviaArte}
                    title="Ver prévia e baixar arte do saldo"
                  >
                    <ImageDown className="h-3 w-3" />
                    <span className="hidden md:inline">Baixar imagem</span>
                  </Button>
                )}
                {!readOnly && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 border-amber-500/45 text-xs text-amber-200 hover:bg-amber-500/15 hover:text-amber-50"
                    onClick={() => setDialogMode({ type: 'ajuste', prestador })}
                  >
                    <Plus className="h-3 w-3" />
                    Ajuste
                  </Button>
                )}
                {!readOnly && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 border-red-500/40 text-xs text-red-300 hover:bg-red-500/15"
                    onClick={() => setDialogMode({ type: 'saque', prestador })}
                    disabled={!temSaldoAReceber}
                  >
                    <ArrowDownToLine className="h-3 w-3" />
                    Retirada
                  </Button>
                )}
                {open ? (
                  <ChevronDown className="h-4 w-4 text-amber-300/70" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-amber-300/70" />
                )}
              </div>
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="flex gap-4 border-t border-amber-900/40 px-5 py-2 text-sm sm:hidden">
              <div>
                <span className={finTextTertiary}>Comissão: </span>
                <span className="font-medium text-amber-400">{formatBRLPontua(prestador.totalComissao)}</span>
              </div>
              <div>
                <span className={finTextTertiary}>Retirado: </span>
                <span className="text-amber-100">{formatBRLPontua(prestador.totalRetirado)}</span>
              </div>
              <div>
                <span className={finTextTertiary}>Saldo: </span>
                <span className="font-bold text-green-400">{formatBRLPontua(prestador.saldoParaSacar)}</span>
              </div>
            </div>

            <div className="space-y-2 border-t px-5 py-3">
              <p className={`mb-3 text-xs font-medium uppercase tracking-wider ${finTextTertiary}`}>
                Detalhamento por lead
              </p>
              {prestador.leads.length === 0 ? (
                <p className={`text-sm ${finCardMuted}`}>Nenhum lead ativo.</p>
              ) : (
                <div className="space-y-2">
                  {prestador.leads.map((lead) => (
                    <LeadComissaoRow
                      key={`${lead.leadId}-${lead.fieldId}`}
                      lead={lead}
                      prestadorId={prestador.id}
                      onLiberar={(input) => liberar.mutate(input)}
                      isLiberando={liberar.isPending}
                      onReverterLiberacao={(input) => reverterLiberacao.mutate(input)}
                      isRevertendo={reverterLiberacao.isPending}
                      readOnly={readOnly}
                    />
                  ))}
                </div>
              )}
            </div>

            <PrestadorLancamentosList
              lancamentos={prestador.lancamentos}
              onExcluir={(id) => deleteLancamento.mutate(id)}
              isExcluindo={deleteLancamento.isPending}
              readOnly={readOnly}
            />
          </CollapsibleContent>
        </div>
      </Collapsible>
    </>
  );
}
