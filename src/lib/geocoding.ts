const enderecoCache = new Map<string, string>()
const enderecoPending = new Map<string, Promise<string>>()

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`
}

function formatEnderecoFromAddress(address: Record<string, string>): string | null {
  const rua =
    address.road ??
    address.pedestrian ??
    address.footway ??
    address.residential ??
    address.path ??
    ''

  const bairro =
    address.suburb ??
    address.neighbourhood ??
    address.quarter ??
    address.city_district ??
    address.district ??
    ''

  const cidade =
    address.city ??
    address.town ??
    address.municipality ??
    address.village ??
    address.county ??
    ''

  const partes = [rua, bairro, cidade].filter(Boolean)
  return partes.length > 0 ? partes.join(', ') : null
}

/** Converte coordenadas em "Rua, Bairro, Cidade" via OpenStreetMap (Nominatim). */
export async function reverseGeocodeEndereco(lat: number, lng: number): Promise<string> {
  const key = cacheKey(lat, lng)
  const cached = enderecoCache.get(key)
  if (cached) return cached

  const inFlight = enderecoPending.get(key)
  if (inFlight) return inFlight

  const promise = (async () => {
    try {
      const url = new URL('https://nominatim.openstreetmap.org/reverse')
      url.searchParams.set('lat', String(lat))
      url.searchParams.set('lon', String(lng))
      url.searchParams.set('format', 'json')
      url.searchParams.set('accept-language', 'pt-BR')
      url.searchParams.set('zoom', '18')

      const res = await fetch(url.toString(), {
        headers: { 'Accept-Language': 'pt-BR' },
      })
      if (!res.ok) throw new Error('Falha ao buscar endereço.')

      const data = (await res.json()) as { address?: Record<string, string> }
      const endereco = formatEnderecoFromAddress(data.address ?? {})
      const texto = endereco ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
      enderecoCache.set(key, texto)
      return texto
    } catch {
      const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
      enderecoCache.set(key, fallback)
      return fallback
    } finally {
      enderecoPending.delete(key)
    }
  })()

  enderecoPending.set(key, promise)
  return promise
}
