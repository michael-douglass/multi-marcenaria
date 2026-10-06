import type { CSSProperties } from 'react';
import { formatarMoedaMarkup } from '@/lib/markup-calculo';
import {
  MARKUP_ORCAMENTO_SIMPLES_ALTURA_MIN_PX,
  MARKUP_ORCAMENTO_SIMPLES_LARGURA_PX,
  calcularTotaisOrcamentoSimples,
  centavosParaReais,
  colunasGaleriaOrcamentoSimples,
  dataValidadeOrcamentoSimples,
  formatarDataOrcamentoSimples,
} from '@/lib/markup-orcamento-simples';
import type { MarkupOrcamentoSimples } from '@/lib/markup-types';

const CREAM = '#fbf6ec';
const CREAM_DEEP = '#efe4d0';
const BRASS = '#c4a35a';
const INK = '#2c1d12';
const MUTED = '#6b5340';
const CORMORANT = "'Cormorant Garamond', Georgia, serif";
const RALEWAY = "'Raleway', 'DM Sans', sans-serif";

export interface MarkupOrcamentoSimplesFolhaBranding {
  /** Nome fantasia (cabeçalho visual). */
  empresaNome: string;
  /** Razão social legal — impressa no documento. */
  empresaRazaoSocial?: string | null;
  empresaCnpj?: string | null;
  logoUrl?: string | null;
}

interface MarkupOrcamentoSimplesFolhaProps {
  doc: MarkupOrcamentoSimples;
  branding: MarkupOrcamentoSimplesFolhaBranding;
  clienteNome: string;
  fotosEmbutidas: string[];
}

export function MarkupOrcamentoSimplesFolha({
  doc,
  branding,
  clienteNome,
  fotosEmbutidas,
}: MarkupOrcamentoSimplesFolhaProps) {
  const totais = calcularTotaisOrcamentoSimples(doc);
  const hoje = new Date();
  const validade = dataValidadeOrcamentoSimples(doc.validade_dias, hoje);
  const cols = colunasGaleriaOrcamentoSimples(fotosEmbutidas.length);
  const razaoSocial = branding.empresaRazaoSocial?.trim() || branding.empresaNome;
  const cnpj = branding.empresaCnpj?.trim();

  return (
    <article
      data-markup-orcamento-folha=""
      style={{
        width: MARKUP_ORCAMENTO_SIMPLES_LARGURA_PX,
        minHeight: MARKUP_ORCAMENTO_SIMPLES_ALTURA_MIN_PX,
        boxSizing: 'border-box',
        padding: '42px 48px 36px',
        background: `linear-gradient(180deg, ${CREAM} 0%, ${CREAM_DEEP} 100%)`,
        color: INK,
        fontFamily: RALEWAY,
        boxShadow: '0 0 0 1px rgba(196,163,90,0.45) inset',
        position: 'relative',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 14,
          border: `1px solid ${BRASS}`,
          opacity: 0.55,
          pointerEvents: 'none',
        }}
      />

      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 24,
          paddingBottom: 22,
          borderBottom: `1px solid ${BRASS}`,
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt=""
              style={{
                width: 72,
                height: 72,
                objectFit: 'contain',
                flexShrink: 0,
              }}
            />
          ) : null}
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontFamily: CORMORANT,
                fontSize: 26,
                fontWeight: 600,
                letterSpacing: '0.02em',
                lineHeight: 1.15,
              }}
            >
              {branding.empresaNome}
            </p>
            <p
              style={{
                margin: '8px 0 0',
                fontSize: 11,
                letterSpacing: '0.04em',
                color: MUTED,
                lineHeight: 1.45,
              }}
            >
              <span style={{ color: BRASS, letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: 9 }}>
                Razão Social
              </span>
              <br />
              {razaoSocial}
            </p>
            {cnpj ? (
              <p
                style={{
                  margin: '6px 0 0',
                  fontSize: 11,
                  letterSpacing: '0.04em',
                  color: MUTED,
                  lineHeight: 1.45,
                }}
              >
                <span style={{ color: BRASS, letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: 9 }}>
                  CNPJ
                </span>
                <br />
                {cnpj}
              </p>
            ) : null}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p
            style={{
              margin: 0,
              fontFamily: CORMORANT,
              fontStyle: 'italic',
              fontSize: 28,
              color: BRASS,
              lineHeight: 1,
            }}
          >
            Orçamento
          </p>
          <p style={{ margin: '8px 0 0', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTED }}>
            {formatarDataOrcamentoSimples(hoje)}
          </p>
        </div>
      </header>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 16,
          padding: '22px 0 18px',
        }}
      >
        <MetaBloco rotulo="Cliente" valor={clienteNome || '—'} />
        <MetaBloco rotulo="Proposta" valor={doc.titulo || '—'} />
        <MetaBloco rotulo="Validade até" valor={formatarDataOrcamentoSimples(validade)} />
      </section>

      {fotosEmbutidas.length > 0 ? (
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gap: 10,
            marginBottom: 22,
          }}
        >
          {fotosEmbutidas.map((src, i) => (
            <div
              key={`${src}-${i}`}
              style={{
                position: 'relative',
                aspectRatio: '4 / 3',
                overflow: 'hidden',
                background: '#e8dcc6',
                boxShadow: `0 0 0 1px ${BRASS}`,
              }}
            >
              <img
                src={src}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              <span
                style={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  fontFamily: CORMORANT,
                  fontSize: 13,
                  letterSpacing: '0.12em',
                  color: BRASS,
                  textShadow: '0 1px 2px rgba(20,14,11,0.55)',
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
            </div>
          ))}
        </section>
      ) : null}

      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 13,
        }}
      >
        <thead>
          <tr style={{ borderBottom: `1px solid ${BRASS}` }}>
            <th style={thStyle('left')}>Item</th>
            <th style={thStyle('right')}>Qtd</th>
            <th style={thStyle('right')}>Unitário</th>
            <th style={thStyle('right')}>Total</th>
          </tr>
        </thead>
        <tbody>
          {doc.itens.map((item) => {
            const linha = Math.round(Math.max(0, item.quantidade) * Math.max(0, item.unitario_centavos));
            return (
              <tr key={item.id} style={{ borderBottom: '1px solid rgba(196,163,90,0.28)' }}>
                <td style={{ ...tdStyle('left'), fontWeight: 500 }}>{item.descricao || '—'}</td>
                <td style={tdStyle('right')}>{formatarQtd(item.quantidade)}</td>
                <td style={tdStyle('right')}>{formatarMoedaMarkup(centavosParaReais(item.unitario_centavos))}</td>
                <td style={{ ...tdStyle('right'), fontWeight: 600 }}>
                  {formatarMoedaMarkup(centavosParaReais(linha))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 22 }}>
        <div style={{ width: 340 }}>
          <LinhaTotal rotulo="Subtotal" valor={formatarMoedaMarkup(centavosParaReais(totais.subtotal_centavos))} />
          {totais.desconto_centavos > 0 ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                marginTop: 10,
                marginBottom: 4,
                padding: '12px 14px',
                borderRadius: 8,
                border: '2px solid #c45c3a',
                background: 'linear-gradient(135deg, #fff4ee 0%, #ffe8dc 100%)',
              }}
            >
              <span
                style={{
                  fontFamily: RALEWAY,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: '#a33d1f',
                }}
              >
                Desconto
                {doc.desconto_tipo === 'percent' ? (
                  <span
                    style={{
                      display: 'inline-block',
                      marginLeft: 8,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: '#c45c3a',
                      color: '#fff',
                      fontSize: 11,
                      letterSpacing: '0.04em',
                      verticalAlign: 'middle',
                    }}
                  >
                    −{Number(doc.desconto_valor).toLocaleString('pt-BR')}%
                  </span>
                ) : null}
              </span>
              <span
                style={{
                  fontFamily: CORMORANT,
                  fontSize: 26,
                  fontWeight: 700,
                  color: '#a33d1f',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}
              >
                −{formatarMoedaMarkup(centavosParaReais(totais.desconto_centavos))}
              </span>
            </div>
          ) : null}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 16,
              marginTop: 12,
              padding: '16px 18px',
              borderRadius: 10,
              border: `2px solid ${BRASS}`,
              background: 'linear-gradient(145deg, #2a1812 0%, #3d2418 55%, #5a3a1f 100%)',
              boxShadow: '0 10px 28px rgba(42, 24, 18, 0.16)',
            }}
          >
            <span
              style={{
                fontFamily: RALEWAY,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: '#f2d892',
              }}
            >
              Preço final
            </span>
            <span
              style={{
                fontFamily: CORMORANT,
                fontSize: 38,
                fontWeight: 700,
                color: '#f7efe4',
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatarMoedaMarkup(centavosParaReais(totais.total_centavos))}
            </span>
          </div>
        </div>
      </div>

      {doc.observacoes.trim() ? (
        <section style={{ marginTop: 28 }}>
          <p
            style={{
              margin: '0 0 8px',
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: BRASS,
            }}
          >
            Observações
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 12.5,
              lineHeight: 1.55,
              color: MUTED,
              whiteSpace: 'pre-wrap',
            }}
          >
            {doc.observacoes.trim()}
          </p>
        </section>
      ) : null}

      <footer
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 48,
          marginTop: 56,
          paddingTop: 8,
        }}
      >
        <Assinatura rotulo="Cliente" />
        <Assinatura rotulo={branding.empresaNome} />
      </footer>
    </article>
  );
}

function MetaBloco({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p
        style={{
          margin: 0,
          fontSize: 10,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: BRASS,
        }}
      >
        {rotulo}
      </p>
      <p
        style={{
          margin: '6px 0 0',
          fontFamily: CORMORANT,
          fontSize: 18,
          fontWeight: 600,
          lineHeight: 1.25,
        }}
      >
        {valor}
      </p>
    </div>
  );
}

function LinhaTotal({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 16,
        fontSize: 12,
        color: MUTED,
        marginBottom: 6,
      }}
    >
      <span>{rotulo}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{valor}</span>
    </div>
  );
}

function Assinatura({ rotulo }: { rotulo: string }) {
  return (
    <div>
      <div style={{ borderBottom: `1px solid ${BRASS}`, height: 48 }} />
      <p
        style={{
          margin: '8px 0 0',
          fontSize: 11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: MUTED,
        }}
      >
        {rotulo}
      </p>
    </div>
  );
}

function thStyle(align: 'left' | 'right'): CSSProperties {
  return {
    textAlign: align,
    fontSize: 10,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: BRASS,
    fontWeight: 600,
    padding: '0 0 10px 0',
  };
}

function tdStyle(align: 'left' | 'right'): CSSProperties {
  return {
    textAlign: align,
    padding: '11px 0',
    verticalAlign: 'top',
    fontVariantNumeric: 'tabular-nums',
  };
}

function formatarQtd(qtd: number): string {
  const n = Number(qtd) || 0;
  return Number.isInteger(n) ? String(n) : n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}
