import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { CrmPageFrame, CrmPageHeader } from '@/components/crm/CrmPageFrame'
import { Button } from '@/components/ui/button'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/EmptyState'
import { useCrmLousaBoard, useCrmLousaLista } from '@/hooks/useCrmLousa'
import {
  drawingToSvgPath,
  filtrarLousaLeads,
  type CrmLousaBoard,
} from '@/lib/crm-lousa'

function LousaCanvas({ board }: { board: CrmLousaBoard }) {
  const paths = useMemo(
    () => board.drawings
      .map(d => ({ id: d.id, d: drawingToSvgPath(d.path_data), cor: d.cor || '#e85d04', width: Number(d.stroke_width) || 3 }))
      .filter((p): p is { id: string; d: string; cor: string; width: number } => Boolean(p.d)),
    [board.drawings],
  )

  const box = useMemo(() => {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const img of board.images) {
      const x = Number(img.position_x) || 0
      const y = Number(img.position_y) || 0
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x + (Number(img.width) || 240))
      maxY = Math.max(maxY, y + (Number(img.height) || 240))
    }
    if (!Number.isFinite(minX)) {
      minX = 0
      minY = 0
      maxX = 800
      maxY = 480
    }
    const pad = 24
    return { minX: minX - pad, minY: minY - pad, w: Math.max(400, maxX - minX + pad * 2), h: Math.max(280, maxY - minY + pad * 2) }
  }, [board.images])

  const scale = Math.min(1, 720 / box.w)

  return (
    <div className="glass-card overflow-auto" style={{ maxHeight: 520 }}>
      <div style={{ width: box.w * scale, height: box.h * scale, minWidth: '100%' }}>
        <div
          className="relative bg-[#1a1410]"
          style={{
            width: box.w,
            height: box.h,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          {board.images.map(img => (
            <img
              key={img.id}
              src={img.file_url}
              alt={img.file_name || 'Foto da lousa'}
              className="absolute object-contain"
              style={{
                left: (Number(img.position_x) || 0) - box.minX,
                top: (Number(img.position_y) || 0) - box.minY,
                width: Number(img.width) || 240,
                height: Number(img.height) || 240,
                zIndex: img.z_index || 1,
              }}
            />
          ))}
          {paths.length > 0 && (
            <svg
              className="pointer-events-none absolute inset-0"
              viewBox={`${box.minX} ${box.minY} ${box.w} ${box.h}`}
              style={{ zIndex: 80 }}
            >
              {paths.map(p => (
                <path key={p.id} d={p.d} stroke={p.cor} strokeWidth={p.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              ))}
            </svg>
          )}
        </div>
      </div>
    </div>
  )
}

function LeadLousaLista() {
  const navigate = useNavigate()
  const { leads, loading, error } = useCrmLousaLista()
  const [busca, setBusca] = useState('')
  const lista = useMemo(() => filtrarLousaLeads(leads, busca), [leads, busca])

  return (
    <CrmPageFrame padded>
      <CrmPageHeader
        title="Lousa do lead"
        subtitle={`${lista.length} de ${leads.length} leads com fotos`}
        below={(
          <label className="relative block max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="glass-input w-full pl-9"
              placeholder="Buscar lead"
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </label>
        )}
      />
      {loading && <LoadingState variant="page" message="Carregando lousas..." />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && lista.length === 0 && <EmptyState message="Nenhuma lousa com foto encontrada." />}
      {!loading && !error && lista.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="obra-scroll-x-mobile overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-[0.7rem] uppercase tracking-wide text-[#b8957f]">
                <tr>
                  <th className="px-3 py-2">Lead</th>
                  <th className="px-3 py-2">Fotos</th>
                  <th className="px-3 py-2">Traços</th>
                </tr>
              </thead>
              <tbody>
                {lista.map(item => (
                  <tr
                    key={item.lead_id}
                    className="cursor-pointer border-t border-white/5 hover:bg-white/5"
                    onClick={() => navigate(`/leads/${item.lead_id}/lousa`)}
                  >
                    <td className="px-3 py-2 font-medium text-[#f2d892]">{item.lead_nome ?? `Lead ${item.lead_id}`}</td>
                    <td className="px-3 py-2 text-[#d4bc9f]">{item.fotos}</td>
                    <td className="px-3 py-2 text-[#edd9c4]">{item.tracos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </CrmPageFrame>
  )
}

function LeadLousaBoardView({ leadId }: { leadId: number }) {
  const { board, loading, error } = useCrmLousaBoard(leadId)
  const { leads } = useCrmLousaLista()
  const outras = leads.filter(l => l.lead_id !== leadId).slice(0, 8)

  return (
    <CrmPageFrame padded>
      <CrmPageHeader
        title={board?.lead_nome || `Lousa ${leadId}`}
        subtitle={board ? `${board.images.length} fotos · ${board.drawings.length} traços` : 'Abrindo a lousa'}
        actions={<Link to="/leads/lousa"><Button variant="outline" size="sm">Todas as lousas</Button></Link>}
      />
      {loading && <LoadingState variant="page" message="Carregando a lousa..." />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && board && board.images.length === 0 && (
        <EmptyState message="Este lead ainda não tem fotos na lousa." />
      )}
      {!loading && !error && board && board.images.length > 0 && (
        <>
          <LousaCanvas board={board} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {board.images.map(img => (
              <a key={img.id} href={img.file_url} target="_blank" rel="noreferrer" className="glass-card overflow-hidden">
                <img src={img.file_url} alt={img.file_name || 'Foto'} className="h-36 w-full object-cover" />
                <p className="truncate px-2 py-1 text-[0.7rem] text-[#b8957f]">{img.file_name || 'Foto'}</p>
              </a>
            ))}
          </div>
        </>
      )}
      {outras.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-[#b8957f]">Outras lousas</p>
          <div className="flex flex-wrap gap-2">
            {outras.map(item => (
              <Link
                key={item.lead_id}
                to={`/leads/${item.lead_id}/lousa`}
                className="btn btn-outline btn-sm"
              >
                {item.lead_nome ?? `Lead ${item.lead_id}`} · {item.fotos} fotos
              </Link>
            ))}
          </div>
        </div>
      )}
    </CrmPageFrame>
  )
}

export function LeadLousaPage() {
  const { id } = useParams()
  const leadId = Number(id)
  if (!id || !Number.isFinite(leadId) || leadId <= 0) return <LeadLousaLista />
  return <LeadLousaBoardView leadId={leadId} />
}
