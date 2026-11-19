// Salva a sessão de login da Lousa num perfil Playwright local (fora do projeto).
// Uso: node scripts/lousa-lead/login.mjs
// Abre uma janela visível; faça o login com um usuário DA EMPRESA (não o master).
// Depois do login o script mesmo abre o lead de teste e fecha quando a lousa aparece.
// Nenhuma senha passa por este script.
import { chromium } from 'playwright';
import path from 'node:path';
import os from 'node:os';

const BASE = process.env.LOUSA_BASE ?? 'http://127.0.0.1:3091';
const LEAD = process.env.LOUSA_LEAD ?? '39';
// Fora do projeto: o watcher do Vite cai (EBUSY) com o perfil do Chromium dentro da árvore.
const PROFILE = process.env.LOUSA_PROFILE ?? path.join(os.homedir(), '.cache', 'lousa-lead-playwright');
const LEAD_URL = `${BASE}/pipeline?id=${LEAD}&tab=detalhes`;

const ctx = await chromium.launchPersistentContext(PROFILE, { headless: false, viewport: { width: 1366, height: 900 } });
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto(LEAD_URL, { timeout: 180000 });
const deadline = Date.now() + 15 * 60_000;
let ok = false;
let lastNav = 0;
while (Date.now() < deadline) {
  try {
    if ((await page.locator('#lead-sec-lousa').count()) > 0) { ok = true; break; }
    const onLogin = (await page.locator('#login-email').count()) > 0;
    const url = page.url();
    if (url.includes('/master')) console.log('AVISO: conta master — saia e entre com um usuário da empresa.');
    if (!onLogin && !url.includes('/master') && !url.includes('/pipeline') && Date.now() - lastNav > 15000) {
      lastNav = Date.now();
      await page.goto(LEAD_URL, { timeout: 180000 });
    }
  } catch { /* navegação em curso */ }
  await new Promise((r) => setTimeout(r, 2000));
}
await new Promise((r) => setTimeout(r, 3000));
await ctx.close();
console.log(ok ? 'LOGIN_OK' : 'LOGIN_TIMEOUT');
process.exit(ok ? 0 : 1);
