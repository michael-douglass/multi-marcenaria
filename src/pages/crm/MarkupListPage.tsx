import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calculator, Plus, Search, Settings } from 'lucide-react'
import { CrmPageFrame, CrmPageHeader } from '@/components/crm/CrmPageFrame'
import { Button } from '@/components/ui/button'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/EmptyState'
import { MarkupCalculatorSheet } from '@/components/crm/MarkupCalculatorSheet'
import { useCrmMarkup } from '@/hooks/useCrmMarkup'
import { filtrarMarkups } from '@/lib/crm-markup'
import { formatarMoedaMarkup } from '@/lib/markup-calculo'
import type { MarkupOrcamento } from '@/lib/markup-types'
import { fmtDate } from '@/lib/utils'
import { showToast } from '@/lib/toast'
import { Modal } from '@/components/ui/Modal'
import { ModalFormFooter } from '@/components/ui/ModalFormFooter'
import { Field } from '@/components/ui/Field'

export function MarkupListPage() {
  const api = useCrmMarkup()
  const [busca, setBusca] = useState('')
  const [orcamento, setOrcamento] = useState<MarkupOrcamento | null>(null)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [leadId, setLeadId] = useState('')

  const lista = useMemo(
    () => filtrarMarkups(api.data.orcamentos, busca),
    [api.data.orcamentos, busca],
  )

  const abrir = async (id: string) => {
    try {
      setOrcamento(await api.obter(id))
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Não foi possível abrir o markup.', 'error')
    }
  }

  return (
    <CrmPageFrame padded>
      <CrmPageHeader
        title="Markup (custo)"
        subtitle={`${lista.length} de ${api.data.orcamentos.length} orçamentos internos`}
        icon={<Calculator className="h-6 w-6 text-amber-400" />}
        actions={(
          <div className="flex gap-2">
            <Link to="/markup/configuracoes">
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="h-4 w-4" />
                Configurações
              </Button>
            </Link>
            <Button size="sm" className="gap-2" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              Novo markup
            </Button>
          </div>
        )}
        below={(
          <label className="relative block max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="glass-input w-full pl-9"
              placeholder="Buscar título, lead ou status"
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </label>
        )}
      />

      {api.loading && <LoadingState variant="page" message="Carregando markups..." />}
      {!api.loading && api.error && <ErrorState message={api.error} />}
      {!api.loading && !api.error && lista.length === 0 && (
        <EmptyState message="Nenhum markup encontrado. Abra um lead ou crie um novo." />
      )}

      {!api.loading && !api.error && lista.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="obra-scroll-x-mobile overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-[0.7rem] uppercase tracking-wide text-[#b8957f]">
                <tr>
                  <th className="px-3 py-2">Título</th>
                  <th className="px-3 py-2">Lead</th>
                  <th className="px-3 py-2 text-right">Preço final</th>
                  <th className="px-3 py-2">Atualizado</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {lista.map(item => (
                  <tr key={item.id} className="cursor-pointer border-t border-white/5 hover:bg-white/5" onClick={() => void abrir(item.id)}>
                    <td className="px-3 py-2 font-medium text-[#f2d892]">{item.titulo}</td>
                    <td className="px-3 py-2 text-[#edd9c4]">{item.lead_nome ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-semibold text-emerald-300">{formatarMoedaMarkup(item.preco_final)}</td>
                    <td className="px-3 py-2 text-[#b8957f]">{fmtDate(item.atualizado_em)}</td>
                    <td className="px-3 py-2 capitalize text-[#d4bc9f]">{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <MarkupCalculatorSheet
        open={!!orcamento}
        orcamento={orcamento}
        config={api.data.config}
        produtos={api.data.produtos}
        categorias={api.data.categorias}
        despesas={api.data.despesas}
        servicos={api.data.servicos}
        saving={saving}
        onClose={() => setOrcamento(null)}
        onSave={async input => {
          setSaving(true)
          try {
            await api.salvar(input)
            setOrcamento(null)
          } finally {
            setSaving(false)
          }
        }}
      />

      <Modal open={creating} onClose={() => setCreating(false)} title="Novo markup" closeOnBackdrop={false}>
        <Field label="Lead">
          <select className="glass-input w-full" value={leadId} onChange={e => setLeadId(e.target.value)}>
            <option value="">Sem lead</option>
            {api.data.leads.map(lead => (
              <option key={lead.id} value={lead.id}>{lead.nome}</option>
            ))}
          </select>
        </Field>
        <ModalFormFooter
          onCancel={() => setCreating(false)}
          onSubmit={() => {
            void api.criar(leadId ? Number(leadId) : null).then(created => {
              setCreating(false)
              setOrcamento(created)
              showToast('Markup criado.')
            }).catch(err => {
              showToast(err instanceof Error ? err.message : 'Não foi possível criar.', 'error')
            })
          }}
          submitLabel="Criar"
        />
      </Modal>
    </CrmPageFrame>
  )
}

export function MarkupConfigPage() {
  const api = useCrmMarkup()
  const [tab, setTab] = useState<'produtos' | 'parametros' | 'despesas' | 'servicos' | 'ia'>('produtos')
  const [nomeProduto, setNomeProduto] = useState('')
  const [preco, setPreco] = useState('')
  const [unidade, setUnidade] = useState('un')
  const [categoriaId, setCategoriaId] = useState('')
  const [novaCategoria, setNovaCategoria] = useState('')

  const cfg = api.data.config

  return (
    <CrmPageFrame padded>
      <CrmPageHeader
        title="Configurações do markup"
        subtitle="Produtos, parâmetros, despesas, mão de obra e IA — sem misturar com o Caixa"
        icon={<Settings className="h-6 w-6 text-amber-400" />}
        actions={(
          <Link to="/markup">
            <Button variant="outline" size="sm" className="gap-2">
              <Calculator className="h-4 w-4" />
              Voltar à lista
            </Button>
          </Link>
        )}
      />

      {api.loading && <LoadingState variant="page" message="Carregando catálogo..." />}
      {!api.loading && api.error && <ErrorState message={api.error} />}

      {!api.loading && !api.error && (
        <>
          <div className="flex flex-wrap gap-2">
            {(['produtos', 'parametros', 'despesas', 'servicos', 'ia'] as const).map(item => (
              <button
                key={item}
                type="button"
                className={tab === item ? 'btn btn-gold btn-sm' : 'btn btn-outline btn-sm'}
                onClick={() => setTab(item)}
              >
                {item === 'produtos' ? 'Produtos' : item === 'parametros' ? 'Parâmetros' : item === 'despesas' ? 'Despesas' : item === 'servicos' ? 'Serviços' : 'IA'}
              </button>
            ))}
          </div>

          {tab === 'produtos' && (
            <div className="glass-card space-y-4 p-4">
              <div className="flex flex-wrap gap-2">
                <input className="glass-input flex-1" placeholder="Nova categoria" value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)} />
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    if (!novaCategoria.trim()) return
                    void api.salvarCategoria(novaCategoria.trim()).then(() => {
                      setNovaCategoria('')
                      showToast('Categoria criada.')
                    }).catch(err => showToast(err instanceof Error ? err.message : 'Erro ao salvar.', 'error'))
                  }}
                >
                  Adicionar categoria
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                <select className="glass-input" value={categoriaId} onChange={e => setCategoriaId(e.target.value)}>
                  <option value="">Categoria</option>
                  {api.data.categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                <input className="glass-input" placeholder="Nome" value={nomeProduto} onChange={e => setNomeProduto(e.target.value)} />
                <input className="glass-input" placeholder="Preço" value={preco} onChange={e => setPreco(e.target.value)} />
                <div className="flex gap-2">
                  <input className="glass-input w-20" placeholder="Un" value={unidade} onChange={e => setUnidade(e.target.value)} />
                  <button
                    type="button"
                    className="btn btn-gold btn-sm"
                    onClick={() => {
                      if (!nomeProduto.trim()) return
                      void api.salvarProduto({
                        categoriaId: categoriaId || null,
                        nome: nomeProduto.trim(),
                        preco: Number(preco.replace(',', '.')) || 0,
                        unidade,
                      }).then(() => {
                        setNomeProduto('')
                        setPreco('')
                        showToast('Produto salvo.')
                      }).catch(err => showToast(err instanceof Error ? err.message : 'Erro ao salvar.', 'error'))
                    }}
                  >
                    Salvar
                  </button>
                </div>
              </div>
              <p className="text-xs text-[#b8957f]">{api.data.produtos.length} produtos no catálogo</p>
              <div className="max-h-[360px] overflow-y-auto text-sm">
                {api.data.produtos.slice(0, 80).map(p => (
                  <div key={p.id} className="flex justify-between border-t border-white/5 py-1 text-[#edd9c4]">
                    <span>{p.nome}{p.variacao ? ` · ${p.variacao}` : ''}</span>
                    <span className="text-emerald-300">{formatarMoedaMarkup(Number(p.preco_unitario ?? 0))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'parametros' && (
            <ParametrosForm
              valorHora={cfg.valor_hora_marcenaria}
              sobras={cfg.fator_sobras}
              margem={cfg.margem_lucro}
              imposto={cfg.percentual_imposto}
              taxas={cfg.taxas_financeiras}
              frete={cfg.custo_frete_padrao}
              rodape={cfg.rodape_observacoes_padrao}
              onSave={values => {
                void api.salvarConfig(values).then(() => showToast('Parâmetros salvos.')).catch(err => {
                  showToast(err instanceof Error ? err.message : 'Erro ao salvar.', 'error')
                })
              }}
            />
          )}

          {tab === 'despesas' && (
            <div className="glass-card space-y-2 p-4 text-sm">
              {api.data.despesas.map(d => (
                <div key={d.id} className="flex justify-between text-[#edd9c4]">
                  <span>{d.nome}</span>
                  <span>{formatarMoedaMarkup(Number(d.valor_padrao))}</span>
                </div>
              ))}
            </div>
          )}

          {tab === 'servicos' && (
            <div className="glass-card space-y-2 p-4 text-sm">
              {api.data.servicos.map(s => (
                <div key={s.id} className="flex justify-between text-[#edd9c4]">
                  <span>{s.nome}</span>
                  <span>{formatarMoedaMarkup(Number(s.valor_hora_padrao))}/h</span>
                </div>
              ))}
            </div>
          )}

          {tab === 'ia' && (
            <div className="glass-card space-y-2 p-4 text-sm text-muted-foreground">
              <p>Os prompts de copy e a geração com IA ficam no <strong className="text-foreground">Marketing de conteúdo</strong> (botão “Gerar com IA” no card).</p>
              <p>Aqui o markup usa só catálogo, parâmetros, despesas e mão de obra — como no original, a aba IA não mistura com o Caixa.</p>
            </div>
          )}
        </>
      )}
    </CrmPageFrame>
  )
}

function ParametrosForm({
  valorHora,
  sobras,
  margem,
  imposto,
  taxas,
  frete,
  rodape,
  onSave,
}: {
  valorHora: number
  sobras: number
  margem: number
  imposto: number
  taxas: number
  frete: number
  rodape: string
  onSave: (input: { valorHora: number; fatorSobras: number; margemLucro: number; imposto: number; taxas: number; frete: number; rodape: string }) => void
}) {
  const [form, setForm] = useState({ valorHora, sobras, margem, imposto, taxas, frete, rodape })
  return (
    <div className="glass-card grid gap-3 p-4 sm:grid-cols-2">
      {([
        ['valorHora', 'Valor/hora'],
        ['sobras', 'Sobras %'],
        ['margem', 'Margem %'],
        ['imposto', 'Imposto %'],
        ['taxas', 'Taxas %'],
        ['frete', 'Frete padrão'],
      ] as const).map(([key, label]) => (
        <Field key={key} label={label}>
          <input
            className="glass-input w-full"
            type="number"
            value={form[key]}
            onChange={e => setForm(prev => ({ ...prev, [key]: Number(e.target.value) || 0 }))}
          />
        </Field>
      ))}
      <div className="sm:col-span-2">
        <Field label="Rodapé padrão">
          <textarea className="glass-input w-full" rows={3} value={form.rodape} onChange={e => setForm(prev => ({ ...prev, rodape: e.target.value }))} />
        </Field>
      </div>
      <button
        type="button"
        className="btn btn-gold btn-md sm:col-span-2"
        onClick={() => onSave({
          valorHora: form.valorHora,
          fatorSobras: form.sobras,
          margemLucro: form.margem,
          imposto: form.imposto,
          taxas: form.taxas,
          frete: form.frete,
          rodape: form.rodape,
        })}
      >
        Salvar parâmetros
      </button>
    </div>
  )
}
