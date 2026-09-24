/**
 * `crypto.randomUUID()` só existe em contexto seguro (HTTPS ou localhost).
 * Ao abrir o app por IP da rede em HTTP (ex.: http://192.168.x.x:3000 no dev),
 * ele fica indefinido e derruba providers como o de Contas a Pagar.
 * `crypto.getRandomValues` existe também em HTTP — gera um UUID v4 equivalente.
 */
if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID !== 'function') {
  const cryptoRef = globalThis.crypto
  Object.defineProperty(cryptoRef, 'randomUUID', {
    configurable: true,
    writable: true,
    value: function randomUUID(): `${string}-${string}-${string}-${string}-${string}` {
      const bytes = cryptoRef.getRandomValues(new Uint8Array(16))
      bytes[6] = (bytes[6] & 0x0f) | 0x40 // versão 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80 // variante RFC 4122
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    },
  })
}

export {}
