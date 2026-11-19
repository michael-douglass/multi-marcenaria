// Auditoria da Lousa do card de lead (Playwright, Node).
//
// Uso:
//   node scripts/lousa-lead/login.mjs           (uma vez — login manual na janela)
//   node scripts/lousa-lead/audit.mjs [--tag antes|depois] [--only desktop,iphone] [--no-tools] [--offline]
//
// - Abre /pipeline?id=<lead>&tab=detalhes com o perfil salvo em .auth/profile.
// - Para cada viewport: prints da lousa embutida e em tela cheia, mede alvos de toque
//   e sobreposição/corte da barra.
// - Nos viewports marcados com tools:true exercita cada ferramenta e confere a gravação
//   pelas respostas REST de lead_whiteboard_* (POST/PATCH/DELETE).
// - --offline: desenha com context.setOffline(true), religa e confere a sincronização.
// - Grava tudo em out/<tag>/report.json e prints em out/<tag>/*.png (pasta gitignorada).
// - Limpa o que criou no lead (Limpar desenhos + Remover foto).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.LOUSA_BASE ?? 'http://127.0.0.1:3091';
const LEAD = process.env.LOUSA_LEAD ?? '39';
// Fora do projeto: o watcher do Vite cai (EBUSY) com o perfil do Chromium dentro da árvore.
const PROFILE = process.env.LOUSA_PROFILE ?? path.join(os.homedir(), '.cache', 'lousa-lead-playwright');
const args = process.argv.slice(2);
const argVal = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const TAG = argVal('--tag', 'antes');
const ONLY = argVal('--only', '')?.split(',').filter(Boolean) ?? [];
const NO_TOOLS = args.includes('--no-tools');
const OFFLINE = args.includes('--offline');
const OUT = path.join(here, 'out', TAG);
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { id: 'desktop', w: 1440, h: 900, touch: false, tools: true },
  { id: 'iphone', w: 390, h: 844, touch: true, tools: true },
  { id: 'galaxy-s', w: 360, h: 800, touch: true },
  { id: 'galaxy-tab-retrato', w: 800, h: 1280, touch: true, tools: true },
  { id: 'galaxy-tab-paisagem', w: 1280, h: 800, touch: true },
  { id: 'ipad-retrato', w: 820, h: 1180, touch: true },
  { id: 'ipad-paisagem', w: 1180, h: 820, touch: true },
  { id: 'ipad-pro-retrato', w: 1024, h: 1366, touch: true },
  { id: 'ipad-pro-paisagem', w: 1366, h: 1024, touch: true },
].filter((v) => !ONLY.length || ONLY.includes(v.id));

const report = { tag: TAG, base: BASE, lead: LEAD, startedAt: new Date().toISOString(), viewports: [] };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const TEST_IMG = path.join(OUT, '_foto-teste.png');

async function makeTestImage(page) {
  // Gera um PNG 1200×800 pelo canvas do próprio navegador (sem depender de libs).
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 1200;
    c.height = 800;
    const g = c.getContext('2d');
    g.fillStyle = '#d9cbb5';
    g.fillRect(0, 0, 1200, 800);
    g.fillStyle = '#5b3a24';
    g.fillRect(200, 150, 800, 500);
    g.fillStyle = '#fff';
    g.font = 'bold 64px sans-serif';
    g.fillText('FOTO TESTE LOUSA', 290, 420);
    return c.toDataURL('image/png').split(',')[1];
  });
  fs.writeFileSync(TEST_IMG, Buffer.from(b64 || PNG_1x1.toString('base64'), 'base64'));
}

function trackNetwork(page, log) {
  page.on('response', async (res) => {
    const url = res.url();
    if (!/lead_whiteboard|marketing-medias/.test(url)) return;
    const m = res.request().method();
    if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return;
    log.push({ t: Date.now(), method: m, status: res.status(), url: url.replace(/\?.*/, '').split('/').slice(-2).join('/') });
  });
  page.on('requestfailed', (req) => {
    const url = req.url();
    if (!/lead_whiteboard|marketing-medias/.test(url)) return;
    log.push({ t: Date.now(), method: req.method(), status: 'FAILED', error: req.failure()?.errorText, url: url.replace(/\?.*/, '').split('/').slice(-2).join('/') });
  });
}

async function waitWrites(log, since, min = 1, timeout = 8000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const hits = log.filter((e) => e.t >= since);
    if (hits.length >= min) {
      await sleep(300);
      return log.filter((e) => e.t >= since);
    }
    await sleep(150);
  }
  return log.filter((e) => e.t >= since);
}

const toolbar = (page) => page.locator('[data-whiteboard-toolbar]').last();
const toolBtn = (page, lucide) => toolbar(page).locator(`button:has(svg.lucide-${lucide})`).first();

async function openLead(page) {
  await page.goto(`${BASE}/pipeline?id=${LEAD}&tab=detalhes`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.locator('#login-email').waitFor({ timeout: 4000 }).then(
    () => {
      throw new Error('Sessão expirada — rode node scripts/lousa-lead/login.mjs');
    },
    () => {},
  );
  await page.locator('#lead-sec-lousa').waitFor({ timeout: 120000 });
  await page.locator('#lead-sec-lousa').scrollIntoViewIfNeeded();
  await page.locator('#lead-whiteboard').waitFor({ timeout: 45000 });
  await sleep(1500);
}

async function measureLayout(page, scope) {
  return page.evaluate((scopeSel) => {
    const root = document.querySelector(scopeSel);
    if (!root) return null;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const btns = [...root.querySelectorAll('[data-whiteboard-toolbar] button')].filter((b) => b.offsetParent !== null);
    const small = btns
      .map((b) => {
        const r = b.getBoundingClientRect();
        const icon = b.querySelector('svg')?.getAttribute('class')?.match(/lucide-([\w-]+)/)?.[1] ?? b.textContent?.trim().slice(0, 20);
        return { icon, w: Math.round(r.width), h: Math.round(r.height), label: b.getAttribute('aria-label') };
      })
      .filter((b) => b.w < 44 || b.h < 44);
    const noLabel = btns
      .filter((b) => !b.getAttribute('aria-label') && !b.textContent?.trim())
      .map((b) => b.querySelector('svg')?.getAttribute('class')?.match(/lucide-([\w-]+)/)?.[1] ?? '?');
    const tb = root.querySelector('[data-whiteboard-toolbar]')?.getBoundingClientRect();
    const vp = root.querySelector('[data-whiteboard-viewport]')?.getBoundingClientRect();
    const overflowX = [...root.querySelectorAll('*')].some((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && (r.right > vw + 1 || r.left < -1) && getComputedStyle(el).position !== 'fixed';
    });
    return {
      vw,
      vh,
      buttons: btns.length,
      smallTargets: small,
      noAriaLabel: noLabel,
      toolbar: tb && { top: Math.round(tb.top), bottom: Math.round(tb.bottom), h: Math.round(tb.height), cutBottom: tb.bottom > vh + 1 },
      viewport: vp && { w: Math.round(vp.width), h: Math.round(vp.height) },
      overflowX,
    };
  }, scope);
}

async function hasActiveImage(page) {
  return (await page.locator('[data-whiteboard-viewport] img').count()) > 0;
}

async function vpBox(page) {
  const box = await page.locator('[data-whiteboard-viewport]').last().boundingBox();
  return { cx: box.x + box.width / 2, cy: box.y + box.height / 2, w: box.width, h: box.height, box };
}

async function drag(page, x1, y1, x2, y2) {
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, { steps: 6 });
  await page.mouse.move(x2, y2, { steps: 6 });
  await page.mouse.up();
}

async function step(results, name, fn) {
  const t0 = Date.now();
  try {
    const detail = await fn();
    results.push({ name, ok: detail?.ok !== false, ms: Date.now() - t0, ...(detail ?? {}) });
  } catch (e) {
    results.push({ name, ok: false, ms: Date.now() - t0, error: String(e?.message ?? e).split('\n')[0] });
  }
}

async function exerciseTools(page, log, vp) {
  const r = [];
  const writesSince = async (since, min = 1) => {
    const w = await waitWrites(log, since, min);
    const bad = w.filter((e) => e.status === 'FAILED' || (typeof e.status === 'number' && e.status >= 400));
    return { writes: w.map((e) => `${e.method} ${e.status} ${e.url}`), ok: w.length >= min && bad.length === 0 };
  };

  // Garante a barra expandida.
  if (await toolbar(page).locator('button[aria-label="Expandir ferramentas"]').count()) {
    await toolbar(page).locator('button[aria-label="Expandir ferramentas"]').click();
  }

  let { cx, cy, w, h } = await vpBox(page);
  const dx = Math.min(w, 600) / 4;
  const dy = Math.min(h, 400) / 5;

  await step(r, 'lapis', async () => {
    await toolBtn(page, 'pencil').click();
    const s = Date.now();
    await drag(page, cx - dx, cy - dy * 1.5, cx + dx, cy - dy * 1.2);
    return writesSince(s);
  });
  await step(r, 'linha', async () => {
    await toolBtn(page, 'minus').click();
    const s = Date.now();
    await drag(page, cx - dx, cy - dy * 0.6, cx + dx, cy - dy * 0.6);
    return writesSince(s);
  });
  await step(r, 'retangulo', async () => {
    await toolBtn(page, 'square').click();
    const s = Date.now();
    await drag(page, cx - dx, cy, cx - dx * 0.2, cy + dy);
    return writesSince(s);
  });
  await step(r, 'elipse', async () => {
    await toolBtn(page, 'circle').click();
    const s = Date.now();
    await drag(page, cx + dx * 0.2, cy, cx + dx, cy + dy);
    return writesSince(s);
  });
  await step(r, 'pontos', async () => {
    await toolBtn(page, 'waypoints').click();
    await page.mouse.click(cx - dx, cy + dy * 1.4);
    await page.mouse.click(cx, cy + dy * 1.7);
    await page.mouse.click(cx + dx, cy + dy * 1.4);
    const s = Date.now();
    const fin = toolbar(page).getByRole('button', { name: /Finalizar linha/ });
    await fin.click({ timeout: 3000 });
    return writesSince(s);
  });
  await step(r, 'texto', async () => {
    await toolBtn(page, 'type').click();
    const s = Date.now();
    await page.mouse.click(cx + dx * 1.2, cy - dy * 1.5);
    await sleep(500);
    await page.keyboard.type('Teste lousa');
    await toolBtn(page, 'mouse-pointer').click();
    await page.mouse.click(cx - dx * 1.6, cy + dy * 2);
    return writesSince(s, 1);
  });
  await step(r, 'medida-reta', async () => {
    await toolBtn(page, 'ruler').click();
    const s = Date.now();
    await page.mouse.click(cx - dx, cy + dy * 2.2);
    await sleep(150);
    await page.mouse.click(cx + dx, cy + dy * 2.2);
    return writesSince(s);
  });
  await step(r, 'medida-arco', async () => {
    await toolBtn(page, 'spline').click();
    const s = Date.now();
    await page.mouse.click(cx - dx, cy - dy * 2);
    await sleep(150);
    await page.mouse.click(cx + dx, cy - dy * 2);
    await sleep(150);
    await page.mouse.click(cx, cy - dy * 2.4);
    return writesSince(s);
  });
  await step(r, 'cor-e-largura-traco', async () => {
    await toolBtn(page, 'pencil').click();
    const slider = toolbar(page).locator('[role="slider"]').first();
    await slider.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    const color = toolbar(page).locator('input[type="color"]').first();
    await color.evaluate((el) => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      set.call(el, '#00aa55');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    return { ok: (await slider.getAttribute('aria-valuenow')) === '5', valor: await slider.getAttribute('aria-valuenow') };
  });
  await step(r, 'selecionar-e-remover-forma', async () => {
    await toolBtn(page, 'mouse-pointer').click();
    // Clica na borda do retângulo desenhado.
    await page.mouse.click(cx - dx, cy + dy * 0.5);
    const rm = toolbar(page).getByRole('button', { name: /Remover forma/ });
    await rm.waitFor({ timeout: 3000 });
    const s = Date.now();
    await rm.click();
    return writesSince(s);
  });
  await step(r, 'desfazer', async () => {
    const s = Date.now();
    await toolBtn(page, 'undo-2').click();
    return writesSince(s);
  });
  await step(r, 'refazer', async () => {
    const s = Date.now();
    await toolBtn(page, 'redo-2').click();
    return writesSince(s);
  });
  await step(r, 'borracha', async () => {
    await toolBtn(page, 'eraser').click();
    const s = Date.now();
    // Clica sobre a linha reta (anotação) — a borracha apaga anotações e traços.
    await page.mouse.click(cx, cy - dy * 0.6);
    return writesSince(s);
  });
  await step(r, 'apagar-ultimo', async () => {
    const s = Date.now();
    await toolBtn(page, 'arrow-left-to-line').click();
    return writesSince(s);
  });
  await step(r, 'zoom', async () => {
    const pct = () => toolbar(page).locator('span').filter({ hasText: /^\d+%$/ }).first().textContent();
    const a = await pct();
    await toolBtn(page, 'zoom-in').click();
    await sleep(200);
    const b = await pct();
    await toolBtn(page, 'zoom-out').click();
    await toolBtn(page, 'zoom-out').click();
    await sleep(200);
    const c = await pct();
    await toolBtn(page, 'scan').click();
    await sleep(300);
    const d = await pct();
    return { ok: parseInt(b) > parseInt(a) && parseInt(c) < parseInt(b), zoom: [a, b, c, d] };
  });
  await step(r, 'recolher-expandir-barra', async () => {
    await toolbar(page).locator('button[aria-label="Recolher ferramentas"]').click();
    await toolbar(page).locator('button[aria-label="Expandir ferramentas"]').click();
    return { ok: (await toolBtn(page, 'pencil').count()) === 1 };
  });
  await step(r, 'nota-da-foto', async () => {
    const ta = page.locator('textarea[placeholder^="Ex.: porta de correr"]').last();
    await ta.fill(`Nota de teste ${vp.id}`);
    const s = Date.now();
    await page.getByRole('button', { name: /Salvar nota/ }).last().click();
    return writesSince(s);
  });
  await step(r, 'limpar-desenhos', async () => {
    const s = Date.now();
    await toolbar(page).getByRole('button', { name: /Limpar desenhos/ }).click();
    return writesSince(s);
  });
  await step(r, 'movel-botao-existe', async () => ({ ok: true, existe: (await toolBtn(page, 'box').count()) > 0 }));
  return r;
}

async function offlineScenario(ctx, page, log) {
  const r = [];
  let { cx, cy, w, h } = await vpBox(page);
  const dx = Math.min(w, 600) / 4;
  const dy = Math.min(h, 400) / 5;
  await ctx.setOffline(true);
  await sleep(800);
  await step(r, 'offline-5-tracos', async () => {
    await toolBtn(page, 'pencil').click();
    for (let i = 0; i < 5; i++) {
      await drag(page, cx - dx, cy - dy * 2 + i * dy * 0.8, cx + dx, cy - dy * 2 + i * dy * 0.8);
      await sleep(250);
    }
    await sleep(800);
    const paths = await page.locator('[data-whiteboard-viewport] svg path[d^="M"]').count();
    return { ok: paths >= 5, pathsNaTela: paths };
  });
  await step(r, 'offline-retangulo-e-medida', async () => {
    await toolBtn(page, 'square').click();
    await drag(page, cx - dx, cy + dy, cx, cy + dy * 2);
    await toolBtn(page, 'ruler').click();
    await page.mouse.click(cx - dx, cy + dy * 2.4);
    await page.mouse.click(cx + dx, cy + dy * 2.4);
    await sleep(800);
    return { ok: true };
  });
  await step(r, 'offline-indicador', async () => {
    const txt = await toolbar(page).innerText();
    return { ok: /offline|pendente/i.test(txt) || (await toolbar(page).locator('svg.lucide-cloud-off').count()) > 0, texto: txt.split('\n').slice(0, 4).join(' | ') };
  });
  const s = Date.now();
  await ctx.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await step(r, 'reconectar-sincroniza', async () => {
    const w2 = await waitWrites(log, s, 7, 20000);
    const posts = w2.filter((e) => e.method === 'POST' && e.status < 400);
    return { ok: posts.length >= 7, writes: w2.map((e) => `${e.method} ${e.status} ${e.url}`) };
  });
  await step(r, 'apos-reload-servidor-tem-tudo', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await openLead(page);
    const paths = await page.locator('[data-whiteboard-viewport] svg path[d^="M"]').count();
    return { ok: paths >= 5, pathsNaTela: paths };
  });
  return r;
}

async function ensureBoard(page, log) {
  if (await hasActiveImage(page)) return { created: false };
  const s = Date.now();
  await page.getByRole('button', { name: /^Quadro branco$/ }).first().click();
  await page.locator('[data-whiteboard-viewport] img').first().waitFor({ timeout: 30000 });
  const w = await waitWrites(log, s, 2, 15000);
  return { created: true, writes: w.map((e) => `${e.method} ${e.status} ${e.url}`) };
}

async function openFullscreen(page) {
  if (await page.locator('[data-whiteboard-fullscreen]').count()) return;
  const btn = page.locator('#lead-whiteboard').getByRole('button', { name: /^(Abrir|Tela cheia)$/ });
  await btn.click();
  await page.locator('[data-whiteboard-fullscreen]').waitFor({ timeout: 8000 });
  await sleep(900);
}

async function closeFullscreen(page) {
  if (!(await page.locator('[data-whiteboard-fullscreen]').count())) return;
  await page.keyboard.press('Escape');
  await sleep(600);
}

async function cleanup(page, log) {
  const r = [];
  await step(r, 'limpeza', async () => {
    const s = Date.now();
    const clear = toolbar(page).getByRole('button', { name: /Limpar desenhos/ });
    if ((await clear.count()) && (await clear.isEnabled())) await clear.click();
    await sleep(800);
    let n = 0;
    while (n < 6 && (await toolbar(page).getByRole('button', { name: /Remover foto/ }).count())) {
      await toolbar(page).getByRole('button', { name: /Remover foto/ }).click();
      await sleep(1500);
      n++;
    }
    const w = await waitWrites(log, s, 1, 4000);
    return { ok: !(await hasActiveImage(page)), fotosRemovidas: n, writes: w.map((e) => `${e.method} ${e.status} ${e.url}`) };
  });
  return r;
}

let created = false;
for (const vp of VIEWPORTS) {
  const entry = { id: vp.id, size: `${vp.w}x${vp.h}`, touch: vp.touch, console: [], pageErrors: [], writes: [] };
  report.viewports.push(entry);
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: true,
    viewport: { width: vp.w, height: vp.h },
    hasTouch: vp.touch,
    isMobile: vp.touch && vp.w < 700,
    deviceScaleFactor: vp.touch ? 2 : 1,
    permissions: ['camera'],
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') entry.console.push(`[${m.type()}] ${m.text().slice(0, 300)}`);
  });
  page.on('pageerror', (e) => entry.pageErrors.push(String(e.message).slice(0, 300)));
  trackNetwork(page, entry.writes);
  try {
    await openLead(page);
    if (!fs.existsSync(TEST_IMG)) await makeTestImage(page);
    entry.board = await ensureBoard(page, entry.writes);
    created = created || entry.board.created;
    await closeFullscreen(page);
    await page.locator('#lead-whiteboard').scrollIntoViewIfNeeded();
    await sleep(600);
    entry.layoutInline = await measureLayout(page, '#lead-whiteboard');
    await page.locator('#lead-whiteboard').screenshot({ path: path.join(OUT, `${vp.id}-1-embutida.png`) });
    await openFullscreen(page);
    entry.layoutFullscreen = await measureLayout(page, '[data-whiteboard-fullscreen]');
    await page.screenshot({ path: path.join(OUT, `${vp.id}-2-tela-cheia.png`) });
    if (vp.tools && !NO_TOOLS) {
      entry.tools = await exerciseTools(page, entry.writes, vp);
      await page.screenshot({ path: path.join(OUT, `${vp.id}-3-apos-ferramentas.png`) });
      // Inserir foto por arquivo.
      const fr = [];
      await step(fr, 'inserir-foto-arquivo', async () => {
        const s = Date.now();
        await page.locator('input[type="file"][multiple]').last().setInputFiles(TEST_IMG);
        const w = await waitWrites(entry.writes, s, 2, 30000);
        return { ok: w.some((e) => e.method === 'POST' && /lead_whiteboard_images/.test(e.url) && e.status < 400), writes: w.map((e) => `${e.method} ${e.status} ${e.url}`) };
      });
      await step(fr, 'tirar-foto-dialogo', async () => {
        await toolbar(page).locator('button[aria-label="Inserir foto"]').click();
        await page.getByRole('button', { name: /^Tirar foto$/ }).last().click();
        await sleep(2500);
        await page.screenshot({ path: path.join(OUT, `${vp.id}-4-camera.png`) });
        const dlg = await page.locator('[role="dialog"] video').count();
        await page.keyboard.press('Escape');
        await sleep(500);
        return { ok: true, videoNaTela: dlg };
      });
      await step(fr, 'do-projeto-dialogo', async () => {
        await openFullscreen(page);
        await toolbar(page).locator('button[aria-label="Inserir foto"]').click();
        await page.getByRole('button', { name: /^Do projeto$/ }).last().click();
        await sleep(2000);
        await page.screenshot({ path: path.join(OUT, `${vp.id}-5-do-projeto.png`) });
        await page.keyboard.press('Escape');
        await sleep(500);
        return { ok: true };
      });
      entry.foto = fr;
      if (OFFLINE) {
        await openFullscreen(page);
        entry.offline = await offlineScenario(ctx, page, entry.writes);
        await openFullscreen(page);
      }
      await openFullscreen(page);
      entry.cleanup = await cleanup(page, entry.writes);
    }
  } catch (e) {
    entry.fatal = String(e?.message ?? e).split('\n')[0];
    try {
      await page.screenshot({ path: path.join(OUT, `${vp.id}-erro.png`) });
    } catch {}
  }
  await ctx.close();
  console.log(`${vp.id}: ${entry.fatal ? 'ERRO ' + entry.fatal : 'ok'}`);
}

// Limpeza final, se algo ficou (viewports sem ferramentas não limpam).
if (created) {
  const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true, viewport: { width: 1440, height: 900 } });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  const log = [];
  trackNetwork(page, log);
  try {
    await openLead(page);
    if (await hasActiveImage(page)) {
      await openFullscreen(page);
      report.finalCleanup = await cleanup(page, log);
    }
  } catch (e) {
    report.finalCleanup = String(e?.message ?? e);
  }
  await ctx.close();
}

report.finishedAt = new Date().toISOString();
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(`Relatório: ${path.join(OUT, 'report.json')}`);
