/**
 * Painel Financeiro · Pontua Garbo — métricas e render.
 *
 * Carrega os módulos pelo resolvedor do próprio Vite (aliases `@/` e JSX
 * iguais aos de produção) e confere a matemática dos KPIs mais o HTML que
 * sai dos componentes novos.
 */
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

/** 15/set/2026 — mês de referência fixo para os números não mudarem com o tempo. */
const REFERENCIA = new Date(2026, 8, 15)

let vite
let calcularPontuaMetricas
let cards
let graficos
let solicitantesMod

before(async () => {
  vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
  })
  ;({ calcularPontuaMetricas } = await vite.ssrLoadModule('/src/lib/pontua-garbo-metricas.ts'))
  cards = await vite.ssrLoadModule('/src/components/financeiro/PontuaMetricasCards.tsx')
  graficos = await vite.ssrLoadModule('/src/components/financeiro/PontuaGraficos.tsx')
  solicitantesMod = await vite.ssrLoadModule(
    '/src/components/financeiro/PontuaSolicitantesSaque.tsx',
  )
})

after(async () => {
  await vite?.close()
})

function arquiteto(over = {}) {
  return {
    id: 'a1',
    nome: 'Ana Vasques',
    titulo: null,
    email: null,
    telefone: null,
    avatarUrl: null,
    criadoEm: null,
    leads: [],
    totalComissao: 0,
    totalAjustes: 0,
    totalRetirado: 0,
    saldoParaSacar: 0,
    totalAguardandoLiberacao: 0,
    lancamentos: [],
    ...over,
  }
}

function pedido(over = {}) {
  return {
    id: 'p1',
    prestador_id: 'a1',
    valor_solicitado: 100,
    chave_pix: 'ana@estudio.com',
    tipo_chave_pix: 'email',
    status: 'pendente',
    obs_admin: null,
    criado_em: '2026-09-02T10:00:00.000Z',
    processado_em: null,
    ...over,
  }
}

const calc = (prestadores, pedidos, meses = 12) =>
  calcularPontuaMetricas(prestadores, pedidos, { meses, referencia: REFERENCIA })

describe('Painel Pontua — série mensal', () => {
  it('monta os últimos 12 meses terminando no mês de referência', () => {
    const m = calc([], [])
    assert.equal(m.serie.length, 12)
    assert.equal(m.serie[11].chave, '2026-09')
    assert.equal(m.serie[11].label, 'set')
    assert.equal(m.serie[11].labelLongo, 'setembro 2026')
    assert.equal(m.serie[0].chave, '2025-10')
  })

  it('atravessa a virada de ano', () => {
    const m = calcularPontuaMetricas(
      [arquiteto({ criadoEm: '2025-12-10T12:00:00.000Z' })],
      [],
      { meses: 12, referencia: new Date(2026, 1, 10) },
    )
    assert.equal(m.serie[0].chave, '2025-03')
    assert.equal(m.serie[11].chave, '2026-02')
    const dez = m.serie.find(b => b.chave === '2025-12')
    assert.equal(dez.cadastrados, 1)
    assert.equal(dez.labelLongo, 'dezembro 2025')
  })
})

describe('Painel Pontua — cadastros de arquitetos', () => {
  it('separa o mês atual do anterior e calcula a variação', () => {
    const m = calc(
      [
        arquiteto({ id: 'a1', criadoEm: '2026-09-03T12:00:00.000Z' }),
        arquiteto({ id: 'a2', criadoEm: '2026-09-20T12:00:00.000Z' }),
        arquiteto({ id: 'a3', criadoEm: '2026-08-05T12:00:00.000Z' }),
        arquiteto({ id: 'a4', criadoEm: null }),
      ],
      [],
    )
    assert.equal(m.cadastradosMes, 2)
    assert.equal(m.cadastradosMesAnterior, 1)
    assert.equal(m.totalCadastrados, 4)
    assert.equal(m.deltaCadastrados, 100)
    assert.equal(m.serie[11].cadastrados, 2)
    assert.equal(m.serie[10].cadastrados, 1)
  })

  it('não inventa variação quando o mês anterior foi zero', () => {
    const m = calc([arquiteto({ criadoEm: '2026-09-03T12:00:00.000Z' })], [], 6)
    assert.equal(m.deltaCadastrados, null)
  })
})

describe('Painel Pontua — quem está pontuando', () => {
  it('conta cada arquiteto uma vez por mês, mesmo com várias vendas ganhas', () => {
    const m = calc(
      [
        arquiteto({
          id: 'a1',
          totalComissao: 900,
          leads: [
            { comissao: 500, vendaGanha: true, vendaRealizadaEm: '2026-09-04T00:00:00.000Z' },
            { comissao: 400, vendaGanha: true, vendaRealizadaEm: '2026-09-19T00:00:00.000Z' },
          ],
        }),
        arquiteto({
          id: 'a2',
          totalComissao: 300,
          leads: [
            { comissao: 300, vendaGanha: true, vendaRealizadaEm: '2026-08-10T00:00:00.000Z' },
          ],
        }),
        arquiteto({ id: 'a3', totalComissao: 0 }),
      ],
      [],
    )
    assert.equal(m.pontuando, 2)
    assert.equal(m.pontuaramNoMes, 1)
    assert.equal(m.serie[11].pontuaram, 1)
    assert.equal(m.serie[10].pontuaram, 1)
    assert.equal(Math.round(m.percentualPontuando), 67)
  })

  it('venda ganha sem data fica fora da série mensal', () => {
    const m = calc(
      [
        arquiteto({
          totalComissao: 100,
          leads: [{ comissao: 100, vendaGanha: true, vendaRealizadaEm: null }],
        }),
      ],
      [],
    )
    assert.equal(m.pontuando, 1)
    assert.equal(m.pontuaramNoMes, 0)
  })
})

describe('Painel Pontua — comissão paga', () => {
  it('faz a média entre quem recebeu e também sobre todos os cadastrados', () => {
    const m = calc(
      [
        arquiteto({ id: 'a1', totalRetirado: 1000 }),
        arquiteto({ id: 'a2', totalRetirado: 500 }),
        arquiteto({ id: 'a3', totalRetirado: 0 }),
        arquiteto({ id: 'a4', totalRetirado: 0 }),
      ],
      [],
    )
    assert.equal(m.totalComissaoPaga, 1500)
    assert.equal(m.arquitetosComComissaoPaga, 2)
    assert.equal(m.mediaComissaoPaga, 750)
    assert.equal(m.mediaComissaoPorCadastrado, 375)
  })

  it('a série mensal usa lançamentos de saque e ignora ajustes', () => {
    const m = calc(
      [
        arquiteto({
          totalRetirado: 800,
          lancamentos: [
            { id: 'l1', prestador_id: 'a1', tipo: 'saque', valor: 500, descricao: null, criado_em: '2026-09-06T00:00:00.000Z' },
            { id: 'l2', prestador_id: 'a1', tipo: 'saque', valor: 300, descricao: null, criado_em: '2026-08-06T00:00:00.000Z' },
            { id: 'l3', prestador_id: 'a1', tipo: 'ajuste', valor: 999, descricao: null, criado_em: '2026-09-07T00:00:00.000Z' },
          ],
        }),
      ],
      [],
    )
    assert.equal(m.serie[11].comissaoPaga, 500)
    assert.equal(m.serie[10].comissaoPaga, 300)
  })
})

describe('Painel Pontua — solicitações de saque', () => {
  it('agrupa por arquiteto, pendentes primeiro e maior valor no topo', () => {
    const m = calc(
      [
        arquiteto({ id: 'a1', nome: 'Ana Vasques' }),
        arquiteto({ id: 'a2', nome: 'Rui Sampaio' }),
        arquiteto({ id: 'a3', nome: 'Ivo Bittar' }),
      ],
      [
        pedido({ id: 'p1', prestador_id: 'a1', valor_solicitado: 200, criado_em: '2026-09-02T10:00:00.000Z' }),
        pedido({ id: 'p2', prestador_id: 'a1', valor_solicitado: 300, criado_em: '2026-09-09T10:00:00.000Z' }),
        pedido({ id: 'p3', prestador_id: 'a2', valor_solicitado: 900, status: 'aprovado', criado_em: '2026-08-01T10:00:00.000Z' }),
        pedido({ id: 'p4', prestador_id: 'a3', valor_solicitado: 100, criado_em: '2026-09-01T10:00:00.000Z' }),
      ],
    )
    assert.equal(m.solicitantes.length, 3)
    assert.equal(m.solicitantesPendentes.length, 2)
    assert.equal(m.totalSolicitadoPendente, 600)
    assert.equal(m.solicitantes[0].nome, 'Ana Vasques')
    assert.equal(m.solicitantes[0].totalPendente, 500)
    assert.equal(m.solicitantes[0].pedidos.length, 2)
    assert.equal(m.solicitantes[0].ultimaSolicitacao, '2026-09-09T10:00:00.000Z')
    assert.equal(m.solicitantes[1].nome, 'Ivo Bittar')
    assert.equal(m.solicitantes[2].nome, 'Rui Sampaio')
    assert.equal(m.solicitantes[2].temPendente, false)
    assert.equal(m.solicitantes[2].totalAprovado, 900)
  })

  it('pedido sem arquiteto correspondente não quebra a lista', () => {
    const m = calc([], [pedido({ prestador_id: 'fantasma' })])
    assert.equal(m.solicitantes.length, 1)
    assert.equal(m.solicitantes[0].nome, 'Arquiteto')
  })
})

describe('Painel Pontua — render dos componentes', () => {
  const prestadores = [
    arquiteto({
      id: 'a1',
      nome: 'Ana Vasques',
      titulo: 'Arquiteta',
      criadoEm: '2026-09-03T12:00:00.000Z',
      leads: [{ comissao: 4200, vendaGanha: true, vendaRealizadaEm: '2026-09-08T00:00:00.000Z' }],
      totalComissao: 4200,
      totalRetirado: 1800,
      saldoParaSacar: 2400,
      lancamentos: [
        { id: 'l1', prestador_id: 'a1', tipo: 'saque', valor: 1800, descricao: null, criado_em: '2026-09-10T00:00:00.000Z' },
      ],
    }),
    arquiteto({
      id: 'a2',
      nome: 'Rui Sampaio',
      titulo: 'Arquiteto',
      criadoEm: '2026-08-14T12:00:00.000Z',
      leads: [{ comissao: 2600, vendaGanha: true, vendaRealizadaEm: '2026-08-20T00:00:00.000Z' }],
      totalComissao: 2600,
      totalRetirado: 2600,
      lancamentos: [
        { id: 'l2', prestador_id: 'a2', tipo: 'saque', valor: 2600, descricao: null, criado_em: '2026-08-25T00:00:00.000Z' },
      ],
    }),
    arquiteto({ id: 'a3', nome: 'Ivo Bittar', criadoEm: '2026-09-22T12:00:00.000Z' }),
  ]

  const pedidos = [
    pedido({ id: 'p1', prestador_id: 'a1', valor_solicitado: 2400, criado_em: '2026-09-12T10:00:00.000Z' }),
    pedido({ id: 'p2', prestador_id: 'a2', valor_solicitado: 2600, status: 'aprovado', tipo_chave_pix: 'telefone', chave_pix: '11912345678', criado_em: '2026-08-22T10:00:00.000Z', processado_em: '2026-08-25T10:00:00.000Z' }),
  ]

  it('os quatro KPIs saem com os números calculados', () => {
    const metricas = calc(prestadores, pedidos)
    const html = renderToStaticMarkup(
      React.createElement(cards.PontuaMetricasCards, {
        metricas,
        onAbrirSolicitantes: () => {},
      }),
    )
    assert.match(html, /Cadastrados neste m/)
    assert.match(html, /Arquitetos pontuando/)
    assert.match(html, /Solicitaram saque/)
    assert.match(html, /M.dia de comiss.o paga/)
    assert.match(html, /\+100%/, '2 cadastros em set contra 1 em ago')
    assert.match(html, /1 no m.s anterior/)
    assert.match(html, /3 no total/)
    assert.match(html, /67% dos cadastrados/, '2 de 3 pontuando')
    assert.match(html, /2\.200,00/, 'media paga = (1800 + 2600) / 2')
    assert.match(html, /Ver quem solicitou/)
  })

  it('tem skeleton enquanto carrega', () => {
    const html = renderToStaticMarkup(React.createElement(cards.PontuaMetricasCardsSkeleton))
    assert.ok(html.length > 0)
  })

  it('os gráficos montam com dados e têm estado vazio', () => {
    const metricas = calc(prestadores, pedidos)

    const cadastros = renderToStaticMarkup(
      React.createElement(graficos.PontuaCadastrosChart, { serie: metricas.serie }),
    )
    assert.match(cadastros, /Entrada de arquitetos por m/)
    assert.doesNotMatch(cadastros, /Nenhum cadastro registrado/)

    const vazio = renderToStaticMarkup(
      React.createElement(graficos.PontuaCadastrosChart, { serie: calc([], []).serie }),
    )
    assert.match(vazio, /Nenhum cadastro registrado no per/)

    const comissoes = renderToStaticMarkup(
      React.createElement(graficos.PontuaComissoesChart, {
        serie: metricas.serie,
        mediaMensal: 2200,
      }),
    )
    assert.match(comissoes, /Comiss.o paga por m/)
    assert.doesNotMatch(comissoes, /Nenhuma comiss.o paga/)
  })

  it('o card de saques nomeia quem solicitou e o valor pendente', () => {
    const metricas = calc(prestadores, pedidos)
    const html = renderToStaticMarkup(
      React.createElement(solicitantesMod.PontuaSolicitantesSaqueCard, {
        solicitantes: metricas.solicitantes,
        totalPendente: metricas.totalSolicitadoPendente,
        onVerTodos: () => {},
      }),
    )
    assert.match(html, /Quem solicitou saque/)
    assert.match(html, /Ana Vasques/)
    assert.match(html, /2\.400,00/)
    assert.match(html, /1 arquiteto aguardando/)
    assert.match(html, /Ver todos \(2\)/)

    const semPedidos = renderToStaticMarkup(
      React.createElement(solicitantesMod.PontuaSolicitantesSaqueCard, {
        solicitantes: [],
        totalPendente: 0,
        onVerTodos: () => {},
      }),
    )
    assert.match(semPedidos, /Nenhum arquiteto solicitou saque/)
  })
})
