import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Copy, Eye, Pencil, Plus, Search } from 'lucide-react'
import { CrmPageFrame, CrmPageHeader } from '@/components/crm/CrmPageFrame'
import { Button } from '@/components/ui/button'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/EmptyState'
import { Field, FieldRow } from '@/components/ui/Field'
import { ModalFormFooter } from '@/components/ui/ModalFormFooter'
import { useCrmOrcamentoSlides } from '@/hooks/useCrmOrcamentoSlides'
import {
  filtrarSlides,
  isLinkPublicoAtivo,
  linkPublicoOrcamento,
  patchLinkPublico,
  patchPrecificacao,
  SLIDE_STATUS_LABEL,
  valorSlide,
} from '@/lib/crm-orcamento-slides'
import { fmtCur, fmtDate } from '@/lib/utils'
import { showToast } from '@/lib/toast'

export function OrcamentoSlidesPage() {
  const navigate = useNavigate()
  const { data, loading, error, criar } = useCrmOrcamentoSlides()
  const [busca, setBusca] = useState('')
  const [creating, setCreating] = useState(false)
  const [cliente, setCliente] = useState('')
  const [leadId, setLeadId] = useState('')

  const lista = useMemo(() => filtrarSlides(data.slides, busca), [data.slides, busca])

  return (
    <CrmPageFrame padded>
      <CrmPageHeader
        title="Slides de orçamento"
        subtitle={`${lista.length} de ${data.slides.length} apresentações`}
        icon={<Eye className="h-6 w-6 text-amber-400" />}
        actions={(
          <Button size="sm" className="gap-2" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Novo orçamento
          </Button>
        )}
        below={(
          <label className="relative block max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="glass-input w-full pl-9"
              placeholder="Buscar cliente ou identificador"
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </label>
        )}
      />

      {loading && <LoadingState variant="page" message="Carregando slides..." />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && lista.length === 0 && (
        <EmptyState message="Nenhum slide encontrado." />
      )}

      {!loading && !error && lista.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="obra-scroll-x-mobile overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="text-[0.7rem] uppercase tracking-wide text-[#b8957f]">
                <tr>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Identificador</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2">Atualizado</th>
                  <th className="px-3 py-2">Link</th>
                  <th className="px-3 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.map(item => (
                  <tr
                    key={item.id}
                    className="cursor-pointer border-t border-white/5 hover:bg-white/5"
                    onClick={() => navigate(`/orcamento-slides/${item.id}`)}
                  >
                    <td className="px-3 py-2 font-medium text-[#f2d892]">{item.cliente_nome}</td>
                    <td className="px-3 py-2 text-[#d4bc9f]">{item.identificador}</td>
                    <td className="px-3 py-2 text-[#edd9c4]">{SLIDE_STATUS_LABEL[item.status] ?? item.status}</td>
                    <td className="px-3 py-2 text-right text-emerald-300">{fmtCur(valorSlide(item))}</td>
                    <td className="px-3 py-2 text-[#b8957f]">{fmtDate(item.atualizado_em)}</td>
                    <td className="px-3 py-2 text-xs text-[#b8957f]">{isLinkPublicoAtivo(item) ? 'Público' : 'Oculto'}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                        <Button size="sm" variant="outline" type="button" onClick={() => navigate(`/orcamento-slides/${item.id}`)}>
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </Button>
                        <a href={linkPublicoOrcamento(item.id)} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="outline" type="button">
                            <Eye className="h-3.5 w-3.5" /> Ver
                          </Button>
                        </a>
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(linkPublicoOrcamento(item.id))
                              .then(() => showToast('Link copiado.'))
                              .catch(() => showToast('Não foi possível copiar.', 'error'))
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" /> Copiar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {creating && (
        <div className="glass-card max-w-lg space-y-3 p-4">
          <h2 className="font-display text-lg text-[#f2d892]">Novo orçamento</h2>
          <Field label="Cliente">
            <input className="glass-input w-full" value={cliente} onChange={e => setCliente(e.target.value)} />
          </Field>
          <Field label="Lead (opcional)">
            <select className="glass-input w-full" value={leadId} onChange={e => setLeadId(e.target.value)}>
              <option value="">Sem lead</option>
              {data.leads.map(lead => (
                <option key={lead.id} value={lead.id}>{lead.nome}</option>
              ))}
            </select>
          </Field>
          <ModalFormFooter
            onCancel={() => setCreating(false)}
            onSubmit={() => {
              void criar(cliente, leadId ? Number(leadId) : null).then(created => {
                setCreating(false)
                navigate(`/orcamento-slides/${created.id}`)
              }).catch(err => showToast(err instanceof Error ? err.message : 'Não foi possível criar.', 'error'))
            }}
            submitLabel="Criar"
            submitDisabled={!cliente.trim() && !leadId}
          />
        </div>
      )}
    </CrmPageFrame>
  )
}

export function OrcamentoSlideEditorPage() {
  const { id } = useParams()
  const { data, loading, error, salvar } = useCrmOrcamentoSlides()
  const slide = data.slides.find(item => item.id === id) ?? null
  const [saving, setSaving] = useState(false)
  const [cliente, setCliente] = useState('')
  const [identificador, setIdentificador] = useState('')
  const [status, setStatus] = useState('rascunho')
  const [leadId, setLeadId] = useState('')
  const [valorFinal, setValorFinal] = useState('0')
  const [valorEntrada, setValorEntrada] = useState('0')
  const [prazo, setPrazo] = useState('')
  const [garantia, setGarantia] = useState('')
  const [oculto, setOculto] = useState(false)

  useEffect(() => {
    if (!slide) return
    setCliente(slide.cliente_nome)
    setIdentificador(slide.identificador)
    setStatus(slide.status)
    setLeadId(slide.lead_id ? String(slide.lead_id) : '')
    setValorFinal(String(slide.dados.precificacao?.valor_final ?? 0))
    setValorEntrada(String(slide.dados.precificacao?.valor_entrada ?? 0))
    setPrazo(slide.dados.prazo_entrega ?? '')
    setGarantia(slide.dados.garantia_meses ?? '')
    setOculto(!isLinkPublicoAtivo(slide))
  }, [slide?.id])

  if (loading && !slide) return <LoadingState variant="page" message="Carregando orçamento..." />
  if (error) return <ErrorState message={error} />
  if (!slide) return <EmptyState message="Orçamento não encontrado." />

  const link = linkPublicoOrcamento(slide.id)

  return (
    <CrmPageFrame padded>
      <CrmPageHeader
        title={slide.cliente_nome}
        subtitle={slide.identificador}
        actions={(
          <div className="flex gap-2">
            <Link to="/orcamento-slides"><Button variant="outline" size="sm">Lista</Button></Link>
            <a href={link} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" className="gap-2">
                <Eye className="h-4 w-4" />
                Ver apresentação
              </Button>
            </a>
          </div>
        )}
      />

      <div className="space-y-3 rounded-xl border border-border/80 bg-card p-4">
        <FieldRow>
          <Field label="Cliente" half>
            <input className="glass-input w-full" value={cliente} onChange={e => setCliente(e.target.value)} />
          </Field>
          <Field label="Identificador" half>
            <input className="glass-input w-full" value={identificador} onChange={e => setIdentificador(e.target.value)} />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Status" half>
            <select className="glass-input w-full" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="rascunho">Rascunho</option>
              <option value="pronto">Pronto</option>
              <option value="enviado">Enviado</option>
            </select>
          </Field>
          <Field label="Lead" half>
            <select className="glass-input w-full" value={leadId} onChange={e => setLeadId(e.target.value)}>
              <option value="">Sem lead</option>
              {data.leads.map(lead => (
                <option key={lead.id} value={lead.id}>{lead.nome}</option>
              ))}
            </select>
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Valor final (R$)" half>
            <input className="glass-input w-full" value={valorFinal} onChange={e => setValorFinal(e.target.value)} />
          </Field>
          <Field label="Entrada (R$)" half>
            <input className="glass-input w-full" value={valorEntrada} onChange={e => setValorEntrada(e.target.value)} />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Prazo de entrega" half>
            <input className="glass-input w-full" value={prazo} onChange={e => setPrazo(e.target.value)} />
          </Field>
          <Field label="Garantia (meses)" half>
            <input className="glass-input w-full" value={garantia} onChange={e => setGarantia(e.target.value)} />
          </Field>
        </FieldRow>
        <label className="flex items-center gap-2 text-sm text-[#edd9c4]">
          <input type="checkbox" checked={!oculto} onChange={e => setOculto(!e.target.checked)} />
          Link público ativo
        </label>
        <div className="flex items-center gap-2 text-xs text-[#b8957f]">
          <span className="truncate">{link}</span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              void navigator.clipboard.writeText(link).then(() => showToast('Link copiado.'))
            }}
          >
            <Copy className="h-3 w-3" />
            Copiar
          </button>
        </div>
        <ModalFormFooter
          onCancel={() => window.history.back()}
          submitting={saving}
          onSubmit={() => {
            setSaving(true)
            const dados = patchLinkPublico(
              patchPrecificacao({
                ...slide.dados,
                prazo_entrega: prazo,
                garantia_meses: garantia,
              }, {
                valor_final: Number(valorFinal.replace(',', '.')) || 0,
                valor_entrada: Number(valorEntrada.replace(',', '.')) || 0,
              }),
              oculto,
            )
            void salvar({
              id: slide.id,
              clienteNome: cliente,
              identificador,
              leadId: leadId ? Number(leadId) : null,
              status,
              dados,
            }).then(() => {
              showToast('Orçamento salvo.')
            }).catch(err => {
              showToast(err instanceof Error ? err.message : 'Não foi possível salvar.', 'error')
            }).finally(() => setSaving(false))
          }}
          submitLabel="Salvar"
        />
      </div>
    </CrmPageFrame>
  )
}
