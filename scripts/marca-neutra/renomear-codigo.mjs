/**
 * Marca neutra (docs/marca-neutra, T08–T11): renomeia arquivos e identificadores do front e das edge
 * functions para não citar uma empresa cliente. Mesmas regras da migration do banco (gerar-migration-banco).
 * Ensaio por padrão (lista renomes e colisões); --write aplica.
 *
 * Uso: node scripts/marca-neutra/renomear-codigo.mjs [--write]
 */
import fs from 'node:fs'
import path from 'node:path'

const WRITE = process.argv.includes('--write')
// Termo montado em partes para o próprio script não carregar o nome.
const T = ['g', 'a', 'r', 'b', 'o'].join('')
const TC = T[0].toUpperCase() + T.slice(1)
const TU = T.toUpperCase()
const R = (s, f = 'g') => new RegExp(s, f)
const RAIZES = ['src', 'supabase/functions']
const EXT = /\.(tsx?|css|mjs|js|json)$/
const barra = (p) => p.split(path.sep).join('/')

function listar(dir) {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = barra(path.join(dir, e.name))
    if (e.isDirectory()) out.push(...listar(p))
    else if (EXT.test(e.name)) out.push(p)
  }
  return out
}

/** Regra para nomes de arquivo/módulo (caminhos de import). */
function nomeArquivo(base) {
  return base
    .replace(R(`^${T}-`), '')
    .replace(R(`-${T}-`), '-')
    .replace(R(`-${T}(?=[.]|$)`), '')
    .replace(R(TC), '')
}

/** Regra para o texto (identificadores, chaves, classes, valores). */
function texto(s) {
  return s
    .replace(R(`Pontua ${TC}`), 'Pontua')
    .replace(R(`Lead ${TC}`), 'Lead')
    .replace(R(`\\b${TU}_`), '')
    .replace(R(`_${TU}_`), '_')
    .replace(R(`_${TU}\\b`), '')
    .replace(R(`([A-Za-z0-9])${TC}`), '$1')
    .replace(R(`\\b${TC}(?=[A-Z])`), '')
    .replace(R(`\\b${T}(?=[A-Z])`), 'app')
    .replace(R(`_${T}_`), '_')
    .replace(R(`_${T}\\b`), '')
    .replace(R(`\\b${T}_`), '')
    .replace(R(`-${T}-`), '-')
    .replace(R(`-${T}\\b`), '')
    .replace(R(`\\b${T}([-:.])`), 'app$1')
}

const arquivos = RAIZES.flatMap(listar)
const renomes = []
for (const f of arquivos) {
  const base = path.basename(f)
  const novo = nomeArquivo(base)
  if (novo !== base) renomes.push([f, barra(path.join(path.dirname(f), novo))])
}
const colisoes = renomes.filter(([, n]) => fs.existsSync(n))
const tokensAntes = new Set()
for (const f of arquivos) for (const m of fs.readFileSync(f, 'utf8').matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) tokensAntes.add(m[0])
const colTok = []
for (const t of tokensAntes) {
  if (!R(T, 'i').test(t)) continue
  const n = texto(t)
  if (n !== t && tokensAntes.has(n)) colTok.push(`${t} → ${n}`)
}
console.log(`arquivos a renomear: ${renomes.length}`)
for (const [a, b] of renomes) console.log(`  ${a} → ${b}`)
console.log(`colisões de arquivo: ${colisoes.length}`, colisoes)
console.log(`tokens novos que já existem: ${colTok.length}`)
for (const c of colTok) console.log(`  ${c}`)

if (WRITE) {
  if (colisoes.length) throw new Error('colisão de arquivo — resolva antes')
  let mod = 0
  for (const f of arquivos) {
    const s = fs.readFileSync(f, 'utf8')
    let n = s.replace(/(from\s+|import\s*\(\s*|import\s+)(['"])([^'"]+)\2/g, (m, a, q, p) =>
      `${a}${q}${p.split('/').map((seg) => nomeArquivo(seg)).join('/')}${q}`)
    n = texto(n)
    if (n !== s) { fs.writeFileSync(f, n); mod++ }
  }
  for (const [a, b] of renomes) fs.renameSync(a, b)
  console.log(`ok: ${mod} arquivo(s) alterado(s), ${renomes.length} renomeado(s)`)
}
