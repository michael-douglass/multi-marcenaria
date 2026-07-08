import { useEnderecoGeo } from '@/hooks/useEnderecoGeo'

interface Props {
  latitude: number
  longitude: number
  precisaoMetros?: number | null
}

export function PontoLocalizacaoLabel({ latitude, longitude, precisaoMetros }: Props) {
  const { endereco, loading } = useEnderecoGeo(latitude, longitude)

  const texto = loading
    ? 'Buscando endereço…'
    : endereco ?? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`

  return (
    <span className="min-w-0 truncate" title={texto}>
      {texto}
      {precisaoMetros != null && ` (±${Math.round(precisaoMetros)}m)`}
    </span>
  )
}
