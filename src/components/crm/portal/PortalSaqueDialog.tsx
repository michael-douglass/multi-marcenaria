import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { ModalFormFooter } from '@/components/ui/ModalFormFooter'
import { Field } from '@/components/ui/Field'
import { TIPO_PIX_LABELS, validarValorSaque, type TipoChavePix } from '@/lib/crm-portal'
import { fmtCur } from '@/lib/utils'
import { showToast } from '@/lib/toast'

interface PortalSaqueDialogProps {
  open: boolean
  saldoDisponivel: number
  chavePix: string
  tipoChavePix: TipoChavePix
  onClose: () => void
  onConfirm: (input: { valor: number; chavePix: string; tipoChavePix: TipoChavePix }) => Promise<void>
}

export function PortalSaqueDialog({
  open,
  saldoDisponivel,
  chavePix,
  tipoChavePix,
  onClose,
  onConfirm,
}: PortalSaqueDialogProps) {
  const [valor, setValor] = useState('')
  const [pix, setPix] = useState(chavePix)
  const [tipo, setTipo] = useState<TipoChavePix>(tipoChavePix)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setValor('')
    setPix(chavePix)
    setTipo(tipoChavePix)
  }, [open, chavePix, tipoChavePix])

  return (
    <Modal open={open} onClose={onClose} title="Solicitar saque" closeOnBackdrop={false}>
      <p className="mb-3 text-sm text-muted-foreground">
        Disponível: <span className="font-semibold text-success">{fmtCur(saldoDisponivel)}</span>
      </p>
      <Field label="Valor">
        <input className="glass-input w-full" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" />
      </Field>
      <Field label="Tipo da chave PIX">
        <select className="glass-input w-full" value={tipo} onChange={e => setTipo(e.target.value as TipoChavePix)}>
          {(Object.keys(TIPO_PIX_LABELS) as TipoChavePix[]).map(item => (
            <option key={item} value={item}>{TIPO_PIX_LABELS[item]}</option>
          ))}
        </select>
      </Field>
      <Field label="Chave PIX">
        <input className="glass-input w-full" value={pix} onChange={e => setPix(e.target.value)} />
      </Field>
      <ModalFormFooter
        onCancel={onClose}
        submitLabel="Enviar pedido"
        submitting={saving}
        onSubmit={() => {
          const parsed = Number(valor.replace(/\./g, '').replace(',', '.'))
          const check = validarValorSaque(saldoDisponivel, parsed)
          if (!check.ok) {
            showToast(check.message, 'error')
            return
          }
          if (!pix.trim()) {
            showToast('Informe a chave PIX.', 'error')
            return
          }
          setSaving(true)
          void onConfirm({ valor: parsed, chavePix: pix.trim(), tipoChavePix: tipo })
            .then(() => {
              showToast('Pedido de saque enviado.')
              onClose()
            })
            .catch(err => showToast(err instanceof Error ? err.message : 'Não foi possível solicitar.', 'error'))
            .finally(() => setSaving(false))
        }}
      />
    </Modal>
  )
}
