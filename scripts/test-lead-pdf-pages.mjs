/**
 * Teste: PDF do lead (marketing-medias) → contagem de páginas.
 * Uso: node --env-file=.env scripts/test-lead-pdf-pages.mjs
 */
import { createClient } from '@supabase/supabase-js'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!url || !key) {
  console.error('Faltam VITE_SUPABASE_URL / ANON_KEY no .env')
  process.exit(1)
}

const supabase = createClient(url, key)

const { data: rows, error } = await supabase
  .schema('emp_garbo')
  .from('marketing_medias')
  .select('id, titulo, file_url, lead_id, tipo')
  .eq('tipo', 'pdf')
  .not('lead_id', 'is', null)
  .limit(3)

if (error) {
  // schema emp_garbo pode não estar exposto na API — baixa via SQL path conhecido
  console.warn('API schema emp_garbo indisponível:', error.message)
  console.log('Testando URL pública conhecida de PDF…')
}

const testUrls = (rows ?? []).map(r => r.file_url).filter(Boolean)

if (testUrls.length === 0) {
  // fallback: busca via storage list
  const { data: files } = await supabase.storage.from('marketing-medias').list('emp_garbo', {
    limit: 50,
    sortBy: { column: 'created_at', order: 'desc' },
  })
  const pdfs = (files ?? []).filter(f => f.name?.toLowerCase().endsWith('.pdf')).slice(0, 2)
  for (const f of pdfs) {
    const { data } = supabase.storage.from('marketing-medias').getPublicUrl(`emp_garbo/${f.name}`)
    if (data?.publicUrl) testUrls.push(data.publicUrl)
  }
}

if (testUrls.length === 0) {
  console.error('Nenhum PDF de teste encontrado.')
  process.exit(1)
}

let ok = 0
for (const fileUrl of testUrls) {
  console.log('\n📄', fileUrl.slice(-80))
  const res = await fetch(fileUrl)
  if (!res.ok) {
    console.error('  fetch falhou:', res.status)
    // tenta storage download
    const marker = '/storage/v1/object/public/marketing-medias/'
    const i = fileUrl.indexOf(marker)
    if (i < 0) continue
    const path = decodeURIComponent(fileUrl.slice(i + marker.length).split('?')[0])
    const { data, error: dlErr } = await supabase.storage.from('marketing-medias').download(path)
    if (dlErr || !data) {
      console.error('  download falhou:', dlErr?.message)
      continue
    }
    const buf = await data.arrayBuffer()
    const pdf = await pdfjs.getDocument({ data: buf }).promise
    console.log(`  ✅ ${pdf.numPages} página(s) via Storage download`)
    ok++
    continue
  }
  const buf = await res.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: buf }).promise
  console.log(`  ✅ ${pdf.numPages} página(s) — virariam ${pdf.numPages} foto(s)`)
  ok++
}

console.log(`\nResultado: ${ok}/${testUrls.length} PDF(s) ok`)
process.exit(ok > 0 ? 0 : 1)
