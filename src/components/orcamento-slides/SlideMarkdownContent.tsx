import type { CSSProperties, ReactNode } from 'react';
import { parseBlocks, renderInline, type MarkdownContentBlock } from '@/lib/lead-ai-formatted-content';
import { normalizarRelatorioAnaliseIa } from '@/lib/lead-ai-relatorio-markdown';

interface SlideMarkdownContentProps {
  content?: string;
  blocks?: MarkdownContentBlock[];
  corpoFont: string;
  tituloFont: string;
  corSecundaria: string;
  mobile?: boolean;
  revealBaseDelay?: number;
  previewMode?: boolean;
}

function revealStyle(delay: number, previewMode: boolean): CSSProperties {
  if (previewMode) return { opacity: 1, transform: 'none' };
  return { '--reveal-delay': `${delay}ms` } as CSSProperties;
}

export function SlideMarkdownContent({
  content,
  blocks: blocksProp,
  corpoFont,
  tituloFont,
  corSecundaria,
  mobile = false,
  revealBaseDelay = 120,
  previewMode = false,
}: SlideMarkdownContentProps) {
  const blocks = blocksProp ?? parseBlocks(normalizarRelatorioAnaliseIa(content ?? ''));
  let revealIndex = 0;

  const nextReveal = () => {
    const delay = revealBaseDelay + revealIndex * 45;
    revealIndex += 1;
    return revealStyle(delay, previewMode);
  };

  const bodySize = mobile ? '0.95rem' : '1.05rem';
  const lineHeight = mobile ? 1.65 : 1.75;

  return (
    <article
      className="w-full space-y-4"
      style={{ fontFamily: `'${corpoFont}', sans-serif`, color: 'rgba(255,255,255,0.88)', lineHeight }}
    >
      {blocks.map((block, index) => {
        if (block.type === 'hr') {
          return (
            <hr
              key={index}
              data-reveal={!previewMode || undefined}
              style={{
                border: 'none',
                height: 1,
                background: `linear-gradient(90deg, transparent, ${corSecundaria}55, transparent)`,
                ...nextReveal(),
              }}
            />
          );
        }

        if (block.type === 'h1' && block.text) {
          return (
            <h2
              key={index}
              data-reveal={!previewMode || undefined}
              style={{
                fontFamily: `'${tituloFont}', serif`,
                color: corSecundaria,
                fontWeight: 900,
                fontSize: mobile ? '1.35rem' : '1.65rem',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                ...nextReveal(),
              }}
            >
              {renderInline(block.text) as ReactNode}
            </h2>
          );
        }

        if (block.type === 'h2' && block.text) {
          return (
            <h3
              key={index}
              data-reveal={!previewMode || undefined}
              style={{
                fontFamily: `'${tituloFont}', serif`,
                color: corSecundaria,
                fontWeight: 800,
                fontSize: mobile ? '1.15rem' : '1.35rem',
                letterSpacing: '0.03em',
                paddingBottom: 8,
                borderBottom: `1px solid ${corSecundaria}33`,
                ...nextReveal(),
              }}
            >
              {renderInline(block.text) as ReactNode}
            </h3>
          );
        }

        if (block.type === 'h3' && block.text) {
          return (
            <h4
              key={index}
              data-reveal={!previewMode || undefined}
              style={{
                fontWeight: 700,
                fontSize: mobile ? '1rem' : '1.1rem',
                color: 'rgba(255,255,255,0.95)',
                ...nextReveal(),
              }}
            >
              {renderInline(block.text) as ReactNode}
            </h4>
          );
        }

        if (block.type === 'h4' && block.text) {
          return (
            <h5
              key={index}
              data-reveal={!previewMode || undefined}
              style={{
                fontWeight: 600,
                fontSize: mobile ? '0.95rem' : '1rem',
                color: corSecundaria,
                letterSpacing: '0.02em',
                ...nextReveal(),
              }}
            >
              {renderInline(block.text) as ReactNode}
            </h5>
          );
        }

        if (block.type === 'ul' && block.items) {
          return (
            <ul key={index} className="space-y-2.5 pl-0.5" data-reveal={!previewMode || undefined} style={nextReveal()}>
              {block.items.map((item, i) => (
                <li key={i} className="flex gap-3" style={{ fontSize: bodySize }}>
                  <span
                    aria-hidden
                    className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: corSecundaria }}
                  />
                  <span>{renderInline(item) as ReactNode}</span>
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === 'ol' && block.items) {
          return (
            <ol key={index} className="space-y-2.5" data-reveal={!previewMode || undefined} style={nextReveal()}>
              {block.items.map((item, i) => (
                <li key={i} className="flex gap-3" style={{ fontSize: bodySize }}>
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    style={{ background: `${corSecundaria}22`, color: corSecundaria, border: `1px solid ${corSecundaria}44` }}
                  >
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{renderInline(item) as ReactNode}</span>
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === 'p' && block.text) {
          return (
            <p
              key={index}
              data-reveal={!previewMode || undefined}
              style={{ fontSize: bodySize, color: 'rgba(255,255,255,0.84)', ...nextReveal() }}
            >
              {renderInline(block.text) as ReactNode}
            </p>
          );
        }

        return null;
      })}
    </article>
  );
}
