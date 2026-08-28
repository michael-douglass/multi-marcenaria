import { Ruler, Package } from 'lucide-react';
import type { MarkupIAProjetistaResult } from '@/lib/markup-types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MarkupIAProjetistaPanelProps {
  levantamento?: MarkupIAProjetistaResult | null;
  scanning?: boolean;
  modoComplemento?: boolean;
  /** Sem card/header — o pai controla o scroll (ex.: accordion do Resumo). */
  embedded?: boolean;
  className?: string;
}

function badgeConfianca(confianca: MarkupIAProjetistaResult['confianca']) {
  switch (confianca) {
    case 'alta':
      return (
        <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600">
          Confiança alta
        </Badge>
      );
    case 'baixa':
      return (
        <Badge variant="outline" className="border-orange-500/40 bg-orange-500/10 text-orange-600">
          Confiança baixa — revise
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600">
          Confiança média
        </Badge>
      );
  }
}

function formatDimensoes(d?: { largura?: number; altura?: number; profundidade?: number }) {
  if (!d) return null;
  const parts = [d.largura, d.altura, d.profundidade].filter((v) => v != null && v > 0);
  if (parts.length === 0) return null;
  return `${parts.join(' × ')} cm`;
}

function badgePontuacaoComodo(pontuacao: number) {
  const cor =
    pontuacao >= 75
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
      : pontuacao >= 50
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-600'
        : 'border-orange-500/40 bg-orange-500/10 text-orange-600';
  return (
    <Badge variant="outline" className={cn('tabular-nums text-[10px]', cor)}>
      {pontuacao}/100
    </Badge>
  );
}

function ProjetistaConteudo({
  levantamento,
}: {
  levantamento: MarkupIAProjetistaResult;
}) {
  const comodosMap = new Map<string, typeof levantamento.moveis>();
  for (const movel of levantamento.moveis) {
    const key = movel.comodo || 'Ambiente';
    const lista = comodosMap.get(key) ?? [];
    lista.push(movel);
    comodosMap.set(key, lista);
  }

  const comodosPontuados =
    levantamento.comodos?.length > 0
      ? levantamento.comodos
      : Array.from(comodosMap.keys()).map((nome, i) => ({
          id: `comodo_${i}`,
          nome,
          pontuacao: 50,
          confianca: 'media' as const,
          moveis_identificados: comodosMap.get(nome)?.length ?? 0,
        }));

  return (
    <div className="space-y-3">
      {comodosPontuados.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {comodosPontuados.map((comodo) => (
            <div
              key={comodo.id}
              className="rounded-lg border border-violet-500/15 bg-violet-500/5 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">{comodo.nome}</span>
                {badgePontuacaoComodo(comodo.pontuacao)}
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {comodo.moveis_identificados} móvel(is) · confiança {comodo.confianca}
              </p>
              {comodo.observacoes && (
                <p className="mt-0.5 text-[10px] italic text-muted-foreground">{comodo.observacoes}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {levantamento.defaults_aplicados.length > 0 && (
        <div className="rounded-lg border border-violet-500/10 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground/80">Padrões aplicados: </span>
          {levantamento.defaults_aplicados.join(' · ')}
        </div>
      )}

      {Array.from(comodosMap.entries()).map(([comodo, moveis]) => (
        <div key={comodo} className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-600/90">
            {comodo}
          </p>
          <Accordion type="multiple" className="space-y-1">
            {moveis.map((movel) => {
              const dims = formatDimensoes(movel.dimensoes_cm);
              return (
                <AccordionItem
                  key={movel.id}
                  value={movel.id}
                  className="rounded-lg border border-border/60 bg-background/80 px-2"
                >
                  <AccordionTrigger className="py-2 text-left text-xs hover:no-underline">
                    <div className="min-w-0 flex-1 pr-2">
                      <span className="font-medium">{movel.nome}</span>
                      {movel.medidas_padrao_aplicadas && (
                        <Badge variant="outline" className="ml-1 h-4 px-1 text-[9px]">
                          Medidas padrão
                        </Badge>
                      )}
                      {(dims || movel.cor_mdf) && (
                        <span className="mt-0.5 block text-[10px] text-muted-foreground">
                          {[dims, movel.cor_mdf && `MDF ${movel.cor_mdf}`]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-2 pt-0">
                    {movel.observacoes && (
                      <p className="mb-2 text-[10px] italic text-muted-foreground">
                        {movel.observacoes}
                      </p>
                    )}
                    <ul className="space-y-1">
                      {(movel.materiais ?? []).map((mat, i) => (
                        <li
                          key={`${mat.nome}-${mat.variacao}-${i}`}
                          className="flex items-start gap-2 text-[11px]"
                        >
                          <Package className="mt-0.5 h-3 w-3 shrink-0 text-violet-500/70" />
                          <div className="min-w-0 flex-1">
                            <span className="font-medium">
                              {mat.nome}
                              {mat.variacao ? ` (${mat.variacao})` : ''}
                            </span>
                            <span className="ml-1 tabular-nums text-violet-600">
                              × {mat.quantidade}
                            </span>
                            <p className="text-[10px] text-muted-foreground">{mat.motivo}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      ))}

      {levantamento.totais_consolidados.length > 0 && (
        <div className="rounded-lg border border-dashed border-violet-500/30 bg-violet-500/5 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-violet-600">
            Totais consolidados
          </p>
          <ul className="grid gap-1 sm:grid-cols-2">
            {levantamento.totais_consolidados.map((t, i) => (
              <li key={`${t.nome}-${t.variacao}-${i}`} className="text-[11px]">
                <span className="font-medium">
                  {t.nome}
                  {t.variacao ? ` ${t.variacao}` : ''}
                </span>
                <span className="ml-1 tabular-nums text-violet-600">× {t.quantidade}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function MarkupIAProjetistaPanel({
  levantamento,
  scanning = false,
  modoComplemento = false,
  embedded = false,
  className,
}: MarkupIAProjetistaPanelProps) {
  if (scanning && !levantamento) {
    return (
      <div
        className={cn(
          'rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-3 text-sm text-muted-foreground',
          className,
        )}
      >
        {modoComplemento
          ? 'Complementando lacunas (fita, ferragens, chapas…) nas pranchas…'
          : 'O projetista está lendo cotas, cores e ferragens nas pranchas…'}
      </div>
    );
  }

  if (!levantamento) return null;

  if (embedded) {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="min-w-0 flex-1 text-xs text-muted-foreground">{levantamento.resumo_projeto}</p>
          {badgeConfianca(levantamento.confianca)}
        </div>
        <ProjetistaConteudo levantamento={levantamento} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-violet-500/25 bg-gradient-to-br from-violet-500/5 via-background to-background',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-violet-500/15 px-4 py-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <Ruler className="h-4 w-4 shrink-0 text-violet-500" />
            <h3 className="text-sm font-semibold">Levantamento do projetista</h3>
            {modoComplemento && (
              <Badge variant="outline" className="border-sky-500/40 bg-sky-500/10 text-sky-600 text-[10px]">
                Complemento
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{levantamento.resumo_projeto}</p>
        </div>
        {badgeConfianca(levantamento.confianca)}
      </div>

      <ScrollArea className="h-[min(280px,40vh)]">
        <div className="p-3">
          <ProjetistaConteudo levantamento={levantamento} />
        </div>
      </ScrollArea>
    </div>
  );
}
