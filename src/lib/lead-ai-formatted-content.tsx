import { cn } from '@/lib/utils';
import { normalizarRelatorioAnaliseIa } from '@/lib/lead-ai-relatorio-markdown';
import type { ReactNode } from 'react';

export function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
      return (
        <em key={index} className="italic text-cream-secondary">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={index}
          className="rounded bg-mahogany-muted/80 px-1.5 py-0.5 text-[0.85em] text-gold-soft font-mono"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export interface MarkdownContentBlock {
  type: 'h1' | 'h2' | 'h3' | 'h4' | 'ul' | 'ol' | 'p' | 'hr';
  items?: string[];
  text?: string;
}

interface Block extends MarkdownContentBlock {}

export function parseBlocks(raw: string): Block[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let listBuffer: { type: 'ul' | 'ol'; items: string[] } | null = null;

  const flushList = () => {
    if (listBuffer) {
      blocks.push({ type: listBuffer.type, items: listBuffer.items });
      listBuffer = null;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      flushList();
      blocks.push({ type: 'hr' });
      continue;
    }

    if (trimmed.startsWith('#### ')) {
      flushList();
      blocks.push({ type: 'h4', text: trimmed.slice(5) });
      continue;
    }

    if (trimmed.startsWith('### ')) {
      flushList();
      blocks.push({ type: 'h3', text: trimmed.slice(4) });
      continue;
    }

    if (trimmed.startsWith('## ')) {
      flushList();
      blocks.push({ type: 'h2', text: trimmed.slice(3) });
      continue;
    }

    if (trimmed.startsWith('# ')) {
      flushList();
      blocks.push({ type: 'h1', text: trimmed.slice(2) });
      continue;
    }

    const ulMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    if (ulMatch) {
      if (listBuffer?.type !== 'ul') {
        flushList();
        listBuffer = { type: 'ul', items: [] };
      }
      listBuffer.items.push(ulMatch[1]);
      continue;
    }

    const olMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (olMatch) {
      if (listBuffer?.type !== 'ol') {
        flushList();
        listBuffer = { type: 'ol', items: [] };
      }
      listBuffer.items.push(olMatch[1]);
      continue;
    }

    flushList();
    blocks.push({ type: 'p', text: trimmed });
  }

  flushList();
  return blocks;
}

export interface LeadAIFormattedContentProps {
  content: string;
  className?: string;
}

export function LeadAIFormattedContent({ content, className }: LeadAIFormattedContentProps) {
  const blocks = parseBlocks(normalizarRelatorioAnaliseIa(content));

  if (!content.trim()) {
    return (
      <p className={cn('text-sm text-muted-foreground italic', className)}>
        Nenhum conteúdo para exibir.
      </p>
    );
  }

  return (
    <article className={cn('space-y-4 text-[15px] leading-relaxed text-cream-secondary', className)}>
      {blocks.map((block, index) => {
        if (block.type === 'hr') {
          return <hr key={index} className="border-gold-border-subtle/60" />;
        }

        if (block.type === 'h1' && block.text) {
          return (
            <h2
              key={index}
              className="font-display text-2xl tracking-wide text-primary uppercase"
            >
              {renderInline(block.text)}
            </h2>
          );
        }

        if (block.type === 'h2' && block.text) {
          return (
            <h3
              key={index}
              className="font-display text-xl tracking-wide text-gold-hover uppercase border-b border-gold-border-subtle/40 pb-2"
            >
              {renderInline(block.text)}
            </h3>
          );
        }

        if (block.type === 'h3' && block.text) {
          return (
            <h4 key={index} className="text-base font-semibold text-foreground">
              {renderInline(block.text)}
            </h4>
          );
        }

        if (block.type === 'h4' && block.text) {
          return (
            <h5 key={index} className="text-sm font-semibold text-gold-hover tracking-wide">
              {renderInline(block.text)}
            </h5>
          );
        }

        if (block.type === 'ul' && block.items) {
          return (
            <ul key={index} className="space-y-2 pl-1">
              {block.items.map((item, i) => (
                <li key={i} className="flex gap-2.5">
                  <span
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-soft"
                    aria-hidden
                  />
                  <span>{renderInline(item)}</span>
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === 'ol' && block.items) {
          return (
            <ol key={index} className="space-y-2 pl-1 counter-reset-none list-none">
              {block.items.map((item, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/15 text-xs font-semibold text-gold">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{renderInline(item)}</span>
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === 'p' && block.text) {
          return (
            <p key={index} className="text-cream-secondary/95">
              {renderInline(block.text)}
            </p>
          );
        }

        return null;
      })}
    </article>
  );
}
