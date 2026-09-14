/**
 * Anexos de imagem no caderno do evento.
 * Guardamos URLs em linhas marcadas no fim do texto — sem mudar a tabela do banco.
 *
 * Formato (uma URL por linha):
 *   ⟦evento-img:https://…⟧
 */

export const EVENTO_IMG_MARK_RE = /^⟦evento-img:(.+?)⟧$/

export interface EventoCadernoCorpoParts {
  texto: string
  imageUrls: string[]
}

export function parseEventoCadernoCorpo(corpo: string): EventoCadernoCorpoParts {
  const lines = (corpo ?? '').split('\n')
  const imageUrls: string[] = []
  const textLines: string[] = []

  for (const line of lines) {
    const match = EVENTO_IMG_MARK_RE.exec(line.trim())
    if (match?.[1]) {
      const url = match[1].trim()
      if (url && !imageUrls.includes(url)) imageUrls.push(url)
      continue
    }
    textLines.push(line)
  }

  // Remove linhas em branco sobrando só no final do texto (antes dos anexos)
  while (textLines.length > 0 && textLines[textLines.length - 1] === '') {
    textLines.pop()
  }

  return { texto: textLines.join('\n'), imageUrls }
}

export function serializeEventoCadernoCorpo(texto: string, imageUrls: string[]): string {
  const cleanUrls = [...new Set(imageUrls.map((u) => u.trim()).filter(Boolean))]
  const body = texto.replace(/\s+$/u, '')
  if (cleanUrls.length === 0) return body
  const marks = cleanUrls.map((url) => `⟦evento-img:${url}⟧`).join('\n')
  return body ? `${body}\n\n${marks}` : marks
}

/** Texto do caderno sem as linhas de anexo (busca, PDF, preview). */
export function textoEventoCadernoSemAnexos(corpo: string): string {
  return parseEventoCadernoCorpo(corpo).texto
}
