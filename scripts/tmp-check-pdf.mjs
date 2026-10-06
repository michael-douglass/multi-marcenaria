import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), '.env'), 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (!m) continue
    const key = m[1].trim()
    let val = m[2].trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnv()

const url = process.env.VITE_SUPABASE_URL
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY

const path =
  '2c196e67-dd26-4e1c-839d-4d234f3a3dfd/201c404c-4140-43f5-8f4e-a9c620b2602e/A4_ARQ_DET_QUARTO SUI_TE_CO_REV01.pdf'

const sb = createClient(url, key)
const t0 = Date.now()
const { data, error } = await sb.storage.from('orcamentos-ia').download(path)
if (error) {
  console.error('DL error', error)
  process.exit(1)
}
const buf = Buffer.from(await data.arrayBuffer())
console.log(
  JSON.stringify({
    bytes: buf.length,
    mb: +(buf.length / 1024 / 1024).toFixed(2),
    downloadMs: Date.now() - t0,
  }),
)
writeFileSync('tmp-test-quote.pdf', buf)

// Test pdf.js open timing (same legacy build as the app)
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  '../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const t1 = Date.now()
const loadingTask = pdfjs.getDocument({
  data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  disableFontFace: true,
  useSystemFonts: true,
})
const pdf = await loadingTask.promise
console.log(
  JSON.stringify({
    openMs: Date.now() - t1,
    numPages: pdf.numPages,
  }),
)

const t2 = Date.now()
const page = await pdf.getPage(1)
const viewport = page.getViewport({ scale: 1.0 })
console.log(
  JSON.stringify({
    page1Ms: Date.now() - t2,
    viewport: { w: Math.round(viewport.width), h: Math.round(viewport.height) },
  }),
)
await pdf.destroy()
