/**
 * Captura de rede do Cortecloud (HAR completo) para análise de caixarias/preços.
 *
 * Uso:
 *   node scripts/capture-cortecloud.js
 *   node scripts/capture-cortecloud.js --url "https://marceneiro.cortecloud.com.br/#/plans/23574204/view"
 *   CORTECLOUD_START_URL=... node scripts/capture-cortecloud.js
 *
 * 1) Abre Chromium visível na URL alvo
 * 2) Faça login e navegue o plano (peças, fitas, materiais, custos)
 * 3) Volte a este terminal e pressione ENTER para gravar ./captura_cortecloud.har
 */
import { chromium } from 'playwright'
import readline from 'node:readline'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const HAR_PATH = path.join(ROOT, 'captura_cortecloud.har')
const READY_MARKER = path.join(ROOT, 'scripts', '.cortecloud-capture-done')
const DEFAULT_URL = 'https://marceneiro.cortecloud.com.br/#/plans/23574204/view'

function resolveStartUrl() {
  const argIdx = process.argv.indexOf('--url')
  if (argIdx >= 0 && process.argv[argIdx + 1]) return process.argv[argIdx + 1]
  const positional = process.argv.slice(2).find((a) => a.startsWith('http'))
  if (positional) return positional
  return process.env.CORTECLOUD_START_URL || DEFAULT_URL
}

/** ENTER no terminal OU criação do arquivo scripts/.cortecloud-capture-done */
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
      if (fs.existsSync(READY_MARKER)) finish('arquivo .cortecloud-capture-done')
    }, 1000)
  })
}

async function main() {
  const START_URL = resolveStartUrl()
  console.log('=== Captura Cortecloud (HAR) ===')
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
  console.log('1) Faça login na sua conta Cortecloud (se pedir)')
  console.log('2) Confirme o plano/serviço alvo (ex.: 23574204)')
  console.log('3) Percorra lista de peças, fitas e custos (deixe as APIs carregarem)')
  console.log('4) Pressione ENTER neste terminal — ou crie o arquivo scripts/.cortecloud-capture-done')
  console.log('')
  await waitForEnterOrMarker('Quando terminar a navegação, pressione ENTER aqui para gravar o HAR… ')

  console.log('Fechando contexto (gravação do HAR)…')
  await context.close()
  await browser.close()

  console.log(`HAR salvo em: ${HAR_PATH}`)
  console.log('Pronto. Rode: node scripts/filter-cortecloud-har-micro.mjs --service 23574204')
}

main().catch((err) => {
  console.error('Falha na captura:', err instanceof Error ? err.message : err)
  process.exit(1)
})
