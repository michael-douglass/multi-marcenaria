import { useEffect, useMemo, useRef, useState } from 'react';
import { useEmpresaIdentidade } from '@/hooks/useEmpresaIdentidade';
import { useAppOptional } from '@/context/AppContext';
import { useApresentacaoConteudo } from '@/hooks/useApresentacaoConteudo';
import { resolverConteudo } from './apresentacao-conteudo';
import { ApresentacaoConteudoProvider, type ApresentacaoConteudoValor } from './ApresentacaoConteudoContext';
import { cn } from '@/lib/utils';
import { BrandLoader } from '@/components/ui/brand-loader';
import {
  APRESENTACAO_NAV,
  APRESENTACAO_NAV_COM_PONTUA,
  PONTUA_NAV,
} from './apresentacao-content';
import { APRESENTACAO_CSS_VARS, APRESENTACAO_THEME } from './apresentacao-theme';
import { ApresentacaoFechamento } from './ApresentacaoFechamento';
import { ApresentacaoHero } from './ApresentacaoHero';
import { ApresentacaoInstagram } from './ApresentacaoInstagram';
import { ApresentacaoNarrativeSection } from './ApresentacaoNarrativeSection';
import { ApresentacaoPontua } from './ApresentacaoPontua';
import { ApresentacaoProgress } from './ApresentacaoProgress';
import { ApresentacaoProjetos } from './ApresentacaoProjetos';
import { ApresentacaoProjetosFim } from './ApresentacaoProjetosFim';
import { ApresentacaoToolbar } from './ApresentacaoToolbar';
import { ParceriaFormOverlay } from './ParceriaFormOverlay';
import { useApresentacaoAutoScroll } from './use-apresentacao-auto-scroll';
import { useApresentacaoReveal } from './use-apresentacao-reveal';

interface ApresentacaoEmpresaProps {
  /** Exibe barra com voltar, rolagem automática e copiar link (uso interno). */
  showToolbar?: boolean;
  /** Inclui o capítulo final do programa de pontuação (Pontua). */
  includePontua?: boolean;
  /** Mostra o botão de copiar link público (padrão: ligado com toolbar). */
  showCopyLink?: boolean;
  /**
   * Conteúdo já resolvido (link público por slug ou prévia do editor). Sem ele, lê o conteúdo da
   * empresa ativa (`crm.apresentacao_conteudo`) e cai no padrão se ela ainda não editou.
   */
  conteudo?: ApresentacaoConteudoValor;
  /** Sem loader de abertura (prévia do editor). */
  semIntro?: boolean;
  /** Só o programa de pontuação (página Pontua e seu link público). */
  somentePontua?: boolean;
}

export function ApresentacaoEmpresa({
  showToolbar = false,
  includePontua = false,
  showCopyLink = true,
  conteudo: conteudoExterno,
  semIntro = false,
  somentePontua = false,
}: ApresentacaoEmpresaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [introDone, setIntroDone] = useState(semIntro);
  const empresaAtiva = useAppOptional()?.empresa ?? null;
  const salvo = useApresentacaoConteudo();
  const [parceriaOpen, setParceriaOpen] = useState(false);

  const { nomePrograma, nomeFantasia } = useEmpresaIdentidade();
  const valor = useMemo<ApresentacaoConteudoValor>(() => {
    if (conteudoExterno) return conteudoExterno;
    return {
      ...resolverConteudo(salvo.data, nomeFantasia),
      empresaId: empresaAtiva?.id ?? null,
      nomeEmpresa: nomeFantasia,
      nomePrograma,
      publicPath: empresaAtiva?.slug
        ? `/apresentacao/${empresaAtiva.slug}${somentePontua ? '/pontua' : ''}`
        : null,
    };
  }, [conteudoExterno, salvo.data, nomeFantasia, nomePrograma, empresaAtiva?.id, empresaAtiva?.slug, somentePontua]);
  const programa = valor.nomePrograma ?? nomePrograma;
  const nomeMarca = valor.nomeEmpresa ?? nomeFantasia;
  const aguardandoConteudo = !conteudoExterno && !!empresaAtiva && salvo.isLoading;
  // Rótulo do capítulo do programa: "Pontua {nome fantasia}" (o id da seção não muda).
  // Sem feed configurado (empresa nova), a seção do Instagram não aparece.
  const temInstagram = !!valor.conteudo.instagram.embedUrl.trim();
  const navItems = useMemo(
    () =>
      somentePontua
        ? PONTUA_NAV.map((it) => (it.id === 'pontua' ? { ...it, label: 'Pontua' } : it))
        : (includePontua ? APRESENTACAO_NAV_COM_PONTUA : APRESENTACAO_NAV)
            .filter((it) => temInstagram || it.id !== 'instagram')
            .map((it) => (it.id === 'pontua' ? { ...it, label: programa } : it)),
    [somentePontua, includePontua, programa, temInstagram],
  );

  useApresentacaoReveal(containerRef, !introDone);

  const { isPlaying, toggle, stop, canAutoScroll } = useApresentacaoAutoScroll({
    containerRef,
    enabled: showToolbar && introDone,
    pausedExternally: parceriaOpen,
    items: navItems,
  });

  useEffect(() => {
    if (semIntro) return;
    const timer = window.setTimeout(() => setIntroDone(true), 1400);
    return () => window.clearTimeout(timer);
  }, [semIntro]);

  if (!introDone || aguardandoConteudo) {
    return (
      <BrandLoader
        variant="fullscreen"
        message={somentePontua ? 'Pontua' : includePontua ? programa : nomeMarca}
      />
    );
  }

  return (
    <ApresentacaoConteudoProvider value={valor}>
    <div
      className={cn('relative w-full overflow-hidden touch-manipulation', semIntro ? 'h-full' : 'h-[100dvh]')}
      style={{
        ...APRESENTACAO_CSS_VARS,
        background: APRESENTACAO_THEME.bgBase,
        fontFamily: APRESENTACAO_THEME.fontBody,
        colorScheme: 'dark',
      }}
    >
      {showToolbar && (
        <ApresentacaoToolbar
          autoScrollAvailable={canAutoScroll}
          autoScrollPlaying={isPlaying}
          onToggleAutoScroll={toggle}
          showCopyLink={showCopyLink && !!valor.publicPath}
          publicPath={valor.publicPath ?? undefined}
        />
      )}

      <ApresentacaoProgress
        containerRef={containerRef}
        onManualNavigate={showToolbar ? stop : undefined}
        items={navItems}
      />

      <div
        ref={containerRef}
        data-apresentacao
        className={cn(
          'h-full w-full overflow-x-hidden overflow-y-auto scroll-smooth snap-y snap-mandatory',
          showToolbar && 'pt-12',
        )}
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {!somentePontua && (
          <>
            <ApresentacaoHero />

            {valor.conteudo.secoes.map((section) => (
              <ApresentacaoNarrativeSection key={section.id} section={section} />
            ))}

            <ApresentacaoFechamento onIniciarParceria={() => setParceriaOpen(true)} />

            <ApresentacaoProjetos />

            {temInstagram && <ApresentacaoInstagram />}

            <ApresentacaoProjetosFim onIniciarParceria={() => setParceriaOpen(true)} />
          </>
        )}

        {(includePontua || somentePontua) && <ApresentacaoPontua scrollerRef={containerRef} />}
      </div>

      {!somentePontua && <ParceriaFormOverlay open={parceriaOpen} onClose={() => setParceriaOpen(false)} />}
    </div>
    </ApresentacaoConteudoProvider>
  );
}
