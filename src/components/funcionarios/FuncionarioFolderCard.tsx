import { FolderOpen, HardHat, Palette, PenTool, Shield, User, Users, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  ADMISSAO_STATUS_LABEL,
  FUNCIONARIO_CATEGORIA_LABEL,
  FUNCIONARIO_TIPO_LABEL,
  PONTO_STATUS_DIA_LABEL,
} from '@/lib/funcionario-constants'
import type { Funcionario, FuncionarioCategoria, FuncionarioTipo } from '@/types'

const TIPO_ICON: Record<FuncionarioTipo, typeof User> = {
  design: Palette,
  projetista: PenTool,
  montador: HardHat,
  montador_admin: Shield,
  administrador_obras: User,
  financeiro: Wallet,
  administrativo: Users,
  outro: FolderOpen,
}

/** Aba da pasta — tinta saturada, legível no papel creme. */
const TIPO_TAB: Record<FuncionarioTipo, string> = {
  design: '#9a3412',
  projetista: '#1d4ed8',
  montador: '#1e4a73',
  montador_admin: '#6b3f12',
  administrador_obras: '#4c1d77',
  financeiro: '#146c38',
  administrativo: '#57534e',
  outro: '#6b5244',
}

const TIPO_WASH: Record<FuncionarioTipo, string> = {
  design: 'rgba(154, 52, 18, 0.10)',
  projetista: 'rgba(29, 78, 216, 0.10)',
  montador: 'rgba(30, 74, 115, 0.10)',
  montador_admin: 'rgba(107, 63, 18, 0.12)',
  administrador_obras: 'rgba(76, 29, 119, 0.10)',
  financeiro: 'rgba(20, 108, 56, 0.10)',
  administrativo: 'rgba(87, 83, 78, 0.10)',
  outro: 'rgba(107, 82, 68, 0.10)',
}

interface Props {
  funcionario: Funcionario
  dispensado?: boolean
  /** Abre direto em Ponto → Registros, sem badges de RH. */
  pontoOnly?: boolean
}

export function FuncionarioFolderCard({ funcionario, dispensado, pontoOnly }: Props) {
  const Icon = TIPO_ICON[funcionario.tipo] ?? User
  const tabColor = TIPO_TAB[funcionario.tipo] ?? '#6b3f12'
  const wash = TIPO_WASH[funcionario.tipo] ?? 'rgba(107, 63, 18, 0.10)'
  const pastaHref = dispensado
    ? `/funcionarios/${funcionario.id}?aba=dispensados${pontoOnly ? '&tab=ponto' : ''}`
    : pontoOnly
      ? `/funcionarios/${funcionario.id}?tab=ponto`
      : `/funcionarios/${funcionario.id}`

  return (
    <Link
      to={pastaHref}
      className="funcionario-folder-card group relative block overflow-hidden rounded-xl border border-[rgba(26,16,12,0.14)] bg-[#fffaf4] shadow-[0_12px_28px_rgba(42,24,18,0.07)] transition-all duration-300 hover:-translate-y-1 hover:border-[rgba(107,63,18,0.42)] hover:shadow-[0_18px_36px_rgba(42,24,18,0.12)]"
    >
      <span
        className="absolute inset-x-0 top-0 h-2.5"
        style={{ background: `linear-gradient(90deg, ${tabColor}, #c4963a, ${tabColor})` }}
        aria-hidden
      />
      <span
        className="pointer-events-none absolute left-3 top-0 h-3 w-16 rounded-b-sm"
        style={{ background: tabColor }}
        aria-hidden
      />
      <div className="relative p-5 pt-7">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-[rgba(26,16,12,0.12)]"
            style={{ background: wash, color: tabColor }}
          >
            <Icon size={22} />
          </div>
          <FolderOpen size={18} className="text-[#6b5244] opacity-70 transition group-hover:text-[#6b3f12]" />
        </div>

        <h3 className="font-display text-xl tracking-wide text-[#1a100c]">{funcionario.nome}</h3>
        <p className="mt-1 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[#4a3428]">
          {FUNCIONARIO_CATEGORIA_LABEL[(funcionario.categoria ?? 'outro') as FuncionarioCategoria]
            ?? FUNCIONARIO_TIPO_LABEL[funcionario.tipo]}
        </p>
        <p className="mt-0.5 text-[0.65rem] text-[#6b5244]">
          {FUNCIONARIO_TIPO_LABEL[funcionario.tipo]}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {dispensado && (
            <span className="rounded-full border border-violet-800/30 bg-violet-50 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-violet-900">
              Dispensado
            </span>
          )}
          {!pontoOnly && (
            <span className="rounded-full border border-[rgba(26,16,12,0.16)] bg-[#f8efe3] px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-[#4a3428]">
              {ADMISSAO_STATUS_LABEL[funcionario.admissao_status]}
            </span>
          )}
          {!dispensado && funcionario.ponto_resumo?.jornada_ativa && funcionario.ponto_resumo.hora_entrada && (
            <span className="rounded-full border border-sky-800/25 bg-sky-50 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-sky-900">
              {funcionario.ponto_resumo.hora_entrada.slice(0, 5)}–{(funcionario.ponto_resumo.hora_saida ?? '17:00').slice(0, 5)}
            </span>
          )}
          {!dispensado && funcionario.ponto_resumo?.status_hoje && (
            <span className={`rounded-full border px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider ${
              funcionario.ponto_resumo.status_hoje === 'atraso' || funcionario.ponto_resumo.status_hoje === 'falta'
                ? 'border-amber-800/30 bg-amber-50 text-amber-900'
                : funcionario.ponto_resumo.status_hoje === 'folga'
                  ? 'border-violet-800/30 bg-violet-50 text-violet-900'
                  : 'border-emerald-800/30 bg-emerald-50 text-emerald-900'
            }`}>
              {PONTO_STATUS_DIA_LABEL[funcionario.ponto_resumo.status_hoje] ?? funcionario.ponto_resumo.status_hoje}
            </span>
          )}
          {!pontoOnly && (funcionario.recibos_pendentes ?? 0) > 0 && (
            <span className="rounded-full border border-amber-800/30 bg-amber-50 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-amber-900">
              {funcionario.recibos_pendentes} recibo{(funcionario.recibos_pendentes ?? 0) !== 1 ? 's' : ''}
            </span>
          )}
          {!pontoOnly && funcionario.usuario_id && (
            <span className="rounded-full border border-emerald-800/30 bg-emerald-50 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-emerald-900">
              Vinculado
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
