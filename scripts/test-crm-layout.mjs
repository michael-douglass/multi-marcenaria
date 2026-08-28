import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

function listCrmPages() {
  const dir = path.join(root, 'src', 'pages', 'crm')
  return readdirSync(dir)
    .filter(name => name.endsWith('.tsx'))
    .map(name => path.join('src', 'pages', 'crm', name))
}

describe('Layout CRM — fiel ao Selletos, não à fábrica', () => {
  it('páginas do CRM não usam o cabeçalho de obras', () => {
    for (const rel of listCrmPages()) {
      const src = readSrc(rel)
      assert.equal(src.includes('ObraPageHeader'), false, `${rel} ainda usa ObraPageHeader`)
      assert.match(src, /CrmPageFrame/, `${rel} precisa do quadro CrmPageFrame`)
    }
  })

  it('pipeline replica Kanban/Lista, filtros e colunas de 216px', () => {
    const src = readSrc('src/pages/crm/PipelinePage.tsx')
    assert.match(src, /viewMode === 'kanban'/)
    assert.match(src, /viewMode === 'list'/)
    assert.match(src, /Todos os vendedores/)
    assert.match(src, /Todas as origens/)
    assert.match(src, /Todas as datas/)
    assert.match(src, /CRM_KANBAN_COLUMN_SHELL_CLASS/)
    assert.equal(src.includes('ObraPageHeader'), false)
  })

  it('área CRM esconde os botões flutuantes de Agenda/Métricas da fábrica', () => {
    const layout = readSrc('src/components/layout/MainLayout.tsx')
    assert.match(layout, /isCrmAppPath/)
    assert.match(layout, /hideFactoryFabs/)
  })

  it('contratos usam o título 2xl e o status Em produção', () => {
    const page = readSrc('src/pages/crm/ContratosPage.tsx')
    const lib = readSrc('src/lib/crm-contratos.ts')
    assert.match(page, /CrmPageHeader/)
    assert.match(page, /CONTRATO_STATUS_STYLE/)
    assert.match(lib, /rascunho: 'Em produção'/)
  })
})
