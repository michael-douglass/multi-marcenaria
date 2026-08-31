import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

describe('notificações de contas a vencer no dia', () => {
  it('está no layout principal e no cabeçalho', () => {
    const layout = readSrc('src/components/layout/MainLayout.tsx')
    const header = readSrc('src/components/layout/NavigationHeader.tsx')
    const panel = readSrc('src/components/layout/ContasPagarNotifications.tsx')
    const hook = readSrc('src/hooks/useContasPagarNotificacoes.ts')

    assert.match(layout, /ContasPagarNotifProvider/)
    assert.match(header, /ContasPagarNotifBell/)
    assert.match(panel, /roles\.includes\('Administrador'\)/)
    assert.match(panel, /Contas a vencer no dia/)
    assert.match(hook, /data_vencimento/)
    assert.match(hook, /hoje/)
  })
})
