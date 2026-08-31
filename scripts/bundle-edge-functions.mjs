import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

const ROOT = 'supabase/functions'
const OUT = 'tmp/fn-bundles'
mkdirSync(OUT, { recursive: true })

const jwtFalse = new Set([
  'get-lead-whatsapp-history',
  'send-whatsapp-message',
  'crm-selletos-receber-webhook',
  'get-lead-origin-table',
  'migrate-leads-regiao',
  'adicionar-numero-negativado',
  'receber-whatsapp',
  'agenda-disparar-webhook',
  'agenda-disparar-confirmacao',
  'agenda-disparar-conclusao',
  'fix-user-access',
  'agenda-disparar-relatorio',
  'cadastro-alunos',
  'edit-lead-render',
  'render-lead-ambiente',
  'agenda-public-booking',
  'agenda-public-upload',
])

function collect(entryFile, seen = new Set()) {
  const abs = entryFile.replaceAll('\\', '/')
  if (seen.has(abs)) return []
  seen.add(abs)
  const src = readFileSync(abs, 'utf8')
  const files = [{ abs, src }]
  const importRe = /from\s+['"](\.[^'"]+)['"]/g
  let m
  while ((m = importRe.exec(src))) {
    let spec = m[1]
    if (!spec.endsWith('.ts')) spec += '.ts'
    const resolved = join(dirname(abs), spec)
    if (existsSync(resolved)) files.push(...collect(resolved, seen))
  }
  return files
}

const slugs = readdirSync(ROOT).filter((n) => existsSync(join(ROOT, n, 'index.ts')))
const manifest = []
for (const slug of slugs) {
  const entry = join(ROOT, slug, 'index.ts')
  const files = collect(entry)
  const payload = {
    name: slug,
    entrypoint_path: `functions/${slug}/index.ts`,
    verify_jwt: !jwtFalse.has(slug),
    files: files.map((f) => ({
      name: `functions/${relative(ROOT, f.abs).replaceAll('\\', '/')}`,
      content: f.src,
    })),
  }
  writeFileSync(join(OUT, `${slug}.json`), JSON.stringify(payload))
  manifest.push({
    slug,
    files: payload.files.length,
    bytes: JSON.stringify(payload).length,
    verify_jwt: payload.verify_jwt,
  })
}
writeFileSync(join(OUT, '_manifest.json'), JSON.stringify(manifest, null, 2))
console.log(JSON.stringify(manifest, null, 2))
