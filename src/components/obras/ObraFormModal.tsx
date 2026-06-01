import { Modal } from '@/components/ui/Modal'
import { ModalFormFooter } from '@/components/ui/ModalFormFooter'
import { Field } from '@/components/ui/Field'
import type { ObraFull, ObraInput, StatusKanbanObra } from '@/types'

const COLUNAS: { key: StatusKanbanObra; label: string }[] = [
  { key: 'datas_em_aberto', label: 'Datas em Aberto' },
  { key: 'datas_em_atraso', label: 'Datas em Atraso' },
  { key: 'datas_definidas', label: 'Datas Definidas' },
  { key: 'em_andamento',    label: 'Em Andamento' },
  { key: 'concluida',       label: 'Concluída' },
  { key: 'cancelada',       label: 'Cancelada' },
]

interface ObraFormModalProps {
  open: boolean
  obra: ObraFull | null
  form: ObraInput
  onChange: (k: keyof ObraInput, v: string | null | number) => void
  onClose: () => void
  onSave: () => void
  saving: boolean
  tipos: { id: string; nome: string }[]
  grupos: { id: string; nome: string }[]
  montadores: { id: string; nome?: string | null; email: string; perfil: string }[]
  canEditDates: boolean
  canEditMontador: boolean
  isAdmin: boolean
}

export function ObraFormModal({
  open, obra, form, onChange, onClose, onSave, saving,
  tipos, grupos, montadores, canEditDates, canEditMontador, isAdmin,
}: ObraFormModalProps) {
  const s = (k: keyof ObraInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange(k, e.target.value || null)

  return (
    <Modal open={open} onClose={onClose} title={obra ? 'EDITAR OBRA' : 'NOVA OBRA'}>
      <Field label="Cliente *">
        <input className="glass-input" value={form.cliente_nome} onChange={s('cliente_nome')} placeholder="Nome do cliente" />
      </Field>
      <Field label="Endereço da Obra">
        <input className="glass-input" value={form.endereco_obra ?? ''} onChange={s('endereco_obra')} placeholder="Rua, número, bairro..." />
      </Field>

      {isAdmin && (
        <>
          <Field label="Tipo de Obra">
            <select className="glass-input" value={form.tipo_obra_id ?? ''} onChange={s('tipo_obra_id')}>
              <option value="">— Selecione —</option>
              {tipos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </Field>
          <Field label="Grupo de Obra">
            <select className="glass-input" value={form.grupo_obra_id ?? ''} onChange={s('grupo_obra_id')}>
              <option value="">— Selecione —</option>
              {grupos.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>
          </Field>
        </>
      )}

      {canEditMontador && (
        <>
          <Field label="Montador Responsável">
            <select className="glass-input" value={form.montador_id ?? ''} onChange={s('montador_id')}>
              <option value="">— Nenhum —</option>
              {montadores.filter(m => m.perfil === 'montador').map(m => (
                <option key={m.id} value={m.id}>{m.nome ?? m.email}</option>
              ))}
            </select>
          </Field>
          <Field label="Montador Admin">
            <select className="glass-input" value={form.montador_admin_id ?? ''} onChange={s('montador_admin_id')}>
              <option value="">— Nenhum —</option>
              {montadores.filter(m => m.perfil === 'montador_admin').map(m => (
                <option key={m.id} value={m.id}>{m.nome ?? m.email}</option>
              ))}
            </select>
          </Field>
        </>
      )}

      {canEditDates && (
        <>
          <Field label="Início Previsto">
            <input type="date" className="glass-input" value={form.data_prevista_inicio ?? ''} onChange={s('data_prevista_inicio')} />
          </Field>
          <Field label="Término Previsto">
            <input type="date" className="glass-input" value={form.data_prevista_fim ?? ''} onChange={s('data_prevista_fim')} />
          </Field>
          <Field label="Prazo Máximo (horas)">
            <input
              type="number" min={0} className="glass-input"
              value={form.tempo_maximo_horas ?? ''}
              onChange={e => onChange('tempo_maximo_horas', e.target.value ? Number(e.target.value) : null)}
              placeholder="Ex: 48"
            />
          </Field>
        </>
      )}

      {isAdmin && (
        <Field label="Status">
          <select className="glass-input" value={form.status_kanban ?? 'datas_em_aberto'} onChange={s('status_kanban')}>
            {COLUNAS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </Field>
      )}

      <ModalFormFooter
        onCancel={onClose}
        onSubmit={onSave}
        submitting={saving}
        submitLabel={obra ? 'Salvar' : 'Criar'}
      />
    </Modal>
  )
}
