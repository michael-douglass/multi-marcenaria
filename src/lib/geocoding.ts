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

export interface GeoCoordinates {
  latitude: number
  longitude: number
  endereco: string
}

export function normalizeCep(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8)
}

export function formatCep(value: string): string {
  const digits = normalizeCep(value)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

export function isCepCompleto(value: string): boolean {
  return normalizeCep(value).length === 8
}

interface BrasilApiCep {
  cep?: string
  state?: string
  city?: string
  neighborhood?: string
  street?: string
  location?: {
    coordinates?: {
      latitude?: string | number
      longitude?: string | number
    } | [string | number, string | number]
  }
}

interface ViaCepResult {
  erro?: boolean | string
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
  cep?: string
}

function readBrasilApiCoords(data: BrasilApiCep): { latitude: number; longitude: number } | null {
  const coords = data.location?.coordinates
  if (!coords) return null
  if (Array.isArray(coords)) {
    const longitude = Number(coords[0])
    const latitude = Number(coords[1])
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
    if (latitude === 0 && longitude === 0) return null
    return { latitude, longitude }
  }
  const latitude = Number(coords.latitude)
  const longitude = Number(coords.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (latitude === 0 && longitude === 0) return null
  return { latitude, longitude }
}

function formatCepEndereco(parts: {
  street?: string
  neighborhood?: string
  city?: string
  state?: string
}): string {
  return [parts.street, parts.neighborhood, parts.city, parts.state]
    .map(part => part?.trim())
    .filter(Boolean)
    .join(', ')
}

async function geocodeQuery(query: string): Promise<GeoCoordinates> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')
  url.searchParams.set('countrycodes', 'br')
  url.searchParams.set('accept-language', 'pt-BR')
  url.searchParams.set('addressdetails', '1')

  const res = await fetch(url.toString(), {
    headers: { 'Accept-Language': 'pt-BR' },
  })
  if (!res.ok) {
    throw new Error('Não foi possível localizar este CEP agora. Tente de novo em alguns segundos.')
  }

  const rows = (await res.json()) as Array<{
    lat?: string
    lon?: string
    display_name?: string
  }>
  const first = rows[0]
  const latitude = Number(first?.lat)
  const longitude = Number(first?.lon)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('Não encontramos este CEP. Confira os 8 números.')
  }

  return {
    latitude,
    longitude,
    endereco: first.display_name?.trim() || query,
  }
}

/** Converte só o CEP em latitude/longitude. O prestador não precisa digitar rua. */
export async function geocodeCep(cep: string): Promise<GeoCoordinates> {
  const digits = normalizeCep(cep)
  if (digits.length !== 8) {
    throw new Error('Digite só o CEP, com 8 números.')
  }

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${digits}`)
    if (res.ok) {
      const data = (await res.json()) as BrasilApiCep
      const endereco = formatCepEndereco({
        street: data.street,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state,
      })
      const coords = readBrasilApiCoords(data)
      if (coords) {
        return { ...coords, endereco: endereco || `CEP ${formatCep(digits)}` }
      }
      if (endereco) return geocodeQuery(`${endereco}, Brasil`)
    }
  } catch {
    // Cai no ViaCEP abaixo.
  }

  const viaRes = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
  if (!viaRes.ok) {
    throw new Error('Não foi possível consultar este CEP agora. Tente de novo.')
  }
  const via = (await viaRes.json()) as ViaCepResult
  if (via.erro) {
    throw new Error('CEP não encontrado. Confira os 8 números.')
  }
  const query = formatCepEndereco({
    street: via.logradouro,
    neighborhood: via.bairro,
    city: via.localidade,
    state: via.uf,
  })
  if (!query) {
    throw new Error('CEP não encontrado. Confira os 8 números.')
  }
  return geocodeQuery(`${query}, Brasil`)
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
