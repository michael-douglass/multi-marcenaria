import { useEffect, useMemo, useRef, useState } from 'react';
import { Calculator, Plus, ExternalLink, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { MarkupCardPreview } from './MarkupCardPreview';
import {
  MarkupOrcamentoSimplesDialog,
  MarkupOrcamentoSimplesTrigger,
} from './MarkupOrcamentoSimplesDialog';
import { useMarkupOrcamentos } from '@/hooks/useMarkupOrcamentos';
import { useSyncLeadMarkupValor } from '@/hooks/useSyncLeadMarkupValor';
import { formatarMoedaMarkup } from '@/lib/markup-calculo';
import {
  closeMarkupSheetSession,
  getMarkupSheetSession,
  openMarkupSheetSession,
} from '@/lib/markup-sheet-session';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { MarkupOrcamento } from '@/lib/markup-types';

interface MarkupLeadSectionProps {
  leadId: number;
  leadNome?: string;
  /**
   * Atualiza o campo Orçamentos do lead.
   * Retorne false para bloquear o sync automático (ex.: usuário editou o valor à mão).
   */
  onOrcamentoSync?: (valor: number, options?: { force?: boolean }) => boolean | void;
  /**
   * Vendedor: vê lista e valores, sem abrir calculadora, criar ou excluir.
   */
  readOnly?: boolean;
}

function somaPrecos(lista: MarkupOrcamento[]): number {
  return lista.reduce((acc, o) => {
    const v = Number(o.preco_final);
    return acc + (Number.isFinite(v) && v > 0 ? v : 0);
  }, 0);
}

export function MarkupLeadSection({
  leadId,
  leadNome,
  onOrcamentoSync,
  readOnly = false,
}: MarkupLeadSectionProps) {
  const { orcamentos, isLoading, removerOrcamento, salvarOrcamento } = useMarkupOrcamentos(leadId);
  const { syncValorLead } = useSyncLeadMarkupValor();
  const [folhaOpen, setFolhaOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; titulo: string } | null>(null);
  /** IDs marcados para a soma do “total selecionado”. */
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set());
  /** IDs já vistos neste lead — para saber o que é “novo” e marcar automaticamente. */
  const idsVistosRef = useRef<Set<string>>(new Set());
  const leadSelecaoRef = useRef(leadId);

  const maisRecente = orcamentos[0] ?? null;
  const syncValorLeadRef = useRef(syncValorLead);
  syncValorLeadRef.current = syncValorLead;

  const idsKey = orcamentos.map((o) => o.id).join('|');
  const idsOrcamentos = useMemo(
    () => (idsKey.length > 0 ? idsKey.split('|') : []),
    [idsKey],
  );

  // Troca de lead: zera seleção e memória de IDs.
  useEffect(() => {
    if (leadSelecaoRef.current === leadId) return;
    leadSelecaoRef.current = leadId;
    idsVistosRef.current = new Set();
    setSelecionados(new Set());
  }, [leadId]);

  // Mantém a seleção alinhada à lista: novos entram marcados; removidos saem.
  useEffect(() => {
    const vistos = idsVistosRef.current;
    setSelecionados((prev) => {
      const next = new Set<string>();
      for (const id of idsOrcamentos) {
        if (!vistos.has(id) || prev.has(id)) {
          next.add(id);
        }
      }
      if (next.size === prev.size && [...next].every((id) => prev.has(id))) {
        return prev;
      }
      return next;
    });
    idsVistosRef.current = new Set(idsOrcamentos);
  }, [idsOrcamentos]);



  const totalGeral = useMemo(() => somaPrecos(orcamentos), [orcamentos]);
  const orcamentosSelecionados = useMemo(
    () => orcamentos.filter((o) => selecionados.has(o.id)),
    [orcamentos, selecionados],
  );
  const totalSelecionado = useMemo(
    () => somaPrecos(orcamentosSelecionados),
    [orcamentosSelecionados],
  );
  const qtdSelecionada = orcamentosSelecionados.length;
  const todosSelecionados = orcamentos.length > 0 && qtdSelecionada === orcamentos.length;

  const confirmarExclusao = async () => {
    if (!deleteTarget || readOnly) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    await removerOrcamento.mutateAsync(id);
    const session = getMarkupSheetSession();
    if (session?.leadId === leadId && session.orcamentoId === id) {
      closeMarkupSheetSession();
    }
  };

  // Ao abrir o card: preenche Orçamentos só se o lead ainda estiver sem valor.
  // Quando o markup é salvo (manual ou automático), a calculadora força o sync
  // via onPrecoFinalChange — aqui não sobrescrevemos edição manual.
  // syncValorLead fica num ref: a mutation do React Query muda de objeto a cada
  // render e, se entrar nas deps, dispara PATCH em loop até o navegador travar.
  useEffect(() => {
    const preco = Number(maisRecente?.preco_final ?? 0);
    if (!Number.isFinite(preco) || preco <= 0) return;
    const accepted = onOrcamentoSync?.(preco);
    if (accepted === false) return;
    void syncValorLeadRef.current(leadId, preco, { onlyIfEmpty: true }).catch(() => {
      /* O auto-save do card tenta de novo sem inundar a rede. */
    });
  }, [leadId, maisRecente?.id, maisRecente?.preco_final, onOrcamentoSync]);

  const abrirNovoMarkup = () => {
    if (readOnly) return;
    openMarkupSheetSession({
      leadId,
      leadNome,
      orcamentoId: null,
      forceNovo: true,
    });
  };

  const abrirMarkupExistente = (id: string) => {
    if (readOnly) return;
    openMarkupSheetSession({
      leadId,
      leadNome,
      orcamentoId: id,
      forceNovo: false,
    });
  };

  const toggleSelecionado = (id: string, marcado: boolean) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (marcado) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selecionarTodos = () => {
    setSelecionados(new Set(orcamentos.map((o) => o.id)));
  };

  const limparSelecao = () => {
    setSelecionados(new Set());
  };

  return (
    <>
      <Card className="lead-modal-panel">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                <Calculator className="h-4 w-4 text-[#8d5e22]" />
                Markup (custo interno)
                {orcamentos.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    {orcamentos.length}
                  </Badge>
                )}
                {!readOnly && (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-normal border-[#c4963a]/40 text-[#8d5e22]"
                  >
                    <Sparkles className="h-3 w-3 mr-1 inline" />
                    Íris multi-agente
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                {readOnly
                  ? 'Valores de referência do markup. A calculadora fica disponível só para a gestão.'
                  : 'Anexe PDF ou foto na ficha do lead e, na calculadora, marque “Usar estes anexos para precificar”. A IA extrai, você confere, e só então o preço pinta o card.'}
              </CardDescription>

              {orcamentos.length > 0 && (
                <div className="lead-markup-totais" aria-live="polite">
                  <div>
                    <div className="lead-markup-totais__kicker">Total geral</div>
                    <div className="lead-markup-totais__valor">
                      {formatarMoedaMarkup(totalGeral)}
                    </div>
                    <div className="lead-markup-totais__meta">
                      Soma de {orcamentos.length} markup{orcamentos.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div>
                    <div className="lead-markup-totais__kicker">Total selecionado</div>
                    <div
                      className={cn(
                        'lead-markup-totais__valor',
                        qtdSelecionada > 0 && 'lead-markup-totais__valor--selecionado',
                      )}
                    >
                      {formatarMoedaMarkup(totalSelecionado)}
                    </div>
                    <div className="lead-markup-totais__meta">
                      {qtdSelecionada === 0
                        ? 'Nenhum marcado — use as caixinhas abaixo'
                        : `${qtdSelecionada} de ${orcamentos.length} marcado${qtdSelecionada === 1 ? '' : 's'}`}
                    </div>
                  </div>
                  {orcamentos.length > 1 && (
                    <div className="lead-markup-totais__acoes">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] border-[#8d5e22]/25 text-[#2a1812]"
                        disabled={todosSelecionados}
                        onClick={selecionarTodos}
                      >
                        Selecionar todos
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[11px] text-[#6b5244]"
                        disabled={qtdSelecionada === 0}
                        onClick={limparSelecao}
                      >
                        Limpar seleção
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <MarkupOrcamentoSimplesTrigger
                disabled={orcamentos.length === 0}
                onClick={() => setFolhaOpen(true)}
              />
              {!readOnly && (
                <Button size="sm" variant="outline" onClick={abrirNovoMarkup}>
                  <Plus className="h-4 w-4 mr-1" />
                  Novo markup
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando markups...</p>
          ) : orcamentos.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                Nenhum markup calculado para este lead
              </p>
              {!readOnly && (
                <Button size="sm" onClick={abrirNovoMarkup}>
                  <Calculator className="h-4 w-4 mr-1" />
                  Abrir calculadora
                </Button>
              )}
            </div>
          ) : (
            <>
              <ul className="space-y-2">
                {orcamentos.map((o, index) => {
                  const marcado = selecionados.has(o.id);
                  const isMaisRecente = index === 0;
                  const podeChip = Number(o.preco_final) > 0;
                  return (
                    <li key={o.id} className="flex items-start gap-2">
                      <label
                        className={cn(
                          'mt-3 flex shrink-0 cursor-pointer items-center',
                          'rounded-sm focus-within:outline-none focus-within:ring-2 focus-within:ring-[#c4963a]/50',
                        )}
                        title={marcado ? 'Remover da soma' : 'Incluir na soma'}
                      >
                        <Checkbox
                          checked={marcado}
                          onCheckedChange={(v) => toggleSelecionado(o.id, v === true)}
                          aria-label={`Incluir “${o.titulo}” na soma selecionada`}
                          className="border-[#8d5e22]/50 data-[state=checked]:border-[#8d5e22] data-[state=checked]:bg-[#c4963a] data-[state=checked]:text-[#1a120e]"
                        />
                        <span className="sr-only">Selecionar para soma</span>
                      </label>
                      <div className="min-w-0 flex-1 space-y-1">
                        {isMaisRecente && podeChip ? (
                          <MarkupCardPreview
                            resumo={{
                              lead_id: leadId,
                              orcamento_id: o.id,
                              preco_final: o.preco_final,
                              titulo: o.titulo,
                              atualizado_em: o.atualizado_em ?? '',
                            }}
                            selected={marcado}
                            readOnly={readOnly}
                            onClick={readOnly ? undefined : () => abrirMarkupExistente(o.id)}
                            onDelete={
                              readOnly
                                ? undefined
                                : (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setDeleteTarget({ id: o.id, titulo: o.titulo });
                                  }
                            }
                          />
                        ) : readOnly ? (
                          <div
                            className={cn(
                              'flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm transition-opacity',
                              marcado
                                ? 'border-[#c4963a]/35 bg-[#fffcf8]'
                                : 'border-[rgba(42,24,18,0.10)] bg-[#fffcf8]/70 opacity-55',
                            )}
                          >
                            <MarkupLinhaMeta orcamento={o} />
                            <span className="shrink-0 font-semibold tabular-nums text-[#2a1812]">
                              {formatarMoedaMarkup(o.preco_final)}
                            </span>
                          </div>
                        ) : (
                          <div
                            className={cn(
                              'flex items-center gap-1 rounded-md border transition-opacity',
                              marcado
                                ? 'border-[#c4963a]/35 bg-[#fffcf8]'
                                : 'border-[rgba(42,24,18,0.10)] bg-[#fffcf8]/70 opacity-55',
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => abrirMarkupExistente(o.id)}
                              className="min-w-0 flex-1 flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[#f2d892]/15 rounded-md"
                            >
                              <MarkupLinhaMeta orcamento={o} />
                              <span className="shrink-0 font-semibold tabular-nums text-[#2a1812]">
                                {formatarMoedaMarkup(o.preco_final)}
                              </span>
                            </button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 shrink-0 mr-1 text-[#6b5244] hover:text-destructive"
                              aria-label={`Excluir ${o.titulo}`}
                              title="Excluir markup"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDeleteTarget({ id: o.id, titulo: o.titulo });
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {maisRecente?.atualizado_em && (
                <p className="text-[10px] text-muted-foreground">
                  Mais recente atualizado em{' '}
                  {format(new Date(maisRecente.atualizado_em), "dd/MM/yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </p>
              )}
            </>
          )}
          {!readOnly && (
            <Button variant="ghost" size="sm" className="w-full text-xs" asChild>
              <Link to="/markup/configuracoes">
                <ExternalLink className="h-3 w-3 mr-1" />
                Configurar catálogo, agentes IA e parâmetros
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <MarkupOrcamentoSimplesDialog
        open={folhaOpen}
        onOpenChange={setFolhaOpen}
        leadId={leadId}
        leadNome={leadNome}
        orcamentos={orcamentos}
        salvarOrcamento={(input) => salvarOrcamento.mutateAsync(input)}
      />

      {!readOnly && (
        <AlertDialog
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir markup?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget
                  ? `“${deleteTarget.titulo}” será removido permanentemente. Essa ação não pode ser desfeita.`
                  : 'O markup será removido permanentemente.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={removerOrcamento.isPending}
                onClick={() => {
                  void confirmarExclusao();
                }}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

function MarkupLinhaMeta({ orcamento }: { orcamento: MarkupOrcamento }) {
  return (
    <span className="min-w-0 truncate text-left">
      <span className="text-[#6b5244]">{orcamento.titulo}</span>
      {orcamento.status === 'rascunho' && (
        <span className="ml-1.5 text-[10px] text-amber-700/80">rascunho</span>
      )}
      {orcamento.atualizado_em && (
        <span className="block text-[10px] text-[#8a7060]">
          {format(new Date(orcamento.atualizado_em), 'dd/MM/yyyy HH:mm', {
            locale: ptBR,
          })}
        </span>
      )}
    </span>
  );
}
