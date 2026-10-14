/** Smoke: colunas HelloMob não colapsam na chave de merge. */
function normalizeExtractionKey(value) {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function dimsTokenFromName(raw) {
  const m = String(raw || '')
    .replace(/,/g, '.')
    .match(
      /(\d+(?:\.\d+)?)\s*(?:mm)?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:mm)?(?:\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:mm)?)?/i,
    )
  if (!m) return null
  const a = Math.round(Number(m[1]))
  const b = Math.round(Number(m[2]))
  if (!(a > 0 && b > 0)) return null
  const c = m[3] != null ? Math.round(Number(m[3])) : null
  return c != null && c > 0 ? `${a}x${b}x${c}` : `${a}x${b}`
}

function canonicalModuleName(name) {
  let raw = String(name || '').trim()
  raw = raw.replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ')
  const dash = raw.indexOf(' - ')
  if (dash > 0) raw = raw.slice(0, dash)
  const dims = dimsTokenFromName(raw)
  const key = normalizeExtractionKey(raw)
  if (/\b1\s*coluna\b/.test(key) || /armario\s+com\s+1\s+coluna/.test(key)) {
    return dims ? `Armário 1 coluna ${dims}` : 'Armário 1 coluna'
  }
  if (/\bbalcao\b/.test(key) && dims) return `Balcão ${dims}`
  return 'other'
}

const a = 'Armário com 1 coluna 860 mm x 750 mm x 600 mm'
const b = 'Armário com 1 coluna 900 mm x 1180 mm x 600 mm'
const ka = normalizeExtractionKey(canonicalModuleName(a))
const kb = normalizeExtractionKey(canonicalModuleName(b))
console.log({ a: canonicalModuleName(a), b: canonicalModuleName(b), ka, kb, distinct: ka !== kb })
if (ka === kb) {
  console.error('FAIL: colunas colapsaram')
  process.exit(1)
}
console.log('OK')
