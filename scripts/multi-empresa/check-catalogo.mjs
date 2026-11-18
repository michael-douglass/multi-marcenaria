/**
 * M41 — Confere o catálogo de páginas: lista as páginas e mapeia cada rota autenticada de src/App.tsx
 * para um id do catálogo. Rotas sem id ficam sempre liberadas — a lista "SEM PÁGINA" deve conter só
 * rotas públicas, redirects e o console master.
 *
 * Uso: npx tsx scripts/multi-empresa/check-catalogo.mjs
 */
import { readFileSync } from 'node:fs'
import { listarPaginas, paginaIdFromPath } from '../../src/lib/paginas-catalogo.ts'

const paginas = listarPaginas()
console.log(`Catálogo: ${paginas.length} páginas`)
for (const p of paginas) {
  console.log(`  [${p.secao}] ${p.grupo}${p.subgrupo ? ` › ${p.subgrupo}` : ''} › ${p.titulo}  (${p.id} → ${p.url})${p.bloqueavel ? '' : '  · não bloqueável'}`)
}

const app = readFileSync('src/App.tsx', 'utf8')
const rotas = [...new Set([...app.matchAll(/path="([^"]+)"/g)].map(m => m[1]))].filter(r => r !== '*')
const ESPERADAS_SEM_PAGINA = [/^\/master/, /^\/orcamento\//, /^\/iniciar-orcamento/, /^\/agendar/, /^\/cadastro/, /^\/apresentacao/, /^\/marketing\/apresentacao-empresa$/, /^\/admin\/empresas$/]

const sem = []
console.log('\nRotas → página')
for (const r of rotas) {
  const exemplo = r.replace(/:[A-Za-z]+/g, 'x')
  const id = paginaIdFromPath(exemplo)
  console.log(`  ${r.padEnd(42)} ${id ?? '—'}`)
  if (!id && !ESPERADAS_SEM_PAGINA.some(re => re.test(r))) sem.push(r)
}
if (sem.length) {
  console.log(`\nSEM PÁGINA (inesperado): ${sem.join(', ')}`)
  process.exitCode = 1
} else {
  console.log('\nOK: toda rota autenticada cai numa página do catálogo.')
}
