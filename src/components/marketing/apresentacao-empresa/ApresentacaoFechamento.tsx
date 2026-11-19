import { useConteudoApresentacao } from './ApresentacaoConteudoContext';
import { ApresentacaoSection, revealStyle } from './ApresentacaoSection';
import { APRESENTACAO_THEME } from './apresentacao-theme';

interface ApresentacaoFechamentoProps {
  onIniciarParceria: () => void;
}

export function ApresentacaoFechamento({ onIniciarParceria }: ApresentacaoFechamentoProps) {
  const { conteudo } = useConteudoApresentacao();
  const { eyebrow, title, paragraphs, closing, ctaLabel, ctaHint } = conteudo.fechamento;

  return (
    <ApresentacaoSection
      id="fechamento"
      variant="soft"
      backgroundImage={conteudo.imagens.fechamento}
    >
      <p
        data-reveal
        style={{
          ...revealStyle(0),
          fontFamily: APRESENTACAO_THEME.fontBody,
          color: APRESENTACAO_THEME.gold,
        }}
        className="mb-4 text-xs font-semibold tracking-[0.35em] uppercase"
      >
        {eyebrow}
      </p>

      <h2
        data-reveal
        style={{
          ...revealStyle(80),
          fontFamily: APRESENTACAO_THEME.fontDisplay,
          color: APRESENTACAO_THEME.textPrimary,
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
              fontFamily: APRESENTACAO_THEME.fontBody,
              color: APRESENTACAO_THEME.textMuted,
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
          fontFamily: APRESENTACAO_THEME.fontDisplay,
          color: APRESENTACAO_THEME.gold,
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
            fontFamily: APRESENTACAO_THEME.fontBody,
            background: APRESENTACAO_THEME.gold,
            color: APRESENTACAO_THEME.bgBase,
            outlineColor: APRESENTACAO_THEME.gold,
          }}
        >
          {ctaLabel}
        </button>
        <p
          className="max-w-sm text-sm leading-relaxed"
          style={{
            fontFamily: APRESENTACAO_THEME.fontBody,
            color: APRESENTACAO_THEME.textMuted,
          }}
        >
          {ctaHint}
        </p>
      </div>
    </ApresentacaoSection>
  );
}
