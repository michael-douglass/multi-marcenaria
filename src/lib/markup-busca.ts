function removerAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Remove acentos, espaços e pontos para comparar textos de forma flexível. */
export function compactarBusca(texto: string): string {
  return removerAcentos(texto)
    .toLowerCase()
    .replace(/[\s.]+/g, '');
}

/** Busca flexível: ignora acentuação, espaços, pontos e ordem das palavras. */
export function correspondeBuscaFlexivel(texto: string, termo: string): boolean {
  const termoLimpo = termo.trim();
  if (!termoLimpo) return true;

  const alvo = compactarBusca(texto);
  const palavras = termoLimpo
    .split(/\s+/)
    .map((palavra) => compactarBusca(palavra))
    .filter(Boolean);

  return palavras.every((palavra) => alvo.includes(palavra));
}
