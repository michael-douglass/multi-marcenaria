import {
  GARBO_APRESENTACAO_FECHAMENTO,
  GARBO_APRESENTACAO_IMAGES,
} from './garbo-apresentacao-content';
import { GarboApresentacaoSection, revealStyle } from './GarboApresentacaoSection';
import { GARBO_APRESENTACAO_THEME } from './garbo-apresentacao-theme';

interface GarboApresentacaoFechamentoProps {
  onIniciarParceria: () => void;
}

export function GarboApresentacaoFechamento({ onIniciarParceria }: GarboApresentacaoFechamentoProps) {
  const { eyebrow, title, paragraphs, closing, ctaLabel, ctaHint } = GARBO_APRESENTACAO_FECHAMENTO;

  return (
    <GarboApresentacaoSection
      id="fechamento"
      variant="soft"
      backgroundImage={GARBO_APRESENTACAO_IMAGES.fechamento}
    >
      <p
        data-reveal
        style={{
          ...revealStyle(0),
          fontFamily: GARBO_APRESENTACAO_THEME.fontBody,
          color: GARBO_APRESENTACAO_THEME.gold,
        }}
        className="mb-4 text-xs font-semibold tracking-[0.35em] uppercase"
      >
        {eyebrow}
      </p>

      <h2
        data-reveal
        style={{
          ...revealStyle(80),
          fontFamily: GARBO_APRESENTACAO_THEME.fontDisplay,
          color: GARBO_APRESENTACAO_THEME.textPrimary,
        }}
        className="mb-8 text-[clamp(1.75rem,4.5vw,2.75rem)] font-light leading-tight text-balance"
      >
        {title}
      </h2>

      <div className="space-y-5">
        {paragraphs.map((paragraph, i) => (
          <p
            key={paragraph.slice(0, 24)}
            data-reveal
            style={{
              ...revealStyle(160 + i * 100),
              fontFamily: GARBO_APRESENTACAO_THEME.fontBody,
              color: GARBO_APRESENTACAO_THEME.textMuted,
            }}
            className="text-base leading-[1.75] sm:text-lg"
          >
            {paragraph}
          </p>
        ))}
      </div>

      <p
        data-reveal
        style={{
          ...revealStyle(160 + paragraphs.length * 100),
          fontFamily: GARBO_APRESENTACAO_THEME.fontDisplay,
          color: GARBO_APRESENTACAO_THEME.gold,
        }}
        className="mt-10 text-[clamp(1.15rem,3vw,1.45rem)] font-light italic leading-snug"
      >
        {closing}
      </p>

      <div
        data-reveal
        style={revealStyle(160 + paragraphs.length * 100 + 120)}
        className="mt-12 flex flex-col items-start gap-3"
      >
        <button
          type="button"
          onClick={onIniciarParceria}
          className="inline-flex min-h-11 min-w-[11rem] items-center justify-center rounded-sm px-8 py-3 text-sm font-semibold tracking-wide transition-[transform,box-shadow] duration-300 hover:scale-[1.02] hover:shadow-[0_0_32px_rgba(242,216,146,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{
            fontFamily: GARBO_APRESENTACAO_THEME.fontBody,
            background: GARBO_APRESENTACAO_THEME.gold,
            color: GARBO_APRESENTACAO_THEME.bgBase,
            outlineColor: GARBO_APRESENTACAO_THEME.gold,
          }}
        >
          {ctaLabel}
        </button>
        <p
          className="max-w-sm text-sm leading-relaxed"
          style={{
            fontFamily: GARBO_APRESENTACAO_THEME.fontBody,
            color: GARBO_APRESENTACAO_THEME.textMuted,
          }}
        >
          {ctaHint}
        </p>
      </div>
    </GarboApresentacaoSection>
  );
}
