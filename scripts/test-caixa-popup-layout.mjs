/**
 * Teste: layout do popup Caixa (tamanho padrão + clamp + resize)
 * Rodar: node scripts/test-caixa-popup-layout.mjs
 */

const CAIXA_POPUP_MIN_W = 720
const CAIXA_POPUP_MIN_H = 420

function defaultCaixaPopupLayout(vw = 1440, vh = 900) {
  const w = Math.min(1360, Math.max(CAIXA_POPUP_MIN_W, Math.round(vw * 0.97)))
  const h = Math.min(960, Math.max(CAIXA_POPUP_MIN_H, Math.round(vh * 0.92)))
  return {
    x: Math.max(8, Math.round((vw - w) / 2)),
    y: Math.max(40, Math.round((vh - h) / 2)),
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

// 1) Default em tela Full HD — deve caber filtros + tabela (~1000px)
{
  const d = defaultCaixaPopupLayout(1920, 1080)
  check('default Full HD largura >= 1100', d.w >= 1100, `w=${d.w}`)
  check('default Full HD altura >= 700', d.h >= 700, `h=${d.h}`)
  check('default Full HD cabe na tela', d.x + d.w <= 1920 && d.y + d.h <= 1080)
}

// 2) Default em notebook 1366x768
{
  const d = defaultCaixaPopupLayout(1366, 768)
  check('default notebook quase tela cheia', d.w >= 1200 && d.h >= 650, `w=${d.w} h=${d.h}`)
  check('default notebook dentro da tela', d.x + d.w <= 1366 && d.y + d.h <= 768)
}

// 3) Clamp não deixa sair da tela nem abaixo do mínimo
{
  const c = clampCaixaPopupLayout({ x: -100, y: -50, w: 200, h: 100 }, 1280, 800)
  check('clamp aplica mínimo W', c.w === CAIXA_POPUP_MIN_W, `w=${c.w}`)
  check('clamp aplica mínimo H', c.h === CAIXA_POPUP_MIN_H, `h=${c.h}`)
  check('clamp x/y >= 0', c.x >= 0 && c.y >= 0, `x=${c.x} y=${c.y}`)
}

// 4) Clamp em layout enorme
{
  const c = clampCaixaPopupLayout({ x: 0, y: 0, w: 5000, h: 4000 }, 1280, 800)
  check('clamp corta largura máxima', c.w === 1280 - 16, `w=${c.w}`)
  check('clamp corta altura máxima', c.h === 800 - 16, `h=${c.h}`)
}

// 5) Resize SE aumenta
{
  const start = { x: 40, y: 60, w: 900, h: 600 }
  const next = applyCaixaResize(start, 'se', 120, 80, 1600, 1000)
  check('resize SE aumenta W', next.w === 1020, `w=${next.w}`)
  check('resize SE aumenta H', next.h === 680, `h=${next.h}`)
}

// 6) Resize NW respeita mínimo
{
  const start = { x: 200, y: 200, w: 800, h: 500 }
  const next = applyCaixaResize(start, 'nw', 500, 400, 1600, 1000)
  check('resize NW não passa do mínimo W', next.w === CAIXA_POPUP_MIN_W, `w=${next.w}`)
  check('resize NW não passa do mínimo H', next.h === CAIXA_POPUP_MIN_H, `h=${next.h}`)
}

// 7) Migração só com x/y (legado) preenche w/h grandes
{
  const base = defaultCaixaPopupLayout(1440, 900)
  const migrated = clampCaixaPopupLayout({ x: 80, y: 72, w: base.w, h: base.h }, 1440, 900)
  check(
    'legado vira janela grande o bastante para a tabela',
    migrated.w >= 1000 && migrated.h >= 700,
    `w=${migrated.w} h=${migrated.h}`,
  )
}

try {
  assert(ok, 'alguns casos falharam')
  console.log('\nOK — layout do CaixaPopup cabe filtros + tabela e redimensiona com segurança')
} catch (e) {
  console.error('\nFAIL —', e.message)
  process.exit(1)
}
