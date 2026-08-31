import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { CuboMagicoLens } from '@/components/orcamento-slides/CuboMagicoFundo';
import { urlImagemApresentacao } from '@/lib/orcamento-slide-imagem-url';
import type { BlocoEscalaVisual } from '@/lib/orcamento-slide-types';
import { slideTypography } from '@/lib/orcamento-slide-typography';

interface PaletaCapa {
  secundaria: string;
  tituloFont: string;
  corpoFont: string;
  logoUrl: string | null;
}

interface CapaEditorialProps {
  paleta: PaletaCapa;
  titulo: string;
  subtitulo: string;
  mobile: boolean;
  previewMode: boolean;
  cuboAtivo: boolean;
  overlay: boolean;
  alignItems: string;
  alignText: string;
  sombraTexto: CSSProperties;
  reveal: (delay?: number, preview?: boolean) => CSSProperties;
  escala?: BlocoEscalaVisual;
}

/** Quebra "Nome - Local" sem inventar texto: só usa o que já está escrito. */
function partirSubtituloCapa(raw: string): { cliente: string; local: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { cliente: '', local: null };
  const parts = trimmed.split(/\s+[-–—]\s+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { cliente: parts[0], local: parts.slice(1).join(' — ') };
  }
  return { cliente: trimmed, local: null };
}

function ehTituloGenericoCapa(titulo: string): boolean {
  return titulo.trim().toLowerCase() === 'proposta comercial';
}

function revealAttr(previewMode: boolean) {
  return !previewMode ? true : undefined;
}

/** Cantos em ouro — como a moldura de um catálogo de marcenaria. */
export function CapaMolduraOuro({
  color,
  className,
}: {
  color: string;
  className?: string;
}) {
  const edge = { borderColor: color };
  return (
    <div
      className={cn('pointer-events-none absolute z-[8]', className)}
      aria-hidden
    >
      <span className="absolute inset-0 border opacity-25" style={edge} />
      <span className="absolute left-0 top-0 h-[4.5rem] w-[4.5rem] border-l-[1.5px] border-t-[1.5px]" style={edge} />
      <span className="absolute right-0 top-0 h-[4.5rem] w-[4.5rem] border-r-[1.5px] border-t-[1.5px]" style={edge} />
      <span className="absolute bottom-0 left-0 h-[4.5rem] w-[4.5rem] border-b-[1.5px] border-l-[1.5px]" style={edge} />
      <span className="absolute bottom-0 right-0 h-[4.5rem] w-[4.5rem] border-b-[1.5px] border-r-[1.5px]" style={edge} />
    </div>
  );
}

function OrnamentoLinha({
  color,
  centered,
  previewMode,
  reveal,
  delay,
}: {
  color: string;
  centered: boolean;
  previewMode: boolean;
  reveal: (delay?: number, preview?: boolean) => CSSProperties;
  delay: number;
}) {
  return (
    <div
      className={cn('mt-1 flex items-center gap-3', centered ? 'justify-center' : 'justify-start')}
      style={reveal(delay, previewMode)}
      data-reveal={revealAttr(previewMode)}
    >
      <span className="h-px w-10 sm:w-14" style={{ background: color, opacity: 0.85 }} />
      <span
        className="h-1.5 w-1.5 rotate-45"
        style={{ background: color, boxShadow: `0 0 10px ${color}` }}
      />
      <span className="h-px w-10 sm:w-14" style={{ background: color, opacity: 0.85 }} />
    </div>
  );
}

/**
 * Hierarquia da capa: o rótulo pequeno, o nome do cliente grande, o lugar embaixo.
 * Não altera as palavras — só organiza o que já existe.
 */
export function CapaEditorialTextos({
  paleta: p,
  titulo,
  subtitulo,
  mobile,
  previewMode,
  cuboAtivo,
  overlay,
  alignItems,
  alignText,
  sombraTexto,
  reveal,
  escala = 'normal',
}: CapaEditorialProps) {
  const typo = slideTypography(mobile, escala);
  const generico = ehTituloGenericoCapa(titulo);
  const partido = partirSubtituloCapa(subtitulo);
  const centered = alignText.includes('center');

  const kicker = generico ? titulo : null;
  const hero = generico && partido.cliente ? partido.cliente : titulo;
  const linhaLocal = generico ? partido.local : null;
  const linhaSub = generico ? null : subtitulo;

  return (
    <CuboMagicoLens
      enabled={cuboAtivo}
      kind="content"
      className={cn(
        'flex w-full flex-col',
        mobile ? 'gap-3.5' : 'gap-5',
        alignItems,
      )}
    >
      {p.logoUrl && (
        <div
          className={cn(
            'mb-1 flex',
            centered ? 'justify-center' : 'justify-start',
          )}
          style={reveal(0, previewMode)}
          data-reveal={revealAttr(previewMode)}
        >
          <div
            className="flex items-center justify-center p-2"
            style={{
              boxShadow: `inset 0 0 0 1px ${p.secundaria}55`,
            }}
          >
            <img
              src={urlImagemApresentacao(p.logoUrl, mobile, 'small')}
              alt="Logo"
              className={cn(
                'object-contain',
                mobile ? 'h-14 max-w-[min(100%,240px)]' : 'h-[4.25rem] max-w-[min(100%,220px)]',
              )}
              loading="eager"
              decoding="async"
            />
          </div>
        </div>
      )}

      {kicker && (
        <p
          className="w-full max-w-full"
          style={{
            color: p.secundaria,
            fontFamily: `'${p.corpoFont}', sans-serif`,
            fontWeight: 600,
            ...typo.etiqueta,
            letterSpacing: mobile ? '0.28em' : '0.38em',
            ...sombraTexto,
            ...reveal(80, previewMode),
          }}
          data-reveal={revealAttr(previewMode)}
        >
          {kicker}
        </p>
      )}

      <h1
        className="font-serif font-black w-full max-w-full"
        style={{
          fontFamily: `'${p.tituloFont}', serif`,
          color: overlay ? '#f7efe4' : p.secundaria,
          ...typo.capaTitulo,
          fontSize: generico && partido.cliente
            ? (mobile
              ? 'clamp(2.1rem, 11cqi, 3.15rem)'
              : 'clamp(2.4rem, 8.5cqi, 4.15rem)')
            : typo.capaTitulo.fontSize,
          lineHeight: 1.05,
          fontWeight: 700,
          ...sombraTexto,
          ...reveal(160, previewMode),
        }}
        data-reveal={revealAttr(previewMode)}
      >
        {hero}
      </h1>

      {linhaLocal && (
        <p
          className="w-full max-w-full"
          style={{
            color: overlay ? 'rgba(247, 239, 228, 0.78)' : 'rgba(255,255,255,0.82)',
            fontFamily: `'${p.tituloFont}', serif`,
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: mobile
              ? 'clamp(1.05rem, 4.4cqi, 1.35rem)'
              : 'clamp(1.15rem, 3.2cqi, 1.65rem)',
            letterSpacing: '0.04em',
            ...sombraTexto,
            ...reveal(260, previewMode),
          }}
          data-reveal={revealAttr(previewMode)}
        >
          {linhaLocal}
        </p>
      )}

      {linhaSub && (
        <p
          className="w-full max-w-full"
          style={{
            color: overlay ? 'rgba(247, 239, 228, 0.86)' : 'rgba(255,255,255,0.85)',
            fontFamily: `'${p.corpoFont}', sans-serif`,
            ...typo.capaSubtitulo,
            ...sombraTexto,
            ...reveal(240, previewMode),
          }}
          data-reveal={revealAttr(previewMode)}
        >
          {linhaSub}
        </p>
      )}

      <OrnamentoLinha
        color={p.secundaria}
        centered={centered}
        previewMode={previewMode}
        reveal={reveal}
        delay={340}
      />
    </CuboMagicoLens>
  );
}
