import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

function leadBelongsInPipelineStage(leadStatus, stage, etapas) {
  const raw = (leadStatus || '').trim()
  const trimmed = raw
  const inbox = etapas[0]?.trim() || 'Novo Lead'
  const stageKey = stage.trim().toLowerCase()
  const normalized = trimmed
  if (stage === inbox) return !normalized || normalized === inbox
  if (normalized === stage) return true
  if (raw && raw.toLowerCase() === stageKey) return true
  return false
}

function getTargetStatusForColumn(coluna) {
  const source = (coluna.fontes || []).find(f => f.ativo && f.tipo === 'status' && f.valor?.trim())
  if (source?.valor?.trim()) return source.valor.trim()
  return coluna.nome.trim()
}

function resolveQuadroColumns(quadro, leads) {
  return [...quadro.colunas]
    .sort((a, b) => a.ordem - b.ordem)
    .map(coluna => {
      const ids = new Set()
      const fontesAtivas = (coluna.fontes || []).filter(f => f.ativo)
      for (const lead of leads) {
        const matched = fontesAtivas.length > 0
          ? fontesAtivas.some(f => f.tipo === 'status' && lead.status === (f.valor ?? ''))
          : lead.status === coluna.nome
        if (matched) ids.add(lead.id)
      }
      for (const override of coluna.overrides || []) {
        if (override.acao === 'exclude') ids.delete(Number(override.leadId))
        else ids.add(Number(override.leadId))
      }
      return {
        title: coluna.nome,
        statusAlvo: getTargetStatusForColumn(coluna),
        items: leads.filter(lead => ids.has(lead.id)),
      }
    })
}

const etapas = ['Novo Lead', 'Visita em obra agendada', 'Enviou orçamento']

describe('Épico 3 — pipeline', () => {
  it('Novo Lead vazio ou com o nome da primeira coluna cai na caixa de entrada', () => {
    assert.equal(leadBelongsInPipelineStage('', 'Novo Lead', etapas), true)
    assert.equal(leadBelongsInPipelineStage('Novo Lead', 'Novo Lead', etapas), true)
    assert.equal(leadBelongsInPipelineStage('Enviou orçamento', 'Novo Lead', etapas), false)
  })

  it('status da coluna extra usa a fonte, não o rótulo', () => {
    const coluna = {
      nome: 'Clientes Ativos',
      fontes: [{ tipo: 'status', valor: 'Cliente', ativo: true }],
    }
    assert.equal(getTargetStatusForColumn(coluna), 'Cliente')
  })

  it('coluna sem fonte casa pelo nome, como Mensagens enviadas', () => {
    const quadro = {
      colunas: [
        { id: '1', nome: 'Mensagens enviadas', ordem: 1, fontes: [], overrides: [] },
        { id: '2', nome: 'Arquiteto', ordem: 2, fontes: [{ tipo: 'status', valor: 'Arquiteto', ativo: true }], overrides: [] },
      ],
    }
    const leads = [
      { id: 1, status: 'Mensagens enviadas' },
      { id: 2, status: 'Arquiteto' },
      { id: 3, status: 'Cliente' },
    ]
    const cols = resolveQuadroColumns(quadro, leads)
    assert.equal(cols[0].items.length, 1)
    assert.equal(cols[0].items[0].id, 1)
    assert.equal(cols[1].items.length, 1)
    assert.equal(cols[1].items[0].id, 2)
  })

  it('override exclude tira o card da coluna', () => {
    const quadro = {
      colunas: [{
        id: '1',
        nome: 'Arquiteto',
        ordem: 1,
        fontes: [{ tipo: 'status', valor: 'Arquiteto', ativo: true }],
        overrides: [{ leadId: 2, acao: 'exclude' }],
      }],
    }
    const leads = [{ id: 1, status: 'Arquiteto' }, { id: 2, status: 'Arquiteto' }]
    const cols = resolveQuadroColumns(quadro, leads)
    assert.deepEqual(cols[0].items.map(l => l.id), [1])
  })

  it('rotas reais no App e RPC no hook', () => {
    const app = readSrc('src/App.tsx')
    assert.match(app, /lazy\(\(\) => import\('@\/pages\/Pipeline'\)\)/)
    assert.match(app, /lazy\(\(\) => import\('@\/pages\/Leads'\)\)/)
    assert.doesNotMatch(app, /crmPlaceholder\('\/pipeline'/)
    const hook = readSrc('src/hooks/useCrmPipeline.ts')
    assert.match(hook, /movelaria_crm_pipeline_boot/)
    assert.match(hook, /movelaria_crm_mover_lead/)
    const sql = readSrc('supabase/migrations/173_crm_pipeline.sql')
    assert.match(sql, /movelaria_crm_pode_pipeline/)
    assert.match(sql, /GRANT EXECUTE ON FUNCTION public.movelaria_crm_pipeline_boot/)
  })
})
