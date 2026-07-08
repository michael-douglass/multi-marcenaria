import { FolderOpen, HardHat, Shield, User, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  ADMISSAO_STATUS_LABEL,
  FUNCIONARIO_TIPO_LABEL,
  PONTO_STATUS_DIA_LABEL,
} from '@/lib/funcionario-constants'
import type { Funcionario, FuncionarioTipo } from '@/types'

const TIPO_ICON: Record<FuncionarioTipo, typeof User> = {
  montador: HardHat,
  montador_admin: Shield,
  administrador_obras: User,
  financeiro: Wallet,
}

const TIPO_COLOR: Record<FuncionarioTipo, string> = {
  montador: 'rgba(96,165,250,0.25)',
  montador_admin: 'rgba(251,191,36,0.25)',
  administrador_obras: 'rgba(167,139,250,0.25)',
  financeiro: 'rgba(52,211,153,0.25)',
}

interface Props {
  funcionario: Funcionario
}

export function FuncionarioFolderCard({ funcionario }: Props) {
  const Icon = TIPO_ICON[funcionario.tipo] ?? User
  const tipoColor = TIPO_COLOR[funcionario.tipo] ?? 'rgba(212,168,83,0.15)'

  return (
    <Link
      to={`/funcionarios/${funcionario.id}`}
      className="group relative block overflow-hidden rounded-xl border border-[rgba(212,168,83,0.22)] bg-[rgba(36,16,8,0.72)] shadow-mogno transition-all duration-300 hover:-translate-y-1 hover:border-[rgba(212,168,83,0.45)] hover:shadow-mogno-lg"
    >
      <div className="absolute left-0 right-0 top-0 h-3 rounded-t-xl bg-gradient-to-r from-[#c9a045] via-[#f2d892] to-[#c9a045]" />
      <div className="relative p-5 pt-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-[rgba(212,168,83,0.3)]"
            style={{ background: tipoColor }}
          >
            <Icon size={22} className="text-[#f2d892]" />
          </div>
          <FolderOpen size={18} className="text-[#b8957f] opacity-60 transition group-hover:text-[#f2d892]" />
        </div>

        <h3 className="font-display text-xl tracking-wide text-[#f2d892]">{funcionario.nome}</h3>
        <p className="section-label mt-1">{FUNCIONARIO_TIPO_LABEL[funcionario.tipo]}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-[rgba(212,168,83,0.25)] px-2.5 py-0.5 text-[0.65rem] uppercase tracking-wider text-[#edd9c4]">
            {ADMISSAO_STATUS_LABEL[funcionario.admissao_status]}
          </span>
          {funcionario.ponto_resumo?.jornada_ativa && funcionario.ponto_resumo.hora_entrada && (
            <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-[0.65rem] uppercase tracking-wider text-sky-200">
              {funcionario.ponto_resumo.hora_entrada.slice(0, 5)}–{(funcionario.ponto_resumo.hora_saida ?? '17:00').slice(0, 5)}
            </span>
          )}
          {funcionario.ponto_resumo?.status_hoje && (
            <span className={`rounded-full border px-2.5 py-0.5 text-[0.65rem] uppercase tracking-wider ${
              funcionario.ponto_resumo.status_hoje === 'atraso' || funcionario.ponto_resumo.status_hoje === 'falta'
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                : funcionario.ponto_resumo.status_hoje === 'folga'
                  ? 'border-violet-500/30 bg-violet-500/10 text-violet-200'
                  : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
            }`}>
              {PONTO_STATUS_DIA_LABEL[funcionario.ponto_resumo.status_hoje] ?? funcionario.ponto_resumo.status_hoje}
            </span>
          )}
          {(funcionario.recibos_pendentes ?? 0) > 0 && (
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[0.65rem] uppercase tracking-wider text-amber-300">
              {funcionario.recibos_pendentes} recibo{(funcionario.recibos_pendentes ?? 0) !== 1 ? 's' : ''}
            </span>
          )}
          {funcionario.usuario_id && (
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[0.65rem] uppercase tracking-wider text-emerald-300">
              Vinculado
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
