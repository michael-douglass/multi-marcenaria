import QRCode from 'qrcode'

/** Linha só com dígitos e separadores comuns de boleto (espaços, pontos, hífens). */
const NUMERIC_LINE_RE = /^[\d\s.\-/]+$/

export interface PrepareQrPayloadResult {
  /** Texto efetivamente gravado no QR */
  payload: string
  /** True se espaços/pontos foram removidos */
  compacted: boolean
}

/**
 * Prepara o texto do QR: linhas só numéricas viram dígitos contínuos;
 * demais textos perdem espaços (PIX, e-mail, chave aleatória).
 */
export function prepareQrPayload(raw: string): PrepareQrPayloadResult {
  const trimmed = raw.trim()
  if (!trimmed) return { payload: '', compacted: false }

  if (NUMERIC_LINE_RE.test(trimmed) && /\d/.test(trimmed)) {
    const digitsOnly = trimmed.replace(/\D/g, '')
    if (digitsOnly.length > 0 && digitsOnly !== trimmed) {
      return { payload: digitsOnly, compacted: true }
    }
    return { payload: digitsOnly || trimmed, compacted: false }
  }

  const compacted = trimmed.replace(/\s+/g, '')
  if (compacted !== trimmed) {
    return { payload: compacted, compacted: true }
  }

  return { payload: trimmed, compacted: false }
}

/** Gera imagem do QR (data URL PNG) com correção de erro nível H. */
export async function generateQrDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 280,
    color: {
      dark: '#1a120e',
      light: '#ffffff',
    },
  })
}
