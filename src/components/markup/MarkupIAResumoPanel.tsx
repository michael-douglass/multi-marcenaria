import { useMemo, useState, type ComponentType } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock,
  MinusCircle,
  Package,
  ShieldCheck,
  Sparkles,
  Wallet,
  XCircle,
} from 'lucide-react';
import type { MarkupIAVerificacaoItemStatus } from '@/lib/markup-ia-verificacao';
import { formatarMoedaMarkup } from '@/lib/markup-calculo';
import { calcularHorasTotaisServicos, normalizarResumoIAServicos } from '@/lib/markup-servicos';
import type { MarkupModulos, MarkupModulosMeta } from '@/lib/markup-types';
import { MarkupIAProjetistaPanel } from '@/components/markup/MarkupIAProjetistaPanel';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
export interface MarkupIAResumoPanelProps {
  meta?: MarkupModulosMeta;
  modulos?: MarkupModulos;
  onEditarTextoResumo?: (texto: string) => void;
  onToggleMaterial?: (produtoId: string, ativo: boolean) => void;
  onToggleServico?: (templateId: string, ativo: boolean) => void;
  onToggleDespesa?: (index: number, ativo: boolean) => void;
  onReabrirConferencia?: () => void;
  className?: string;
}

function ResumoMetricTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-violet-500/15 bg-background/70 px-3 py-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-violet-500/10">
        <Icon className="h-3.5 w-3.5 text-violet-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-sm font-semibold tabular-nums">{formatarMoedaMarkup(value)}</p>
      </div>
    </div>
  );
}

function labelStatusVerificacao(status: MarkupIAVerificacaoItemStatus): string {
  switch (status) {
    case 'encontrado':
      return 'Na planilha';
    case 'inventado':
      return 'Possível inventado';
    case 'referencia_apenas':
      return 'Só referência';
    case 'ausente_documento':
      return 'Ausente';
    default:
      return status;
  }
}

function iconStatusVerificacao(status: MarkupIAVerificacaoItemStatus) {
  switch (status) {
    case 'encontrado':
      return <CheckCircle2 className="h-3 w-3 text-emerald-500" />;
    case 'ausente_documento':
      return <XCircle className="h-3 w-3 text-orange-500" />;
    case 'inventado':
      return <XCircle className="h-3 w-3 text-red-500" />;
    case 'referencia_apenas':
    case 'nao_aplicavel':
      return <MinusCircle className="h-3 w-3 text-muted-foreground" />;
    default:
      return <Circle className="h-3 w-3 text-muted-foreground" />;
  }
}

export function MarkupIAResumoPanel({
  meta,
  modulos,
  onEditarTextoResumo,
  onToggleMaterial,
  onToggleServico,
  onToggleDespesa,
  onReabrirConferencia,
  className,
}: MarkupIAResumoPanelProps) {
  const resumo = meta?.resumo_ia;
  const despesas = resumo?.despesas ?? [];
  const comodos = resumo?.comodos ?? [];
  const servicosResumo = useMemo(
    () => (resumo?.servicos ? normalizarResumoIAServicos(resumo.servicos) : null),
    [resumo?.servicos],
  );
  const totalMoveis = useMemo(
    () => comodos.reduce((acc, c) => acc + (c.moveis?.length ?? 0), 0),
    [comodos],
  );

  const [painelAberto, setPainelAberto] = useState(false);

  if (!resumo) return null;

  const precoFinal = modulos?.totais?.preco_final ?? resumo.preco_final ?? 0;
  const custoServicosAoVivo = modulos?.totais?.custo_servicos ?? resumo.custo_servicos ?? 0;
  const somarComodosMateriais = comodos.reduce((acc, c) => acc + (c.subtotal ?? 0), 0);
  const custoMateriaisAoVivo =
    modulos?.totais?.custo_materiais ?? resumo.custo_materiais ?? somarComodosMateriais;
  const editavel = Boolean(modulos && onEditarTextoResumo);

  const temMetricas =
    custoMateriaisAoVivo > 0 ||
    resumo.custo_servicos != null ||
    resumo.custo_despesas != null;

  return (
    <Collapsible
      open={painelAberto}
      onOpenChange={setPainelAberto}
      className={cn(
        'w-full min-w-0 overflow-hidden rounded-xl border border-violet-500/25 bg-gradient-to-b from-violet-500/[0.07] to-transparent shadow-sm',
        className,
      )}
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            'relative w-full overflow-hidden px-4 py-4 text-left transition-colors hover:bg-violet-500/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 focus-visible:ring-inset',
            painelAberto && 'border-b border-violet-500/20',
          )}
          aria-expanded={painelAberto}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet-500/10 blur-2xl"
          />
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/15">
                  <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                </div>
                <h4 className="text-sm font-semibold tracking-tight">Resumo gerado por IA</h4>
                {comodos.length > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
                    {comodos.length} cômodo{comodos.length !== 1 ? 's' : ''}
                    {totalMoveis > 0 && ` · ${totalMoveis} móve${totalMoveis !== 1 ? 'is' : 'l'}`}
                  </Badge>
                )}
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                    painelAberto && 'rotate-180',
                  )}
                  aria-hidden
                />
              </div>
              {resumo.gerado_em && (
                <p className="pl-9 text-[11px] text-muted-foreground">
                  Gerado em{' '}
                  {new Date(resumo.gerado_em).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}
              {!painelAberto && (
                <p className="pl-9 text-[11px] text-muted-foreground">
                  Clique para expandir o detalhamento
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Preço de venda</p>
              <p className="text-xl font-bold tabular-nums text-violet-600 dark:text-violet-400 sm:text-2xl">
                {formatarMoedaMarkup(precoFinal)}
              </p>
            </div>
          </div>
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
      {temMetricas && (
        <div className="grid grid-cols-1 gap-2 border-b border-violet-500/10 p-3 sm:grid-cols-3">
          {custoMateriaisAoVivo > 0 && (
            <ResumoMetricTile label="Materiais" value={custoMateriaisAoVivo} icon={Package} />
          )}
          {resumo.custo_servicos != null && (
            <ResumoMetricTile label="Mão de obra" value={resumo.custo_servicos} icon={Clock} />
          )}
          {resumo.custo_despesas != null && (
            <ResumoMetricTile label="Despesas" value={resumo.custo_despesas} icon={Wallet} />
          )}
        </div>
      )}

      {(resumo.bloqueado || (resumo.faltantes_criticos?.length ?? 0) > 0) && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Itens críticos ausentes
          </p>
          <ul className="space-y-0.5 pl-5 text-[11px] text-red-800/90 dark:text-red-200/90 [list-style-type:disc]">
            {(resumo.faltantes_criticos ?? ['Composição incompleta — verifique dobradiças, corrediças e fitas.']).map(
              (item) => (
                <li key={item} className="break-words">
                  {item}
                </li>
              ),
            )}
          </ul>
        </div>
      )}

      <Accordion type="multiple" defaultValue={[]} className="px-1">
        {resumo.levantamento_projetista && (
          <AccordionItem value="projetista" className="border-violet-500/10 px-3">
            <AccordionTrigger className="gap-2 py-3 text-sm hover:no-underline">
              <span className="flex items-center gap-2">
                <Package className="h-3.5 w-3.5 text-violet-500" />
                Levantamento do projetista
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <ScrollArea className="h-[min(360px,50vh)]">
                <div className="pr-3">
                  <MarkupIAProjetistaPanel
                    embedded
                    levantamento={resumo.levantamento_projetista}
                    className="pb-1"
                  />
                </div>
              </ScrollArea>
            </AccordionContent>
          </AccordionItem>
        )}
        {resumo.levantamento_projetista?.auditoria_projetista && (
          <AccordionItem value="auditoria-projetista" className="border-sky-500/10 px-3">
            <AccordionTrigger className="gap-2 py-3 text-sm hover:no-underline">
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-sky-500" />
                Auditoria do projetista (2ª passagem)
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-3 text-xs text-muted-foreground whitespace-pre-wrap">
              {resumo.levantamento_projetista.auditoria_projetista.resumo_secao ??
                (resumo.levantamento_projetista.auditoria_projetista.ok
                  ? 'Todos os itens do projetista constam na composição.'
                  : `Pendências: ${resumo.levantamento_projetista.auditoria_projetista.faltantes.join('; ')}`)}
            </AccordionContent>
          </AccordionItem>
        )}
        {resumo.verificacao_categorias && resumo.verificacao_categorias.length > 0 && (
          <AccordionItem value="auditoria" className="border-violet-500/10 px-3">
            <AccordionTrigger className="gap-2 py-3 text-sm hover:no-underline">
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />
                Auditoria de verificação
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pb-2">
                {resumo.verificacao_categorias.map((cat) => {
                  const encontrados = cat.itens.filter((i) => i.status === 'encontrado');
                  const inventados = cat.itens.filter((i) => i.status === 'inventado');
                  const ausentes = cat.itens.filter((i) => i.status === 'ausente_documento');
                  return (
                    <div key={cat.categoria_id} className="rounded-lg border bg-muted/30 p-2.5">
                      <p className="text-xs font-semibold mb-1.5">{cat.nome}</p>
                      <ul className="space-y-1">
                        {[...encontrados, ...ausentes, ...inventados].slice(0, 10).map((item) => (
                          <li
                            key={`${item.item_id}-${item.variacao}-${item.status}`}
                            className="flex items-start gap-1.5 text-[11px]"
                          >
                            {iconStatusVerificacao(item.status)}
                            <span className="flex-1">
                              {item.nome}
                              {item.variacao ? ` (${item.variacao})` : ''}
                              {item.quantidade != null ? ` × ${item.quantidade}` : ''}
                              <span className="text-muted-foreground ml-1">
                                — {labelStatusVerificacao(item.status)}
                              </span>
                            </span>
                          </li>
                        ))}
                        {encontrados.length === 0 &&
                          inventados.length === 0 &&
                          ausentes.length === 0 && (
                          <li className="text-[11px] text-muted-foreground">
                            Nenhum item com quantidade nesta categoria.
                          </li>
                        )}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
        {servicosResumo && (
          <AccordionItem value="servicos" className="border-violet-500/10 px-3">
            <AccordionTrigger className="gap-2 py-3 text-sm hover:no-underline [&[data-state=open]>svg]:text-violet-500">
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <Clock className="h-3.5 w-3.5 shrink-0 text-violet-500/70" />
                <span className="truncate">Mão de obra</span>
                <span className="shrink-0 text-xs font-normal text-muted-foreground">
                  ({calcularHorasTotaisServicos(servicosResumo.linhas).toLocaleString('pt-BR')}h)
                </span>
              </span>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-violet-600 dark:text-violet-400">
                {formatarMoedaMarkup(custoServicosAoVivo)}
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <div className="space-y-1.5 rounded-lg border border-violet-500/10 bg-background/50 p-3">
                {servicosResumo.linhas.map((linha) => {
                  const ativo = linha.ativo !== false;
                  const templateId = linha.template_id ?? linha.descricao;
                  return (
                    <div
                      key={templateId}
                      className={cn(
                        'flex items-center gap-2 text-xs',
                        !ativo && 'opacity-50',
                      )}
                    >
                      <Checkbox
                        checked={ativo}
                        disabled={!onToggleServico}
                        onCheckedChange={(checked) =>
                          onToggleServico?.(templateId, checked === true)
                        }
                        aria-label={`Incluir ${linha.descricao}`}
                      />
                      <span className="min-w-0 flex-1 break-words text-muted-foreground">
                        {linha.descricao}
                      </span>
                      <span className="shrink-0 tabular-nums">{linha.horas}h</span>
                    </div>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {despesas.length > 0 && (
          <AccordionItem value="despesas" className="border-violet-500/10 px-3">
            <AccordionTrigger className="gap-2 py-3 text-sm hover:no-underline">
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <Wallet className="h-3.5 w-3.5 shrink-0 text-violet-500/70" />
                <span className="truncate">Despesas previstas</span>
              </span>
              <span className="shrink-0 text-xs font-normal text-muted-foreground">
                {despesas.length} item{despesas.length !== 1 ? 's' : ''}
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <div className="space-y-1.5 rounded-lg border border-violet-500/10 bg-background/50 p-3">
                {despesas.map((d, index) => {
                  const ativo = d.ativo !== false;
                  return (
                    <div
                      key={`${d.descricao}-${index}`}
                      className={cn('flex items-center gap-2 text-xs', !ativo && 'opacity-50')}
                    >
                      <Checkbox
                        checked={ativo}
                        disabled={!onToggleDespesa}
                        onCheckedChange={(checked) =>
                          onToggleDespesa?.(index, checked === true)
                        }
                        aria-label={`Incluir ${d.descricao}`}
                      />
                      <span className="min-w-0 flex-1 break-words text-muted-foreground">
                        {d.descricao}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {formatarMoedaMarkup(d.valor)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {comodos.map((comodo) => (
          <AccordionItem
            key={comodo.nome}
            value={`comodo-${comodo.nome}`}
            className="border-violet-500/10 px-3"
          >
            <AccordionTrigger className="gap-2 py-3 text-sm hover:no-underline">
              <span className="min-w-0 flex-1 truncate pr-2 text-left font-medium">{comodo.nome}</span>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-violet-600 dark:text-violet-400">
                {formatarMoedaMarkup(comodo.subtotal)}
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <ScrollArea className="max-h-[min(280px,40vh)]">
                <div className="space-y-2.5 pr-3">
                  {(comodo.moveis ?? []).map((movel) => (
                    <div
                      key={`${comodo.nome}-${movel.nome}`}
                      className="rounded-lg border border-violet-500/10 bg-background/50 p-3"
                    >
                      <div className="flex items-start justify-between gap-2 border-l-2 border-violet-500/30 pl-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-snug">{movel.nome}</p>
                          {movel.descricao && (
                            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                              {movel.descricao}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 text-xs font-semibold tabular-nums">
                          {formatarMoedaMarkup(movel.subtotal)}
                        </span>
                      </div>
                      {(movel.materiais?.length ?? 0) > 0 && (
                        <ul className="mt-2 space-y-1 border-t border-violet-500/10 pt-2">
                          {(movel.materiais ?? []).map((mat, idx) => {
                            const ativo = mat.ativo !== false;
                            const produtoId = mat.produto_id;
                            return (
                              <li
                                key={produtoId ?? `${mat.descricao}-${idx}`}
                                className={cn(
                                  'flex items-start gap-2 text-[11px]',
                                  !ativo && 'opacity-50',
                                )}
                              >
                                {produtoId ? (
                                  <Checkbox
                                    className="mt-0.5"
                                    checked={ativo}
                                    disabled={!onToggleMaterial}
                                    onCheckedChange={(checked) =>
                                      onToggleMaterial?.(produtoId, checked === true)
                                    }
                                    aria-label={`Incluir ${mat.descricao}`}
                                  />
                                ) : (
                                  <span className="w-4" />
                                )}
                                <span className="min-w-0 flex-1 break-words text-muted-foreground">
                                  <span className="font-medium text-foreground/80">
                                    {mat.quantidade}×
                                  </span>{' '}
                                  {mat.descricao}
                                </span>
                                <span className="shrink-0 tabular-nums">
                                  {formatarMoedaMarkup(mat.valor_total)}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <div className="space-y-2 border-t border-violet-500/10 p-3">
        {onReabrirConferencia && (resumo.itens_extraidos?.length ?? 0) > 0 && (
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={onReabrirConferencia}>
            Reconferir extração
          </Button>
        )}
        {resumo.limites_anexos?.avisos && resumo.limites_anexos.avisos.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="mb-1.5 text-xs font-medium text-amber-800 dark:text-amber-200">
              Limites da leitura
            </p>
            <ul className="space-y-0.5 pl-5 text-[11px] [list-style-type:disc]">
              {resumo.limites_anexos.avisos.map((aviso) => (
                <li key={aviso}>{aviso}</li>
              ))}
            </ul>
          </div>
        )}
        {resumo.itens_nao_catalogados && resumo.itens_nao_catalogados.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Não encontrados no catálogo
            </p>
            <ul className="space-y-0.5 pl-5 text-[11px] text-amber-900/80 dark:text-amber-100/80 [list-style-type:disc]">
              {resumo.itens_nao_catalogados.map((item) => (
                <li key={item} className="break-words">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">
            Texto do resumo (editável — aparece no PDF)
          </Label>
          <Textarea
            value={resumo.texto_resumo ?? ''}
            readOnly={!editavel}
            onChange={(e) => onEditarTextoResumo?.(e.target.value)}
            rows={5}
            className="text-xs leading-relaxed"
            placeholder="Resumo do orçamento para o vendedor..."
          />
        </div>
      </div>
      </CollapsibleContent>
    </Collapsible>
  );
}