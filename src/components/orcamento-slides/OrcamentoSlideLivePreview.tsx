import { useEffect, useRef, useState } from 'react';
import { Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { OrcamentoSlideApresentacao } from '@/components/orcamento-slides/OrcamentoSlideApresentacao';
import { useOrcamentoSlideCatalogo } from '@/hooks/useOrcamentoSlideCatalogo';
import { useOrcamentoSlidePerguntas } from '@/hooks/useOrcamentoSlidePerguntas';
import { PREVIEW_ORCAMENTO } from '@/lib/orcamento-slide-preview-data';
import {
  SLIDE_PREVIEW_DESKTOP,
  SLIDE_PREVIEW_MOBILE,
} from '@/lib/orcamento-slide-imagem-spec';
import type { OrcamentoSlideBloco, OrcamentoSlideTemplate } from '@/lib/orcamento-slide-types';
import type { ViewportMode } from '@/lib/orcamento-slide-layout';

/** Computador: 1920×1080 · Celular: 1080×1920 */
const VIEWPORT_SPECS = {
  desktop: SLIDE_PREVIEW_DESKTOP,
  mobile: SLIDE_PREVIEW_MOBILE,
} as const;

interface OrcamentoSlideLivePreviewProps {
  template: Partial<OrcamentoSlideTemplate> & Pick<OrcamentoSlideTemplate, 'cor_primaria' | 'cor_secundaria' | 'cor_texto' | 'cor_fundo' | 'fonte_titulo' | 'fonte_corpo'>;
  blocos: OrcamentoSlideBloco[];
  templateId?: string;
  className?: string;
}

function usePreviewScale(viewport: ViewportMode, containerRef: React.RefObject<HTMLDivElement | null>) {
  const spec = VIEWPORT_SPECS[viewport];
  const [scale, setScale] = useState(0.35);

  useEffect(() => {
    setScale(0.35);
  }, [viewport, spec.width, spec.height]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const pad = viewport === 'mobile' ? 16 : 8;
      const availableW = Math.max(el.clientWidth - pad, 1);
      const availableH = Math.max(el.clientHeight - pad, 1);
      const scaleW = availableW / spec.width;
      const scaleH = availableH / spec.height;
      const next = Math.min(scaleW, scaleH);
      setScale(Math.max(next, 0.08));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [spec.width, spec.height, viewport]);

  return { scale, spec };
}

export function OrcamentoSlideLivePreview({
  template,
  blocos,
  templateId = 'preview-template',
  className,
}: OrcamentoSlideLivePreviewProps) {
  const [viewport, setViewport] = useState<ViewportMode>('desktop');
  const viewportFrameRef = useRef<HTMLDivElement>(null);
  const { scale, spec } = usePreviewScale(viewport, viewportFrameRef);
  const { perguntas } = useOrcamentoSlidePerguntas();
  const { itens: catalogoFerragens } = useOrcamentoSlideCatalogo('ferragem');
  const { itens: catalogoMdf } = useOrcamentoSlideCatalogo('mdf');
  const catalogoItens = [...catalogoFerragens, ...catalogoMdf];

  const mergedTemplate: OrcamentoSlideTemplate = {
    id: templateId,
    nome: template.nome ?? 'Padrão',
    cor_primaria: template.cor_primaria,
    cor_secundaria: template.cor_secundaria,
    cor_texto: template.cor_texto,
    cor_fundo: template.cor_fundo,
    fonte_titulo: template.fonte_titulo,
    fonte_corpo: template.fonte_corpo,
    logo_url: template.logo_url ?? null,
    fundo_url: template.fundo_url ?? null,
    ativo: true,
    criado_em: '',
    atualizado_em: '',
  };

  const scaledWidth = Math.round(spec.width * scale);
  const scaledHeight = Math.round(spec.height * scale);
  const resolutionLabel =
    viewport === 'desktop'
      ? `${SLIDE_PREVIEW_DESKTOP.width} × ${SLIDE_PREVIEW_DESKTOP.height}`
      : `${SLIDE_PREVIEW_MOBILE.width} × ${SLIDE_PREVIEW_MOBILE.height}`;
  const isMobile = viewport === 'mobile';

  return (
    <div className={cn('flex h-full min-h-0 flex-col gap-2', className)}>
      <div className="flex shrink-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-green-400" />
          <span className="text-sm font-medium text-muted-foreground">Prévia ao vivo</span>
          <span className="hidden truncate text-xs text-muted-foreground sm:inline">
            — {resolutionLabel} · {blocos.filter((b) => b.ativo).length} dobras
          </span>
        </div>
        <div className="flex shrink-0 rounded-lg border border-border/60 bg-muted/40 p-0.5">
          <Button
            type="button"
            size="sm"
            variant={viewport === 'desktop' ? 'secondary' : 'ghost'}
            className="h-7 gap-1.5 px-2.5 text-xs"
            onClick={() => setViewport('desktop')}
          >
            <Monitor className="h-3.5 w-3.5" />
            Computador
          </Button>
          <Button
            type="button"
            size="sm"
            variant={isMobile ? 'secondary' : 'ghost'}
            className="h-7 gap-1.5 px-2.5 text-xs"
            onClick={() => setViewport('mobile')}
          >
            <Smartphone className="h-3.5 w-3.5" />
            Celular
          </Button>
        </div>
      </div>

      <div
        ref={viewportFrameRef}
        className={cn(
          'relative min-h-[280px] w-full flex-1 overflow-auto rounded-xl border border-border/60 bg-muted/30',
          isMobile && 'rounded-[2rem] border-[3px] border-zinc-700/80 bg-zinc-900/90',
        )}
        data-preview-viewport={viewport}
        data-preview-native={`${spec.width}x${spec.height}`}
      >
        <div className="flex min-h-full w-full items-start justify-center p-2">
          <div
            className={cn(
              'relative shrink-0 overflow-hidden shadow-lg',
              isMobile ? 'rounded-[1.75rem] ring-1 ring-white/10' : 'rounded-lg',
            )}
            style={{
              width: scaledWidth,
              height: scaledHeight,
              aspectRatio: isMobile ? '9 / 16' : '16 / 9',
            }}
            data-preview-scaled={`${scaledWidth}x${scaledHeight}`}
          >
            {isMobile && (
              <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center pt-2">
                <div className="h-1 w-14 rounded-full bg-zinc-600/80" />
              </div>
            )}
            <div
              className="overflow-hidden bg-[#2a1812]"
              style={{
                width: scaledWidth,
                height: scaledHeight,
              }}
            >
              <div
                style={{
                  width: spec.width,
                  height: spec.height,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                }}
              >
                <OrcamentoSlideApresentacao
                  key={`preview-${viewport}-${templateId}`}
                  orcamento={PREVIEW_ORCAMENTO}
                  template={mergedTemplate}
                  blocos={blocos}
                  midias={[]}
                  perguntas={perguntas}
                  catalogoFerragens={catalogoFerragens}
                  catalogoItens={catalogoItens}
                  viewport={viewport}
                  previewMode
                  faithfulPreview
                  className="h-full w-full overflow-y-auto overflow-x-hidden"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="shrink-0 text-center text-[11px] text-muted-foreground">
        {isMobile ? 'Celular' : 'Computador'}: {resolutionLabel} · escala {Math.round(scale * 100)}%
        {' · '}
        role para ver as dobras
      </p>
    </div>
  );
}
