import { useEffect, useState } from 'react'
import { useEmpresa } from '@/contexts/EmpresaContext'
import {
  buscarContatoDestinatario,
  type CaixaDestinatarioContato,
} from '@/lib/caixa-destinatario-contato'

export function useCaixaDestinatarioContato(
  destinatarioNome: string | null,
  destinatarioId: string | null,
) {
  const { schemaEmpresa } = useEmpresa()
  const [contato, setContato] = useState<CaixaDestinatarioContato | null>(null)
  const [loading, setLoading] = useState(() => Boolean(destinatarioNome && destinatarioId))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!destinatarioNome || !destinatarioId) {
      setContato(null)
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    void buscarContatoDestinatario({
      destinatarioNome,
      destinatarioId,
      schemaEmpresa,
    })
      .then(result => {
        if (cancelled) return
        setContato(result)
      })
      .catch(err => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Não foi possível carregar o contato.')
        setContato(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [destinatarioNome, destinatarioId, schemaEmpresa])

  return { contato, loading, error }
}
