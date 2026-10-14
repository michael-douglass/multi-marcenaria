/**
 * Captura de rede do HelloMob / Cortecloud (HAR) para paridade modular Quarto.
 *
 * Uso:
 *   node scripts/capture-hellomob.js
 *   node scripts/capture-hellomob.js --url "https://marceneiro.cortecloud.com.br/#/hellomobweb/22168837/view/environment/Quarto"
 *   node scripts/capture-hellomob.js --auto-close-sec 90
 *   HELLOMOB_START_URL=... node scripts/capture-hellomob.js
 *
 * 1) Abre Chromium visível na URL HelloMob
 * 2) Faça login (se pedir) e abra a aba Projeto (lista de módulos)
 * 3) Pressione ENTER — ou crie scripts/.hellomob-capture-done — ou use --auto-close-sec
 */
import { chromium } from 'playwright'
import readline from 'node:readline'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const HAR_PATH = path.join(ROOT, 'captura_hellomob.har')
const READY_MARKER = path.join(ROOT, 'scripts', '.hellomob-capture-done')
const DEFAULT_URL =
  'https://marceneiro.cortecloud.com.br/#/hellomobweb/22168837/view/environment/Quarto'

function resolveStartUrl() {
  const argIdx = process.argv.indexOf('--url')
  if (argIdx >= 0 && process.argv[argIdx + 1]) return process.argv[argIdx + 1]
  const positional = process.argv.slice(2).find((a) => a.startsWith('http'))
  if (positional) return positional
  return process.env.HELLOMOB_START_URL || DEFAULT_URL
}

function resolveAutoCloseSec() {
  const argIdx = process.argv.indexOf('--auto-close-sec')
  if (argIdx >= 0 && process.argv[argIdx + 1]) {
    const n = Number(process.argv[argIdx + 1])
    return Number.isFinite(n) && n > 0 ? n : null
  }
  const env = Number(process.env.HELLOMOB_AUTO_CLOSE_SEC)
  return Number.isFinite(env) && env > 0 ? env : null
}

/** ENTER no terminal, marker file, ou timeout --auto-close-sec */
function waitForEnterOrMarker(prompt, autoCloseSec) {
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
      if (autoTimer) clearTimeout(autoTimer)
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
      if (fs.existsSync(READY_MARKER)) finish('arquivo .hellomob-capture-done')
    }, 1000)
    let autoTimer = null
    if (autoCloseSec) {
      console.log(`Auto-close em ${autoCloseSec}s (ou ENTER / marker antes).`)
      autoTimer = setTimeout(() => finish(`auto-close ${autoCloseSec}s`), autoCloseSec * 1000)
    }
  })
}

async function main() {
  const START_URL = resolveStartUrl()
  const autoCloseSec = resolveAutoCloseSec()
  console.log('=== Captura HelloMob (HAR) ===')
  console.log(`HAR de saída: ${HAR_PATH}`)
  console.log(`URL inicial:  ${START_URL}`)
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

  console.log('Navegador aberto.')
  console.log('1) Faça login na conta Cortecloud (se pedir)')
  console.log('2) Confirme HelloMob 22168837 — ambiente Quarto')
  console.log('3) Abra a aba Projeto e role a lista de módulos (APIs carregarem)')
  console.log('4) Pressione ENTER — ou crie scripts/.hellomob-capture-done')
  console.log('')
  await waitForEnterOrMarker(
    'Quando terminar a navegação, pressione ENTER aqui para gravar o HAR… ',
    autoCloseSec,
  )

  console.log('Fechando contexto (gravação do HAR)…')
  await context.close()
  await browser.close()

  console.log(`HAR salvo em: ${HAR_PATH}`)
  console.log('Pronto. Inspecione com REA inspect_web_network_capture (format=har).')
}

main().catch((err) => {
  console.error('Falha na captura:', err instanceof Error ? err.message : err)
  process.exit(1)
})
