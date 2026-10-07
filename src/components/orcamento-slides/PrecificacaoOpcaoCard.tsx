import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { BRL, type OpcaoPagamentoApresentacao } from '@/lib/orcamento-slide-precificacao';

interface PaletaPrecificacao {
  primaria: string;
  secundaria: string;
  tituloFont: string;
  corpoFont: string;
}

interface PrecificacaoOpcaoCardProps {
  opcao: OpcaoPagamentoApresentacao;
  paleta: PaletaPrecificacao;
  mobile?: boolean;
  fator?: number;
  variant?: 'slide' | 'slide-hero' | 'form-preview';
  className?: string;
  style?: CSSProperties;
  textAlign?: 'left' | 'center' | 'right';
}

/** Card de opção de pagamento — slide, PDF (via clone) e prévia do formulário. */
export function PrecificacaoOpcaoCard({
  opcao,
  paleta,
  mobile = false,
  fator = 1,
  variant = 'slide',
  className,
  style,
  textAlign = 'left',
}: PrecificacaoOpcaoCardProps) {
  const isHero = variant === 'slide-hero';
  const isForm = variant === 'form-preview';
  const alignCenter = textAlign === 'center';
  const alignRight = textAlign === 'right';
  const temAjuste = opcao.temDesconto || opcao.temAcrescimo;

  const precoPx = isHero ? (mobile ? 36 : 52) * fator : isForm ? 22 : (mobile ? 22 : 28) * fator;
  const nomePx = (mobile ? 13 : isForm ? 13 : 16) * fator;
  const cream = '#f7efe4';
  const espresso = '#0d0806';

  return (
    <div
      data-orcamento-preco-card=""
      className={cn(
        'relative overflow-hidden',
        !isForm && 'rounded-2xl border',
        isForm && 'paper-accent-card rounded-xl',
        className,
      )}
      style={{
        borderColor: isForm ? undefined : `${paleta.secundaria}99`,
        background: isForm ? undefined : espresso,
        boxShadow: isForm
          ? undefined
          : `inset 0 1px 0 ${paleta.secundaria}55, 0 0 0 1px ${paleta.secundaria}28`,
        padding: isHero ? (mobile ? 20 : 28) : isForm ? 14 : mobile ? 16 : 20,
        textAlign,
        ...style,
      }}
    >
      {!isForm && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ background: paleta.secundaria, opacity: 0.85 }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.14]"
            style={{
              backgroundImage: `radial-gradient(ellipse at 12% 0%, ${paleta.secundaria} 0%, transparent 52%)`,
            }}
          />
        </>
      )}

      <div className={cn('relative flex flex-col gap-2', alignCenter && 'items-center', alignRight && 'items-end')}>
        {(variant !== 'slide-hero' || temAjuste) && (
          <p
            className={cn('font-serif font-bold tracking-tight', isForm ? 'text-foreground' : undefined)}
            style={{
              fontFamily: `'${paleta.tituloFont}', serif`,
              fontSize: nomePx,
              color: isForm ? undefined : cream,
            }}
          >
            {opcao.nome}
          </p>
        )}

        {temAjuste && (
          <div className={cn('flex flex-wrap items-center gap-2', alignCenter && 'justify-center', alignRight && 'justify-end')}>
            <span
              className={cn(
                opcao.temDesconto && !opcao.temAcrescimo && 'line-through',
                isForm ? 'text-muted-foreground' : undefined,
              )}
              style={{
                fontFamily: `'${paleta.corpoFont}', sans-serif`,
                fontSize: (mobile ? 13 : 16) * fator,
                color: isForm ? undefined : 'rgba(247, 239, 228, 0.45)',
              }}
            >
              {BRL(opcao.valorIntegral)}
            </span>
            {opcao.temDesconto && (
              <span
                className={cn(
                  'rounded-full font-bold uppercase tracking-wider',
                  isForm
                    ? 'bg-[#f3ebe1] text-[#6b3d12] border border-[#8d5e22]/35 px-2 py-0.5 text-[10px]'
                    : 'px-2.5 py-1 text-[11px]',
                )}
                style={
                  isForm
                    ? undefined
                    : {
                        background: paleta.secundaria,
                        color: paleta.primaria,
                        fontFamily: `'${paleta.corpoFont}', sans-serif`,
                      }
                }
              >
                −{opcao.descontoPercent}% OFF
              </span>
            )}
            {opcao.temAcrescimo && (
              <span
                className={cn(
                  'rounded-full font-bold uppercase tracking-wider',
                  isForm
                    ? 'bg-[#ecfdf3] text-[#166534] border border-emerald-600/30 px-2 py-0.5 text-[10px]'
                    : 'px-2.5 py-1 text-[11px]',
                )}
                style={
                  isForm
                    ? undefined
                    : {
                        background: `${paleta.secundaria}33`,
                        color: '#fff',
                        border: `1px solid ${paleta.secundaria}80`,
                        fontFamily: `'${paleta.corpoFont}', sans-serif`,
                      }
                }
              >
                +{opcao.acrescimoPercent}%
              </span>
            )}
          </div>
        )}

        <p
          className={cn('font-serif font-black', isForm ? 'text-foreground' : undefined)}
          style={{
            fontFamily: `'${paleta.tituloFont}', serif`,
            fontSize: precoPx,
            // leading-none fazia o html2canvas desenhar o valor sobre a linha de parcelas no PDF.
            lineHeight: 1.1,
            color: isForm ? undefined : paleta.secundaria,
            textShadow: isForm ? undefined : `0 1px 0 ${espresso}, 0 2px 18px ${paleta.secundaria}40`,
          }}
        >
          {BRL(opcao.valorFinal)}
        </p>

        <div className={cn('flex flex-col gap-1 mt-1', alignCenter && 'items-center', alignRight && 'items-end')}>
          {opcao.linhas.map((linha) => (
            <p
              key={linha}
              className={cn(isForm ? 'text-muted-foreground' : undefined)}
              style={{
                fontFamily: `'${paleta.corpoFont}', sans-serif`,
                fontSize: isForm ? 12 : (mobile ? 13 : 16) * fator,
                lineHeight: 1.45,
                color: isForm ? undefined : cream,
              }}
            >
              {linha}
            </p>
          ))}
          {opcao.observacao?.trim() && (
            <p
              className={cn(
                'mt-1 max-w-prose whitespace-pre-line italic',
                isForm ? 'text-[#6b3d12]' : undefined,
              )}
              style={{
                fontFamily: `'${paleta.corpoFont}', sans-serif`,
                fontSize: isForm ? 11 : (mobile ? 12 : 14) * fator,
                lineHeight: 1.45,
                color: isForm ? undefined : 'rgba(247, 239, 228, 0.78)',
              }}
            >
              {opcao.observacao.trim()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
