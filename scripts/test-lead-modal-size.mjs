/**
 * Teste: tamanho fixo do card do lead (~1147×718 centralizado)
 * Rodar: node scripts/test-lead-modal-size.mjs
 */

const LEAD_MODAL_PREFERRED_W = 1147
const LEAD_MODAL_PREFERRED_H = 718
const LEAD_MODAL_MIN_W_DESKTOP = 420
const LEAD_MODAL_MIN_H_DESKTOP = 360
const LEAD_MODAL_MIN_W_MOBILE = 280
const LEAD_MODAL_MIN_H_MOBILE = 320
const LEAD_MODAL_MOBILE_BREAKPOINT = 768

function isLeadModalMobileViewport(vw = 1440) {
  return vw < LEAD_MODAL_MOBILE_BREAKPOINT
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
  const margin = isLeadModalMobileViewport(vw) ? 8 : 16
  const maxW = Math.max(minW, vw - margin * 2)
  const maxH = Math.max(minH, vh - margin * 2)
  const w = Math.min(Math.max(size.w, minW), maxW)
  const h = Math.min(Math.max(size.h, minH), maxH)
  const x = Math.min(Math.max(size.x, margin), Math.max(margin, vw - w - margin))
  const y = Math.min(Math.max(size.y, margin), Math.max(margin, vh - h - margin))
  return { x, y, w, h }
}

function defaultLeadModalSize(vw = 1440, vh = 900) {
  const mobile = isLeadModalMobileViewport(vw)
  const { minW, minH } = leadModalMins(vw)
  const margin = mobile ? 8 : 16

  if (mobile) {
    const w = Math.max(minW, vw - margin * 2)
    const h = Math.max(minH, Math.round(Math.min(vh * 0.9, vh - margin * 2)))
    return centerLeadModalSize(w, h, vw, vh, margin)
  }

  const w = Math.min(LEAD_MODAL_PREFERRED_W, Math.max(minW, vw - margin * 2))
  const h = Math.min(LEAD_MODAL_PREFERRED_H, Math.max(minH, vh - margin * 2))
  return clampLeadModalSize(centerLeadModalSize(w, h, vw, vh, margin), vw, vh)
}

let ok = true
function check(nome, cond, detalhe = '') {
  const pass = Boolean(cond)
  console.log(`${pass ? 'OK' : 'FAIL'} ${nome}${detalhe ? `: ${detalhe}` : ''}`)
  if (!pass) ok = false
}

// 1) Desktop 1648×920 (tela do usuário)
{
  const d = defaultLeadModalSize(1648, 920)
  check('desktop tamanho fixo largura', d.w === LEAD_MODAL_PREFERRED_W, `w=${d.w}`)
  check('desktop tamanho fixo altura', d.h === LEAD_MODAL_PREFERRED_H, `h=${d.h}`)
  check('desktop centralizado X', d.x === Math.round((1648 - d.w) / 2), `x=${d.x}`)
  check('desktop centralizado Y', d.y === Math.round((920 - d.h) / 2), `y=${d.y}`)
}

// 2) Full HD
{
  const d = defaultLeadModalSize(1920, 1080)
  check('Full HD mantém preferido', d.w === 1147 && d.h === 718, `w=${d.w} h=${d.h}`)
  check('Full HD centralizado', d.x === Math.round((1920 - 1147) / 2) && d.y === Math.round((1080 - 718) / 2))
}

// 3) Notebook menor que o preferido em altura
{
  const d = defaultLeadModalSize(1280, 700)
  check('notebook encolhe altura', d.h === 700 - 32, `h=${d.h}`)
  check('notebook mantém largura se couber', d.w === Math.min(1147, 1280 - 32), `w=${d.w}`)
  check('notebook centralizado', Math.abs(d.x - (1280 - d.w) / 2) < 1)
}

// 4) Celular
{
  const d = defaultLeadModalSize(390, 844)
  check('celular quase tela', d.w === 390 - 16, `w=${d.w}`)
  check('celular centralizado', d.x === Math.round((390 - d.w) / 2))
}

console.log(ok ? '\nTodos os testes passaram.' : '\nAlguns testes falharam.')
process.exit(ok ? 0 : 1)
