import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

function orcamentosDoLead(lista, leadId) {
  return lista
    .filter(item => item.lead_id === leadId)
    .sort((a, b) => String(b.atualizado_em ?? '').localeCompare(String(a.atualizado_em ?? '')))
}

describe('Épico 11 — ficha do lead', () => {
  it('orçamentos do lead ficam no lead certo, mais recente primeiro', () => {
    const lista = [
      { lead_id: 1, id: 'a', atualizado_em: '2026-01-01' },
      { lead_id: 2, id: 'b', atualizado_em: '2026-08-01' },
      { lead_id: 1, id: 'c', atualizado_em: '2026-08-20' },
    ]
    assert.deepEqual(orcamentosDoLead(lista, 1).map(i => i.id), ['c', 'a'])
  })

  it('ficha tem abas Detalhes e Análise IA, markup embutido e WhatsApp', () => {
    const modal = readSrc('src/components/crm/PipelineLeadModal.tsx')
    assert.match(modal, /Detalhes/)
    assert.match(modal, /Análise IA/)
    assert.match(modal, /MarkupLeadSection/)
    assert.match(modal, /LeadWhatsAppPanel/)
    assert.match(modal, /LeadIaPanel/)
    assert.match(modal, /Materiais do lead/)
    assert.doesNotMatch(modal, /Módulos do card/)
  })

  it('seção de markup lista, cria e abre existente', () => {
    const src = readSrc('src/components/crm/MarkupLeadSection.tsx')
    assert.match(src, /Novo markup/)
    assert.match(src, /Abrir calculadora/)
    assert.match(src, /MarkupCardPreview/)
    assert.match(src, /readOnly/)
  })

  it('página passa os orçamentos do lead e fecha a ficha ao abrir a calculadora', () => {
    const page = readSrc('src/pages/crm/PipelinePage.tsx')
    assert.match(page, /orcamentosDoLead/)
    assert.match(page, /markupItens/)
    assert.match(page, /abrirMarkupDoLead\(current, orcamentoId\)/)
    const lib = readSrc('src/lib/crm-markup.ts')
    assert.match(lib, /export function orcamentosDoLead/)
  })
})
