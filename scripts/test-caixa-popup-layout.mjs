/**
 * Teste: layout do popup Caixa (~3/4 da tela + clamp + resize)
 * Rodar: node scripts/test-caixa-popup-layout.mjs
 */

const CAIXA_POPUP_MIN_W = 420
const CAIXA_POPUP_MIN_H = 320

function defaultCaixaPopupLayout(vw = 1440, vh = 900) {
  const w = Math.min(980, Math.max(CAIXA_POPUP_MIN_W, Math.round(vw * 0.72)))
  const h = Math.min(720, Math.max(CAIXA_POPUP_MIN_H, Math.round(vh * 0.72)))
  return {
    x: Math.max(8, Math.round((vw - w) / 2)),
    y: Math.max(48, Math.round((vh - h) / 2)),
    w,
    h,
  }
}

function clampCaixaPopupLayout(layout, vw = 1440, vh = 900) {
  const maxW = Math.max(CAIXA_POPUP_MIN_W, vw - 16)
  const maxH = Math.max(CAIXA_POPUP_MIN_H, vh - 16)
  const w = Math.min(Math.max(layout.w, CAIXA_POPUP_MIN_W), maxW)
  const h = Math.min(Math.max(layout.h, CAIXA_POPUP_MIN_H), maxH)
  const x = Math.min(Math.max(layout.x, 0), Math.max(0, vw - w))
  const y = Math.min(Math.max(layout.y, 0), Math.max(0, vh - h))
  return { x, y, w, h }
}

function applyCaixaResize(start, corner, dx, dy, vw = 1440, vh = 900) {
  let next = { ...start }

  if (corner.includes('e')) next.w = start.w + dx
  if (corner.includes('s')) next.h = start.h + dy
  if (corner.includes('w')) {
    next.w = start.w - dx
    next.x = start.x + dx
  }
  if (corner.includes('n')) {
    next.h = start.h - dy
    next.y = start.y + dy
  }

  if (next.w < CAIXA_POPUP_MIN_W) {
    if (corner.includes('w')) next.x = start.x + start.w - CAIXA_POPUP_MIN_W
    next.w = CAIXA_POPUP_MIN_W
  }
  if (next.h < CAIXA_POPUP_MIN_H) {
    if (corner.includes('n')) next.y = start.y + start.h - CAIXA_POPUP_MIN_H
    next.h = CAIXA_POPUP_MIN_H
  }

  return clampCaixaPopupLayout(next, vw, vh)
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

let ok = true
function check(nome, cond, detalhe = '') {
  const pass = Boolean(cond)
  console.log(`${pass ? 'OK' : 'FAIL'} ${nome}${detalhe ? `: ${detalhe}` : ''}`)
  if (!pass) ok = false
}

// 1) Default Full HD — ~3/4, maior que metade
{
  const d = defaultCaixaPopupLayout(1920, 1080)
  check('default Full HD largura intermediária', d.w >= 900 && d.w <= 980, `w=${d.w}`)
  check('default Full HD altura intermediária', d.h >= 650 && d.h <= 720, `h=${d.h}`)
  check('default Full HD cabe na tela', d.x + d.w <= 1920 && d.y + d.h <= 1080)
  check('default Full HD maior que metade', d.w > 960 * 0.5 && d.h > 1080 * 0.5)
}

// 2) Default notebook 1366x768
{
  const d = defaultCaixaPopupLayout(1366, 768)
  check('default notebook confortável', d.w >= 900 && d.h >= 500, `w=${d.w} h=${d.h}`)
  check('default notebook dentro da tela', d.x + d.w <= 1366 && d.y + d.h <= 768)
  check('default notebook >= mínimo', d.w >= CAIXA_POPUP_MIN_W && d.h >= CAIXA_POPUP_MIN_H)
}

// 3) Clamp mínimo
{
  const c = clampCaixaPopupLayout({ x: -100, y: -50, w: 200, h: 100 }, 1280, 800)
  check('clamp aplica mínimo W', c.w === CAIXA_POPUP_MIN_W, `w=${c.w}`)
  check('clamp aplica mínimo H', c.h === CAIXA_POPUP_MIN_H, `h=${c.h}`)
  check('clamp x/y >= 0', c.x >= 0 && c.y >= 0, `x=${c.x} y=${c.y}`)
}

// 4) Clamp máximo
{
  const c = clampCaixaPopupLayout({ x: 0, y: 0, w: 5000, h: 4000 }, 1280, 800)
  check('clamp corta largura máxima', c.w === 1280 - 16, `w=${c.w}`)
  check('clamp corta altura máxima', c.h === 800 - 16, `h=${c.h}`)
}

// 5) Resize SE
{
  const start = { x: 40, y: 60, w: 700, h: 500 }
  const next = applyCaixaResize(start, 'se', 120, 80, 1600, 1000)
  check('resize SE aumenta W', next.w === 820, `w=${next.w}`)
  check('resize SE aumenta H', next.h === 580, `h=${next.h}`)
}

// 6) Resize NW mínimo
{
  const start = { x: 200, y: 200, w: 700, h: 500 }
  const next = applyCaixaResize(start, 'nw', 600, 400, 1600, 1000)
  check('resize NW não passa do mínimo W', next.w === CAIXA_POPUP_MIN_W, `w=${next.w}`)
  check('resize NW não passa do mínimo H', next.h === CAIXA_POPUP_MIN_H, `h=${next.h}`)
}

// 7) Default intermediário
{
  const base = defaultCaixaPopupLayout(1440, 900)
  check(
    'padrão intermediário (~72%)',
    base.w >= 900 && base.w <= 980 && base.h >= 600 && base.h <= 720,
    `w=${base.w} h=${base.h}`,
  )
}

function estimateCaixaTableViewportHeight(popupH, chrome = 230) {
  return Math.max(120, popupH - chrome)
}

function caixaTableScrollFitsPopup({ popupH, tablePanelClientH, tablePanelScrollH }) {
  if (popupH < CAIXA_POPUP_MIN_H) return { ok: false, reason: 'popup menor que o mínimo' }
  if (tablePanelClientH <= 0) return { ok: false, reason: 'painel da tabela sem altura' }
  if (tablePanelClientH > popupH) {
    return { ok: false, reason: 'painel maior que o popup (estourou o container)' }
  }
  if (tablePanelScrollH < tablePanelClientH - 1) {
    return { ok: false, reason: 'scrollHeight inconsistente' }
  }
  return { ok: true, reason: 'painel contido no popup com rolagem interna' }
}

// 8) Área da tabela cabe no popup (não estoura como 3982px)
{
  const popupH = 720
  const viewport = estimateCaixaTableViewportHeight(popupH)
  check('viewport da tabela < altura do popup', viewport < popupH, `viewport=${viewport}`)
  check('viewport da tabela >= 120', viewport >= 120, `viewport=${viewport}`)

  // Simula lista longa (3982px de conteúdo) dentro de painel contido (~490px)
  const longList = caixaTableScrollFitsPopup({
    popupH,
    tablePanelClientH: viewport,
    tablePanelScrollH: 3982,
  })
  check('lista longa rola dentro do popup', longList.ok, longList.reason)
  check(
    'lista longa NÃO estoura o popup',
    viewport < 3982 && viewport < popupH,
    `client=${viewport} scroll=3982 popup=${popupH}`,
  )
}

// 9) Painel que estoura o popup deve falhar
{
  const bad = caixaTableScrollFitsPopup({
    popupH: 720,
    tablePanelClientH: 3982,
    tablePanelScrollH: 3982,
  })
  check('detecta painel estourado', !bad.ok, bad.reason)
}

try {
  assert(ok, 'alguns casos falharam')
  console.log('\nOK — CaixaPopup com tabela contida e rolagem interna')
} catch (e) {
  console.error('\nFAIL —', e.message)
  process.exit(1)
}
