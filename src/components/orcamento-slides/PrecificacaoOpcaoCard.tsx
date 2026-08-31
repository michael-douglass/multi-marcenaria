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

  return (
    <div
      className={cn(
        'relative overflow-hidden',
        !isForm && 'rounded-2xl border',
        isForm && 'paper-accent-card rounded-xl',
        className,
      )}
      style={{
        borderColor: isForm ? undefined : `${paleta.secundaria}40`,
        background: isForm
          ? undefined
          : `linear-gradient(145deg, ${paleta.secundaria}18 0%, ${paleta.primaria}88 100%)`,
        boxShadow: isForm ? undefined : `0 8px 32px ${paleta.primaria}60, inset 0 1px 0 ${paleta.secundaria}25`,
        padding: isHero ? (mobile ? 20 : 28) : isForm ? 14 : mobile ? 16 : 20,
        textAlign,
        ...style,
      }}
    >
      {!isForm && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `radial-gradient(circle at 100% 0%, ${paleta.secundaria} 0%, transparent 55%)`,
          }}
        />
      )}

      <div className={cn('relative flex flex-col gap-2', alignCenter && 'items-center', alignRight && 'items-end')}>
        {(variant !== 'slide-hero' || temAjuste) && (
          <p
            className={cn('font-serif font-bold tracking-tight', isForm ? 'text-foreground' : 'text-white/95')}
            style={{
              fontFamily: `'${paleta.tituloFont}', serif`,
              fontSize: nomePx,
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
                isForm ? 'text-muted-foreground' : 'text-white/40',
              )}
              style={{
                fontFamily: `'${paleta.corpoFont}', sans-serif`,
                fontSize: (mobile ? 13 : 16) * fator,
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
          className={cn('font-serif font-black leading-none', isForm ? 'text-foreground' : 'text-white')}
          style={{
            fontFamily: `'${paleta.tituloFont}', serif`,
            fontSize: precoPx,
          }}
        >
          {BRL(opcao.valorFinal)}
        </p>

        <div className={cn('flex flex-col gap-1 mt-1', alignCenter && 'items-center', alignRight && 'items-end')}>
          {opcao.linhas.map((linha) => (
            <p
              key={linha}
              className={cn(isForm ? 'text-muted-foreground' : 'text-white/72')}
              style={{
                fontFamily: `'${paleta.corpoFont}', sans-serif`,
                fontSize: isForm ? 12 : (mobile ? 13 : 16) * fator,
                lineHeight: 1.45,
              }}
            >
              {linha}
            </p>
          ))}
          {opcao.observacao?.trim() && (
            <p
              className={cn(
                'mt-1 max-w-prose whitespace-pre-line italic',
                isForm ? 'text-[#6b3d12]' : 'text-white/58',
              )}
              style={{
                fontFamily: `'${paleta.corpoFont}', sans-serif`,
                fontSize: isForm ? 11 : (mobile ? 12 : 14) * fator,
                lineHeight: 1.45,
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
