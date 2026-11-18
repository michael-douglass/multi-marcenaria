import { createContext, useContext, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useAppOptional } from '@/context/AppContext';
import { formatCnpj } from '@/lib/empresa-identidade';

/** Dados legais da empresa dona do orçamento (vêm do RPC público `orcamento_publico_obter`). */
export interface EmpresaDadosLegaisFonte {
  nome?: string | null;
  razao_social?: string | null;
  cnpj?: string | null;
  logo_url?: string | null;
  telefone?: string | null;
  email?: string | null;
  cidade?: string | null;
  uf?: string | null;
}

const EmpresaPublicaContext = createContext<EmpresaDadosLegaisFonte | null>(null);

/**
 * Página pública (sem sessão): fornece a empresa do orçamento para todos os slides, inclusive o
 * render offscreen da exportação. Tem prioridade sobre a empresa da sessão.
 */
export function EmpresaPublicaProvider({
  empresa,
  children,
}: {
  empresa: EmpresaDadosLegaisFonte | null | undefined;
  children: ReactNode;
}) {
  return <EmpresaPublicaContext.Provider value={empresa ?? null}>{children}</EmpresaPublicaContext.Provider>;
}

interface EmpresaDadosLegaisProps {
  color?: string;
  className?: string;
  style?: CSSProperties;
  /** compact = uma linha; stacked = rótulos empilhados (capa / PDF). */
  variant?: 'stacked' | 'inline';
  align?: 'left' | 'center' | 'right';
  /** Empresa explícita (prioridade sobre o provider público e sobre a empresa da sessão). */
  empresa?: EmpresaDadosLegaisFonte | null;
}

/**
 * Razão social e CNPJ da casa — aparecem na capa e no slide de investimento
 * (e, portanto, no PDF/impressão da apresentação).
 */
export function EmpresaDadosLegais({
  color = 'rgba(242, 216, 146, 0.88)',
  className,
  style,
  variant = 'stacked',
  align = 'left',
  empresa: empresaProp,
}: EmpresaDadosLegaisProps) {
  // Multi-empresa: prop → empresa do orçamento público → empresa da sessão (sem fallback fixo).
  // Sem dados cadastrados, não renderiza nada.
  const publica = useContext(EmpresaPublicaContext);
  const sessao = useAppOptional()?.empresa ?? null;
  const fonte: EmpresaDadosLegaisFonte | null =
    empresaProp ?? publica ?? (sessao ? { razao_social: sessao.razaoSocial, cnpj: sessao.cnpj } : null);
  const razao = fonte?.razao_social?.trim() || '';
  const cnpj = formatCnpj(fonte?.cnpj);
  if (!razao && !cnpj) return null;
  const textAlign = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';

  if (variant === 'inline') {
    return (
      <p
        className={cn('w-full max-w-full tracking-wide', textAlign, className)}
        style={{
          color,
          fontSize: 'clamp(0.7rem, 1.6cqi, 0.82rem)',
          letterSpacing: '0.06em',
          lineHeight: 1.5,
          ...style,
        }}
      >
        Razão Social: {razao}
        <span aria-hidden style={{ opacity: 0.45 }}>
          {' '}
          ·{' '}
        </span>
        CNPJ: {cnpj}
      </p>
    );
  }

  return (
    <div
      className={cn('w-full max-w-full space-y-1', textAlign, className)}
      style={{ color, ...style }}
    >
      <p
        className="m-0"
        style={{
          fontSize: 'clamp(0.68rem, 1.55cqi, 0.8rem)',
          letterSpacing: '0.04em',
          lineHeight: 1.45,
        }}
      >
        <span
          className="block opacity-80"
          style={{
            fontSize: '0.65em',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            marginBottom: 2,
          }}
        >
          Razão Social
        </span>
        {razao}
      </p>
      <p
        className="m-0"
        style={{
          fontSize: 'clamp(0.68rem, 1.55cqi, 0.8rem)',
          letterSpacing: '0.04em',
          lineHeight: 1.45,
        }}
      >
        <span
          className="block opacity-80"
          style={{
            fontSize: '0.65em',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            marginBottom: 2,
          }}
        >
          CNPJ
        </span>
        {cnpj}
      </p>
    </div>
  );
}
