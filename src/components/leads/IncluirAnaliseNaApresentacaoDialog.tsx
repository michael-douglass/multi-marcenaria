import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, Presentation, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOrcamentosPorLead, useOrcamentoSlides } from '@/hooks/useOrcamentoSlides';
import { useOrcamentoSlideTemplate } from '@/hooks/useOrcamentoSlideTemplate';
import { useOrcamentoSlideBlocos } from '@/hooks/useOrcamentoSlideBlocos';
import { inserirRelatorioAnaliseIa } from '@/lib/orcamento-slide-analise-ia';
import { normalizarRelatorioAnaliseIa } from '@/lib/lead-ai-relatorio-markdown';
import { withOrcamentoReturnTo } from '@/lib/orcamento-slide-navigation';

interface IncluirAnaliseNaApresentacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: number;
  relatorio: string;
  returnTo?: string;
}

export function IncluirAnaliseNaApresentacaoDialog({
  open,
  onOpenChange,
  leadId,
  relatorio,
  returnTo,
}: IncluirAnaliseNaApresentacaoDialogProps) {
  const navigate = useNavigate();
  const { data: orcamentos = [], isLoading: loadingOrcamentos } = useOrcamentosPorLead(leadId);
  const { template } = useOrcamentoSlideTemplate();
  const { blocos, isLoading: loadingBlocos } = useOrcamentoSlideBlocos(template?.id);
  const { salvarOrcamento } = useOrcamentoSlides();

  const blocosAnalise = useMemo(
    () => blocos.filter((b) => b.tipo === 'analise_ia' && b.ativo),
    [blocos],
  );

  const [orcamentoId, setOrcamentoId] = useState('');
  const [blocoId, setBlocoId] = useState('');

  useEffect(() => {
    if (blocosAnalise.length === 1) setBlocoId(blocosAnalise[0].id);
  }, [blocosAnalise]);

  const orcamentoSelecionado = orcamentos.find((o) => o.id === orcamentoId);

  const handleConfirm = async () => {
    if (!relatorio.trim()) {
      toast.error('Não há relatório para enviar');
      return;
    }
    if (!orcamentoSelecionado) {
      toast.error('Selecione um orçamento');
      return;
    }
    const targetBlocoId = blocoId || blocosAnalise[0]?.id;
    if (!targetBlocoId) {
      toast.error('Selecione o bloco de análise');
      return;
    }

    try {
      const novosDados = inserirRelatorioAnaliseIa(
        orcamentoSelecionado,
        targetBlocoId,
        normalizarRelatorioAnaliseIa(relatorio),
      );
      await salvarOrcamento.mutateAsync({
        id: orcamentoSelecionado.id,
        identificador: orcamentoSelecionado.identificador,
        lead_id: orcamentoSelecionado.lead_id,
        cliente_nome: orcamentoSelecionado.cliente_nome,
        status: orcamentoSelecionado.status,
        dados: novosDados,
      });
      toast.success('Análise incluída na apresentação!', {
        description: 'Você pode revisar e editar o texto antes de enviar ao cliente.',
      });
      onOpenChange(false);
    } catch {
      // toast no mutation
    }
  };

  const abrirApresentacao = () => {
    if (!orcamentoSelecionado) return;
    const path = `/orcamento-slides/${orcamentoSelecionado.id}/apresentar`;
    navigate(returnTo ? withOrcamentoReturnTo(path, returnTo) : path);
    onOpenChange(false);
  };

  const semBlocoConfig = !loadingBlocos && blocosAnalise.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-amber-500/25 bg-mahogany-panel sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-400" />
            Incluir análise na apresentação
          </DialogTitle>
          <DialogDescription>
            O relatório da IA será colocado no slide <strong>Análise de IA</strong> do orçamento escolhido. Depois você pode editar todo o texto.
          </DialogDescription>
        </DialogHeader>

        {semBlocoConfig ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
            Adicione o bloco <strong>Análise de IA</strong> em{' '}
            <button
              type="button"
              className="underline underline-offset-2 hover:text-white"
              onClick={() => {
                navigate('/orcamento-slides/configuracoes');
                onOpenChange(false);
              }}
            >
              Orçamento slides → Configurações → Blocos
            </button>
            .
          </div>
        ) : (
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label>Orçamento</Label>
              {loadingOrcamentos ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando orçamentos…
                </div>
              ) : orcamentos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum orçamento vinculado a este lead.</p>
              ) : (
                <Select value={orcamentoId} onValueChange={setOrcamentoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o orçamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {orcamentos.map((orc) => (
                      <SelectItem key={orc.id} value={orc.id}>
                        {orc.cliente_nome || orc.identificador} · {orc.identificador} ·{' '}
                        {format(new Date(orc.atualizado_em), 'dd/MM/yyyy', { locale: ptBR })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {blocosAnalise.length > 1 && (
              <div className="space-y-2">
                <Label>Bloco na apresentação</Label>
                <Select value={blocoId} onValueChange={setBlocoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Qual bloco de análise?" />
                  </SelectTrigger>
                  <SelectContent>
                    {blocosAnalise.map((b, i) => (
                      <SelectItem key={b.id} value={b.id}>
                        Análise de IA {i + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {orcamentoSelecionado && (
            <Button type="button" variant="outline" onClick={abrirApresentacao} className="mr-auto">
              <Presentation className="h-4 w-4 mr-2" />
              Ver apresentação
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={
              semBlocoConfig
              || !orcamentoId
              || salvarOrcamento.isPending
              || (!blocoId && blocosAnalise.length === 0)
            }
          >
            {salvarOrcamento.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Incluindo…
              </>
            ) : (
              'Incluir análise'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
