function tlv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, '0')}${value}`
}

function crc16(str: string): string {
  let crc = 0xffff
  for (const ch of str) {
    crc ^= ch.charCodeAt(0) << 8
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

function normalizarNome(nome: string): string {
  return nome
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9 ]/g, '')
    .slice(0, 25)
    .trim() || 'GARBO MOVELARIA'
}

export interface PixPayloadParams {
  chave: string
  valor?: number
  nomeBeneficiario?: string
  cidade?: string
}

export function gerarPixPayload({
  chave,
  valor,
  nomeBeneficiario = 'GARBO MOVELARIA',
  cidade = 'Brasil',
}: PixPayloadParams): string {
  const merchantInfo =
    tlv('00', 'br.gov.bcb.pix') +
    tlv('01', chave.trim().slice(0, 77))

  const additionalData = tlv('05', '***')

  const nome = normalizarNome(nomeBeneficiario)
  const city = cidade
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .slice(0, 15)
    .trim() || 'Brasil'

  let payload =
    tlv('00', '01') +
    tlv('01', valor !== undefined ? '12' : '11') +
    tlv('26', merchantInfo) +
    tlv('52', '0000') +
    tlv('53', '986') +
    (valor !== undefined ? tlv('54', valor.toFixed(2)) : '') +
    tlv('58', 'BR') +
    tlv('59', nome) +
    tlv('60', city) +
    tlv('62', additionalData) +
    '6304'

  return payload + crc16(payload)
}
