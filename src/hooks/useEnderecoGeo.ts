import { useEffect, useState } from 'react'
import { reverseGeocodeEndereco } from '@/lib/geocoding'

export function useEnderecoGeo(latitude?: number | null, longitude?: number | null) {
  const [endereco, setEndereco] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (latitude == null || longitude == null) {
      setEndereco(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    void reverseGeocodeEndereco(latitude, longitude).then(texto => {
      if (!cancelled) {
        setEndereco(texto)
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [latitude, longitude])

  return { endereco, loading }
}
