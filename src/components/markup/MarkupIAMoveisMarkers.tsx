import { useMemo, useState } from 'react';
import { ImageOff, MapPin } from 'lucide-react';
import type { LeadAIAnalysisItemPayload } from '@/lib/lead-ai-media-sources';
import { buildOrderedUniqueImages } from '@/lib/markup-ia-imagens';
import type { MarkupIAProjetistaMovel } from '@/lib/markup-types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

/** Mesmo id usado no AccordionItem de MarkupIAProjetistaPanel — ancora do scroll/realce ao clicar num marcador. */
export function markupIaMovelDomId(movelId: string): string {
  return `markup-ia-movel-${movelId}`;
}

interface MarkupIAMoveisMarkersProps {
  itens: LeadAIAnalysisItemPayload[];
  moveis: MarkupIAProjetistaMovel[];
  className?: string;
}

function selecionarMovel(movelId: string) {
  const el = document.getElementById(markupIaMovelDomId(movelId));
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('markup-ia-movel-highlight');
  window.setTimeout(() => el.classList.remove('markup-ia-movel-highlight'), 1600);
}

export function MarkupIAMoveisMarkers({ itens, moveis, className }: MarkupIAMoveisMarkersProps) {
  const imagens = useMemo(() => buildOrderedUniqueImages(itens), [itens]);
  const [imagemAtiva, setImagemAtiva] = useState(0);

  const moveisPorImagem = useMemo(() => {
    const map = new Map<number, MarkupIAProjetistaMovel[]>();
    for (const movel of moveis) {
      const loc = movel.localizacao;
      if (!loc) continue;
      const lista = map.get(loc.imagem_indice) ?? [];
      lista.push(movel);
      map.set(loc.imagem_indice, lista);
    }
    return map;
  }, [moveis]);

  const moveisSemLocalizacao = useMemo(() => moveis.filter((m) => !m.localizacao), [moveis]);
  const numeroPorMovel = useMemo(() => {
    const map = new Map<string, number>();
    moveis.forEach((m, i) => map.set(m.id, i + 1));
    return map;
  }, [moveis]);

  if (imagens.length === 0) {
    return (
      <div className={cn('flex items-center gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground', className)}>
        <ImageOff className="h-4 w-4 shrink-0" />
        Nenhuma imagem para mostrar os móveis marcados.
      </div>
    );
  }

  const atual = imagens[Math.min(imagemAtiva, imagens.length - 1)];
  const marcadoresAtual = moveisPorImagem.get(atual.indice) ?? [];

  return (
    <div className={cn('flex min-h-0 flex-col gap-2', className)}>
      {imagens.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {imagens.map((img) => {
            const temMarcador = (moveisPorImagem.get(img.indice)?.length ?? 0) > 0;
            return (
              <button
                key={img.indice}
                type="button"
                onClick={() => setImagemAtiva(img.indice - 1)}
                className={cn(
                  'rounded-md border px-2 py-1 text-[10px] font-medium tabular-nums transition-colors',
                  img.indice === atual.indice
                    ? 'border-violet-500 bg-violet-500/10 text-violet-700'
                    : 'border-border/60 text-muted-foreground hover:border-violet-500/40',
                )}
                title={img.pagina ? `${img.itemLabel} — página ${img.pagina}` : img.itemLabel}
              >
                Imagem {img.indice}
                {temMarcador && <span className="ml-1 text-violet-500">●</span>}
              </button>
            );
          })}
        </div>
      )}

      <div className="relative overflow-hidden rounded-lg border bg-muted/20">
        <img
          src={atual.dataUrl}
          alt={atual.itemLabel}
          className="block max-h-[min(360px,50vh)] w-full object-contain"
        />
        {marcadoresAtual.map((movel) => {
          const loc = movel.localizacao!;
          return (
            <button
              key={movel.id}
              type="button"
              onClick={() => selecionarMovel(movel.id)}
              title={movel.nome}
              className={cn(
                'absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center',
                'rounded-full border-2 border-white bg-violet-600 text-[11px] font-bold text-white shadow-lg',
                'transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400',
                loc.confianca === 'baixa' && 'bg-violet-600/60',
              )}
              style={{ left: `${loc.ponto_normalizado.x * 100}%`, top: `${loc.ponto_normalizado.y * 100}%` }}
            >
              {numeroPorMovel.get(movel.id) ?? <MapPin className="h-3 w-3" />}
            </button>
          );
        })}
      </div>

      {moveisSemLocalizacao.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          {moveisSemLocalizacao.length} móvel(is) sem posição identificada na imagem — veja a lista abaixo.
        </p>
      )}
    </div>
  );
}

interface MarkupIAMoveisGaleriaScrollProps extends MarkupIAMoveisMarkersProps {}

/** Variante com ScrollArea — usar quando o container pai não controla altura/overflow. */
export function MarkupIAMoveisMarkersScrollable(props: MarkupIAMoveisGaleriaScrollProps) {
  return (
    <ScrollArea className="max-h-[min(420px,55vh)]">
      <MarkupIAMoveisMarkers {...props} />
    </ScrollArea>
  );
}
