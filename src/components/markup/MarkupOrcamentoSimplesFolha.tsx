import type { CSSProperties } from 'react';
import { formatarMoedaMarkup } from '@/lib/markup-calculo';
import {
  MARKUP_ORCAMENTO_SIMPLES_ALTURA_PX,
  MARKUP_ORCAMENTO_SIMPLES_LARGURA_PX,
  alturaMaxFotoOrcamentoSimples,
  calcularTotaisOrcamentoSimples,
  centavosParaReais,
  colunasGaleriaOrcamentoSimples,
  dataValidadeOrcamentoSimples,
  formatarDataOrcamentoSimples,
  paginarOrcamentoSimplesFolha,
  type MarkupOrcamentoSimplesPagina,
} from '@/lib/markup-orcamento-simples';
import type { MarkupOrcamentoSimples, MarkupOrcamentoSimplesItem } from '@/lib/markup-types';

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
  const razaoSocial = branding.empresaRazaoSocial?.trim() || branding.empresaNome;
  const cnpj = branding.empresaCnpj?.trim();
  const paginas = paginarOrcamentoSimplesFolha({
    fotos: fotosEmbutidas,
    itens: doc.itens,
    observacoes: doc.observacoes,
    temDesconto: totais.desconto_centavos > 0,
  });

  return (
    <div
      data-markup-orcamento-folhas=""
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 28,
        width: MARKUP_ORCAMENTO_SIMPLES_LARGURA_PX,
      }}
    >
      {paginas.map((pagina) => (
        <PaginaA4
          key={`pagina-${pagina.indice}`}
          pagina={pagina}
          branding={branding}
          razaoSocial={razaoSocial}
          cnpj={cnpj}
          clienteNome={clienteNome}
          titulo={doc.titulo}
          validade={validade}
          hoje={hoje}
          doc={doc}
          totais={totais}
        />
      ))}
    </div>
  );
}

function PaginaA4({
  pagina,
  branding,
  razaoSocial,
  cnpj,
  clienteNome,
  titulo,
  validade,
  hoje,
  doc,
  totais,
}: {
  pagina: MarkupOrcamentoSimplesPagina;
  branding: MarkupOrcamentoSimplesFolhaBranding;
  razaoSocial: string;
  cnpj?: string;
  clienteNome: string;
  titulo: string;
  validade: Date;
  hoje: Date;
  doc: MarkupOrcamentoSimples;
  totais: ReturnType<typeof calcularTotaisOrcamentoSimples>;
}) {
  const cols = colunasGaleriaOrcamentoSimples(pagina.fotos.length);

  return (
    <article
      data-markup-orcamento-folha=""
      data-pagina={pagina.indice}
      data-total-paginas={pagina.total}
      style={{
        width: MARKUP_ORCAMENTO_SIMPLES_LARGURA_PX,
        height: MARKUP_ORCAMENTO_SIMPLES_ALTURA_PX,
        boxSizing: 'border-box',
        padding: '42px 48px 36px',
        background: `linear-gradient(180deg, ${CREAM} 0%, ${CREAM_DEEP} 100%)`,
        color: INK,
        fontFamily: RALEWAY,
        boxShadow:
          '0 0 0 1px rgba(196,163,90,0.45) inset, 0 18px 48px rgba(0,0,0,0.28)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
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

      {pagina.cabecalhoCompleto ? (
        <CabecalhoCompleto
          branding={branding}
          razaoSocial={razaoSocial}
          cnpj={cnpj}
          hoje={hoje}
        />
      ) : (
        <CabecalhoContinuacao
          empresaNome={branding.empresaNome}
          logoUrl={branding.logoUrl}
          indice={pagina.indice}
          total={pagina.total}
        />
      )}

      {pagina.cabecalhoCompleto ? (
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 16,
            padding: '22px 0 18px',
            flexShrink: 0,
          }}
        >
          <MetaBloco rotulo="Cliente" valor={clienteNome || '—'} />
          <MetaBloco rotulo="Proposta" valor={titulo || '—'} />
          <MetaBloco rotulo="Validade até" valor={formatarDataOrcamentoSimples(validade)} />
        </section>
      ) : null}

      <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {pagina.fotos.length > 0 ? (
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gap: 12,
              marginBottom: 22,
              flexShrink: 0,
              alignItems: 'start',
            }}
          >
            {pagina.fotos.map((src, i) => (
              <FotoQuadro
                key={`${src}-${pagina.fotoInicio + i}`}
                src={src}
                numero={pagina.fotoInicio + i}
                maxHeight={alturaMaxFotoOrcamentoSimples(cols)}
              />
            ))}
          </section>
        ) : null}

        {pagina.itens.length > 0 ? (
          <TabelaItens itens={pagina.itens} mostrarCabecalho={pagina.mostrarCabecalhoTabela} />
        ) : null}

        {pagina.mostrarTotais ? <BlocoTotais doc={doc} totais={totais} /> : null}

        {pagina.observacoes.trim() ? (
          <section style={{ marginTop: pagina.mostrarTotais || pagina.itens.length > 0 ? 28 : 8 }}>
            <p
              style={{
                margin: '0 0 8px',
                fontSize: 10,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: BRASS,
              }}
            >
              Observações{pagina.observacoesContinuacao ? ' (cont.)' : ''}
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
              {pagina.observacoes.trim()}
            </p>
          </section>
        ) : null}

        {pagina.mostrarAssinaturas ? (
          <footer
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 48,
              marginTop: 'auto',
              paddingTop: 16,
              flexShrink: 0,
            }}
          >
            <Assinatura rotulo="Cliente" />
            <Assinatura rotulo={branding.empresaNome} />
          </footer>
        ) : null}
      </div>

      {pagina.total > 1 ? (
        <p
          style={{
            margin: '12px 0 0',
            textAlign: 'center',
            fontSize: 10,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: MUTED,
            flexShrink: 0,
          }}
        >
          Página {pagina.indice} de {pagina.total}
        </p>
      ) : null}
    </article>
  );
}

function CabecalhoCompleto({
  branding,
  razaoSocial,
  cnpj,
  hoje,
}: {
  branding: MarkupOrcamentoSimplesFolhaBranding;
  razaoSocial: string;
  cnpj?: string;
  hoje: Date;
}) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 24,
        paddingBottom: 22,
        borderBottom: `1px solid ${BRASS}`,
        position: 'relative',
        flexShrink: 0,
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
  );
}

function CabecalhoContinuacao({
  empresaNome,
  logoUrl,
  indice,
  total,
}: {
  empresaNome: string;
  logoUrl?: string | null;
  indice: number;
  total: number;
}) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        paddingBottom: 14,
        borderBottom: `1px solid ${BRASS}`,
        marginBottom: 18,
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        {logoUrl ? (
          <img src={logoUrl} alt="" style={{ width: 36, height: 36, objectFit: 'contain', flexShrink: 0 }} />
        ) : null}
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontFamily: CORMORANT,
              fontSize: 18,
              fontWeight: 600,
              lineHeight: 1.2,
            }}
          >
            {empresaNome}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: MUTED }}>
            Orçamento — continuação
          </p>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: BRASS, flexShrink: 0 }}>
        {indice}/{total}
      </p>
    </header>
  );
}

function TabelaItens({
  itens,
  mostrarCabecalho,
}: {
  itens: MarkupOrcamentoSimplesItem[];
  mostrarCabecalho: boolean;
}) {
  return (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 13,
        flexShrink: 0,
      }}
    >
      {mostrarCabecalho ? (
        <thead>
          <tr style={{ borderBottom: `1px solid ${BRASS}` }}>
            <th style={thStyle('left')}>Item</th>
            <th style={thStyle('right')}>Qtd</th>
            <th style={thStyle('right')}>Unitário</th>
            <th style={thStyle('right')}>Total</th>
          </tr>
        </thead>
      ) : null}
      <tbody>
        {itens.map((item) => {
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
  );
}

function BlocoTotais({
  doc,
  totais,
}: {
  doc: MarkupOrcamentoSimples;
  totais: ReturnType<typeof calcularTotaisOrcamentoSimples>;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 22, flexShrink: 0 }}>
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
  );
}

/**
 * Quadro editorial: a foto entra no formato dela (retrato ou paisagem).
 * Nunca estica — só reduz para caber na largura da coluna e na altura máxima.
 */
function FotoQuadro({
  src,
  numero,
  maxHeight,
}: {
  src: string;
  numero: number;
  maxHeight: number;
}) {
  return (
    <figure
      style={{
        margin: 0,
        position: 'relative',
        padding: 7,
        background: `linear-gradient(155deg, #f7efe0 0%, #e8d7bd 55%, #dfc9a8 100%)`,
        boxShadow: `0 0 0 1px ${BRASS}, 0 10px 22px rgba(44, 29, 18, 0.08)`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(180deg, #1c140f 0%, #2a1d14 100%)',
          minHeight: 72,
          maxHeight,
          overflow: 'hidden',
        }}
      >
        <img
          src={src}
          alt=""
          style={{
            display: 'block',
            maxWidth: '100%',
            maxHeight,
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
            objectPosition: 'center',
          }}
        />
      </div>
      <figcaption
        aria-hidden
        style={{
          position: 'absolute',
          top: 14,
          left: 14,
          fontFamily: CORMORANT,
          fontSize: 13,
          letterSpacing: '0.14em',
          color: BRASS,
          textShadow: '0 1px 3px rgba(20,14,11,0.65)',
          pointerEvents: 'none',
        }}
      >
        {String(numero).padStart(2, '0')}
      </figcaption>
    </figure>
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
      <div style={{ borderBottom: `1px solid ${BRASS}`, height: 40 }} />
      <p
        style={{
          margin: '6px 0 0',
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
