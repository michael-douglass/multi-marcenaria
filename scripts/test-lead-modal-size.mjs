/**
 * Teste: card maximizado quase tela cheia + modos de janela
 * Rodar: node scripts/test-lead-modal-size.mjs
 */

const LEAD_MODAL_MARGIN_DESKTOP = 16
const LEAD_MODAL_MARGIN_MOBILE = 8
const LEAD_MODAL_MIN_W_DESKTOP = 420
const LEAD_MODAL_MIN_H_DESKTOP = 360
const LEAD_MODAL_MIN_W_MOBILE = 280
const LEAD_MODAL_MIN_H_MOBILE = 320
const LEAD_MODAL_MOBILE_BREAKPOINT = 768
const LEAD_MODAL_MINIMIZED_H = 52

function isLeadModalMobileViewport(vw = 1440) {
  return vw < LEAD_MODAL_MOBILE_BREAKPOINT
}

function leadModalOuterMargin(vw) {
  return isLeadModalMobileViewport(vw) ? LEAD_MODAL_MARGIN_MOBILE : LEAD_MODAL_MARGIN_DESKTOP
}

function leadModalMins(vw) {
  const mobile = isLeadModalMobileViewport(vw)
  return {
    minW: mobile ? LEAD_MODAL_MIN_W_MOBILE : LEAD_MODAL_MIN_W_DESKTOP,
    minH: mobile ? LEAD_MODAL_MIN_H_MOBILE : LEAD_MODAL_MIN_H_DESKTOP,
  }
}

function centerLeadModalSize(w, h, vw, vh, margin) {
  return {
    x: Math.max(margin, Math.round((vw - w) / 2)),
    y: Math.max(margin, Math.round((vh - h) / 2)),
    w,
    h,
  }
}

function clampLeadModalSize(size, vw = 1440, vh = 900) {
  const { minW, minH } = leadModalMins(vw)
  const margin = leadModalOuterMargin(vw)
  const maxW = Math.max(minW, vw - margin * 2)
  const maxH = Math.max(minH, vh - margin * 2)
  const w = Math.min(Math.max(size.w, minW), maxW)
  const h = Math.min(Math.max(size.h, minH), maxH)
  const x = Math.min(Math.max(size.x, margin), Math.max(margin, vw - w - margin))
  const y = Math.min(Math.max(size.y, margin), Math.max(margin, vh - h - margin))
  return { x, y, w, h }
}

function maximizedLeadModalSize(vw = 1440, vh = 900) {
  const { minW, minH } = leadModalMins(vw)
  const margin = leadModalOuterMargin(vw)
  const w = Math.max(minW, vw - margin * 2)
  const h = Math.max(minH, vh - margin * 2)
  return clampLeadModalSize(centerLeadModalSize(w, h, vw, vh, margin), vw, vh)
}

function resolveLeadModalDisplaySize(layout, vw = 1440, vh = 900) {
  if (layout.mode === 'maximized') return maximizedLeadModalSize(vw, vh)
  if (layout.mode === 'minimized') {
    const margin = leadModalOuterMargin(vw)
    const maxW = Math.max(280, vw - margin * 2)
    const w = Math.min(Math.max(layout.w, 280), maxW)
    const x = Math.min(Math.max(layout.x, margin), Math.max(margin, vw - w - margin))
    const y = Math.min(
      Math.max(layout.y, margin),
      Math.max(margin, vh - LEAD_MODAL_MINIMIZED_H - margin),
    )
    return { x, y, w, h: LEAD_MODAL_MINIMIZED_H }
  }
  return clampLeadModalSize(layout, vw, vh)
}

let ok = true
function check(nome, cond, detalhe = '') {
  const pass = Boolean(cond)
  console.log(`${pass ? 'OK' : 'FAIL'} ${nome}${detalhe ? `: ${detalhe}` : ''}`)
  if (!pass) ok = false
}

{
  const d = maximizedLeadModalSize(1648, 920)
  check('desktop quase tela', d.w === 1616 && d.h === 888, `w=${d.w} h=${d.h}`)
  check('desktop margem 16', d.x === 16 && d.y === 16)
  check('desktop ocupa >95%', d.w / 1648 > 0.95 && d.h / 920 > 0.95)
}

{
  const d = maximizedLeadModalSize(390, 844)
  check('celular quase tela', d.w === 374 && d.h === 828, `w=${d.w} h=${d.h}`)
  check('celular margem 8', d.x === 8 && d.y === 8)
}

{
  const max = maximizedLeadModalSize(1648, 920)
  const shown = resolveLeadModalDisplaySize({ ...max, mode: 'maximized' }, 1648, 920)
  check('modo maximizado ignora size antigo', shown.w === 1616 && shown.h === 888)
}

{
  const shown = resolveLeadModalDisplaySize(
    { x: 100, y: 80, w: 800, h: 500, mode: 'minimized' },
    1648,
    920,
  )
  check('modo minimizado altura faixa', shown.h === LEAD_MODAL_MINIMIZED_H, `h=${shown.h}`)
}

console.log(ok ? '\nTodos os testes passaram.' : '\nAlguns testes falharam.')
process.exit(ok ? 0 : 1)
