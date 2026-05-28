import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { ModalFormFooter } from '../ui/ModalFormFooter'
import { Field, FieldRow } from '../ui/Field'
import { LoadingState, ErrorState } from '../ui/EmptyState'
import { fmtCur, todayISO } from '../../lib/utils'
import type { FormaPagamento, LeadGanho, TipoRecebimento } from '../../types'
import type { DarEntradaInput } from '../../hooks/useOrcamentosFechados'
import type { HistoricoCompraCliente } from '../../hooks/useOrcamentosFechados'

interface Props {
  leads: LeadGanho[]
  loading: boolean
  error: string | null
  onDarEntrada: (input: DarEntradaInput) => Promise<void>
  onLoadHistorico: (lead: LeadGanho) => Promise<HistoricoCompraCliente[]>
}

const TIPO_LABELS: Record<TipoRecebimento, string> = {
  a_vista: 'À Vista',
  cartao_parcelado: 'Cartão Parcelado',
  nosso_parcelamento: 'Nosso Parcelamento',
}

const TIPO_ICONS: Record<TipoRecebimento, string> = {
  a_vista: '💵',
  cartao_parcelado: '💳',
  nosso_parcelamento: '📝',
}

const TIPOS: TipoRecebimento[] = ['a_vista', 'cartao_parcelado', 'nosso_parcelamento']
const PM_AVISTA: FormaPagamento[] = ['pix', 'dinheiro', 'cheque']
const PM_LABELS: Record<FormaPagamento, string> = {
  pix: 'PIX', dinheiro: 'Dinheiro', cheque: 'Cheque', boleto: 'Boleto', cartao: 'Cartão',
}

interface EntradaForm {
  valor: string
  tipo: TipoRecebimento
  forma: FormaPagamento
  parcelas: string
  primeiroVenc: string
  descontoCartaoPercentual: string
  descricao: string
}

function defaultForm(): EntradaForm {
  return {
    valor: '',
    tipo: 'a_vista',
    forma: 'pix',
    parcelas: '2',
    primeiroVenc: todayISO(),
    descontoCartaoPercentual: '0',
    descricao: '',
  }
}

export function OrcamentosFechados({ leads, loading, error, onDarEntrada, onLoadHistorico }: Props) {
  const [selected, setSelected] = useState<LeadGanho | null>(null)
  const [form, setForm] = useState<EntradaForm>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [historico, setHistorico] = useState<HistoricoCompraCliente[]>([])
  const [loadingHistorico, setLoadingHistorico] = useState(false)
  const [historicoError, setHistoricoError] = useState<string | null>(null)

  const f =
    (k: keyof EntradaForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }))

  const openModal = async (lead: LeadGanho) => {
    setSelected(lead)
    setForm({ ...defaultForm(), valor: lead.valor_orcamento ? String(lead.valor_orcamento) : '' })
    setSaveError(null)
    setHistorico([])
    setHistoricoError(null)
    setLoadingHistorico(true)
    try {
      const items = await onLoadHistorico(lead)
      setHistorico(items)
    } catch (e) {
      setHistoricoError(e instanceof Error ? e.message : 'Erro ao carregar histórico.')
    } finally {
      setLoadingHistorico(false)
    }
  }

  const closeModal = () => {
    setSelected(null)
    setSaveError(null)
    setHistorico([])
    setHistoricoError(null)
    setLoadingHistorico(false)
  }

  const selectTipo = (tipo: TipoRecebimento) =>
    setForm(p => ({
      ...p,
      tipo,
      forma: tipo === 'a_vista' ? 'pix' : tipo === 'cartao_parcelado' ? 'cartao' : p.forma,
      parcelas: tipo === 'a_vista' ? '1' : p.parcelas === '1' ? '2' : p.parcelas,
    }))

  const submit = async () => {
    if (!selected) return
    const val = parseFloat(form.valor)
    if (!val || val <= 0) { setSaveError('Informe o valor total da venda.'); return }
    const n = parseInt(form.parcelas) || 1
    if (form.tipo !== 'a_vista' && n < 2) { setSaveError('Informe ao menos 2 parcelas.'); return }
    const descontoCartaoPercentual = Math.max(0, Math.min(100, parseFloat(form.descontoCartaoPercentual) || 0))
    setSaving(true)
    setSaveError(null)
    try {
      await onDarEntrada({
        lead: selected,
        valor_total: val,
        tipo_recebimento: form.tipo,
        forma_pagamento: form.forma,
        total_parcelas: form.tipo === 'a_vista' ? 1 : n,
        primeiro_vencimento: form.primeiroVenc,
        desconto_cartao_percentual: form.tipo === 'cartao_parcelado' ? descontoCartaoPercentual : undefined,
        descricao: form.descricao || undefined,
      })
      closeModal()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erro ao dar entrada.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="mb-8"><LoadingState /></div>
  if (error) return <div className="mb-8"><ErrorState message={error} /></div>
  if (leads.length === 0) return null

  const val = parseFloat(form.valor) || 0
  const n = parseInt(form.parcelas) || 1
  const isParcelado = form.tipo !== 'a_vista'
  const descontoCartaoPercentual = Math.max(0, Math.min(100, parseFloat(form.descontoCartaoPercentual) || 0))
  const descontoCartaoValor = parseFloat(((val * descontoCartaoPercentual) / 100).toFixed(2))
  const liquidoCartao = parseFloat((val - descontoCartaoValor).toFixed(2))

  return (
    <div className="mb-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            className="font-display"
            style={{ fontSize: '1.3rem', color: '#d4a853', letterSpacing: '.06em' }}
          >
            Orçamentos Fechados — Dar entrada no caixa
          </h2>
          <p className="section-label mt-0.5">
            {leads.length} orçamento{leads.length !== 1 ? 's' : ''} aguardando lançamento
          </p>
        </div>
        <div
          className="glass-card px-4 py-2 text-right"
          style={{ borderLeft: '3px solid rgba(212,168,83,.5)' }}
        >
          <div className="section-label" style={{ fontSize: '.68rem' }}>Total em aberto</div>
          <div
            className="font-display"
            style={{ fontSize: '1.2rem', color: '#d4a853' }}
          >
            {fmtCur(leads.reduce((s, l) => s + (l.valor_orcamento ?? 0), 0))}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: '1rem',
        }}
      >
        {leads.map(lead => (
          <div
            key={lead.id}
            className="glass-card p-5"
            style={{ borderLeft: '3px solid rgba(212,168,83,.5)' }}
          >
            <div style={{ fontWeight: 700, color: '#f4e4d6', fontSize: '1rem', marginBottom: '.35rem' }}>
              {lead.nome}
            </div>
            {lead.telefone && (
              <div className="section-label" style={{ marginBottom: '.2rem' }}>
                📞 {lead.telefone}
              </div>
            )}
            {lead.email && (
              <div className="section-label" style={{ marginBottom: '.2rem', fontSize: '.7rem' }}>
                {lead.email}
              </div>
            )}
            {lead.origem && (
              <div
                className="section-label"
                style={{ marginBottom: '.5rem', fontSize: '.68rem', opacity: 0.65 }}
              >
                via {lead.origem}
              </div>
            )}
            {lead.observacoes && (
              <div
                style={{
                  marginBottom: '.65rem',
                  padding: '.45rem .55rem',
                  borderRadius: 8,
                  border: '1px solid rgba(212,168,83,.2)',
                  background: 'rgba(212,168,83,.05)',
                }}
              >
                <div className="section-label" style={{ fontSize: '.64rem', marginBottom: '.18rem' }}>
                  Observações
                </div>
                <p
                  className="section-label"
                  style={{
                    fontSize: '.72rem',
                    lineHeight: 1.35,
                    color: '#e8d8ca',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                  title={lead.observacoes}
                >
                  {lead.observacoes}
                </p>
              </div>
            )}
            {lead.valor_orcamento != null && lead.valor_orcamento > 0 && (
              <div
                className="font-display"
                style={{ fontSize: '1.1rem', color: '#4ade80', marginBottom: '.7rem' }}
              >
                {fmtCur(lead.valor_orcamento)}
              </div>
            )}
            <button
              type="button"
              className="btn btn-gold btn-sm w-full"
              onClick={() => void openModal(lead)}
            >
              Ver histórico e dar entrada
            </button>
          </div>
        ))}
      </div>

      {selected && (
        <Modal
          open
          onClose={closeModal}
          title={`DAR ENTRADA — ${selected.nome.toUpperCase()}`}
        >
          <div
            style={{
              background: 'rgba(212,168,83,.06)',
              border: '1px solid rgba(212,168,83,.2)',
              borderRadius: 8,
              padding: '.65rem .85rem',
              marginBottom: '.75rem',
            }}
          >
            <div className="section-label" style={{ marginBottom: '.35rem' }}>
              Histórico de compras do cliente
            </div>
            {loadingHistorico ? (
              <p className="section-label">Carregando histórico...</p>
            ) : historicoError ? (
              <p className="text-sm text-red-400">{historicoError}</p>
            ) : historico.length === 0 ? (
              <p className="section-label">Ainda não há compras anteriores registradas.</p>
            ) : (
              <div style={{ display: 'grid', gap: '.45rem', maxHeight: 180, overflowY: 'auto' }}>
                {historico.map(item => (
                  <div
                    key={item.id}
                    style={{
                      border: '1px solid rgba(212,168,83,.14)',
                      borderRadius: 8,
                      padding: '.45rem .55rem',
                      background: 'rgba(255,255,255,.01)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem' }}>
                      <span className="section-label">{item.criado_em ? new Date(item.criado_em).toLocaleDateString('pt-BR') : '-'}</span>
                      <strong style={{ color: '#4ade80', fontSize: '.82rem' }}>{fmtCur(item.valor_total)}</strong>
                    </div>
                    <div className="section-label" style={{ fontSize: '.7rem', marginTop: '.1rem' }}>
                      {TIPO_LABELS[item.tipo_recebimento]} · {item.total_parcelas} parcela{item.total_parcelas > 1 ? 's' : ''}
                    </div>
                    {item.descricao && (
                      <p className="section-label" style={{ marginTop: '.15rem' }}>{item.descricao}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <Field label="Valor Total da Venda (R$) *">
            <input
              className="glass-input"
              type="number"
              value={form.valor}
              onChange={f('valor')}
              placeholder="0,00"
              min="0"
              step="0.01"
              autoFocus
            />
          </Field>

          <Field label="Como será recebido?">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '.5rem' }}>
              {TIPOS.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => selectTipo(t)}
                  style={{
                    padding: '.65rem .4rem',
                    borderRadius: 8,
                    border: form.tipo === t ? '1.5px solid #d4a853' : '1px solid rgba(212,168,83,.2)',
                    background: form.tipo === t ? 'rgba(212,168,83,.12)' : 'transparent',
                    color: form.tipo === t ? '#d4a853' : '#8a6a55',
                    cursor: 'pointer',
                    fontSize: '.7rem',
                    fontWeight: 600,
                    textAlign: 'center',
                    fontFamily: 'Raleway, sans-serif',
                    lineHeight: 1.4,
                    transition: 'all .15s',
                  }}
                >
                  <div style={{ fontSize: '1.15rem', marginBottom: '.2rem' }}>{TIPO_ICONS[t]}</div>
                  {TIPO_LABELS[t]}
                </button>
              ))}
            </div>
          </Field>

          {form.tipo === 'a_vista' ? (
            <FieldRow>
              <Field label="Forma" half>
                <select className="glass-input" value={form.forma} onChange={f('forma')}>
                  {PM_AVISTA.map(pm => (
                    <option key={pm} value={pm}>{PM_LABELS[pm]}</option>
                  ))}
                </select>
              </Field>
              <Field label="Data de Recebimento" half>
                <input className="glass-input" type="date" value={form.primeiroVenc} onChange={f('primeiroVenc')} />
              </Field>
            </FieldRow>
          ) : form.tipo === 'cartao_parcelado' ? (
            <>
              <FieldRow>
                <Field label="% de Desconto do Cartão *" half>
                  <input
                    className="glass-input"
                    type="number"
                    value={form.descontoCartaoPercentual}
                    onChange={f('descontoCartaoPercentual')}
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="Ex: 4.99"
                  />
                </Field>
                <Field label="Parcelas no cartão (informativo)" half>
                  <input
                    className="glass-input"
                    type="number"
                    value={form.parcelas}
                    onChange={f('parcelas')}
                    min="2"
                    max="24"
                  />
                </Field>
              </FieldRow>
              <p className="section-label mb-2" style={{ fontSize: '.72rem' }}>
                No cartão parcelado, o sistema lança 1 entrada líquida recebida hoje. As parcelas ficam apenas como informação.
              </p>
            </>
          ) : (
            <FieldRow>
              <Field label="Forma" half>
                <select className="glass-input" value={form.forma} onChange={f('forma')}>
                  {(['pix', 'boleto', 'dinheiro', 'cheque', 'cartao'] as FormaPagamento[]).map(pm => (
                    <option key={pm} value={pm}>{PM_LABELS[pm]}</option>
                  ))}
                </select>
              </Field>
              <Field label="Nº de Parcelas" half>
                <input
                  className="glass-input"
                  type="number"
                  value={form.parcelas}
                  onChange={f('parcelas')}
                  min="2"
                  max="60"
                />
              </Field>
              <Field label={form.tipo === 'nosso_parcelamento' ? '1ª Parcela' : '1ª Parcela'} half>
                <input className="glass-input" type="date" value={form.primeiroVenc} onChange={f('primeiroVenc')} />
              </Field>
            </FieldRow>
          )}

          <Field label="Descrição (opcional)">
            <input
              className="glass-input"
              value={form.descricao}
              onChange={f('descricao')}
              placeholder="Ex: Dormitório casal, sala completa..."
            />
          </Field>

          {val > 0 && (
            <div
              style={{
                background: 'rgba(74,222,128,.06)',
                border: '1px solid rgba(74,222,128,.2)',
                borderRadius: 8,
                padding: '.6rem .85rem',
                marginBottom: '.5rem',
              }}
            >
              <span style={{ color: '#4ade80', fontSize: '.82rem' }}>
                {isParcelado
                  ? form.tipo === 'cartao_parcelado'
                    ? `Bruto ${fmtCur(val)} · Desconto ${descontoCartaoPercentual.toFixed(2)}% (${fmtCur(descontoCartaoValor)}) · Líquido recebido ${fmtCur(liquidoCartao)}`
                    : `${n}× de ${fmtCur(val / n)} · ${PM_LABELS[form.forma]} · 1ª: ${form.primeiroVenc}`
                  : `${fmtCur(val)} via ${PM_LABELS[form.forma]} · ${form.primeiroVenc}`}
              </span>
            </div>
          )}

          {saveError && <p className="mb-2 text-sm text-red-400">{saveError}</p>}

          <ModalFormFooter
            onCancel={closeModal}
            onSubmit={submit}
            submitLabel="Lançar no caixa"
            submittingLabel="Lançando..."
            submitting={saving}
            submitDisabled={!form.valor}
          />
        </Modal>
      )}
    </div>
  )
}
