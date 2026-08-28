import { useEffect, useState } from 'react'
import { CalendarDays, FileText, FolderOpen, Presentation, Sparkles, StickyNote, User } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { ModalFormFooter } from '@/components/ui/ModalFormFooter'
import { Field, FieldRow } from '@/components/ui/Field'
import { Button } from '@/components/ui/button'
import { CrmLeadSection } from '@/components/crm/CrmLeadSection'
import { MarkupLeadSection } from '@/components/crm/MarkupLeadSection'
import { LeadIaPanel, LeadWhatsAppPanel } from '@/components/crm/LeadComunicacaoPanels'
import { showToast } from '@/lib/toast'
import type { CrmMarkupListaItem } from '@/lib/crm-markup'
import type { CrmLeadCard } from '@/lib/crm-pipeline'
import { cn } from '@/lib/utils'

interface PipelineLeadModalProps {
  lead: CrmLeadCard | null
  statusOptions: { value: string; label: string; group: string }[]
  creating?: boolean
  canOpenMarkup?: boolean
  markupItens?: CrmMarkupListaItem[]
  onOpenMarkup?: (orcamentoId?: string) => void
  onOpenLousa?: () => void
  onOpenContrato?: () => void
  onOpenSlides?: () => void
  onOpenAgenda?: () => void
  onClose: () => void
  onSave: (input: {
    id: number
    nome: string
    telefone: string
    email: string
    origem: string
    observacoes: string
    valorNegocio: number
    status: string
  }) => Promise<void>
  onCreate?: (input: { nome: string; telefone: string; origem: string }) => Promise<void>
}

export function PipelineLeadModal({
  lead,
  statusOptions,
  creating = false,
  canOpenMarkup = false,
  markupItens = [],
  onOpenMarkup,
  onOpenLousa,
  onOpenContrato,
  onOpenSlides,
  onOpenAgenda,
  onClose,
  onSave,
  onCreate,
}: PipelineLeadModalProps) {
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [origem, setOrigem] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [valorNegocio, setValorNegocio] = useState('0')
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [aba, setAba] = useState<'detalhes' | 'analise-ia'>('detalhes')

  useEffect(() => {
    setNome(lead?.nome ?? '')
    setTelefone(lead?.telefone ?? '')
    setEmail(lead?.email ?? '')
    setOrigem(lead?.origem ?? '')
    setObservacoes(lead?.observacoes ?? '')
    setValorNegocio(String(lead?.valorNegocio ?? 0))
    setStatus(lead?.status ?? statusOptions[0]?.value ?? 'Novo Lead')
    setAba('detalhes')
  }, [lead, creating, statusOptions])

  const open = creating || lead != null
  const statusLabel = statusOptions.find(opt => opt.value === status)

  const handleSubmit = async () => {
    if (!nome.trim()) {
      showToast('Informe o nome do lead.', 'error')
      return
    }
    setSaving(true)
    try {
      if (creating) {
        await onCreate?.({ nome, telefone, origem })
        showToast('Lead criado.')
      } else if (lead) {
        await onSave({
          id: lead.id,
          nome,
          telefone,
          email,
          origem,
          observacoes,
          valorNegocio: Number(valorNegocio.replace(',', '.')) || 0,
          status,
        })
        showToast('Lead salvo.')
      }
      onClose()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Não foi possível salvar.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={creating ? 'Novo lead' : lead?.nome ?? 'Lead'}
      extraWide
      tall
      closeOnBackdrop={false}
      headerTop={lead?.vendedorNome ? (
        <p className="text-[11px] font-medium uppercase tracking-wide text-gold">
          Vendedor: {lead.vendedorNome}
        </p>
      ) : null}
      headerExtra={!creating && statusLabel ? (
        <div className="inline-flex max-w-full flex-col gap-0.5 rounded-md border border-gold-border-subtle/40 bg-gold/10 px-2 py-1">
          <span className="truncate text-[9px] font-semibold uppercase tracking-[0.12em] text-gold/80">
            {statusLabel.group}
          </span>
          <span className="truncate text-[11px] font-medium text-gold">{statusLabel.label}</span>
        </div>
      ) : null}
    >
      {!creating && lead && (
        <div className="mb-3 inline-flex rounded-lg border border-border bg-muted/30 p-0.5">
          <button
            type="button"
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium',
              aba === 'detalhes' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
            )}
            onClick={() => setAba('detalhes')}
          >
            Detalhes
          </button>
          <button
            type="button"
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium',
              aba === 'analise-ia' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
            )}
            onClick={() => setAba('analise-ia')}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Análise IA
          </button>
        </div>
      )}

      {(creating || aba === 'detalhes') && (
        <>
          <CrmLeadSection title="Dados do lead" icon={User}>
            <Field label="Nome">
              <input className="glass-input w-full" value={nome} onChange={e => setNome(e.target.value)} />
            </Field>
            <FieldRow>
              <Field label="Telefone" half>
                <input className="glass-input w-full" value={telefone} onChange={e => setTelefone(e.target.value)} />
              </Field>
              <Field label="Origem" half>
                <input className="glass-input w-full" value={origem} onChange={e => setOrigem(e.target.value)} />
              </Field>
            </FieldRow>
            {!creating && (
              <>
                <Field label="E-mail">
                  <input className="glass-input w-full" value={email} onChange={e => setEmail(e.target.value)} />
                </Field>
                <FieldRow>
                  <Field label="Etapa" half>
                    <select className="glass-input w-full" value={status} onChange={e => setStatus(e.target.value)}>
                      {statusOptions.map(opt => (
                        <option key={`${opt.group}-${opt.value}`} value={opt.value}>
                          {opt.group} · {opt.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Valor (R$)" half>
                    <input className="glass-input w-full" value={valorNegocio} onChange={e => setValorNegocio(e.target.value)} />
                  </Field>
                </FieldRow>
              </>
            )}
          </CrmLeadSection>

          {!creating && (
            <>
              <CrmLeadSection title="Observações" icon={StickyNote}>
                <textarea className="glass-input w-full" rows={4} value={observacoes} onChange={e => setObservacoes(e.target.value)} />
              </CrmLeadSection>

              {lead && (
                <MarkupLeadSection
                  leadId={lead.id}
                  leadNome={nome || lead.nome}
                  itens={markupItens}
                  readOnly={!canOpenMarkup}
                  onOpen={canOpenMarkup ? onOpenMarkup : undefined}
                />
              )}

              {telefone.trim() && (
                <LeadWhatsAppPanel telefone={telefone} leadNome={nome || lead?.nome || 'Lead'} />
              )}

              <CrmLeadSection
                title="Materiais do lead"
                icon={FolderOpen}
                variant="accent"
                description="Contratos, slides, agenda e a lousa deste lead."
              >
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {onOpenSlides && (
                    <Button type="button" variant="outline" className="justify-start" onClick={onOpenSlides}>
                      <Presentation className="h-4 w-4" />
                      Slides de orçamento
                    </Button>
                  )}
                  {onOpenContrato && (
                    <Button type="button" variant="outline" className="justify-start" onClick={onOpenContrato}>
                      <FileText className="h-4 w-4" />
                      Contratos
                    </Button>
                  )}
                  {onOpenAgenda && (
                    <Button type="button" variant="outline" className="justify-start" onClick={onOpenAgenda}>
                      <CalendarDays className="h-4 w-4" />
                      Agenda comercial
                    </Button>
                  )}
                  {onOpenLousa && (
                    <Button type="button" variant="outline" className="justify-start" onClick={onOpenLousa}>
                      Lousa do lead
                    </Button>
                  )}
                </div>
              </CrmLeadSection>
            </>
          )}
        </>
      )}

      {!creating && lead && aba === 'analise-ia' && (
        <LeadIaPanel leadId={lead.id} leadNome={nome || lead.nome} leadOrigem={origem} />
      )}

      <ModalFormFooter
        onCancel={onClose}
        onSubmit={() => void handleSubmit()}
        submitLabel={creating ? 'Criar' : 'Salvar'}
        submitting={saving}
      />
    </Modal>
  )
}
