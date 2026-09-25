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

const PADRAO = 400

function normalizarPercentual(valor) {
  const n = Number(valor)
  if (!Number.isFinite(n) || n <= 0) return PADRAO
  return arredondar(Math.min(9999, Math.max(1, n)))
}

function calcularPrecoIdeal(custoMateriais, percentualAlvo = PADRAO) {
  const custo = Math.max(0, Number(custoMateriais) || 0)
  const pct = normalizarPercentual(percentualAlvo)
  return arredondar(custo * (pct / 100))
}

function calcularAuditor({ custoMateriais, precoFinal, percentualAlvo }) {
  const alvo = normalizarPercentual(percentualAlvo)
  const custo = arredondar(Math.max(0, Number(custoMateriais) || 0))
  const preco = arredondar(Math.max(0, Number(precoFinal) || 0))
  const precoIdeal = calcularPrecoIdeal(custo, alvo)
  const diferenca = arredondar(precoIdeal - preco)
  const percentualAtual = custo > 0 ? arredondar((preco / custo) * 100) : 0
  const percentualDiferenca = precoIdeal > 0 ? arredondar(((preco - precoIdeal) / precoIdeal) * 100, 1) : 0
  let status = 'ok'
  if (!(custo > 0)) status = 'sem_material'
  else if (preco + 0.005 < precoIdeal) status = 'baixo'
  else if (preco > precoIdeal + 0.005) status = 'acima'
  return { percentualAlvo: alvo, custoMateriais: custo, precoFinal: preco, precoIdeal, diferenca, percentualAtual, percentualDiferenca, status }
}

function formatarPercentualDiferenca(percentual) {
  return `${String(Math.abs(percentual)).replace('.', ',')}%`
}

function formatarVezesMaterial(percentualAtual) {
  const vezes = arredondar(Math.max(0, Number(percentualAtual) || 0) / 100, 2)
  return vezes.toFixed(2).replace('.', ',')
}

function formatarIndice(percentual) {
  return String(Math.round(Math.max(0, Number(percentual) || 0)))
}

function rotuloAuditorFaixa(status, percentualDiferenca) {
  if (status === 'baixo') return `Preço abaixo do ideal ${formatarPercentualDiferenca(percentualDiferenca)}`
  if (status === 'acima') return `Preço acima do ideal ${formatarPercentualDiferenca(percentualDiferenca)}`
  return null
}

function podeVerAuditorLucro(userRole, isSuperAdmin = false) {
  return isSuperAdmin || userRole === 'admin'
}

describe('Épico 1 — cálculo do Auditor de lucro', () => {
  it('400% sobre R$ 10.000 vira preço ideal de R$ 40.000', () => {
    const r = calcularAuditor({ custoMateriais: 10000, precoFinal: 40000, percentualAlvo: 400 })
    assert.equal(r.precoIdeal, 40000)
    assert.equal(r.status, 'ok')
    assert.equal(r.diferenca, 0)
  })

  it('alerta lucro baixo e informa o ideal quando o orçamento não chega no alvo', () => {
    const r = calcularAuditor({ custoMateriais: 10000, precoFinal: 25000, percentualAlvo: 400 })
    assert.equal(r.status, 'baixo')
    assert.equal(r.precoIdeal, 40000)
    assert.equal(r.diferenca, 15000)
  })

  it('usa 400% pré-cadastrado quando o percentual vem vazio ou inválido', () => {
    assert.equal(normalizarPercentual(undefined), 400)
    assert.equal(normalizarPercentual(0), 400)
    assert.equal(normalizarPercentual(-10), 400)
    assert.equal(calcularPrecoIdeal(6220), 24880)
  })

  it('reproduz o caso da calculadora: material 6.220 e preço 16.736,39 ficam abaixo', () => {
    const r = calcularAuditor({
      custoMateriais: 6220,
      precoFinal: 16736.39,
      percentualAlvo: 400,
    })
    assert.equal(r.status, 'baixo')
    assert.equal(r.precoIdeal, 24880)
    assert.equal(r.diferenca, 8143.61)
    assert.equal(r.percentualDiferenca, -32.7)
    assert.equal(r.percentualAtual, 269.07)
    assert.equal(rotuloAuditorFaixa(r.status, r.percentualDiferenca), 'Preço abaixo do ideal 32,7%')
  })

  it('diz quantas vezes o material o preço atual representa e compara com o 400', () => {
    const r = calcularAuditor({
      custoMateriais: 22217.9,
      precoFinal: 78082.11,
      percentualAlvo: 400,
    })
    assert.equal(r.precoIdeal, 88871.6)
    assert.equal(r.percentualAtual, 351.44)
    assert.equal(formatarVezesMaterial(r.percentualAtual), '3,51')
    assert.equal(formatarIndice(r.percentualAtual), '351')
    assert.equal(formatarIndice(r.percentualAlvo), '400')
  })

  it('preço acima do ideal marca positivo e mostra o percentual a mais', () => {
    const r = calcularAuditor({ custoMateriais: 10000, precoFinal: 50000, percentualAlvo: 400 })
    assert.equal(r.status, 'acima')
    assert.equal(r.precoIdeal, 40000)
    assert.equal(r.percentualDiferenca, 25)
    assert.equal(rotuloAuditorFaixa(r.status, r.percentualDiferenca), 'Preço acima do ideal 25%')
  })
})

describe('Épico 2 — persistência e permissão de admin', () => {
  it('só administrador vê o auditor', () => {
    assert.equal(podeVerAuditorLucro('admin'), true)
    assert.equal(podeVerAuditorLucro('vendedor'), false)
    assert.equal(podeVerAuditorLucro('projetista'), false)
    assert.equal(podeVerAuditorLucro('nenhum', true), true)
  })

  it('aba Resumo da calculadora fica só para administrador', () => {
    const lib = readSrc('src/lib/markup-auditor-lucro.ts')
    const sheet = readSrc('src/components/markup/MarkupCalculatorSheet.tsx')
    const crm = readSrc('src/components/crm/MarkupCalculatorSheet.tsx')
    assert.match(lib, /export function podeVerMarkupResumo/)
    assert.match(sheet, /podeVerMarkupResumo\(userRole, isSuperAdmin\)/)
    assert.match(sheet, /\{podeVerResumo && \(/)
    assert.match(crm, /podeVerMarkupResumo\(userRole, isSuperAdmin\)/)
    assert.match(crm, /podeVerResumo && aba === 'resumo'/)
  })

  it('config guarda auditor_lucro_percentual com padrão 400', () => {
    const types = readSrc('src/lib/markup-types.ts')
    const hook = readSrc('src/hooks/useMarkupConfig.ts')
    const migration = readSrc('supabase/migrations/180_markup_auditor_lucro.sql')
    assert.match(types, /auditor_lucro_percentual/)
    assert.match(types, /auditor_lucro_percentual: 400/)
    assert.match(hook, /auditor_lucro_percentual: normalizarPercentualAuditorLucro/)
    assert.match(migration, /auditor_lucro_percentual NUMERIC\(10,2\) NOT NULL DEFAULT 400/)
  })
})

describe('Épico 3 e 4 — presença viva e engrenagem no card', () => {
  it('calculadora principal monta o auditor na faixa do preço final', () => {
    const sheet = readSrc('src/components/markup/MarkupCalculatorSheet.tsx')
    assert.match(sheet, /MarkupAuditorLucro/)
    assert.match(sheet, /Preço final/)
    assert.match(sheet, /custoMateriais=\{modulosSeguros\.totais\.custo_materiais\}/)
    assert.match(sheet, /precoFinal=\{modulosSeguros\.totais\.preco_final\}/)
    assert.doesNotMatch(sheet, /MarkupAuditorLucroPrecoSelo/)
  })

  it('ícone flutua na faixa do preço com balão +/− e texto que sai e volta', () => {
    const ui = readSrc('src/components/markup/MarkupAuditorLucro.tsx')
    const lib = readSrc('src/lib/markup-auditor-lucro.ts')
    assert.match(ui, /sortearDestinoNaPista/)
    assert.match(ui, /relative h-9 w-36/)
    assert.doesNotMatch(ui, /createPortal/)
    assert.match(ui, /ShaderMaterial/)
    assert.match(ui, /uSign/)
    assert.match(ui, /gsap/)
    assert.match(ui, /\bEar\b/)
    assert.match(ui, /data-markup-auditor-trigger/)
    assert.match(ui, /data-markup-auditor-sinal/)
    assert.match(ui, /data-markup-auditor-texto/)
    assert.match(ui, /Abrir auditor de lucro/)
    assert.match(ui, /Configurar margem do auditor de lucro/)
    assert.match(ui, /Ideal\{' '\}/)
    assert.match(ui, /Faltam\{' '\}/)
    assert.match(ui, /material ×/)
    assert.match(ui, /está em/)
    assert.match(ui, /data-markup-auditor-indice/)
    assert.match(lib, /Preço abaixo do ideal/)
    assert.match(lib, /Preço acima do ideal/)
    assert.match(lib, /percentualDiferenca/)
    assert.match(lib, /formatarVezesMaterialAuditor/)
    assert.doesNotMatch(ui, /Material \{formatarMoedaMarkup/)
    assert.match(lib, /AUDITOR_LUCRO_PERCENTUAL_PADRAO = 400/)
  })

  it('aparece em todo markup, inclusive na calculadora do CRM', () => {
    const crm = readSrc('src/components/crm/MarkupCalculatorSheet.tsx')
    assert.match(crm, /MarkupAuditorLucro/)
    assert.match(crm, /totais\.custo_materiais/)
  })
})

describe('Épico 5 — markup geral vs lead + sugestão de lucro', () => {
  function resolverPercentual(percentualGeral, meta) {
    const geral = normalizarPercentual(percentualGeral)
    if (meta?.fonte !== 'especifico') return geral
    if (meta.percentual == null || !Number.isFinite(Number(meta.percentual)) || Number(meta.percentual) <= 0) {
      return geral
    }
    return normalizarPercentual(meta.percentual)
  }

  it('usa percentual específico do lead quando a fonte é especifico', () => {
    assert.equal(resolverPercentual(400, { fonte: 'especifico', percentual: 350 }), 350)
    assert.equal(resolverPercentual(400, { fonte: 'geral', percentual: 350 }), 400)
    assert.equal(resolverPercentual(400, { fonte: 'especifico' }), 400)
  })

  it('engrenagem tem Geral/Este lead e o Resumo tem sugestão de lucro', () => {
    const types = readSrc('src/lib/markup-types.ts')
    const lib = readSrc('src/lib/markup-auditor-lucro.ts')
    const ui = readSrc('src/components/markup/MarkupAuditorLucro.tsx')
    const sheet = readSrc('src/components/markup/MarkupCalculatorSheet.tsx')
    assert.match(types, /auditor_lucro\?:/)
    assert.match(types, /MarkupAuditorLucroFonte = 'geral' \| 'especifico'/)
    assert.match(types, /fonte: MarkupAuditorLucroFonte/)
    assert.match(lib, /export function resolverPercentualAuditorLucro/)
    assert.match(ui, /Este lead/)
    assert.match(ui, /Salvar neste lead/)
    assert.match(ui, /onAuditorMetaChange/)
    assert.match(sheet, /onAuditorMetaChange=\{handleAuditorMetaChange\}/)
    assert.match(sheet, /data-markup-sugestao-lucro/)
    assert.match(sheet, /Sugestão de lucro/)
    assert.match(sheet, /confirmarLucroReaisEditado\(auditorLucroResumo\.diferenca\)/)
  })
})
