import { useEffect, useMemo, useState } from 'react'
import { FileText, Mail, MapPin, Phone, Presentation } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { LoadingState } from '@/components/ui/EmptyState'
import { drawingToSvgPath, type CrmLousaBoard } from '@/lib/crm-lousa'
import { linkPublicoOrcamento } from '@/lib/crm-orcamento-slides'
import type { PortalComissaoLead, PortalLeadDetalhe } from '@/lib/crm-portal'
import { fmtCur, fmtDate } from '@/lib/utils'

type TabId = 'detalhes' | 'lousa' | 'orcamentos'

interface PortalLeadDialogProps {
  open: boolean
  lead: PortalComissaoLead | null
  detalhe: PortalLeadDetalhe | null
  loading: boolean
  onClose: () => void
}

export function PortalLeadDialog({ open, lead, detalhe, loading, onClose }: PortalLeadDialogProps) {
  const tabs = useMemo(() => {
    const list: { id: TabId; label: string }[] = []
    if (detalhe?.podeVerDetalhes) list.push({ id: 'detalhes', label: 'Detalhes' })
    if (detalhe?.podeVerLousa || detalhe?.podeVerFotos) list.push({ id: 'lousa', label: 'Lousa' })
    if (detalhe?.podeVerOrcamento) list.push({ id: 'orcamentos', label: 'Orçamentos' })
    return list
  }, [detalhe])
  const [tab, setTab] = useState<TabId>('detalhes')
  const current = tabs.some(t => t.id === tab) ? tab : tabs[0]?.id

  useEffect(() => {
    if (open && tabs[0]) setTab(tabs[0].id)
  }, [open, lead?.leadId, tabs])

  const board: CrmLousaBoard | null = detalhe
    ? { lead_id: lead?.leadId ?? 0, lead_nome: lead?.leadNome ?? null, images: detalhe.lousaImages, drawings: detalhe.lousaDrawings }
    : null

  return (
    <Modal open={open} onClose={onClose} title={lead?.leadNome ?? 'Lead'} extraWide tall closeOnBackdrop={false}>
      {loading && <LoadingState variant="page" message="Abrindo o projeto..." />}
      {!loading && detalhe && (
        <>
          {tabs.length > 1 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {tabs.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={current === item.id ? 'btn btn-gold btn-sm' : 'btn btn-outline btn-sm'}
                  onClick={() => setTab(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
          {current === 'detalhes' && detalhe.lead && (
            <div className="space-y-3 text-sm">
              <Info icon={FileText} label="Status" value={detalhe.lead.status} />
              <Info icon={Phone} label="Telefone" value={detalhe.lead.telefone} />
              <Info icon={Mail} label="E-mail" value={detalhe.lead.email} />
              <Info icon={MapPin} label="Região" value={detalhe.lead.regiao} />
              <Info icon={Presentation} label="Orçamento" value={fmtCur(detalhe.lead.valorOrcamento)} />
              <Info icon={FileText} label="Chegada" value={fmtDate(detalhe.lead.dataChegada)} />
              {detalhe.podeVerAnotacoes && detalhe.lead.observacoes && (
                <p className="whitespace-pre-wrap rounded-lg border border-white/10 bg-white/5 p-3 text-white/80">{detalhe.lead.observacoes}</p>
              )}
            </div>
          )}
          {current === 'lousa' && board && <PortalLousaPreview board={board} />}
          {current === 'orcamentos' && (
            <div className="space-y-2">
              {detalhe.slides.length === 0 && <p className="text-sm text-muted-foreground">Nenhum orçamento liberado.</p>}
              {detalhe.slides.map(slide => (
                <a
                  key={slide.id}
                  href={linkPublicoOrcamento(slide.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-lg border border-gold/25 bg-gold/5 px-3 py-2 text-sm hover:bg-gold/10"
                >
                  <p className="font-medium">{slide.clienteNome || slide.identificador}</p>
                  <p className="text-xs text-muted-foreground">{slide.status}</p>
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </Modal>
  )
}

function Info({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <p className="flex items-center gap-2 text-white/80">
      <Icon className="h-4 w-4 text-gold" />
      <span className="text-xs uppercase tracking-wide text-white/40">{label}:</span>
      {value}
    </p>
  )
}

function PortalLousaPreview({ board }: { board: CrmLousaBoard }) {
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

  if (board.images.length === 0 && paths.length === 0) {
    return <p className="text-sm text-muted-foreground">Esta lousa ainda não tem fotos.</p>
  }

  const scale = Math.min(1, 720 / box.w)

  return (
    <div className="overflow-auto rounded-lg border border-white/10" style={{ maxHeight: 420 }}>
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
