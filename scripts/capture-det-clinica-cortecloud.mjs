/**
 * Login Cortecloud + captura quantitativos do plano #23496206 (DET_CLÍNICA).
 * Uso: node --env-file=.env scripts/capture-det-clinica-cortecloud.mjs
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PLAN_ID = '23496206'
const START_URL = `https://marceneiro.cortecloud.com.br/#/plans/${PLAN_ID}/editmodules`
const OUT = path.join(ROOT, 'docs', 'evidence', 'resultado_cortecloud_23496206.json')
const HAR_PATH = path.join(ROOT, 'docs', 'evidence', 'captura_cortecloud-23496206.har')

function asObj(v) {
  if (!v) return null
  if (typeof v === 'string') {
    try {
      return JSON.parse(v)
    } catch {
      return null
    }
  }
  return typeof v === 'object' ? v : null
}

function deepFindArrays(root, pred, acc = []) {
  if (!root || typeof root !== 'object') return acc
  if (Array.isArray(root)) {
    if (root.length && pred(root)) acc.push(root)
    for (const item of root) deepFindArrays(item, pred, acc)
    return acc
  }
  for (const v of Object.values(root)) deepFindArrays(v, pred, acc)
  return acc
}

async function tryAutoLogin(page) {
  const email = process.env.CORTECLOUD_EMAIL
  const password = process.env.CORTECLOUD_PASSWORD
  if (!email || !password) throw new Error('CORTECLOUD_EMAIL/PASSWORD ausentes no .env')

  await page.waitForTimeout(2000)

  // Modal "Atualização de senha" — tenta fechar / pular
  for (const label of ['Agora não', 'Depois', 'Cancelar', 'Fechar', 'Pular', 'Continuar']) {
    const btn = page.getByRole('button', { name: new RegExp(label, 'i') }).first()
    if ((await btn.count()) > 0) {
      try {
        await btn.click({ timeout: 2000 })
        await page.waitForTimeout(1000)
      } catch {
        /* ignore */
      }
    }
  }

  const emailSel =
    'input[type="email"], input[name="email"], input[placeholder*="mail" i], input[id*="email" i]'
  const passSel = 'input[type="password"]'
  const emailEl = page.locator(emailSel).first()
  const passEl = page.locator(passSel).first()

  if ((await emailEl.count()) > 0 && (await passEl.count()) > 0) {
    console.log('Login…')
    await emailEl.fill(email)
    await passEl.fill(password)
    await passEl.press('Enter')
    await page.waitForTimeout(5000)
    const submit = page.locator('button.btn-primary:visible, button[type="submit"]:visible').first()
    if ((await submit.count()) > 0) {
      try {
        await submit.click({ timeout: 4000 })
        await page.waitForTimeout(3000)
      } catch {
        /* ignore */
      }
    }
  } else {
    console.log('Formulário de login não visível (sessão existente?).')
  }
}

async function main() {
  const bags = {
    parts: [],
    boards: [],
    edges: [],
    materials: [],
    modules: [],
    services: [],
    raw_urls: [],
  }

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    recordHar: { path: HAR_PATH, mode: 'full' },
    viewport: { width: 1440, height: 900 },
    locale: 'pt-BR',
  })
  const page = await context.newPage()

  page.on('response', async (res) => {
    const u = res.url()
    if (!/cortecloud|hellomob/i.test(u)) return
    if (!/parts|boards|edges|materials|modules|services|products|Hellomob|ambient/i.test(u)) return
    bags.raw_urls.push(u)
    let body = null
    try {
      body = asObj(await res.text())
    } catch {
      return
    }
    if (!body) return

    if (/parts/i.test(u)) bags.parts.push({ url: u, body })
    if (/boards/i.test(u) || /\/core\/boards/i.test(u)) bags.boards.push({ url: u, body })
    if (/edges|edging|fita/i.test(u)) bags.edges.push({ url: u, body })
    if (/materials/i.test(u)) bags.materials.push({ url: u, body })
    if (/modulo|module|Hellomob|ambient/i.test(u)) bags.modules.push({ url: u, body })
    if (/services/i.test(u) && new RegExp(PLAN_ID).test(u)) bags.services.push({ url: u, body })
  })

  console.log('Abrindo', START_URL)
  await page.goto(START_URL, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await tryAutoLogin(page)

  if (!page.url().includes(PLAN_ID)) {
    await page.goto(START_URL, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  }

  // Dispara abas do plano
  for (const label of [
    'Módulos',
    'Resumo',
    'Chapas',
    'Fitas',
    'Peças',
    'Lista',
    'Materiais',
    'Projeto',
  ]) {
    try {
      const tab = page.getByText(label, { exact: false }).first()
      if ((await tab.count()) > 0) {
        await tab.click({ timeout: 2500 }).catch(() => {})
        await page.waitForTimeout(1500)
      }
    } catch {
      /* ignore */
    }
  }

  // Navega views comuns
  for (const hash of [
    `#/plans/${PLAN_ID}/view`,
    `#/plans/${PLAN_ID}/editmodules`,
    `#/plans/${PLAN_ID}/parts`,
    `#/plans/${PLAN_ID}/materials`,
  ]) {
    try {
      await page.goto(`https://marceneiro.cortecloud.com.br/${hash}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      })
      await page.waitForTimeout(4000)
    } catch {
      /* ignore */
    }
  }

  await page.waitForTimeout(8000)

  // Extrai chapas
  const sheets = []
  for (const pack of bags.boards) {
    const arrays = deepFindArrays(
      pack.body,
      (arr) =>
        arr.some(
          (x) =>
            x &&
            typeof x === 'object' &&
            ('thickness' in x ||
              'thickness_mm' in x ||
              'consumption' in x ||
              'color' in x ||
              'board_id' in x),
        ),
    )
    for (const arr of arrays) {
      for (const s of arr) {
        if (!s || typeof s !== 'object') continue
        const thickness = Number(s.thickness_mm ?? s.thickness ?? s.thick) || null
        const consumption = Number(s.consumption ?? s.qty ?? s.quantity ?? s.amount) || 0
        if (!consumption && !thickness) continue
        sheets.push({
          id: s.id ?? s.board_id ?? null,
          kind: s.kind ?? s.type ?? 'MDF',
          color: s.color ?? s.colour ?? s.name ?? null,
          finishing: s.finishing ?? s.finish ?? null,
          brand: s.brand ?? s.manufacturer ?? null,
          thickness_mm: thickness,
          consumption,
          label:
            s.label ||
            s.description ||
            [s.kind || 'MDF', thickness ? `${thickness}mm` : null, s.color, s.brand]
              .filter(Boolean)
              .join(' '),
        })
      }
    }
  }

  // Dedup sheets by label+thickness
  const sheetMap = new Map()
  for (const s of sheets) {
    const key = `${s.label}|${s.thickness_mm}|${s.color}`
    const prev = sheetMap.get(key)
    if (!prev || (s.consumption || 0) > (prev.consumption || 0)) sheetMap.set(key, s)
  }
  const sheetsUnique = [...sheetMap.values()]

  // Parts
  let partsRows = []
  for (const pack of bags.parts) {
    const arrays = deepFindArrays(
      pack.body,
      (arr) =>
        arr.some(
          (x) =>
            x &&
            typeof x === 'object' &&
            ('width' in x || 'height' in x || 'unique' in x || 'part_id' in x || 'function' in x),
        ),
    )
    for (const arr of arrays) {
      if (arr.length > partsRows.length) partsRows = arr
    }
  }

  // Modules from DOM text if API thin
  const moduleTexts = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('a, button, li, tr, div'))
    const names = []
    for (const n of nodes) {
      const t = (n.textContent || '').replace(/\s+/g, ' ').trim()
      if (t.length < 4 || t.length > 80) continue
      if (/módulo|modulo|armário|armario|balcão|balcao|painel|gaveta|nicho|porta/i.test(t)) {
        names.push(t)
      }
    }
    return [...new Set(names)].slice(0, 200)
  })

  // Ambients / modules from Hellomob payloads
  const modules = []
  const ambients_piece_qty = {}
  for (const pack of bags.modules) {
    const arrays = deepFindArrays(
      pack.body,
      (arr) =>
        arr.some(
          (x) =>
            x &&
            typeof x === 'object' &&
            ('name' in x || 'nome' in x || 'module_name' in x || 'title' in x) &&
            ('environment' in x || 'ambiente' in x || 'ambient' in x || 'width' in x || 'children' in x),
        ),
    )
    for (const arr of arrays) {
      for (const m of arr) {
        const name = m.name || m.nome || m.module_name || m.title
        const env = m.environment || m.ambiente || m.ambient || m.room || 'Ambiente'
        if (!name) continue
        modules.push({
          env: typeof env === 'string' ? env : env?.name || 'Ambiente',
          name: String(name),
          typology: m.typology || m.type || m.categoria || null,
          width: m.width ?? m.largura ?? null,
          height: m.height ?? m.altura ?? null,
          depth: m.depth ?? m.profundidade ?? null,
        })
        const ek = typeof env === 'string' ? env : env?.name || 'Ambiente'
        ambients_piece_qty[ek] = (ambients_piece_qty[ek] || 0) + 1
      }
    }
  }

  // Hardware / edges
  const edges = []
  for (const pack of bags.edges) {
    const arrays = deepFindArrays(
      pack.body,
      (arr) =>
        arr.some(
          (x) =>
            x &&
            typeof x === 'object' &&
            ('color' in x || 'thickness' in x || 'meters' in x || 'consumption' in x || 'edge_id' in x),
        ),
    )
    for (const arr of arrays) {
      for (const e of arr) {
        edges.push({
          label: e.label || e.description || e.color || e.name || 'Fita',
          quantity: Number(e.consumption ?? e.meters ?? e.quantity ?? e.qty) || 0,
          unit: e.unit || 'm',
        })
      }
    }
  }

  const pieces_quantity_sum = partsRows.reduce((s, p) => {
    const q = Number(p.quantity ?? p.qty ?? p.amount ?? 1) || 1
    return s + q
  }, 0)

  const result = {
    plan_id: Number(PLAN_ID),
    url: START_URL,
    source: 'playwright auto-login + network capture',
    extracted_at: new Date().toISOString(),
    client: 'DET_CLÍNICA',
    parts_rows: partsRows.length,
    pieces_quantity_sum,
    sheets_total: sheetsUnique.reduce((s, x) => s + (Number(x.consumption) || 0), 0),
    sheets: sheetsUnique,
    edges,
    modules,
    module_dom_hints: moduleTexts,
    ambients_piece_qty,
    api_url_count: bags.raw_urls.length,
    api_urls_sample: [...new Set(bags.raw_urls)].slice(0, 40),
    capture_note:
      'Preços ignorados na conferência. Quantitativos de chapas/peças/módulos quando disponíveis na API.',
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2), 'utf8')
  console.log('Salvo', OUT)
  console.log(
    JSON.stringify(
      {
        sheets: result.sheets.length,
        sheets_total: result.sheets_total,
        parts_rows: result.parts_rows,
        modules: result.modules.length,
        edges: result.edges.length,
        api_urls: result.api_url_count,
        page: page.url(),
      },
      null,
      2,
    ),
  )

  await context.close()
  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
