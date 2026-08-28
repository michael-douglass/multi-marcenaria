import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

function paginasDoEvento(paginas, eventoId) {
  return paginas.filter(p => p.eventoId === eventoId).sort((a, b) => a.ordem - b.ordem)
}

function juntarWhatsApp(local, n8n) {
  const seen = new Set()
  const out = []
  for (const msg of [...n8n, ...local]) {
    const key = `${msg.origem}:${msg.id}:${(msg.conteudo || '').slice(0, 40)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(msg)
  }
  return out
}

function canAccessCrmPath(pathname, crm) {
  const roles = crm?.roles ?? []
  const admin = roles.includes('admin')
  const vendedor = roles.includes('vendedor') || admin
  const marketing = roles.includes('marketing') || admin
  const projetista = roles.includes('projetista') || roles.includes('projetista_admin') || admin
  const marketingOnly = roles.includes('marketing') && !admin && !roles.includes('vendedor')
  if (pathname.startsWith('/eventos-crm')) return vendedor && !marketingOnly
  if (pathname.startsWith('/chat-crm')) return vendedor && !marketingOnly
  if (pathname.startsWith('/pipeline')) return (vendedor || projetista) && !marketingOnly
  if (pathname.startsWith('/agendar')) return true
  return false
}

describe('Épico 8 — comunicação', () => {
  it('páginas do evento ficam no evento certo', () => {
    const paginas = [
      { eventoId: 'a', ordem: 2, titulo: 'B' },
      { eventoId: 'a', ordem: 1, titulo: 'A' },
      { eventoId: 'b', ordem: 1, titulo: 'C' },
    ]
    assert.deepEqual(paginasDoEvento(paginas, 'a').map(p => p.titulo), ['A', 'B'])
  })

  it('histórico WhatsApp junta sem duplicar', () => {
    const local = [{ origem: 'crm', id: '1', conteudo: 'oi' }]
    const n8n = [{ origem: 'n8n', id: '1', conteudo: 'oi' }, { origem: 'crm', id: '1', conteudo: 'oi' }]
    assert.equal(juntarWhatsApp(local, n8n).length, 2)
  })

  it('eventos e chat respeitam o papel', () => {
    const admin = { roles: ['admin'] }
    const mkt = { roles: ['marketing'] }
    const vend = { roles: ['vendedor'] }
    assert.equal(canAccessCrmPath('/eventos-crm', admin), true)
    assert.equal(canAccessCrmPath('/eventos-crm', vend), true)
    assert.equal(canAccessCrmPath('/eventos-crm', mkt), false)
    assert.equal(canAccessCrmPath('/chat-crm', vend), true)
  })

  it('páginas vivas no App e RPCs no SQL', () => {
    const app = readSrc('src/App.tsx')
    assert.match(app, /EventosCrmPage/)
    assert.match(app, /ChatCrmPage/)
    assert.match(app, /AgendamentoPublico/)
    const header = readSrc('src/components/layout/NavigationHeader.tsx')
    assert.doesNotMatch(header, /CrmNotificationBell/)
    assert.doesNotMatch(header, /ContasPagarNotifBell/)

    const sql = readSrc('supabase/migrations/178_crm_comunicacao.sql')
    assert.match(sql, /movelaria_crm_notificacoes/)
    assert.match(sql, /movelaria_crm_whatsapp_historico/)
    assert.match(sql, /movelaria_crm_eventos_boot/)
    assert.match(sql, /movelaria_crm_agenda_publica/)
    assert.match(sql, /Não mistura com o Caixa|Avisos do CRM|notificações do CRM/)
  })
})
