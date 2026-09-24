import { useEffect, useRef, useState } from 'react';
import { Calculator, Plus, ExternalLink, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { MarkupCalculatorSheet } from './MarkupCalculatorSheet';
import {
  MarkupOrcamentoSimplesDialog,
  MarkupOrcamentoSimplesTrigger,
} from './MarkupOrcamentoSimplesDialog';
import { useMarkupOrcamentos } from '@/hooks/useMarkupOrcamentos';
import { useSyncLeadMarkupValor } from '@/hooks/useSyncLeadMarkupValor';
import { formatarMoedaMarkup } from '@/lib/markup-calculo';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';

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

export function MarkupLeadSection({
  leadId,
  leadNome,
  onOrcamentoSync,
  readOnly = false,
}: MarkupLeadSectionProps) {
  const { orcamentos, isLoading, removerOrcamento, salvarOrcamento } = useMarkupOrcamentos(leadId);
  const { syncValorLead } = useSyncLeadMarkupValor();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [folhaOpen, setFolhaOpen] = useState(false);
  const [orcamentoId, setOrcamentoId] = useState<string | null>(null);
  const [forceNovo, setForceNovo] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; titulo: string } | null>(null);

  const maisRecente = orcamentos[0] ?? null;
  const syncValorLeadRef = useRef(syncValorLead);
  syncValorLeadRef.current = syncValorLead;

  const confirmarExclusao = async () => {
    if (!deleteTarget || readOnly) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    await removerOrcamento.mutateAsync(id);
    if (orcamentoId === id) {
      setSheetOpen(false);
      setOrcamentoId(null);
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
    setOrcamentoId(null);
    setForceNovo(true);
    setSheetOpen(true);
  };

  const abrirMarkupExistente = (id: string) => {
    if (readOnly) return;
    setOrcamentoId(id);
    setForceNovo(false);
    setSheetOpen(true);
  };

  return (
    <>
      <Card className="lead-modal-panel">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                <Calculator className="h-4 w-4 text-emerald-500" />
                Markup (custo interno)
                {orcamentos.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    {orcamentos.length}
                  </Badge>
                )}
                {!readOnly && (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-normal border-amber-500/30 text-amber-700 dark:text-amber-400"
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
              {maisRecente && (
                <MarkupCardPreview
                  resumo={{
                    lead_id: leadId,
                    orcamento_id: maisRecente.id,
                    preco_final: maisRecente.preco_final,
                    titulo: maisRecente.titulo,
                    atualizado_em: maisRecente.atualizado_em ?? '',
                  }}
                  readOnly={readOnly}
                  onClick={readOnly ? undefined : () => abrirMarkupExistente(maisRecente.id)}
                  onDelete={
                    readOnly
                      ? undefined
                      : (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDeleteTarget({ id: maisRecente.id, titulo: maisRecente.titulo });
                        }
                  }
                />
              )}
              {orcamentos.length > 1 && (
                <ul className="space-y-1.5 pt-2 border-t">
                  {orcamentos.slice(1).map((o) => (
                    <li key={o.id} className="flex items-center gap-1">
                      {readOnly ? (
                        <div className="min-w-0 flex-1 flex items-center justify-between gap-2 text-sm px-2 py-1.5">
                          <span className="min-w-0 truncate text-left">
                            <span className="text-muted-foreground">{o.titulo}</span>
                            {o.status === 'rascunho' && (
                              <span className="ml-1.5 text-[10px] text-amber-600/80 dark:text-amber-400/80">
                                rascunho
                              </span>
                            )}
                            {o.atualizado_em && (
                              <span className="block text-[10px] text-muted-foreground/80">
                                {format(new Date(o.atualizado_em), 'dd/MM/yyyy HH:mm', {
                                  locale: ptBR,
                                })}
                              </span>
                            )}
                          </span>
                          <span className="font-medium shrink-0">
                            {formatarMoedaMarkup(o.preco_final)}
                          </span>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => abrirMarkupExistente(o.id)}
                            className="min-w-0 flex-1 flex items-center justify-between gap-2 text-sm hover:bg-muted/50 rounded px-2 py-1.5"
                          >
                            <span className="min-w-0 truncate text-left">
                              <span className="text-muted-foreground">{o.titulo}</span>
                              {o.status === 'rascunho' && (
                                <span className="ml-1.5 text-[10px] text-amber-600/80 dark:text-amber-400/80">
                                  rascunho
                                </span>
                              )}
                              {o.atualizado_em && (
                                <span className="block text-[10px] text-muted-foreground/80">
                                  {format(new Date(o.atualizado_em), 'dd/MM/yyyy HH:mm', {
                                    locale: ptBR,
                                  })}
                                </span>
                              )}
                            </span>
                            <span className="font-medium shrink-0">
                              {formatarMoedaMarkup(o.preco_final)}
                            </span>
                          </button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
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
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
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
        <>
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

          <MarkupCalculatorSheet
            key={`${leadId}-${orcamentoId ?? 'sem-id'}-${forceNovo ? 'novo' : 'edit'}`}
            open={sheetOpen}
            modal={false}
            onOpenChange={(open) => {
              setSheetOpen(open);
              if (!open) {
                setForceNovo(false);
                setOrcamentoId(null);
              }
            }}
            leadId={leadId}
            leadNome={leadNome}
            orcamentoId={orcamentoId}
            forceNovo={forceNovo}
            onPrecoFinalChange={(valor) => {
              onOrcamentoSync?.(valor, { force: true });
            }}
          />
        </>
      )}
    </>
  );
}
