// T04 — Filtra o índice (TOC) do dump do banco antigo usando supabase/baseline/manifest.json.
// Entrada:  supabase/baseline/.work/toc.list          (pg_restore -l)
// Saída:    supabase/baseline/.work/toc.filtered.list (para pg_restore -L)
import fs from 'fs'

const m = JSON.parse(fs.readFileSync('supabase/baseline/manifest.json', 'utf8'))
const tables = new Set(m.tables)
const views = new Set(m.views)
const functions = new Set(m.functions)
const types = new Set(m.types)
const sequences = new Set(m.sequences)
const indexes = new Set(Object.keys(m.indexes))
const skippedFks = new Set(m.skippedFks)

const TYPES = ['SEQUENCE OWNED BY', 'MATERIALIZED VIEW DATA', 'MATERIALIZED VIEW', 'FK CONSTRAINT', 'ROW SECURITY', 'DEFAULT ACL',
  'SEQUENCE SET', 'TABLE DATA', 'CONSTRAINT', 'FUNCTION', 'PROCEDURE', 'AGGREGATE', 'SEQUENCE', 'TRIGGER', 'COMMENT', 'DEFAULT',
  'POLICY', 'SCHEMA', 'TABLE', 'INDEX', 'VIEW', 'TYPE', 'RULE', 'ACL', 'DOMAIN', 'EXTENSION', 'PUBLICATION TABLE', 'PUBLICATION',
  'OPERATOR', 'CAST', 'EVENT TRIGGER', 'STATISTICS']
  .sort((a, b) => b.length - a.length)

const unq = s => s.replace(/"/g, '')
const fnName = s => unq(s.split('(')[0].trim())
const rel = (schema, name) => tables.has(schema + '.' + name) || views.has(schema + '.' + name)

function decide(type, schema, name) {
  const first = name.split(' ')[0]
  switch (type) {
    case 'SCHEMA': return name === 'emp_garbo'
    case 'TABLE':
    case 'MATERIALIZED VIEW': return tables.has(schema + '.' + name)
    case 'VIEW': return views.has(schema + '.' + name)
    case 'TYPE':
    case 'DOMAIN': return types.has(schema + '.' + name)
    case 'SEQUENCE':
    case 'SEQUENCE OWNED BY': return sequences.has(schema + '.' + name)
    case 'FUNCTION':
    case 'PROCEDURE':
    case 'AGGREGATE': return functions.has(schema + '.' + fnName(name))
    case 'FK CONSTRAINT': return tables.has(schema + '.' + first) && !skippedFks.has(name)
    case 'DEFAULT':
    case 'CONSTRAINT':
    case 'TRIGGER':
    case 'POLICY':
    case 'ROW SECURITY':
    case 'RULE': return rel(schema, first)
    case 'INDEX': return indexes.has(schema + '.' + name)
    case 'DEFAULT ACL': return schema === 'emp_garbo'
    case 'COMMENT':
    case 'ACL': {
      // name = "<KIND> <alvo>"; schema "-" para objetos sem schema
      const sp = name.indexOf(' ')
      const kind = name.slice(0, sp)
      const target = name.slice(sp + 1)
      if (kind === 'SCHEMA') return target === 'emp_garbo'
      if (kind === 'TABLE' || kind === 'VIEW' || kind === 'MATERIALIZED') return rel(schema, unq(target.replace(/^VIEW /, '')))
      if (kind === 'COLUMN') { const t = unq(target); return rel(schema, t.slice(0, t.lastIndexOf('.'))) }
      if (kind === 'FUNCTION' || kind === 'PROCEDURE') return functions.has(schema + '.' + fnName(target))
      if (kind === 'SEQUENCE') return sequences.has(schema + '.' + unq(target))
      if (kind === 'TYPE') return types.has(schema + '.' + unq(target))
      if (kind === 'INDEX') return indexes.has(schema + '.' + unq(target))
      const on = target.match(/ ON (.+)$/) // POLICY/TRIGGER/CONSTRAINT x ON tabela
      if (on) return rel(schema, unq(on[1]))
      return false
    }
    default: return false
  }
}

const lines = fs.readFileSync('supabase/baseline/.work/toc.list', 'utf8').split(/\r?\n/)
const out = []
const kept = {}
const dropped = {}
const unknown = []
for (const line of lines) {
  if (!line || line.startsWith(';')) { out.push(line); continue }
  const mm = line.match(/^(\d+); (\d+) (\d+) (.+)$/)
  if (!mm) { unknown.push(line); continue }
  const rest = mm[4]
  const type = TYPES.find(t => rest.startsWith(t + ' '))
  if (!type) { unknown.push(line); continue }
  const afterType = rest.slice(type.length + 1)
  const sp = afterType.indexOf(' ')
  const schema = afterType.slice(0, sp)
  const tail = afterType.slice(sp + 1)
  const name = tail.slice(0, tail.lastIndexOf(' ')) // remove o dono
  const keep = decide(type, schema, name)
  const bucket = keep ? kept : dropped
  bucket[type] = (bucket[type] || 0) + 1
  out.push((keep ? '' : ';') + line)
}
fs.writeFileSync('supabase/baseline/.work/toc.filtered.list', out.join('\n'))
console.log('mantidos  ', JSON.stringify(kept))
console.log('descartados', JSON.stringify(dropped))
if (unknown.length) console.log('NAO RECONHECIDOS (' + unknown.length + '):\n' + unknown.slice(0, 20).join('\n'))

// conferência: tudo que o manifesto pede apareceu no dump?
const text = lines.join('\n')
const missing = [...tables].filter(t => { const [s, ...n] = t.split('.'); return !new RegExp(' (TABLE|MATERIALIZED VIEW) ' + s + ' ' + n.join('.').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' ').test(text) })
console.log('tabelas do manifesto ausentes no dump:', missing.length ? missing : 'nenhuma')
