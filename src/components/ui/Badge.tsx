interface BadgeProps {
  status: string
}

const statusMap: Record<string, string> = {
  aguardando_aprovacao: 'badge badge-gold',
  aprovado:             'badge badge-green',
  recusado:             'badge badge-red',
  pago:                 'badge badge-green',
  pendente:             'badge badge-amber',
  recebido:             'badge badge-green',
  vencido:              'badge badge-red',
}

const labelMap: Record<string, string> = {
  aguardando_aprovacao: 'Aguardando Aprovação',
  aprovado:             'Aprovado',
  recusado:             'Recusado',
  pago:                 'Pago',
  pendente:             'Pendente',
  recebido:             'Recebido',
  vencido:              'Vencido',
}

export function Badge({ status }: BadgeProps) {
  return (
    <span className={statusMap[status] ?? 'badge badge-amber'}>
      {labelMap[status] ?? status}
    </span>
  )
}
