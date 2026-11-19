/**
 * Marca neutra (docs/marca-neutra, T06): gera o monograma padrão da plataforma (sem marca de cliente).
 * Saída: public/imagens/marca-padrao.svg + PNGs (marca-padrao.png 512, pwa-192x192, pwa-512x512,
 * apple-touch-icon 180, favicon.png 64). Sem dependências: rasteriza as formas e grava PNG com zlib.
 *
 * Desenho: quadrado escuro arredondado com quatro módulos dourados (2×2) — remete a móveis/módulos
 * sem citar nenhuma empresa.
 *
 * Uso: node scripts/marca-neutra/gerar-icones.mjs
 */
import fs from 'node:fs'
import zlib from 'node:zlib'

const FUNDO = [0x1c, 0x14, 0x10]
const OURO = [0xc9, 0xa9, 0x6e]
const OURO_CLARO = [0xe8, 0xcf, 0x9a]

// Formas em coordenadas 0..512: [x, y, w, h, raio, cor]
const FORMAS = [
  [0, 0, 512, 512, 112, FUNDO],
  [128, 128, 116, 116, 22, OURO],
  [268, 128, 116, 116, 22, OURO_CLARO],
  [128, 268, 116, 116, 22, OURO],
  [268, 268, 116, 116, 22, OURO],
]

function dentro(px, py, [x, y, w, h, r]) {
  if (px < x || py < y || px > x + w || py > y + h) return false
  const cx = Math.min(Math.max(px, x + r), x + w - r)
  const cy = Math.min(Math.max(py, y + r), y + h - r)
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r
}

function rasterizar(tam) {
  const esc = 512 / tam
  const S = 4 // supersampling por eixo
  const px = Buffer.alloc(tam * tam * 4)
  for (let j = 0; j < tam; j++) {
    for (let i = 0; i < tam; i++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const x = (i + (sx + 0.5) / S) * esc
          const y = (j + (sy + 0.5) / S) * esc
          let cor = null
          for (const f of FORMAS) if (dentro(x, y, f)) cor = f[5]
          if (cor) { r += cor[0]; g += cor[1]; b += cor[2]; a += 255 }
        }
      }
      const n = S * S
      const o = (j * tam + i) * 4
      const cob = a / n
      px[o] = cob ? Math.round(r / (a / 255)) : 0
      px[o + 1] = cob ? Math.round(g / (a / 255)) : 0
      px[o + 2] = cob ? Math.round(b / (a / 255)) : 0
      px[o + 3] = Math.round(cob)
    }
  }
  return px
}

const CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return (buf) => {
    let c = 0xffffffff
    for (const b of buf) c = t[(c ^ b) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
})()

function chunk(tipo, dados) {
  const len = Buffer.alloc(4); len.writeUInt32BE(dados.length)
  const td = Buffer.concat([Buffer.from(tipo, 'ascii'), dados])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(td))
  return Buffer.concat([len, td, crc])
}

function png(tam) {
  const px = rasterizar(tam)
  const linhas = Buffer.alloc((tam * 4 + 1) * tam)
  for (let j = 0; j < tam; j++) {
    linhas[j * (tam * 4 + 1)] = 0
    px.copy(linhas, j * (tam * 4 + 1) + 1, j * tam * 4, (j + 1) * tam * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(tam, 0); ihdr.writeUInt32BE(tam, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(linhas, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const hex = (c) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="Marca padrão">
${FORMAS.map(([x, y, w, h, r, c]) => `  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${hex(c)}"/>`).join('\n')}
</svg>
`

fs.writeFileSync('public/imagens/marca-padrao.svg', svg)
const saidas = [
  ['public/imagens/marca-padrao.png', 512],
  ['public/pwa-512x512.png', 512],
  ['public/pwa-192x192.png', 192],
  ['public/apple-touch-icon.png', 180],
  ['public/favicon.png', 64],
]
for (const [arq, tam] of saidas) {
  fs.writeFileSync(arq, png(tam))
  console.log(`ok ${arq} (${tam}px)`)
}
