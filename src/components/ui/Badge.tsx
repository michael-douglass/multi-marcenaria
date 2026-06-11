interface BadgeProps {
  status: string
}

const statusMap: Record<string, string> = {
  aguardando_aprovacao: 'badge badge-gold',
  aprovado:             'badge badge-green',
  recusado:             'badge badge-red',
  pago:                 'badge badge-green',
  pendente:             'badge badge-amber',
  parcialmente_pago:    'badge badge-blue',
  recebido:             'badge badge-green',
  vencido:              'badge badge-red',
  aberto:               'badge badge-amber',
}

const labelMap: Record<string, string> = {
  aguardando_aprovacao: 'Aguardando Aprovação',
  aprovado:             'Aprovado',
  recusado:             'Recusado',
  pago:                 'Pago',
  pendente:             'Pendente',
  parcialmente_pago:    'Parcial',
  recebido:             'Recebido',
  vencido:              'Vencido',
  aberto:               'Aberto',
}

export function Badge({ status }: BadgeProps) {
  return (
    <span className={statusMap[status] ?? 'badge badge-amber'}>
      {labelMap[status] ?? status}
    </span>
  )
}
