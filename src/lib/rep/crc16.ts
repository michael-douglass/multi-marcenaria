/** CRC-16 CCITT-FALSE (spec MTE AFD) */
export function crc16CcittFalse(data: string): string {
  let crc = 0xffff
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
      crc &= 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export async function sha256HexBytes(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Normaliza texto para ISO-8859-1 substituindo chars não ASCII */
export function toLatin1(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function padField(value: string, length: number): string {
  const v = toLatin1(value).slice(0, length)
  return v.padEnd(length, ' ')
}

export function padNum(value: number | string, length: number): string {
  return String(value).replace(/\D/g, '').slice(-length).padStart(length, '0')
}

export function afdLine(fields: string[]): string {
  const line = fields.join('|')
  const crc = crc16CcittFalse(line)
  return `${line}|${crc}\r\n`
}
