import { useEffect, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useObras } from '@/hooks/useObras'
import { useTiposObra } from '@/hooks/useTiposObra'
import { useGruposObra } from '@/hooks/useGruposObra'
import { useApp } from '@/context/AppContext'
import { ObraDetalheModal } from '@/components/obras/ObraDetalheModal'
import { ObraFormModal } from '@/components/obras/ObraFormModal'
import { ObraPageHeader } from '@/components/obras/ObraPageHeader'
import { ChegadaMaterialCalendario } from '@/components/obras/ChegadaMaterialCalendario'
import { LoadingState, ErrorState } from '@/components/ui/EmptyState'
import { KanbanPageToolbar, PageZoomProvider } from '@/components/page-zoom'
import { canEditObras, canDeleteObras } from '@/lib/obra-permissions'
import type { ObraFull, ObraInput } from '@/types'

const BLANK_OBRA: ObraInput = {
  cliente_nome: '', cliente_id: null, lousa: null, descricao: null, endereco_obra: null,
  tipo_obra_id: null, grupo_obra_id: null, montador_admin_id: null, montador_id: null, montador_ids: [],
  data_prevista_inicio: null, data_prevista_fim: null, tempo_maximo_horas: null,
  status_kanban: 'datas_em_aberto', pedido_material_feito: false, data_entrega_pedido: null,
  numero_pedido_cort_claud: null,
  comissao_habilitada: false, comissao_itens: [],
}

export function ChegadaMateriaisCalendario() {
  return (
    <PageZoomProvider pageKey="calendario_chegada_materiais">
      <ChegadaMateriaisCalendarioContent />
    </PageZoomProvider>
  )
}

function ChegadaMateriaisCalendarioContent() {
  const { roles } = useApp()
  const obrasHook = useObras()
  const tiposHook = useTiposObra()
  const gruposHook = useGruposObra()
  const canEdit = canEditObras(roles)
  const canDelete = canDeleteObras(roles)

  const [viewDate, setViewDate] = useState(() => new Date())
  const [busca, setBusca] = useState('')
  const [detalheObra, setDetalheObra] = useState<ObraFull | null>(null)
  const [editObra, setEditObra] = useState<ObraFull | null>(null)
  const [obraOpen, setObraOpen] = useState(false)
  const [obraForm, setObraForm] = useState<ObraInput>(BLANK_OBRA)
  const [savingObra, setSavingObra] = useState(false)
  const [togglingPedidoMaterial, setTogglingPedidoMaterial] = useState<string | null>(null)
  const [updatingDataEntrega, setUpdatingDataEntrega] = useState<string | null>(null)

  const obrasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return obrasHook.data
    return obrasHook.data.filter(o => {
      const haystack = [
        o.cliente_nome,
        o.lousa,
        o.endereco_obra,
        o.tipo_obra_nome,
        o.grupo_obra_nome,
        o.montador_nome,
        o.montador_admin_nome,
        o.numero_pedido_cort_claud,
        o.data_entrega_pedido,
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [obrasHook.data, busca])

  useEffect(() => {
    if (!detalheObra) return
    const fresh = obrasHook.data.find(o => o.id === detalheObra.id)
    if (fresh) setDetalheObra(fresh)
    else setDetalheObra(null)
  }, [obrasHook.data, detalheObra?.id])

  const handleUpdateDataEntrega = async (obra: ObraFull, data: string | null) => {
    if (!canEdit) return
    setUpdatingDataEntrega(obra.id)
    try {
      await obrasHook.update(obra.id, {
        pedido_material_feito: true,
        data_entrega_pedido: data,
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível atualizar a data de chegada.')
    } finally {
      setUpdatingDataEntrega(null)
    }
  }

  const handleTogglePedidoMaterial = async (obra: ObraFull, feito: boolean) => {
    if (!canEdit) return
    setTogglingPedidoMaterial(obra.id)
    try {
      await obrasHook.update(obra.id, {
        pedido_material_feito: feito,
        data_entrega_pedido: feito ? obra.data_entrega_pedido : null,
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível atualizar o pedido de material.')
    } finally {
      setTogglingPedidoMaterial(null)
    }
  }

  const openEdit = (obra: ObraFull) => {
    setEditObra(obra)
    setObraForm({
      cliente_nome: obra.cliente_nome,
      cliente_id: obra.cliente_id,
      lousa: obra.lousa,
      descricao: obra.descricao,
      endereco_obra: obra.endereco_obra,
      tipo_obra_id: obra.tipo_obra_id,
      grupo_obra_id: obra.grupo_obra_id,
      montador_admin_id: obra.montador_admin_id,
      montador_id: obra.montador_id,
      montador_ids: obra.montador_ids ?? [],
      data_prevista_inicio: obra.data_prevista_inicio,
      data_prevista_fim: obra.data_prevista_fim,
      tempo_maximo_horas: obra.tempo_maximo_horas,
      status_kanban: obra.status_kanban,
      pedido_material_feito: obra.pedido_material_feito,
      data_entrega_pedido: obra.data_entrega_pedido,
      numero_pedido_cort_claud: obra.numero_pedido_cort_claud,
      comissao_habilitada: obra.comissao_habilitada,
      comissao_itens: obra.comissao_itens ?? [],
    })
    setObraOpen(true)
  }

  const saveObra = async () => {
    if (!editObra) return
    setSavingObra(true)
    try {
      await obrasHook.update(editObra.id, obraForm)
      setObraOpen(false)
      setEditObra(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível salvar a obra.')
    } finally {
      setSavingObra(false)
    }
  }

  const handleObraChange = (k: keyof ObraInput, v: string | null | number | string[] | boolean) => {
    setObraForm(p => ({ ...p, [k]: v }))
  }

  return (
    <div className="obra-page-shell obra-page-shell--calendario fade-in flex flex-col min-h-0">
      <KanbanPageToolbar className="shrink-0">
        <ObraPageHeader
          title="Chegada de Materiais"
          collapseBelowOnMobile
          belowMobileLabel="Busca"
          subtitle={
            <>
              {obrasFiltradas.length} obra{obrasFiltradas.length !== 1 ? 's' : ''} com chegada programada
            </>
          }
          below={
            <div className="obra-page-search relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a6a55] pointer-events-none" />
              <input
                className="glass-input pl-9 pr-8 w-full"
                placeholder="Buscar por cliente, pedido, montador, endereço..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
              />
              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a6a55] hover:text-[#d4a853] transition-colors"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          }
        />
      </KanbanPageToolbar>

      {obrasHook.loading && <LoadingState />}
      {!obrasHook.loading && obrasHook.error && <ErrorState message={obrasHook.error} />}

      {!obrasHook.loading && !obrasHook.error && (
        <ChegadaMaterialCalendario
          obras={obrasFiltradas}
          viewDate={viewDate}
          onViewDateChange={setViewDate}
          onObraClick={setDetalheObra}
          canEdit={canEdit}
          onUpdateDataEntrega={handleUpdateDataEntrega}
          updatingDataEntrega={updatingDataEntrega}
          onTogglePedido={handleTogglePedidoMaterial}
          togglingPedido={togglingPedidoMaterial}
          showHeader={false}
          embedded={false}
        />
      )}

      <ObraDetalheModal
        open={!!detalheObra}
        obra={detalheObra}
        canEdit={canEdit}
        canUpload={canEdit}
        isMontador={false}
        actioning={null}
        onClose={() => setDetalheObra(null)}
        onEdit={obra => { setDetalheObra(null); setTimeout(() => openEdit(obra), 80) }}
        onIniciar={() => {}}
        onConcluir={() => {}}
        canDelete={canDelete}
        onExcluir={() => {}}
        canAplicarComissao={false}
        applyingComissao={false}
        onAplicarComissao={() => {}}
        showAllComissao
        onUpdateDataEntrega={handleUpdateDataEntrega}
        updatingDataEntrega={updatingDataEntrega === detalheObra?.id}
      />

      <ObraFormModal
        open={obraOpen}
        obra={editObra}
        form={obraForm}
        onChange={handleObraChange}
        onClose={() => setObraOpen(false)}
        onSave={saveObra}
        saving={savingObra}
        tipos={tiposHook.data}
        grupos={gruposHook.data}
        montadores={gruposHook.montadores}
        canEditDates={canEdit}
        canEditMontador={canEdit}
        isAdmin={canEdit}
        canEditComissao={false}
        pendingFiles={[]}
        onAddFiles={() => {}}
        onRemoveFile={() => {}}
      />
    </div>
  )
}
