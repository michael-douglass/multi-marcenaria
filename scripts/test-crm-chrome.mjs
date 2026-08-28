import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

describe('Épico 9 — moldura CRM', () => {
  it('no CRM some a agenda de obras e entram os ícones comerciais', () => {
    const layout = readSrc('src/components/layout/MainLayout.tsx')
    assert.match(layout, /hideFactoryFabs = hideFabsOnPonto \|\| isCrmArea/)
    assert.match(layout, /isCrmArea && \(/)
    assert.match(layout, /CrmSelletosDock/)
  })

  it('dock CRM usa os ícones do GitHub só na área comercial', () => {
    const dock = readSrc('src/components/crm/CrmSelletosDock.tsx')
    assert.match(dock, /WhatsAppNotificationIcon/)
    assert.match(dock, /FloatingAgendaGeralShell/)
    assert.match(dock, /FloatingSaquePedidosIcon/)
    assert.match(dock, /LeadSinalizacoesPopup/)
    assert.doesNotMatch(dock, /AgendaPopup/)
    assert.doesNotMatch(dock, /MetricasObrasPopup/)
  })

  it('no CRM o calendário do topo abre agenda comercial, não obras', () => {
    const header = readSrc('src/components/layout/NavigationHeader.tsx')
    assert.match(header, /isCrmAppPath/)
    assert.match(header, /navigate\('\/agenda-comercial'\)/)
    assert.match(header, /Agenda comercial/)
    assert.doesNotMatch(header, /CrmNotificationBell/)
    assert.doesNotMatch(header, /ContasPagarNotifBell/)
  })
})
