import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

function arredondar(valor, casas = 2) {
  const fator = 10 ** casas
  return Math.round(valor * fator) / fator
}

function reaisParaCentavos(valor) {
  const n = Number(valor)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.round(arredondar(n) * 100)
}

function parseMoedaBrParaCentavos(texto) {
  const bruto = texto.trim()
  if (!bruto) return 0
  const limpo = bruto.replace(/[^\d,.-]/g, '')
  if (!limpo) return 0
  const temVirgula = limpo.includes(',')
  const normalizado = temVirgula ? limpo.replace(/\./g, '').replace(',', '.') : limpo.replace(/,/g, '')
  const n = Number(normalizado)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100)
}

function calcularTotais(doc) {
  const subtotal_centavos = doc.itens.reduce((acc, item) => {
    const qtd = Math.max(0, Number(item.quantidade) || 0)
    const unit = Math.max(0, Math.round(item.unitario_centavos) || 0)
    return acc + Math.round(qtd * unit)
  }, 0)

  let desconto_centavos = 0
  if (doc.desconto_tipo === 'percent') {
    const pct = Math.min(100, Math.max(0, Number(doc.desconto_valor) || 0))
    desconto_centavos = Math.round(subtotal_centavos * (pct / 100))
  } else {
    desconto_centavos = Math.min(subtotal_centavos, Math.max(0, Math.round(Number(doc.desconto_valor) || 0)))
  }

  return {
    subtotal_centavos,
    desconto_centavos,
    total_centavos: Math.max(0, subtotal_centavos - desconto_centavos),
  }
}

function fotosPersistiveis(fotos) {
  return fotos.filter((foto) => foto.origem === 'lead' && foto.url && !foto.url.startsWith('data:'))
}

describe('Folha comercial — totais em centavos', () => {
  it('um item com o preço final vira o total da primeira folha', () => {
    const preco = 78082.11
    const doc = {
      itens: [{ quantidade: 1, unitario_centavos: reaisParaCentavos(preco) }],
      desconto_tipo: 'percent',
      desconto_valor: 0,
    }
    const t = calcularTotais(doc)
    assert.equal(t.subtotal_centavos, 7808211)
    assert.equal(t.total_centavos, 7808211)
  })

  it('desconto em % não passa de 100 e abate o subtotal', () => {
    const doc = {
      itens: [{ quantidade: 2, unitario_centavos: 10000 }],
      desconto_tipo: 'percent',
      desconto_valor: 10,
    }
    const t = calcularTotais(doc)
    assert.equal(t.subtotal_centavos, 20000)
    assert.equal(t.desconto_centavos, 2000)
    assert.equal(t.total_centavos, 18000)
  })

  it('desconto em reais não passa do subtotal', () => {
    const t = calcularTotais({
      itens: [{ quantidade: 1, unitario_centavos: 5000 }],
      desconto_tipo: 'reais',
      desconto_valor: 9000,
    })
    assert.equal(t.desconto_centavos, 5000)
    assert.equal(t.total_centavos, 0)
  })

  it('lê moeda brasileira com ponto de milhar', () => {
    assert.equal(parseMoedaBrParaCentavos('R$ 78.082,11'), 7808211)
    assert.equal(parseMoedaBrParaCentavos('40000'), 4000000)
  })

  it('foto local (data URL) não persiste no caderno', () => {
    const fotos = [
      { origem: 'lead', url: 'https://cdn.exemplo/foto.jpg' },
      { origem: 'local', url: 'data:image/jpeg;base64,xxx' },
    ]
    assert.deepEqual(fotosPersistiveis(fotos), [{ origem: 'lead', url: 'https://cdn.exemplo/foto.jpg' }])
  })
})

describe('Folha comercial — encaixe no markup existente', () => {
  it('tipos e JSON ficam em meta.orcamento_simples', () => {
    const types = readSrc('src/lib/markup-types.ts')
    const modelo = readSrc('src/lib/markup-orcamento-simples.ts')
    const migration = readSrc('supabase/migrations/181_markup_orcamento_simples_meta.sql')
    assert.match(types, /orcamento_simples\?: MarkupOrcamentoSimples/)
    assert.match(types, /unitario_centavos/)
    assert.match(modelo, /criarOrcamentoSimplesPadrao/)
    assert.match(modelo, /MARKUP_ORCAMENTO_SIMPLES_MAX_FOTOS = 18/)
    assert.match(modelo, /MARKUP_ORCAMENTO_SIMPLES_VALIDADE_PADRAO = 15/)
    assert.match(migration, /modulos\.meta\.orcamento_simples/)
    assert.match(migration, /Não altera preco_final/)
  })

  it('Imprimir abre a folha no card do lead e o chip continua só a calculadora', () => {
    const section = readSrc('src/components/markup/MarkupLeadSection.tsx')
    const chip = readSrc('src/components/markup/MarkupCardPreview.tsx')
    const dialog = readSrc('src/components/markup/MarkupOrcamentoSimplesDialog.tsx')
    assert.match(section, /MarkupOrcamentoSimplesTrigger/)
    assert.match(section, /MarkupOrcamentoSimplesDialog/)
    assert.match(dialog, /Imprimir/)
    assert.match(dialog, /Folha comercial/)
    assert.match(dialog, /data-markup-orcamento-simples/)
    assert.match(dialog, /silent: true/)
    assert.doesNotMatch(chip, /MarkupOrcamentoSimples/)
  })

  it('exporta PDF/JPG fatiado e embute foto em JPEG', () => {
    const exp = readSrc('src/lib/markup-orcamento-simples-export.ts')
    assert.match(exp, /incorporarImagemOrcamento/)
    assert.match(exp, /scale: EXPORT_SCALE/)
    assert.match(exp, /fatiarPdf/)
    assert.match(exp, /html2canvas/)
    assert.match(exp, /jsPDF/)
    assert.match(exp, /orcamento-/)
  })

  it('o card do lead não fecha com a folha aberta', () => {
    const ui = readSrc('src/lib/markup-ui.ts')
    const guard = readSrc('src/lib/dialog-outside-guard.ts')
    assert.match(ui, /setMarkupOrcamentoSimplesOpenFlag/)
    assert.match(guard, /MARKUP_ORCAMENTO_SIMPLES_OPEN_ATTR/)
    assert.match(guard, /data-markup-orcamento-simples/)
  })
})
