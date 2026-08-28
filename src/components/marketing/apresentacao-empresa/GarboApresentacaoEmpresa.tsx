import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { GarboBrandLoader } from '@/components/ui/garbo-brand-loader';
import {
  GARBO_APRESENTACAO_NAV,
  GARBO_APRESENTACAO_NAV_COM_PONTUA,
  GARBO_APRESENTACAO_SECTIONS,
} from './garbo-apresentacao-content';
import { GARBO_APRESENTACAO_CSS_VARS, GARBO_APRESENTACAO_THEME } from './garbo-apresentacao-theme';
import { GarboApresentacaoFechamento } from './GarboApresentacaoFechamento';
import { GarboApresentacaoHero } from './GarboApresentacaoHero';
import { GarboApresentacaoInstagram } from './GarboApresentacaoInstagram';
import { GarboApresentacaoNarrativeSection } from './GarboApresentacaoNarrativeSection';
import { GarboApresentacaoPontuaGarbo } from './GarboApresentacaoPontuaGarbo';
import { GarboApresentacaoProgress } from './GarboApresentacaoProgress';
import { GarboApresentacaoProjetos } from './GarboApresentacaoProjetos';
import { GarboApresentacaoProjetosFim } from './GarboApresentacaoProjetosFim';
import { GarboApresentacaoToolbar } from './GarboApresentacaoToolbar';
import { GarboParceriaFormOverlay } from './GarboParceriaFormOverlay';
import { useGarboApresentacaoAutoScroll } from './use-garbo-apresentacao-auto-scroll';
import { useGarboApresentacaoReveal } from './use-garbo-apresentacao-reveal';

interface GarboApresentacaoEmpresaProps {
  /** Exibe barra com voltar, rolagem automática e copiar link (uso interno). */
  showToolbar?: boolean;
  /** Inclui o capítulo final do Programa Pontua Garbo. */
  includePontua?: boolean;
  /** Mostra o botão de copiar link público (padrão: ligado com toolbar). */
  showCopyLink?: boolean;
}

export function GarboApresentacaoEmpresa({
  showToolbar = false,
  includePontua = false,
  showCopyLink = true,
}: GarboApresentacaoEmpresaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [introDone, setIntroDone] = useState(false);
  const [parceriaOpen, setParceriaOpen] = useState(false);

  const navItems = includePontua ? GARBO_APRESENTACAO_NAV_COM_PONTUA : GARBO_APRESENTACAO_NAV;

  useGarboApresentacaoReveal(containerRef, !introDone);

  const { isPlaying, toggle, stop, canAutoScroll } = useGarboApresentacaoAutoScroll({
    containerRef,
    enabled: showToolbar && introDone,
    pausedExternally: parceriaOpen,
    items: navItems,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setIntroDone(true), 1400);
    return () => window.clearTimeout(timer);
  }, []);

  if (!introDone) {
    return (
      <GarboBrandLoader
        variant="fullscreen"
        message={includePontua ? 'Pontua Garbo' : 'Garbo Movelaria'}
      />
    );
  }

  return (
    <div
      className="relative h-[100dvh] w-full overflow-hidden touch-manipulation"
      style={{
        ...GARBO_APRESENTACAO_CSS_VARS,
        background: GARBO_APRESENTACAO_THEME.bgBase,
        fontFamily: GARBO_APRESENTACAO_THEME.fontBody,
        colorScheme: 'dark',
      }}
    >
      {showToolbar && (
        <GarboApresentacaoToolbar
          autoScrollAvailable={canAutoScroll}
          autoScrollPlaying={isPlaying}
          onToggleAutoScroll={toggle}
          showCopyLink={showCopyLink}
        />
      )}

      <GarboApresentacaoProgress
        containerRef={containerRef}
        onManualNavigate={showToolbar ? stop : undefined}
        items={navItems}
      />

      <div
        ref={containerRef}
        data-garbo-apresentacao
        className={cn(
          'h-full w-full overflow-x-hidden overflow-y-auto scroll-smooth snap-y snap-mandatory',
          showToolbar && 'pt-12',
        )}
        style={{ scrollSnapType: 'y mandatory' }}
      >
        <GarboApresentacaoHero />

        {GARBO_APRESENTACAO_SECTIONS.map((section) => (
          <GarboApresentacaoNarrativeSection key={section.id} section={section} />
        ))}

        <GarboApresentacaoFechamento onIniciarParceria={() => setParceriaOpen(true)} />

        <GarboApresentacaoProjetos />

        <GarboApresentacaoInstagram />

        <GarboApresentacaoProjetosFim onIniciarParceria={() => setParceriaOpen(true)} />

        {includePontua && <GarboApresentacaoPontuaGarbo scrollerRef={containerRef} />}
      </div>

      <GarboParceriaFormOverlay open={parceriaOpen} onClose={() => setParceriaOpen(false)} />
    </div>
  );
}
