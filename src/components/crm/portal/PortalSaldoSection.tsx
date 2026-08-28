import { useMemo, useState } from 'react'
import { Trophy, TrendingUp, Wallet } from 'lucide-react'
import type { PortalResumo, PortalSaque, TipoChavePix } from '@/lib/crm-portal'
import { calcSaldoExibidoPrestador, TIPO_PIX_LABELS } from '@/lib/crm-portal'
import { fmtCur, fmtDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PortalSaqueDialog } from '@/components/crm/portal/PortalSaqueDialog'

interface PortalSaldoSectionProps {
  resumo: PortalResumo
  saques: PortalSaque[]
  chavePix: string
  tipoChavePix: TipoChavePix
  onSolicitar: (input: { valor: number; chavePix: string; tipoChavePix: TipoChavePix }) => Promise<void>
}

export function PortalSaldoSection({ resumo, saques, chavePix, tipoChavePix, onSolicitar }: PortalSaldoSectionProps) {
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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-6 pb-28 pt-10 md:px-14">
      <div>
        <div className="mb-5 h-px w-10 bg-amber-400/30" />
        <h2 className="font-display text-3xl tracking-wide text-white md:text-4xl">Saldo</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <MetricTile icon={Wallet} label="Para sacar" value={exibido.saldoDisponivel} color="#4ade80" large />
        <MetricTile icon={TrendingUp} label="A ganhar" value={exibido.aGanharExibido} color="#f2d892" />
        <MetricTile icon={Trophy} label="Já ganho" value={resumo.totalComissaoGanha} color="#f2d892" />
        <MetricTile icon={Wallet} label="Já retirado" value={resumo.totalRetirado} color="rgba(255,255,255,0.7)" />
      </div>
      <Button type="button" className="self-start" disabled={exibido.saldoDisponivel <= 0} onClick={() => setSaqueOpen(true)}>
        Solicitar saque
      </Button>
      <div className="overflow-hidden rounded-2xl" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="border-b border-white/10 px-4 py-3 text-[11px] uppercase tracking-widest text-white/40">Pedidos de saque</p>
        {saques.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-white/35">Nenhum pedido ainda.</p>
        ) : (
          saques.map(item => {
            const badge = item.status === 'pendente'
              ? { label: 'Pendente', color: '#f2d892' }
              : item.status === 'aprovado'
                ? { label: 'Pago', color: '#4ade80' }
                : { label: 'Rejeitado', color: '#f87171' }
            return (
              <div key={item.id} className="flex items-center justify-between gap-3 border-t border-white/5 px-4 py-3">
                <div>
                  <p className="text-sm text-white">{fmtCur(item.valorSolicitado)}</p>
                  <p className="text-[11px] text-white/40">
                    {TIPO_PIX_LABELS[item.tipoChavePix as TipoChavePix] ?? item.tipoChavePix} · {fmtDate(item.criadoEm)}
                  </p>
                </div>
                <span className="text-[11px] uppercase tracking-wide" style={{ color: badge.color }}>{badge.label}</span>
              </div>
            )
          })
        )}
      </div>
      <PortalSaqueDialog
        open={saqueOpen}
        saldoDisponivel={exibido.saldoDisponivel}
        chavePix={chavePix}
        tipoChavePix={tipoChavePix}
        onClose={() => setSaqueOpen(false)}
        onConfirm={onSolicitar}
      />
    </div>
  )
}

function MetricTile({ icon: Icon, label, value, color, large }: { icon: typeof Wallet; label: string; value: number; color: string; large?: boolean }) {
  return (
    <div className={`flex flex-col gap-2 rounded-2xl ${large ? 'p-6 sm:col-span-2' : 'p-5'}`} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-center gap-1.5">
        <Icon size={large ? 16 : 13} style={{ color }} />
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30" style={{ fontFamily: 'Raleway, sans-serif' }}>{label}</span>
      </div>
      <p className={`font-display ${large ? 'text-4xl' : 'text-2xl'}`} style={{ color }}>{fmtCur(value)}</p>
    </div>
  )
}
