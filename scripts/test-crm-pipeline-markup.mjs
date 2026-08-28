import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

describe('Épico 10 — markup no card do Pipeline', () => {
  it('faixa verde continua visível só para leitura quando não pode abrir', () => {
    const src = readSrc('src/components/crm/MarkupCardPreview.tsx')
    assert.match(src, /readOnly/)
    assert.match(src, /preco_final <= 0/)
    assert.match(src, /pointer-events-auto/)
    assert.doesNotMatch(src, /canOpen/)
  })

  it('card mostra botão Markup quando ainda não há preço', () => {
    const src = readSrc('src/components/crm/PipelineLeadCard.tsx')
    assert.match(src, /temPreco \|\| \(canOpenMarkup && onOpenMarkup\)/)
    assert.match(src, /<Calculator className="h-3 w-3" \/>\s*Markup/)
    assert.match(src, /aria-label="Arrastar card"/)
    assert.match(src, /GripVertical/)
  })

  it('arraste fica só na alça, não no Card inteiro', () => {
    const src = readSrc('src/components/crm/PipelineLeadCard.tsx')
    const cardBlock = src.slice(src.indexOf('<Card'), src.indexOf('</Card>'))
    assert.doesNotMatch(src, /<Card[\s\S]{0,120}draggable/)
    assert.match(src, /<button[\s\S]{0,180}draggable[\s\S]{0,80}aria-label="Arrastar card"/)
  })

  it('abrir markup fecha a ficha do lead', () => {
    const src = readSrc('src/pages/crm/PipelinePage.tsx')
    assert.match(src, /const abrirMarkupDoLead = async \(current: CrmLeadCard, orcamentoId\?: string\) => \{[\s\S]*setSelected\(null\)/)
    assert.match(src, /setCreating\(false\)/)
  })
})
