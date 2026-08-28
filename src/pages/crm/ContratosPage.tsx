import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FileText, Plus, Printer, Search, Settings } from 'lucide-react'
import { CrmPageFrame, CrmPageHeader, CRM_TABLE_SHELL_CLASS } from '@/components/crm/CrmPageFrame'
import { Button } from '@/components/ui/button'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/EmptyState'
import { Field, FieldRow } from '@/components/ui/Field'
import { ModalFormFooter } from '@/components/ui/ModalFormFooter'
import { useCrmContratos } from '@/hooks/useCrmContratos'
import {
  buildConteudoContrato,
  CONTRATO_STATUS_LABEL,
  CONTRATO_STATUS_STYLE,
  filtrarContratos,
  gerarIdentificadorContrato,
  nomeExibicaoContrato,
  contratosEmProducao,
  contratosFinalizados,
  type ContratoStatus,
  type CrmContrato,
} from '@/lib/crm-contratos'
import { fmtDate } from '@/lib/utils'
import { showToast } from '@/lib/toast'

export function ContratosPage() {
  const navigate = useNavigate()
  const { data, loading, error } = useCrmContratos()
  const [busca, setBusca] = useState('')
  const lista = useMemo(() => filtrarContratos(data.contratos, busca), [data.contratos, busca])

  return (
    <CrmPageFrame padded>
      <CrmPageHeader
        title="Contratos"
        subtitle={`${lista.length} de ${data.contratos.length} documentos — inclusive rascunhos em produção`}
        icon={(
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/15">
            <FileText className="h-4 w-4 text-amber-400" />
          </div>
        )}
        actions={(
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/contratos/configuracoes')}>
              <Settings className="h-4 w-4" />
              Configurações
            </Button>
            <Button size="sm" className="gap-2 bg-amber-500 font-semibold text-black hover:bg-amber-600" onClick={() => navigate('/contratos/novo')}>
              <Plus className="h-4 w-4" />
              Novo Contrato
            </Button>
          </div>
        )}
        below={(
          <label className="relative block max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="glass-input w-full pl-9"
              placeholder="Buscar por cliente, lead ou identificador..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </label>
        )}
      />
      {loading && <LoadingState variant="page" message="Carregando contratos..." />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && lista.length === 0 && <EmptyState message="Nenhum contrato encontrado." />}
      {!loading && !error && lista.length > 0 && (
        <div className="space-y-6">
          <ContratosTabela
            titulo="Em produção"
            itens={contratosEmProducao(lista)}
            onOpen={id => navigate(`/contratos/${id}`)}
            producao
          />
          <ContratosTabela
            titulo="Finalizados"
            itens={contratosFinalizados(lista)}
            onOpen={id => navigate(`/contratos/${id}`)}
          />
        </div>
      )}
    </CrmPageFrame>
  )
}

function ContratosTabela({
  titulo,
  itens,
  onOpen,
  producao = false,
}: {
  titulo: string
  itens: CrmContrato[]
  onOpen: (id: string) => void
  producao?: boolean
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</h2>
      {itens.length === 0 ? (
        <p className="rounded-xl border border-border/60 px-3 py-4 text-sm text-muted-foreground">Nenhum contrato nesta lista.</p>
      ) : (
        <div className={producao ? `${CRM_TABLE_SHELL_CLASS} border-violet-500/30` : CRM_TABLE_SHELL_CLASS}>
          <div className="obra-scroll-x-mobile overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Cliente / Lead</th>
                  <th className="px-3 py-2">Identificador</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Alterado</th>
                </tr>
              </thead>
              <tbody>
                {itens.map(item => (
                  <tr
                    key={item.id}
                    className="cursor-pointer border-t border-border/40 hover:bg-accent/40"
                    onClick={() => onOpen(item.id)}
                  >
                    <td className="px-3 py-2 font-medium text-foreground">
                      {nomeExibicaoContrato(item)}
                      {item.lead_nome && item.lead_nome !== nomeExibicaoContrato(item) && (
                        <span className="ml-2 text-xs text-muted-foreground">{item.lead_nome}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{item.identificador}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${CONTRATO_STATUS_STYLE[item.status] ?? 'border-border text-muted-foreground'}`}>
                        {CONTRATO_STATUS_LABEL[item.status] ?? item.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{fmtDate(item.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}

export function ContratoEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const creating = id === 'novo' || !id
  const { data, loading, error, salvar, criar } = useCrmContratos()
  const contrato = creating ? null : data.contratos.find(c => c.id === id) ?? null
  const [modeloId, setModeloId] = useState('')
  const [cliente, setCliente] = useState('')
  const [identificador, setIdentificador] = useState('')
  const [status, setStatus] = useState<ContratoStatus>('rascunho')
  const [leadId, setLeadId] = useState('')
  const [campos, setCampos] = useState<Record<string, string>>({})
  const [conteudo, setConteudo] = useState('')
  const [hydrated, setHydrated] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState<'preencher' | 'preview'>('preencher')

  const modelo = data.modelos.find(m => m.id === modeloId) ?? data.modelos.find(m => m.ativo) ?? data.modelos[0] ?? null

  useEffect(() => {
    const key = creating ? 'novo' : contrato?.id ?? null
    if (!key || hydrated === key) return
    if (contrato) {
      setCliente(contrato.cliente_nome)
      setIdentificador(contrato.identificador)
      setStatus(contrato.status)
      setLeadId(contrato.lead_id ? String(contrato.lead_id) : '')
      setCampos(contrato.campos_valores)
      setConteudo(contrato.conteudo_final)
      setModeloId(contrato.campos_valores.__modelo_id || data.modelos[0]?.id || '')
    } else if (creating && data.modelos[0]) {
      setModeloId(data.modelos[0].id)
    }
    if (contrato || (creating && (data.modelos.length > 0 || !loading))) setHydrated(key)
  }, [creating, contrato, data.modelos, hydrated, loading])

  if (loading && !creating && !contrato) return <LoadingState variant="page" message="Carregando contrato..." />
  if (error) return <ErrorState message={error} />
  if (!loading && !creating && !contrato) return <EmptyState message="Contrato não encontrado." />

  const regenerar = () => {
    if (!modelo) return
    setConteudo(buildConteudoContrato(modelo.conteudo, { ...campos, nome: cliente, cliente_nome: cliente }))
  }

  const imprimir = () => {
    const w = window.open('', '_blank', 'noopener,noreferrer')
    if (!w) return
    w.document.write(`<!doctype html><html><head><title>${cliente || 'Contrato'}</title></head><body style="font-family:Times,serif;white-space:pre-wrap;padding:32px">${conteudo.replace(/</g, '&lt;')}</body></html>`)
    w.document.close()
    w.focus()
    w.print()
  }

  return (
    <CrmPageFrame padded>
      <CrmPageHeader
        title={creating ? 'Novo contrato' : nomeExibicaoContrato(contrato!)}
        subtitle={identificador || 'Preencha as variáveis do modelo'}
        actions={<Link to="/contratos"><Button variant="outline" size="sm">Lista</Button></Link>}
      />
      <div className="mb-3 flex gap-2">
        <button type="button" className={step === 'preencher' ? 'btn btn-gold btn-sm' : 'btn btn-outline btn-sm'} onClick={() => setStep('preencher')}>
          1. Preencher
        </button>
        <button
          type="button"
          className={step === 'preview' ? 'btn btn-gold btn-sm' : 'btn btn-outline btn-sm'}
          onClick={() => {
            if (!conteudo.trim()) regenerar()
            setStep('preview')
          }}
        >
          2. Preview
        </button>
      </div>
      {step === 'preencher' && (
      <div className="space-y-3 rounded-xl border border-border/80 bg-card p-4">
        <FieldRow>
          <Field label="Modelo" half>
            <select className="glass-input w-full" value={modeloId} onChange={e => setModeloId(e.target.value)}>
              {data.modelos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </Field>
          <Field label="Status" half>
            <select className="glass-input w-full" value={status} onChange={e => setStatus(e.target.value as ContratoStatus)}>
              {Object.entries(CONTRATO_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Cliente" half>
            <input className="glass-input w-full" value={cliente} onChange={e => setCliente(e.target.value)} />
          </Field>
          <Field label="Lead" half>
            <select
              className="glass-input w-full"
              value={leadId}
              onChange={e => {
                setLeadId(e.target.value)
                const lead = data.leads.find(l => String(l.id) === e.target.value)
                if (lead && !cliente) setCliente(lead.nome)
              }}
            >
              <option value="">Sem lead</option>
              {data.leads.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </Field>
        </FieldRow>
        <Field label="Identificador">
          <input className="glass-input w-full" value={identificador} onChange={e => setIdentificador(e.target.value)} />
        </Field>
        {data.variaveis.map(v => (
          <Field key={v.id} label={v.label || v.nome}>
            <input
              className="glass-input w-full"
              value={campos[v.nome] ?? ''}
              onChange={e => setCampos(prev => ({ ...prev, [v.nome]: e.target.value }))}
            />
          </Field>
        ))}
        <button type="button" className="btn btn-outline btn-sm" onClick={() => { regenerar(); setStep('preview') }}>
          <FileText className="h-4 w-4" />
          Pré-visualizar
        </button>
      </div>
      )}
      {step === 'preview' && (
        <div className="space-y-3 rounded-xl border border-border/80 bg-card p-4">
          <Field label="Texto do contrato (A4)">
            <textarea className="glass-input min-h-[320px] w-full font-serif text-sm" value={conteudo} onChange={e => setConteudo(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setStep('preencher')}>Voltar</Button>
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={imprimir}>
              <Printer className="h-4 w-4" />
              Imprimir / PDF
            </Button>
          </div>
        </div>
      )}
      <div className="mt-3">
        <ModalFormFooter
          onCancel={() => navigate('/contratos')}
          submitting={saving}
          onSubmit={() => {
            const nome = cliente.trim() || 'Rascunho'
            const ident = identificador.trim() || gerarIdentificadorContrato(nome)
            const payload = {
              identificador: ident,
              clienteNome: nome,
              leadId: leadId ? Number(leadId) : null,
              campos: { ...campos, __modelo_id: modeloId },
              conteudo,
            }
            setSaving(true)
            const run = creating
              ? criar(payload)
              : salvar({ ...payload, id: contrato!.id, status })
            void run.then(saved => {
              showToast('Contrato salvo.')
              if (creating) navigate(`/contratos/${saved.id}`, { replace: true })
            }).catch(err => {
              showToast(err instanceof Error ? err.message : 'Não foi possível salvar.', 'error')
            }).finally(() => setSaving(false))
          }}
          submitLabel="Salvar contrato"
        />
      </div>
    </CrmPageFrame>
  )
}

export function ContratosConfigPage() {
  const { data, loading, error } = useCrmContratos()
  const [tab, setTab] = useState<'modelos' | 'campos'>('modelos')
  return (
    <CrmPageFrame padded>
      <CrmPageHeader
        title="Configurações de contratos"
        subtitle="Modelos e variáveis já cadastrados. Sem painel multiempresa."
        actions={<Link to="/contratos"><Button variant="outline" size="sm">Voltar</Button></Link>}
      />
      {loading && <LoadingState variant="page" message="Abrindo os modelos..." />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && (
        <>
          <div className="mb-3 flex gap-2">
            <button type="button" className={tab === 'modelos' ? 'btn btn-gold btn-sm' : 'btn btn-outline btn-sm'} onClick={() => setTab('modelos')}>Modelos</button>
            <button type="button" className={tab === 'campos' ? 'btn btn-gold btn-sm' : 'btn btn-outline btn-sm'} onClick={() => setTab('campos')}>Campos variáveis</button>
          </div>
          {tab === 'modelos' && (
            <ul className="space-y-2">
              {data.modelos.map(m => (
                <li key={m.id} className="rounded-xl border border-border/80 p-3">
                  <p className="font-medium">{m.nome}{m.ativo ? '' : ' (inativo)'}</p>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">{m.conteudo.slice(0, 800)}</pre>
                </li>
              ))}
            </ul>
          )}
          {tab === 'campos' && (
            <ul className="divide-y divide-border/50 rounded-xl border border-border/80">
              {data.variaveis.map(v => (
                <li key={v.id} className="px-3 py-2 text-sm">
                  <span className="font-medium">{v.label || v.nome}</span>
                  <span className="ml-2 text-muted-foreground">{v.nome} · {v.tipo}{v.obrigatorio ? ' · obrigatório' : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </CrmPageFrame>
  )
}
