import { AssinaturaCanvas } from '@/components/ui/AssinaturaCanvas'

interface Props {
  onExport: (dataUrl: string) => void
  height?: number
}

export function ReciboAssinaturaCanvas({ onExport, height = 200 }: Props) {
  return (
    <AssinaturaCanvas
      onExport={onExport}
      height={height}
      hint="Desenhe sua assinatura com o dedo ou caneta na área abaixo"
    />
  )
}
