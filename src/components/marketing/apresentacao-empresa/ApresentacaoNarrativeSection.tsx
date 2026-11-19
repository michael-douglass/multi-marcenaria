import { useEffect, useRef, useState } from 'react';
import type { ApresentacaoConteudo, ApresentacaoSecao } from './apresentacao-conteudo';
import { useConteudoApresentacao } from './ApresentacaoConteudoContext';
import { ApresentacaoSection, revealStyle } from './ApresentacaoSection';
import { APRESENTACAO_THEME } from './apresentacao-theme';
import { ProjetosFlipCube } from './ProjetosFlipCube';

interface ApresentacaoNarrativeSectionProps {
  section: ApresentacaoSecao;
}

function backgroundForSection(id: ApresentacaoSecao['id'], imagens: ApresentacaoConteudo['imagens']): string | undefined {
  if (id === 'proposta') return imagens.proposta;
  if (id === 'origem') return imagens.origem;
  return undefined;
}

function variantForSection(id: ApresentacaoSecao['id']) {
  if (id === 'origem') return 'soft' as const;
  if (id === 'prova-social') return 'gradient' as const;
  /** Proposta: overlay mais leve para a foto aparecer sob os cubos */
  if (id === 'proposta') return 'soft' as const;
  return 'image' as const;
}

export function ApresentacaoNarrativeSection({ section }: ApresentacaoNarrativeSectionProps) {
  const { conteudo } = useConteudoApresentacao();
  const bg = backgroundForSection(section.id, conteudo.imagens);
  const variant = variantForSection(section.id);
  const isProposta = section.id === 'proposta';
  const [cubeActive, setCubeActive] = useState(false);
  const sectionHostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isProposta) return;

    const host = sectionHostRef.current;
    const sectionEl = host?.closest('section') ?? host;
    if (!sectionEl) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setCubeActive(entry.isIntersecting && entry.intersectionRatio >= 0.2);
      },
      { threshold: [0.15, 0.2, 0.35] },
    );

    observer.observe(sectionEl);
    return () => observer.disconnect();
  }, [isProposta]);

  return (
    <ApresentacaoSection
      id={section.id}
      variant={variant}
      backgroundImage={bg}
      layer={isProposta ? <ProjetosFlipCube active={cubeActive} /> : undefined}
    >
      <div
        ref={sectionHostRef}
        className={isProposta ? 'app-proposta-copy relative isolate' : undefined}
      >
        <p
          data-reveal
          style={{
            ...revealStyle(0),
            fontFamily: APRESENTACAO_THEME.fontBody,
            color: APRESENTACAO_THEME.gold,
            ...(isProposta ? { textShadow: APRESENTACAO_THEME.textShadowGold } : null),
          }}
          className="mb-4 text-xs font-semibold tracking-[0.35em] uppercase"
        >
          {section.eyebrow}
        </p>

        <h2
          data-reveal
          style={{
            ...revealStyle(80),
            fontFamily: APRESENTACAO_THEME.fontDisplay,
            color: APRESENTACAO_THEME.textPrimary,
            ...(isProposta ? { textShadow: APRESENTACAO_THEME.textShadowTitle } : null),
          }}
          className="mb-8 text-[clamp(1.75rem,4.5vw,2.75rem)] font-light leading-tight text-balance"
        >
          {section.title}
        </h2>

        <div className="space-y-5">
          {section.paragraphs.map((paragraph, i) => (
            <p
              key={paragraph.slice(0, 24)}
              data-reveal
              style={{
                ...revealStyle(160 + i * 100),
                fontFamily: APRESENTACAO_THEME.fontBody,
                color: isProposta ? 'rgba(255, 250, 244, 0.92)' : APRESENTACAO_THEME.textMuted,
                ...(isProposta ? { textShadow: APRESENTACAO_THEME.textShadowBody } : null),
              }}
              className="text-base leading-[1.75] sm:text-lg"
            >
              {paragraph}
            </p>
          ))}
        </div>

        {section.highlight && (
          <blockquote
            data-reveal
            style={{
              ...revealStyle(160 + section.paragraphs.length * 100),
              fontFamily: APRESENTACAO_THEME.fontDisplay,
              color: APRESENTACAO_THEME.gold,
              borderColor: APRESENTACAO_THEME.goldMuted,
              ...(isProposta ? { textShadow: APRESENTACAO_THEME.textShadowGold } : null),
            }}
            className="mt-10 border-l-2 pl-5 text-[clamp(1.15rem,3vw,1.5rem)] font-light italic leading-snug"
          >
            {section.highlight}
          </blockquote>
        )}
      </div>
    </ApresentacaoSection>
  );
}
