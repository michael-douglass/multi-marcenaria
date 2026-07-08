import { useMemo } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  ExternalLink,
  MapPin,
  UserX,
} from 'lucide-react'
import { ErrorState, LoadingState } from '@/components/ui/EmptyState'
import {
  FUNCIONARIO_TIPO_LABEL,
  PONTO_STATUS_DIA_LABEL,
} from '@/lib/funcionario-constants'
import {
  formatHoraPonto,
  googleMapsUrl,
  labelPontoTipo,
} from '@/lib/funcionario-ponto'
import { useControlePontoDiario } from '@/hooks/useControlePontoDiario'
import type { PontoControleFuncionarioRow, PontoStatusDia } from '@/types'

function statusStyle(status: PontoStatusDia): string {
  switch (status) {
    case 'em_dia':
    case 'completo':
      return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
    case 'atraso':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-300'
    case 'falta':
      return 'border-red-500/35 bg-red-500/10 text-red-300'
    case 'folga':
      return 'border-violet-500/35 bg-violet-500/10 text-violet-200'
    default:
      return 'border-[rgba(212,168,83,0.25)] bg-[rgba(36,16,8,0.5)] text-[#b8957f]'
  }
}

function ResumoChip({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'gold' | 'green' | 'amber' | 'red' | 'muted'
}) {
  const tones = {
    gold: 'from-[rgba(201,160,69,0.18)] border-[rgba(212,168,83,0.35)] text-[#f2d892]',
    green: 'from-emerald-500/15 border-emerald-500/30 text-emerald-300',
    amber: 'from-amber-500/15 border-amber-500/30 text-amber-300',
    red: 'from-red-500/15 border-red-500/30 text-red-300',
    muted: 'from-[rgba(36,16,8,0.6)] border-[rgba(212,168,83,0.2)] text-[#edd9c4]',
  }
  return (
    <div
      className={`rounded-xl border bg-gradient-to-br to-transparent px-4 py-3 ${tones[tone]}`}
    >
      <p className="text-[0.65rem] uppercase tracking-widest opacity-80">{label}</p>
      <p className="font-display mt-1 text-2xl tabular-nums">{value}</p>
    </div>
  )
}

function FuncionarioPontoCard({ row }: { row: PontoControleFuncionarioRow }) {
  const entrada = row.entrada
  const previsto = formatHoraPonto(row.hora_prevista)
  const chegada = formatHoraPonto(entrada?.registrado_em)

  return (
    <article
      className="group relative overflow-hidden rounded-2xl border border-[rgba(212,168,83,0.22)] bg-[rgba(36,16,8,0.72)] shadow-mogno transition-all duration-300 hover:border-[rgba(212,168,83,0.45)] hover:shadow-mogno-lg"
      style={{ animation: 'fadeIn 0.45s ease-out both' }}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[#f2d892] to-transparent opacity-60" />

      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[rgba(212,168,83,0.12)] px-5 py-4">
        <div>
          <h3 className="font-display text-xl tracking-wide text-[#f2d892]">{row.nome}</h3>
          <p className="section-label mt-0.5">{FUNCIONARIO_TIPO_LABEL[row.tipo]}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-[0.65rem] uppercase tracking-wider ${statusStyle(row.status_dia)}`}>
          {PONTO_STATUS_DIA_LABEL[row.status_dia] ?? row.status_dia}
        </span>
      </header>

      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <div className="space-y-3">
          <div className="rounded-xl border border-[rgba(212,168,83,0.15)] bg-[rgba(20,10,6,0.55)] p-4">
            <p className="text-[0.65rem] uppercase tracking-widest text-[#b8957f]">Chegada</p>
            <div className="mt-2 flex items-end gap-3">
              <span className="font-display text-3xl tabular-nums text-[#f2d892]">
                {entrada ? chegada : '—'}
              </span>
              {entrada?.status === 'atraso' && (
                <span className="mb-1 flex items-center gap-1 text-xs text-amber-400">
                  <AlertTriangle size={12} />
                  +{entrada.atraso_minutos} min
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-[#b8957f]">
              Previsto: <span className="text-[#edd9c4]">{previsto}</span>
            </p>
          </div>

          {entrada?.latitude != null && entrada.longitude != null ? (
            <a
              href={googleMapsUrl(entrada.latitude, entrada.longitude)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl border border-sky-500/25 bg-sky-500/5 px-4 py-3 text-sm text-sky-200 transition hover:border-sky-400/40 hover:bg-sky-500/10"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/15">
                <MapPin size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">Local da batida</p>
                <p className="truncate text-xs opacity-80">
                  {entrada.latitude.toFixed(5)}, {entrada.longitude.toFixed(5)}
                  {entrada.precisao_metros != null && ` (±${Math.round(entrada.precisao_metros)}m)`}
                </p>
              </div>
              <ExternalLink size={14} className="shrink-0 opacity-60" />
            </a>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-[rgba(212,168,83,0.2)] px-4 py-3 text-sm text-[#b8957f]">
              <MapPin size={16} />
              {row.status_dia === 'falta' || row.status_dia === 'folga'
                ? 'Sem localização (ocorrência registrada)'
                : 'Aguardando batida de entrada'}
            </div>
          )}

          {row.marcacoes.length > 1 && (
            <ul className="space-y-1 text-xs text-[#b8957f]">
              {row.marcacoes.filter(m => m.tipo !== 'entrada').map(m => (
                <li key={m.id} className="flex justify-between gap-2">
                  <span>{labelPontoTipo(m.tipo)}</span>
                  <span className="text-[#edd9c4]">{formatHoraPonto(m.registrado_em)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="overflow-hidden rounded-xl border border-[rgba(212,168,83,0.2)] bg-[#1a1208]">
            <p className="border-b border-[rgba(212,168,83,0.12)] px-3 py-1.5 text-[0.6rem] uppercase tracking-widest text-[#b8957f]">
              Selfie
            </p>
            {row.fotoUrl ? (
              <img
                src={row.fotoUrl}
                alt={`Foto de ${row.nome}`}
                className="aspect-[3/4] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[3/4] items-center justify-center text-[#6b5344]">
                <UserX size={32} strokeWidth={1.2} />
              </div>
            )}
          </div>
          <div className="overflow-hidden rounded-xl border border-[rgba(212,168,83,0.2)] bg-[#faf8f5]">
            <p className="border-b border-[rgba(212,168,83,0.2)] bg-[#1a1208] px-3 py-1.5 text-[0.6rem] uppercase tracking-widest text-[#b8957f]">
              Assinatura
            </p>
            {row.assinaturaUrl ? (
              <img
                src={row.assinaturaUrl}
                alt={`Assinatura de ${row.nome}`}
                className="aspect-[3/4] w-full object-contain p-2"
              />
            ) : (
              <div className="flex aspect-[3/4] items-center justify-center bg-[#faf8f5] text-[#c4b8a8]">
                <span className="text-xs">Sem assinatura</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

export function PontoControleFuncionarios() {
  const { data, setData, rows, loading, error, reload } = useControlePontoDiario()

  const resumo = useMemo(() => {
    let presentes = 0
    let atrasados = 0
    let faltas = 0
    let pendentes = 0
    for (const r of rows) {
      if (r.status_dia === 'falta') faltas++
      else if (r.status_dia === 'atraso') atrasados++
      else if (r.entrada) presentes++
      else if (r.status_dia === 'folga') { /* folga não conta pendente */ }
      else pendentes++
    }
    return { presentes, atrasados, faltas, pendentes, total: rows.length }
  }, [rows])

  const dataFormatada = useMemo(() => {
    const d = new Date(data + 'T12:00:00')
    return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  }, [data])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-label capitalize">{dataFormatada}</p>
          <h2 className="font-display text-2xl text-[#f2d892]">Resumo diário da equipe</h2>
        </div>
        <label className="flex items-center gap-2">
          <CalendarDays size={16} className="text-[#f2d892]" />
          <input
            type="date"
            className="glass-input"
            value={data}
            onChange={e => setData(e.target.value)}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <ResumoChip label="Equipe" value={resumo.total} tone="gold" />
        <ResumoChip label="Presentes" value={resumo.presentes} tone="green" />
        <ResumoChip label="Atrasados" value={resumo.atrasados} tone="amber" />
        <ResumoChip label="Faltas" value={resumo.faltas} tone="red" />
        <ResumoChip label="Aguardando" value={resumo.pendentes} tone="muted" />
      </div>

      {loading && <LoadingState message="Carregando batidas do dia…" />}
      {!loading && error && <ErrorState message={error} onRetry={() => void reload()} />}

      {!loading && !error && rows.length === 0 && (
        <div className="glass-card p-10 text-center text-[#b8957f]">
          Nenhum funcionário de campo cadastrado.
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="grid gap-5 xl:grid-cols-2">
          {rows.map((row, i) => (
            <div key={row.funcionario_id} style={{ animationDelay: `${i * 60}ms` }}>
              <FuncionarioPontoCard row={row} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
