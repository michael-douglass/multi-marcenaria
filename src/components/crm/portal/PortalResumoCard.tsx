import { useMemo, useState } from 'react'
import { Clock, TrendingUp, Trophy, Wallet } from 'lucide-react'
import type { PortalResumo, PortalSaque, TipoChavePix } from '@/lib/crm-portal'
import { calcSaldoExibidoPrestador } from '@/lib/crm-portal'
import { fmtCur } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PortalSaqueDialog } from '@/components/crm/portal/PortalSaqueDialog'

interface PortalResumoCardProps {
  resumo: PortalResumo
  saques: PortalSaque[]
  chavePix: string
  tipoChavePix: TipoChavePix
  onSolicitar: (input: { valor: number; chavePix: string; tipoChavePix: TipoChavePix }) => Promise<void>
}

export function PortalResumoCard({ resumo, saques, chavePix, tipoChavePix, onSolicitar }: PortalResumoCardProps) {
  const [saqueOpen, setSaqueOpen] = useState(false)
  const exibido = useMemo(
    () => calcSaldoExibidoPrestador(
      resumo.saldoParaSacar,
      resumo.totalComissaoCarteira,
      resumo.totalAGanar,
      resumo.totalRetirado,
      resumo.totalComissaoGanha,
      resumo.totalAjustes,
      saques,
    ),
    [resumo, saques],
  )

  return (
    <aside
      className="flex flex-col gap-3 rounded-2xl p-4"
      style={{
        background: 'linear-gradient(165deg, rgba(22,18,12,0.96), rgba(8,8,8,1))',
        border: '1px solid rgba(240,210,140,0.22)',
      }}
    >
      <div
        className="flex flex-col gap-1.5 rounded-xl p-4"
        style={{
          background: 'linear-gradient(135deg, rgba(240,210,140,0.18), rgba(255,255,255,0.02))',
          border: '1px solid rgba(240,210,140,0.35)',
        }}
      >
        <div className="flex items-center gap-2">
          <TrendingUp size={15} style={{ color: '#f2d892' }} />
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'rgba(240,210,140,0.85)', fontFamily: 'Raleway, sans-serif' }}>
            A ganhar
          </span>
        </div>
        <p className="font-display text-3xl leading-none" style={{ color: '#f2d892' }}>{fmtCur(exibido.aGanharExibido)}</p>
      </div>

      <div
        className="flex flex-col gap-3 rounded-xl p-5"
        style={{
          background: 'linear-gradient(135deg, rgba(74,222,128,0.22), rgba(255,255,255,0.02))',
          border: '1px solid rgba(74,222,128,0.4)',
        }}
      >
        <div className="flex items-center gap-2">
          <Wallet size={18} style={{ color: '#4ade80' }} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'rgba(74,222,128,0.9)', fontFamily: 'Raleway, sans-serif' }}>
            Para sacar
          </span>
        </div>
        <p className="font-display text-4xl leading-none" style={{ color: '#4ade80' }}>{fmtCur(exibido.saldoDisponivel)}</p>
        {exibido.valorReservado > 0 && (
          <p className="flex items-center gap-1.5 text-[11px]" style={{ color: 'rgba(240,210,140,0.85)' }}>
            <Clock size={12} />
            {fmtCur(exibido.valorReservado)} aguardando liberação do administrador
          </p>
        )}
        <Button type="button" size="sm" className="mt-1" disabled={exibido.saldoDisponivel <= 0} onClick={() => setSaqueOpen(true)}>
          Solicitar saque
        </Button>
      </div>

      <SaldoRow icon={Trophy} label="Já ganho" value={resumo.totalComissaoGanha} color="#f2d892" />
      <SaldoRow icon={Wallet} label="Já retirado" value={resumo.totalRetirado} color="rgba(255,255,255,0.55)" />

      {resumo.ganhosPorMes.length > 0 && (
        <div className="mt-1 space-y-1.5">
          {resumo.ganhosPorMes.map(item => (
            <div key={item.key} className="flex justify-between text-xs text-white/45">
              <span>{item.label}</span>
              <span className="tabular-nums text-[#f2d892]">{fmtCur(item.valor)}</span>
            </div>
          ))}
        </div>
      )}

      <PortalSaqueDialog
        open={saqueOpen}
        saldoDisponivel={exibido.saldoDisponivel}
        chavePix={chavePix}
        tipoChavePix={tipoChavePix}
        onClose={() => setSaqueOpen(false)}
        onConfirm={onSolicitar}
      />
    </aside>
  )
}

function SaldoRow({ icon: Icon, label, value, color }: { icon: typeof Trophy; label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="flex min-w-0 items-center gap-2">
        <Icon size={13} style={{ color }} />
        <span className="truncate text-[10px] uppercase tracking-widest text-white/35" style={{ fontFamily: 'Raleway, sans-serif' }}>{label}</span>
      </div>
      <span className="font-display text-base shrink-0" style={{ color }}>{fmtCur(value)}</span>
    </div>
  )
}
