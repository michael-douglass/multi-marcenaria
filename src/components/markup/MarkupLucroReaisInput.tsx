import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { formatarMoedaMarkup } from '@/lib/markup-calculo';
import { cn, parseMoneyBr } from '@/lib/utils';

interface MarkupLucroReaisInputProps {
  id?: string;
  value: number;
  onCommit: (reais: number) => void;
  disabled?: boolean;
}

function formatarRascunho(valor: number): string {
  if (!Number.isFinite(valor)) return '0,00';
  return valor.toFixed(2).replace('.', ',');
}

function textoExibido(valor: number): string {
  return formatarMoedaMarkup(valor).replace(/^R\$\s?/, '');
}

function parseLucroDigitado(raw: string): number | null {
  const limpo = raw.replace(/R\$\s?/gi, '').trim();
  if (!limpo) return 0;
  const n = parseMoneyBr(limpo);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, n);
}

/**
 * Célula de lucro em reais no caderno de markup.
 * Você escreve quanto quer ganhar; a margem % acompanha.
 */
export function MarkupLucroReaisInput({
  id = 'markup-lucro-reais',
  value,
  onCommit,
  disabled,
}: MarkupLucroReaisInputProps) {
  const focusedRef = useRef(false);
  const [draft, setDraft] = useState(() => textoExibido(value));

  useEffect(() => {
    if (focusedRef.current) return;
    setDraft(textoExibido(value));
  }, [value]);

  const confirmar = () => {
    focusedRef.current = false;
    const parsed = parseLucroDigitado(draft);
    if (parsed == null) {
      setDraft(textoExibido(value));
      return;
    }
    onCommit(parsed);
    setDraft(textoExibido(parsed));
  };

  return (
    <div
      className={cn(
        'group/lucro relative inline-flex min-w-0 items-center gap-1 rounded-md border px-1.5 py-0.5',
        'border-gold/border-subtle bg-mahogany/40 shadow-[inset_0_1px_0_rgba(242,216,146,0.08)]',
        'transition-[border-color,box-shadow] duration-200',
        'focus-within:border-gold focus-within:shadow-[0_0_0_1px_rgba(242,216,146,0.35)]',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <span className="pointer-events-none select-none font-display text-[10px] tracking-[0.14em] text-gold">
        R$
      </span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        disabled={disabled}
        aria-label="Lucro em reais. A margem percentual se ajusta automaticamente."
        title="Digite o lucro em reais — a margem % se ajusta"
        value={draft}
        onFocus={() => {
          focusedRef.current = true;
          setDraft(formatarRascunho(value));
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            focusedRef.current = false;
            setDraft(textoExibido(value));
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={cn(
          'h-6 w-[6.75rem] border-0 bg-transparent p-0 text-right text-[13px] font-medium tabular-nums',
          'text-foreground outline-none placeholder:text-muted-foreground',
        )}
      />
      <Pencil
        className={cn(
          'h-3 w-3 shrink-0 text-gold/50 transition-opacity duration-200',
          'group-hover/lucro:text-gold group-focus-within/lucro:opacity-0',
        )}
        aria-hidden="true"
      />
    </div>
  );
}
