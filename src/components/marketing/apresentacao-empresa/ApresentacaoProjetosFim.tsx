import { revealStyle } from './ApresentacaoSection';
import { useConteudoApresentacao } from './ApresentacaoConteudoContext';
import { APRESENTACAO_THEME } from './apresentacao-theme';

interface ApresentacaoProjetosFimProps {
  onIniciarParceria?: () => void;
}

/** Última tela: frase de fechamento + CTA de parceria. */
export function ApresentacaoProjetosFim({ onIniciarParceria }: ApresentacaoProjetosFimProps) {
  const { conteudo } = useConteudoApresentacao();
  return (
    <section
      id="projetos-fim"
      data-section="projetos-fim"
      className="relative isolate flex min-h-[100dvh] w-full snap-start snap-always flex-col items-center justify-center overflow-hidden px-6 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]"
      style={{ background: APRESENTACAO_THEME.bgBase }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background: `
            radial-gradient(ellipse 60% 50% at 50% 50%, rgba(242,216,146,0.08), transparent 65%),
            linear-gradient(180deg, #0a0908 0%, #1a1612 50%, #0a0908 100%)
          `,
        }}
      />
      <div className="relative z-10 mx-auto flex max-w-lg flex-col items-center text-center">
        <p
          data-reveal
          style={{
            ...revealStyle(0),
            fontFamily: APRESENTACAO_THEME.fontDisplay,
            color: APRESENTACAO_THEME.gold,
          }}
          className="mb-6 text-[clamp(1.35rem,3.5vw,1.75rem)] font-light italic leading-snug"
        >
          Cada obra conta a mesma história: o projeto intacto.
        </p>
        {onIniciarParceria && (
          <div data-reveal style={revealStyle(120)} className="flex flex-col items-center gap-3">
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
              Iniciar parceria
            </button>
            <p
              className="max-w-xs text-sm leading-relaxed"
              style={{
                fontFamily: APRESENTACAO_THEME.fontBody,
                color: APRESENTACAO_THEME.textMuted,
              }}
            >
              {conteudo.contato.aviso}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
