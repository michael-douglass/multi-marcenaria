import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Field } from '@/components/ui/Field'
import type { useMarkupCatalogo } from '@/hooks/useMarkupCatalogo'
import { draftsFromMarkup, type PedidoItemDraft } from '@/hooks/usePedidosObras'
import {
  itemLabel,
  linhaFromCatalogo,
  linhaMarkupAvulsa,
  linhasAtivas,
} from '@/lib/pedidos-obras'
import { fmtCur } from '@/lib/utils'
import type { MarkupLinhaProduto } from '@/types'

type CatalogoApi = ReturnType<typeof useMarkupCatalogo>

interface PedidoItensAPedirEditorProps {
  linhasIniciais: MarkupLinhaProduto[]
  catalogo: CatalogoApi
  canEdit: boolean
  saving: boolean
  onSalvarMarkup: (linhas: MarkupLinhaProduto[]) => Promise<void>
  onEnviarPedido: (itens: PedidoItemDraft[]) => Promise<void>
}

export function PedidoItensAPedirEditor({
  linhasIniciais,
  catalogo,
  canEdit,
  saving,
  onSalvarMarkup,
  onEnviarPedido,
}: PedidoItensAPedirEditorProps) {
  const [linhas, setLinhas] = useState<MarkupLinhaProduto[]>(linhasIniciais)
  const [precosFeitos, setPrecosFeitos] = useState<number[]>(
    () => linhasIniciais.map(l => l.valor_unitario),
  )
  const [nomeAvulso, setNomeAvulso] = useState('')
  const [qtdAvulsa, setQtdAvulsa] = useState('1')
  const [precoAvulso, setPrecoAvulso] = useState('')

  useEffect(() => {
    if (linhas.length > 0 || linhasIniciais.length === 0) return
    setLinhas(linhasIniciais)
    setPrecosFeitos(linhasIniciais.map(l => l.valor_unitario))
  }, [linhas.length, linhasIniciais])

  const updateLinha = (idx: number, patch: Partial<MarkupLinhaProduto>) => {
    setLinhas(prev => prev.map((linha, i) => {
      if (i !== idx) return linha
      const next = { ...linha, ...patch }
      next.valor_total = next.quantidade * next.valor_unitario
      return next
    }))
  }

  const addLinha = (linha: MarkupLinhaProduto) => {
    setLinhas(prev => [...prev, linha])
    setPrecosFeitos(prev => [...prev, linha.valor_unitario])
  }

  const removeLinha = (idx: number) => {
    setLinhas(prev => prev.filter((_, i) => i !== idx))
    setPrecosFeitos(prev => prev.filter((_, i) => i !== idx))
  }

  const totalMarkup = useMemo(
    () => linhas.filter(l => l.ativo).reduce((s, l) => s + l.quantidade * l.valor_unitario, 0),
    [linhas],
  )
  const totalPedido = useMemo(
    () => linhas.reduce((s, l, i) => {
      if (!l.ativo) return s
      return s + l.quantidade * (precosFeitos[i] ?? l.valor_unitario)
    }, 0),
    [linhas, precosFeitos],
  )

  const itensParaPedido = (): PedidoItemDraft[] => {
    const ativasComPreco = linhas
      .map((linha, idx) => ({ linha, feito: precosFeitos[idx] ?? linha.valor_unitario }))
      .filter(x => x.linha.ativo)
    const precos: Record<string, number> = {}
    ativasComPreco.forEach((x, idx) => {
      const key = x.linha.produto_id ?? `${x.linha.descricao}-${idx}`
      precos[key] = x.feito
    })
    return draftsFromMarkup(ativasComPreco.map(x => x.linha), precos)
  }

  const handleAddAvulso = () => {
    if (!nomeAvulso.trim()) return
    addLinha(linhaMarkupAvulsa(
      nomeAvulso,
      parseFloat(qtdAvulsa) || 1,
      parseFloat(precoAvulso) || 0,
    ))
    setNomeAvulso('')
    setQtdAvulsa('1')
    setPrecoAvulso('')
  }

  if (!canEdit) {
    return (
      <p className="text-[0.72rem] text-[#c4a882]">
        Sem permissão para montar itens neste lead.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {linhas.length === 0 && (
        <p className="text-[0.72rem] text-[#c4a882]">
          Nenhum item ainda. Escolha no catálogo ou digite um item abaixo.
        </p>
      )}

      {linhas.length > 0 && (
        <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-0.5">
          {linhas.map((linha, idx) => (
            <li
              key={`${linha.produto_id ?? linha.descricao}-${idx}`}
              className="rounded-lg border border-[rgba(74,222,128,0.22)] bg-[rgba(74,222,128,0.06)] p-2"
            >
              <div className="mb-1.5 flex items-start justify-between gap-2">
                <label className="flex min-w-0 items-center gap-2 text-[0.72rem] text-[#fffaf4]">
                  <input
                    type="checkbox"
                    checked={linha.ativo}
                    onChange={e => updateLinha(idx, { ativo: e.target.checked })}
                  />
                  <span className="truncate">{itemLabel(linha)}</span>
                </label>
                <button
                  type="button"
                  className="shrink-0 rounded p-1 text-[#c4a882] hover:bg-red-500/10 hover:text-red-400"
                  aria-label="Remover item"
                  onClick={() => removeLinha(idx)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <label className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[0.58rem] uppercase tracking-wide text-[#c4a882]">Qtd</span>
                  <input
                    className="glass-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={linha.quantidade}
                    onChange={e => updateLinha(idx, { quantidade: parseFloat(e.target.value) || 0 })}
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[0.58rem] uppercase tracking-wide text-[#c4a882]">Markup</span>
                  <input
                    className="glass-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={linha.valor_unitario}
                    onChange={e => {
                      const valor_unitario = parseFloat(e.target.value) || 0
                      updateLinha(idx, { valor_unitario })
                    }}
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[0.58rem] uppercase tracking-wide text-[#c4a882]">Preço feito</span>
                  <input
                    className="glass-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={precosFeitos[idx] ?? linha.valor_unitario}
                    onChange={e => {
                      const value = parseFloat(e.target.value) || 0
                      setPrecosFeitos(prev => prev.map((p, i) => i === idx ? value : p))
                    }}
                  />
                </label>
              </div>
              <p className="mt-1 text-right text-[0.68rem] font-semibold text-[#4ade80]">
                {fmtCur(linha.quantidade * (precosFeitos[idx] ?? linha.valor_unitario))}
              </p>
            </li>
          ))}
        </ul>
      )}

      {catalogo.produtos.length > 0 && (
        <Field label="Adicionar do catálogo">
          <select
            className="glass-input"
            defaultValue=""
            onChange={e => {
              const produto = catalogo.produtos.find(p => p.id === e.target.value)
              if (produto) addLinha(linhaFromCatalogo(produto))
              e.target.value = ''
            }}
          >
            <option value="">Escolher produto…</option>
            {catalogo.produtos.filter(p => p.ativo).map(p => (
              <option key={p.id} value={p.id}>
                {p.nome}{p.variacao ? ` · ${p.variacao}` : ''} — {fmtCur(Number(p.preco_unitario))}
              </option>
            ))}
          </select>
        </Field>
      )}

      <div className="rounded-lg border border-[rgba(240,210,140,0.16)] p-2">
        <p className="mb-1.5 text-[0.62rem] uppercase tracking-wide text-[#c4a882]">
          Item avulso (nome + markup)
        </p>
        <div className="grid grid-cols-12 gap-1.5">
          <input
            className="glass-input col-span-12 sm:col-span-5"
            placeholder="Nome do item"
            value={nomeAvulso}
            onChange={e => setNomeAvulso(e.target.value)}
          />
          <input
            className="glass-input col-span-4 sm:col-span-2"
            type="number"
            min="0"
            step="0.01"
            placeholder="Qtd"
            value={qtdAvulsa}
            onChange={e => setQtdAvulsa(e.target.value)}
          />
          <input
            className="glass-input col-span-5 sm:col-span-3"
            type="number"
            min="0"
            step="0.01"
            placeholder="Markup un."
            value={precoAvulso}
            onChange={e => setPrecoAvulso(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-outline btn-sm col-span-3 sm:col-span-2 inline-flex items-center justify-center gap-1"
            disabled={!nomeAvulso.trim()}
            onClick={handleAddAvulso}
          >
            <Plus size={12} />
            Add
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[0.75rem]">
        <span className="text-[#c4a882]">Markup {fmtCur(totalMarkup)}</span>
        <span className="font-semibold text-[#4ade80]">Pedido {fmtCur(totalPedido)}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          disabled={saving || linhas.length === 0}
          onClick={() => void onSalvarMarkup(linhas)}
        >
          {saving ? 'Salvando…' : 'Salvar no markup'}
        </button>
        <button
          type="button"
          className="btn btn-gold btn-sm"
          disabled={saving || linhasAtivas(linhas).length === 0}
          onClick={() => {
            void (async () => {
              await onSalvarMarkup(linhas)
              await onEnviarPedido(itensParaPedido())
            })()
          }}
        >
          Enviar para pedido
        </button>
      </div>
    </div>
  )
}
