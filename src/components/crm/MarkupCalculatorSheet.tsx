import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { ModalFormFooter } from '@/components/ui/ModalFormFooter'
import { Field, FieldRow } from '@/components/ui/Field'
import {
  aplicarConfiguracaoFixaNosModulos,
  arredondar,
  calcularDescontoPercentFromPrecoAlvo,
  formatarMoedaMarkup,
  recalcularModulos,
} from '@/lib/markup-calculo'
import { agrupatProdutosPorCategoria } from '@/lib/crm-markup'
import { calcularCustoServicoHoras, resolverValorHoraLinhaServico } from '@/lib/markup-servicos'
import type {
  MarkupCategoria,
  MarkupConfig,
  MarkupDespesaTemplate,
  MarkupLinhaProduto,
  MarkupModulos,
  MarkupOrcamento,
  MarkupProduto,
  MarkupServicoTemplate,
} from '@/lib/markup-types'
import { showToast } from '@/lib/toast'
import { MarkupAuditorLucro } from '@/components/markup/MarkupAuditorLucro'
import { useAuth } from '@/contexts/AuthContext'
import { podeVerMarkupResumo } from '@/lib/markup-auditor-lucro'

interface MarkupCalculatorSheetProps {
  open: boolean
  orcamento: MarkupOrcamento | null
  config: MarkupConfig
  produtos: MarkupProduto[]
  categorias: MarkupCategoria[]
  despesas: MarkupDespesaTemplate[]
  servicos: MarkupServicoTemplate[]
  saving?: boolean
  onClose: () => void
  onSave: (input: {
    id: string
    titulo: string
    status: string
    modulos: MarkupModulos
    observacoes: string
    leadId: number | null
  }) => Promise<void>
}

type Aba = 'materiais' | 'servicos' | 'despesas' | 'resumo'

export function MarkupCalculatorSheet({
  open,
  orcamento,
  config,
  produtos,
  categorias,
  despesas,
  servicos,
  saving = false,
  onClose,
  onSave,
}: MarkupCalculatorSheetProps) {
  const { userRole, isSuperAdmin } = useAuth()
  const podeVerResumo = podeVerMarkupResumo(userRole, isSuperAdmin)
  const [titulo, setTitulo] = useState('')
  const [status, setStatus] = useState('rascunho')
  const [observacoes, setObservacoes] = useState('')
  const [modulos, setModulos] = useState<MarkupModulos | null>(null)
  const [busca, setBusca] = useState('')
  const [aba, setAba] = useState<Aba>('materiais')

  useEffect(() => {
    if (!open || !orcamento) return
    setTitulo(orcamento.titulo)
    setStatus(orcamento.status)
    setObservacoes(orcamento.observacoes_rodape)
    setModulos(recalcularModulos(aplicarConfiguracaoFixaNosModulos(config, orcamento.modulos)))
    setAba('materiais')
    setBusca('')
  }, [open, orcamento, config])

  useEffect(() => {
    if (!podeVerResumo && aba === 'resumo') setAba('materiais')
  }, [podeVerResumo, aba])

  const grupos = useMemo(
    () => agrupatProdutosPorCategoria(produtos, categorias, busca),
    [produtos, categorias, busca],
  )

  const patch = (updater: (current: MarkupModulos) => MarkupModulos) => {
    setModulos(current => current ? recalcularModulos(updater(current)) : current)
  }

  const qtdPorProduto = useMemo(() => {
    const map = new Map<string, number>()
    for (const linha of modulos?.materiais.linhas ?? []) {
      if (linha.produto_id) map.set(linha.produto_id, linha.quantidade)
    }
    return map
  }, [modulos])

  const setQuantidadeProduto = (produto: MarkupProduto, quantidade: number) => {
    patch(current => {
      const linhas = [...current.materiais.linhas]
      const idx = linhas.findIndex(l => l.produto_id === produto.id)
      if (quantidade <= 0) {
        return { ...current, materiais: { ...current.materiais, linhas: linhas.filter(l => l.produto_id !== produto.id) } }
      }
      const linha: MarkupLinhaProduto = {
        produto_id: produto.id,
        descricao: produto.nome,
        variacao: produto.variacao,
        unidade: produto.unidade,
        categoria: produto.categoria ?? null,
        quantidade,
        valor_unitario: Number(produto.preco_unitario ?? 0),
        valor_total: arredondar(quantidade * Number(produto.preco_unitario ?? 0)),
        ativo: true,
      }
      if (idx >= 0) linhas[idx] = { ...linhas[idx], ...linha }
      else linhas.push(linha)
      return { ...current, materiais: { ...current.materiais, linhas } }
    })
  }

  if (!orcamento || !modulos) {
    return (
      <Modal open={open} onClose={onClose} title="Markup" extraWide closeOnBackdrop={false}>
        <p className="text-sm text-[#d4bc9f]">Carregando calculadora...</p>
      </Modal>
    )
  }

  const totais = modulos.totais

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={titulo || 'Markup'}
      extraWide
      closeOnBackdrop={false}
      headerExtra={(
        <div className="flex items-center gap-3">
          <MarkupAuditorLucro
            custoMateriais={totais.custo_materiais}
            precoFinal={totais.preco_final}
          />
          <p className="text-sm font-semibold text-emerald-300">
            Preço final {formatarMoedaMarkup(totais.preco_final)}
          </p>
        </div>
      )}
    >
      <FieldRow>
        <Field label="Título" half>
          <input className="glass-input w-full" value={titulo} onChange={e => setTitulo(e.target.value)} />
        </Field>
        <Field label="Status" half>
          <select className="glass-input w-full" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="rascunho">Rascunho</option>
            <option value="finalizado">Finalizado</option>
          </select>
        </Field>
      </FieldRow>

      <div className="mb-3 flex flex-wrap gap-2">
        {(
          podeVerResumo
            ? (['materiais', 'servicos', 'despesas', 'resumo'] as const)
            : (['materiais', 'servicos', 'despesas'] as const)
        ).map(item => (
          <button
            key={item}
            type="button"
            className={aba === item ? 'btn btn-gold btn-sm' : 'btn btn-outline btn-sm'}
            onClick={() => setAba(item)}
          >
            {item === 'materiais' ? 'Materiais' : item === 'servicos' ? 'Serviços' : item === 'despesas' ? 'Despesas' : 'Resumo'}
          </button>
        ))}
      </div>

      {aba === 'materiais' && (
        <div className="space-y-3">
          <input
            className="glass-input w-full"
            placeholder="Buscar produto do catálogo"
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
          <div className="max-h-[280px] space-y-3 overflow-y-auto rounded-lg border border-[rgba(240,210,140,0.12)] p-2">
            {grupos.map(grupo => (
              <div key={grupo.categoria}>
                <p className="mb-1 text-[0.65rem] font-bold uppercase tracking-wide text-[#f2d892]">{grupo.categoria}</p>
                {grupo.items.map(produto => (
                  <div key={produto.id} className="flex items-center gap-2 py-1 text-sm">
                    <span className="min-w-0 flex-1 truncate text-[#edd9c4]">
                      {produto.nome}{produto.variacao ? ` · ${produto.variacao}` : ''}
                    </span>
                    <span className="shrink-0 text-xs text-[#b8957f]">{formatarMoedaMarkup(Number(produto.preco_unitario ?? 0))}</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      className="glass-input w-16 text-right"
                      value={qtdPorProduto.get(produto.id) ?? ''}
                      onChange={e => setQuantidadeProduto(produto, Number(e.target.value) || 0)}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
          <p className="text-xs text-[#b8957f]">
            Materiais: {formatarMoedaMarkup(totais.custo_materiais)} · com sobras {formatarMoedaMarkup(totais.custo_materiais_ajustado)}
          </p>
        </div>
      )}

      {aba === 'servicos' && (
        <div className="space-y-2">
          {(servicos.filter(s => s.ativo !== false).length ? servicos.filter(s => s.ativo !== false) : servicos).map(template => {
            const linha = modulos.servicos.linhas.find(l => l.template_id === template.id || l.descricao === template.nome)
            const horas = linha?.horas ?? 0
            const valorHora = resolverValorHoraLinhaServico(linha ?? { descricao: template.nome, horas: 0, valor_hora: template.valor_hora_padrao }, modulos.servicos.valor_hora)
            return (
              <div key={template.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-[#edd9c4]">{template.nome}</span>
                <span className="shrink-0 text-xs text-[#b8957f]">{formatarMoedaMarkup(valorHora)}/h</span>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  className="glass-input w-20 text-right"
                  value={horas || ''}
                  onChange={e => {
                    const nextHoras = Number(e.target.value) || 0
                    patch(current => {
                      const linhas = [...current.servicos.linhas]
                      const idx = linhas.findIndex(l => l.template_id === template.id || l.descricao === template.nome)
                      const next = {
                        template_id: template.id,
                        descricao: template.nome,
                        horas: nextHoras,
                        valor_hora: valorHora,
                        ativo: true,
                      }
                      if (idx >= 0) linhas[idx] = next
                      else linhas.push(next)
                      return { ...current, servicos: { ...current.servicos, linhas } }
                    })
                  }}
                />
                <span className="w-24 shrink-0 text-right text-xs text-emerald-300">
                  {formatarMoedaMarkup(calcularCustoServicoHoras(horas, valorHora))}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {aba === 'despesas' && (
        <div className="space-y-2">
          {despesas.map(template => {
            const linha = modulos.despesas.find(d => d.template_id === template.id || d.descricao === template.nome)
            const ativo = linha?.ativo ?? false
            const valor = linha?.valor ?? template.valor_padrao
            return (
              <label key={template.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={ativo}
                  onChange={e => {
                    const checked = e.target.checked
                    patch(current => {
                      const linhas = [...current.despesas]
                      const idx = linhas.findIndex(d => d.template_id === template.id || d.descricao === template.nome)
                      const next = { template_id: template.id, descricao: template.nome, valor: Number(valor) || 0, ativo: checked }
                      if (idx >= 0) linhas[idx] = next
                      else linhas.push(next)
                      return { ...current, despesas: linhas }
                    })
                  }}
                />
                <span className="min-w-0 flex-1 truncate text-[#edd9c4]">{template.nome}</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="glass-input w-28 text-right"
                  value={valor || ''}
                  onChange={e => {
                    const nextValor = Number(e.target.value) || 0
                    patch(current => {
                      const linhas = [...current.despesas]
                      const idx = linhas.findIndex(d => d.template_id === template.id || d.descricao === template.nome)
                      const next = { template_id: template.id, descricao: template.nome, valor: nextValor, ativo }
                      if (idx >= 0) linhas[idx] = next
                      else linhas.push(next)
                      return { ...current, despesas: linhas }
                    })
                  }}
                />
              </label>
            )
          })}
        </div>
      )}

      {podeVerResumo && aba === 'resumo' && (
        <div className="space-y-3">
          <FieldRow>
            <Field label="Sobras %" half>
              <input
                type="number"
                className="glass-input w-full"
                value={modulos.margem.fator_sobras}
                onChange={e => patch(current => ({
                  ...current,
                  margem: { ...current.margem, fator_sobras: Number(e.target.value) || 0 },
                  materiais: { ...current.materiais, fator_sobras: Number(e.target.value) || 0 },
                }))}
              />
            </Field>
            <Field label="Margem %" half>
              <input
                type="number"
                className="glass-input w-full"
                value={modulos.margem.margem_lucro}
                onChange={e => patch(current => ({
                  ...current,
                  margem: { ...current.margem, margem_lucro: Number(e.target.value) || 0 },
                }))}
              />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Imposto %" half>
              <input
                type="number"
                className="glass-input w-full"
                value={modulos.impostos.percentual_imposto}
                onChange={e => patch(current => ({
                  ...current,
                  impostos: { ...current.impostos, percentual_imposto: Number(e.target.value) || 0 },
                }))}
              />
            </Field>
            <Field label="Taxas %" half>
              <input
                type="number"
                className="glass-input w-full"
                value={modulos.impostos.taxas_financeiras}
                onChange={e => patch(current => ({
                  ...current,
                  impostos: { ...current.impostos, taxas_financeiras: Number(e.target.value) || 0 },
                }))}
              />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Frete (R$)" half>
              <input
                type="number"
                className="glass-input w-full"
                value={modulos.margem.custo_frete}
                onChange={e => patch(current => ({
                  ...current,
                  margem: { ...current.margem, custo_frete: Number(e.target.value) || 0 },
                }))}
              />
            </Field>
            <Field label="Preço final desejado (R$)" half>
              <input
                type="number"
                className="glass-input w-full"
                value={totais.preco_final}
                onChange={e => {
                  const alvo = Number(e.target.value) || 0
                  patch(current => ({
                    ...current,
                    margem: {
                      ...current.margem,
                      desconto_final_percent: calcularDescontoPercentFromPrecoAlvo(current.totais.preco_final_bruto, alvo),
                    },
                  }))
                }}
              />
            </Field>
          </FieldRow>
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-[#edd9c4]">
            <p>Materiais: {formatarMoedaMarkup(totais.custo_materiais_ajustado)}</p>
            <p>Serviços: {formatarMoedaMarkup(totais.custo_servicos)}</p>
            <p>Despesas: {formatarMoedaMarkup(totais.custo_despesas)}</p>
            <p>Com impostos: {formatarMoedaMarkup(totais.custo_com_impostos)}</p>
            <p className="mt-2 text-base font-semibold text-emerald-300">Preço final: {formatarMoedaMarkup(totais.preco_final)}</p>
          </div>
          <Field label="Observações do rodapé">
            <textarea className="glass-input w-full" rows={3} value={observacoes} onChange={e => setObservacoes(e.target.value)} />
          </Field>
        </div>
      )}

      <ModalFormFooter
        onCancel={onClose}
        onSubmit={() => {
          void onSave({
            id: orcamento.id,
            titulo,
            status,
            modulos,
            observacoes,
            leadId: orcamento.lead_id,
          }).then(() => showToast('Markup salvo.')).catch(err => {
            showToast(err instanceof Error ? err.message : 'Não foi possível salvar.', 'error')
          })
        }}
        submitLabel="Salvar markup"
        submitting={saving}
      />
    </Modal>
  )
}
