import { useEffect, useId, useState } from 'react'
import { Loader2, MapPinned } from 'lucide-react'
import { geocodeCep, isCepCompleto, normalizeCep, type GeoCoordinates } from '@/lib/geocoding'
import type { GeoPosition } from '@/lib/geolocation'
import './ponto-cep-stamp.css'

interface Props {
  disabled?: boolean
  onConfirm: (geo: GeoPosition) => void
}

export function PontoLocalizacaoManual({ disabled = false, onConfirm }: Props) {
  const inputId = useId()
  const [digits, setDigits] = useState('')
  const [consulta, setConsulta] = useState<GeoCoordinates | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!isCepCompleto(digits)) {
      setConsulta(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setErro(null)

    void geocodeCep(digits)
      .then(resultado => {
        if (!cancelled) setConsulta(resultado)
      })
      .catch(e => {
        if (!cancelled) {
          setConsulta(null)
          setErro(e instanceof Error ? e.message : 'CEP não encontrado.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [digits])

  const enviar = () => {
    if (!consulta) {
      setErro(isCepCompleto(digits) ? erro : 'Digite só o CEP, com 8 números.')
      return
    }
    onConfirm({
      latitude: consulta.latitude,
      longitude: consulta.longitude,
      accuracy: null,
      origem: 'manual',
    })
  }

  const activeIndex = Math.min(digits.length, 7)

  return (
    <div className="ponto-cep-stamp mt-2 px-4 pb-4 pt-5 text-left">
      <div className="ponto-cep-plate space-y-3">
        <p className="ponto-cep-kicker">Somente o CEP</p>
        <div>
          <h3 className="font-display text-[1.65rem] leading-none tracking-[0.12em] text-[#f2d892]">
            Onde você está
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-[#c4a48c]">
            Não precisa de rua nem número. Digite os 8 números do CEP do local.
          </p>
        </div>

        <div className="relative pt-1">
          <label htmlFor={inputId} className="sr-only">
            CEP com 8 números
          </label>
          <div className="ponto-cep-cells" aria-hidden="true">
            {Array.from({ length: 8 }, (_, index) => (
              <span key={index} className="contents">
                {index === 5 && <span className="ponto-cep-hyphen">-</span>}
                <span
                  className={[
                    'ponto-cep-cell',
                    digits[index] ? 'is-filled' : '',
                    focused && index === activeIndex ? 'is-active' : '',
                  ].join(' ')}
                >
                  {digits[index] ?? ''}
                </span>
              </span>
            ))}
          </div>
          <input
            id={inputId}
            className="ponto-cep-input"
            inputMode="numeric"
            autoComplete="postal-code"
            autoCapitalize="off"
            pattern="[0-9]*"
            enterKeyHint="done"
            maxLength={8}
            value={digits}
            disabled={disabled}
            aria-invalid={erro ? true : undefined}
            aria-describedby={erro ? `${inputId}-erro` : undefined}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={event => {
              setDigits(normalizeCep(event.target.value))
              setErro(null)
            }}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault()
                enviar()
              }
            }}
          />
        </div>

        <div className="min-h-[1.4rem]">
          {loading && (
            <p className="flex items-center gap-1.5 text-xs text-[#f2d892]">
              <Loader2 size={13} className="animate-spin" />
              Procurando este CEP…
            </p>
          )}
          {!loading && consulta && (
            <p className="ponto-cep-city">{consulta.endereco}</p>
          )}
          {!loading && erro && (
            <p id={`${inputId}-erro`} className="text-xs text-red-200">
              {erro}
            </p>
          )}
        </div>

        <button
          type="button"
          className="ponto-cep-cta"
          disabled={disabled || loading || !consulta}
          onClick={enviar}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <MapPinned size={16} />}
          Usar este CEP
        </button>
      </div>
    </div>
  )
}
