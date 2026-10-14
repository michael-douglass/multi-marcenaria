/**
 * Captura HAR do plano Flaviane/Hélio — Cortecloud #23125828.
 *
 * Uso:
 *   node scripts/capture-flaviane.js
 *   node scripts/capture-flaviane.js --auto
 *
 * --auto: login via CORTECLOUD_EMAIL/PASSWORD (.env), navega o plano,
 *         espera APIs de peças/chapas e grava ./captura_flaviane.har sem ENTER.
 *
 * Manual: abre Chromium, você navega, ENTER ou marker scripts/.flaviane-capture-done.
 */
import { chromium } from 'playwright'
import readline from 'node:readline'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const HAR_PATH = path.join(ROOT, 'captura_flaviane.har')
const READY_MARKER = path.join(ROOT, 'scripts', '.flaviane-capture-done')
const DEFAULT_URL = 'https://marceneiro.cortecloud.com.br/#/plans/23125828/view'
const PLAN_ID = '23125828'

function loadDotEnv() {
  const envPath = path.join(ROOT, '.env')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = v
  }
}

function resolveStartUrl() {
  const argIdx = process.argv.indexOf('--url')
  if (argIdx >= 0 && process.argv[argIdx + 1]) return process.argv[argIdx + 1]
  const positional = process.argv.slice(2).find((a) => a.startsWith('http'))
  if (positional) return positional
  return process.env.CORTECLOUD_START_URL || DEFAULT_URL
}

function waitForEnterOrMarker(prompt) {
  try {
    if (fs.existsSync(READY_MARKER)) fs.unlinkSync(READY_MARKER)
  } catch {
    /* ignore */
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    let done = false
    const finish = (reason) => {
      if (done) return
      done = true
      clearInterval(timer)
      try {
        rl.close()
      } catch {
        /* ignore */
      }
      console.log(`Sinal recebido (${reason}).`)
      resolve()
    }

    rl.question(prompt, () => finish('ENTER'))
    const timer = setInterval(() => {
      if (fs.existsSync(READY_MARKER)) finish('arquivo .flaviane-capture-done')
    }, 1000)
  })
}

async function tryAutoLogin(page) {
  const email = process.env.CORTECLOUD_EMAIL
  const password = process.env.CORTECLOUD_PASSWORD
  if (!email || !password) {
    console.log('CORTECLOUD_EMAIL/PASSWORD ausentes — login manual.')
    return false
  }

  await page.waitForTimeout(2500)
  const emailSel =
    'input[type="email"], input[name="email"], input[placeholder*="mail" i], input[id*="email" i]'
  const passSel = 'input[type="password"]:visible'
  const emailEl = page.locator(emailSel).first()
  const passEl = page.locator(passSel).first()

  if ((await emailEl.count()) === 0 || (await passEl.count()) === 0) {
    console.log('Formulário de login não encontrado (já autenticado?).')
    return false
  }

  console.log('Preenchendo login Cortecloud…')
  await emailEl.fill(email)
  await passEl.fill(password)
  // Prefer Enter — botões "Começar a terceirizar" / social ficam ocultos no DOM
  await passEl.press('Enter')
  await page.waitForTimeout(5000)
  // Se ainda na home, tenta botão de submit visível
  const visibleSubmit = page.locator('button.btn-primary:visible, button[type="submit"]:visible').first()
  if ((await visibleSubmit.count()) > 0) {
    try {
      await visibleSubmit.click({ timeout: 5000 })
      await page.waitForTimeout(3000)
    } catch {
      /* ignore */
    }
  }
  return true
}

async function waitForPlanApis(page, timeoutMs = 90_000) {
  const interesting = []
  const onResponse = (res) => {
    const u = res.url()
    if (
      /api\.cortecloud\.com\.br/i.test(u) &&
      (new RegExp(PLAN_ID).test(u) || /parts|materials|boards|edges|services/i.test(u))
    ) {
      interesting.push(u)
    }
  }
  page.on('response', onResponse)

  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (interesting.length >= 3) break
    await page.waitForTimeout(1500)
  }
  page.off('response', onResponse)
  console.log(`APIs observadas: ${interesting.length}`)
  return interesting
}

async function main() {
  loadDotEnv()
  const auto = process.argv.includes('--auto')
  const START_URL = resolveStartUrl()
  console.log('=== Captura Flaviane Cortecloud #23125828 (HAR) ===')
  console.log(`HAR de saída: ${HAR_PATH}`)
  console.log(`URL inicial:  ${START_URL}`)
  console.log(`Modo: ${auto ? 'auto' : 'manual'}`)
  console.log('')

  const browser = await chromium.launch({
    headless: false,
    channel: undefined,
  })

  const context = await browser.newContext({
    recordHar: {
      path: HAR_PATH,
      mode: 'full',
    },
    viewport: { width: 1440, height: 900 },
    locale: 'pt-BR',
  })

  const page = await context.newPage()
  await page.goto(START_URL, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await tryAutoLogin(page)

  if (!page.url().includes(PLAN_ID)) {
    await page.goto(START_URL, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  }

  // Dispara abas comuns do plano para puxar APIs de chapas/peças
  for (const label of ['Resumo', 'Chapas', 'Fitas', 'Peças', 'Lista']) {
    try {
      const tab = page.getByText(label, { exact: false }).first()
      if ((await tab.count()) > 0) {
        await tab.click({ timeout: 2000 }).catch(() => {})
        await page.waitForTimeout(1200)
      }
    } catch {
      /* ignore */
    }
  }

  await waitForPlanApis(page)

  if (auto) {
    console.log('Modo --auto: aguardando mais 8s e gravando HAR…')
    await page.waitForTimeout(8000)
  } else {
    console.log('Navegador aberto.')
    console.log('1) Confirme login e o plano #23125828')
    console.log('2) Percorra Resumo / Chapas / Fitas / Peças')
    console.log('3) ENTER neste terminal — ou crie scripts/.flaviane-capture-done')
    console.log('')
    await waitForEnterOrMarker('Quando terminar, pressione ENTER para gravar o HAR… ')
  }

  console.log('Fechando contexto (gravação do HAR)…')
  await context.close()
  await browser.close()

  console.log(`HAR salvo em: ${HAR_PATH}`)
  if (fs.existsSync(HAR_PATH)) {
    console.log(`Tamanho: ${fs.statSync(HAR_PATH).size} bytes`)
  }
  console.log('Próximo: filtrar HAR e gerar docs/evidence/resultado_cortecloud_23125828.json')
}

main().catch((err) => {
  console.error('Falha na captura:', err instanceof Error ? err.message : err)
  process.exit(1)
})
