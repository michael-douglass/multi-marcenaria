import { useEffect, useMemo, useState } from 'react'
import { FileWarning, FileDown, Loader2 } from 'lucide-react'
import { DateInput } from '@/components/ui/DateInput'
import { FUNCIONARIO_TIPO_LABEL } from '@/lib/funcionario-constants'
import {
  formatDataCurtaBr,
  imprimirAdvertenciaDisciplinarPdf,
  montarMotivoFaltas,
} from '@/lib/advertencia-disciplinar-pdf'
import { pontoDataLocal } from '@/lib/funcionario-ponto'
import { showToast } from '@/lib/toast'
import type { FuncionarioTipo, PontoOcorrencia } from '@/types'

interface AdvertenciaDisciplinarPanelProps {
  funcionarioNome: string
  funcionarioTipo: FuncionarioTipo
  funcionarioCpf?: string | null
  ocorrencias: PontoOcorrencia[]
  empresaNome?: string | null
  empresaCnpj?: string | null
  readOnly?: boolean
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="section-label">{label}</span>
      {children}
    </label>
  )
}

export function AdvertenciaDisciplinarPanel({
  funcionarioNome,
  funcionarioTipo,
  funcionarioCpf,
  ocorrencias,
  empresaNome,
  empresaCnpj,
  readOnly,
}: AdvertenciaDisciplinarPanelProps) {
  const faltas = useMemo(
    () =>
      ocorrencias
        .filter((o) => o.tipo === 'falta')
        .slice()
        .sort((a, b) => a.data.localeCompare(b.data)),
    [ocorrencias],
  )

  const [datasSelecionadas, setDatasSelecionadas] = useState<string[]>([])
  const [motivo, setMotivo] = useState('')
  const [dataDocumento, setDataDocumento] = useState(pontoDataLocal())
  const [cidadeUf, setCidadeUf] = useState('Contagem/MG')
  const [exportando, setExportando] = useState(false)
  const [motivoEditado, setMotivoEditado] = useState(false)

  const cargo = FUNCIONARIO_TIPO_LABEL[funcionarioTipo] ?? funcionarioTipo
  const faltasKey = faltas.map((f) => f.data).join('|')

  useEffect(() => {
    const datas = faltas.map((f) => f.data)
    setDatasSelecionadas(datas)
    setMotivo(montarMotivoFaltas(datas))
    setMotivoEditado(false)
  }, [faltasKey])

  function toggleData(data: string) {
    setDatasSelecionadas((prev) => {
      const next = prev.includes(data) ? prev.filter((d) => d !== data) : [...prev, data].sort()
      if (!motivoEditado) setMotivo(montarMotivoFaltas(next))
      return next
    })
  }

  function selecionarTodas() {
    const todas = faltas.map((f) => f.data)
    setDatasSelecionadas(todas)
    if (!motivoEditado) setMotivo(montarMotivoFaltas(todas))
  }

  function limparDatas() {
    setDatasSelecionadas([])
    if (!motivoEditado) setMotivo(montarMotivoFaltas([]))
  }

  function aplicarMotivoPadrao() {
    setMotivo(montarMotivoFaltas(datasSelecionadas))
    setMotivoEditado(false)
  }

  async function exportarPdf() {
    if (exportando) return
    setExportando(true)
    try {
      imprimirAdvertenciaDisciplinarPdf({
        funcionarioNome,
        funcionarioCargo: cargo,
        funcionarioCpf,
        motivo,
        dataDocumento,
        empresaNome,
        empresaCnpj,
        cidadeUf,
      })
      showToast('Advertência pronta para salvar em PDF.')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Não foi possível gerar o PDF.', 'error')
    } finally {
      window.setTimeout(() => setExportando(false), 800)
    }
  }

  return (
    <section
      className="advertencia-panel relative overflow-hidden rounded-2xl border border-[rgba(26,16,12,0.14)] bg-[#fffaf4] p-5 shadow-[0_12px_28px_rgba(42,24,18,0.07)]"
      aria-label="Advertência disciplinar"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#f2d892] to-transparent opacity-70"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-[rgba(242,216,146,0.06)] blur-3xl"
        aria-hidden
      />

      <header className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="section-label text-[#d4a853]">RH · Documento</p>
          <h3 className="font-display mt-1 flex items-center gap-2 text-xl tracking-wide text-[#f2d892]">
            <FileWarning className="h-5 w-5 text-amber-300" aria-hidden />
            Advertência
          </h3>
          <p className="mt-1 max-w-xl text-sm text-[#b8957f]">
            Gera advertência disciplinar timbrada da empresa para{' '}
            <span className="text-[#edd9c4]">{funcionarioNome}</span>
            {' · '}
            {cargo}.
          </p>
        </div>
        <button
          type="button"
          disabled={readOnly || exportando || !motivo.trim()}
          onClick={() => void exportarPdf()}
          className={
            'inline-flex items-center gap-1.5 rounded-lg border border-[rgba(212,168,83,0.4)] ' +
            'bg-[#f4e4c4] px-3.5 py-2 text-[0.72rem] font-semibold uppercase ' +
            'tracking-wider text-[#6b3f12] shadow-sm transition-all duration-200 ' +
            'ease-[cubic-bezier(0.4,0,0.2,1)] hover:border-[rgba(107,63,18,0.55)] ' +
            'hover:bg-[#ecd7a8] hover:text-[#1a100c] ' +
            'active:scale-x-[0.97] active:scale-y-[1.04] ' +
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(242,216,146,0.4)] ' +
            'disabled:cursor-not-allowed disabled:opacity-55'
          }
        >
          {exportando ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <FileDown className="h-3.5 w-3.5" aria-hidden />
          )}
          {exportando ? 'Gerando…' : 'Exportar PDF'}
        </button>
      </header>

      <div className="relative mt-5 grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="section-label">Faltas da pasta (ocorrências)</p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={readOnly || faltas.length === 0}
                onClick={selecionarTodas}
                className="text-[0.65rem] uppercase tracking-wider text-[#f2d892] underline-offset-2 hover:underline disabled:opacity-40"
              >
                Todas
              </button>
              <button
                type="button"
                disabled={readOnly || datasSelecionadas.length === 0}
                onClick={limparDatas}
                className="text-[0.65rem] uppercase tracking-wider text-[#b8957f] underline-offset-2 hover:underline disabled:opacity-40"
              >
                Limpar
              </button>
            </div>
          </div>

          {faltas.length === 0 ? (
            <p className="rounded-xl border border-[rgba(212,168,83,0.15)] bg-[rgba(20,10,4,0.4)] px-3 py-3 text-sm text-[#b8957f]">
              Nenhuma falta registrada nesta pasta. Você ainda pode escrever o motivo manualmente.
            </p>
          ) : (
            <ul className="flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-xl border border-[rgba(212,168,83,0.15)] bg-[rgba(20,10,4,0.4)] p-3">
              {faltas.map((f) => {
                const ativo = datasSelecionadas.includes(f.data)
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      disabled={readOnly}
                      aria-pressed={ativo}
                      onClick={() => toggleData(f.data)}
                      className={
                        'rounded-lg border px-2.5 py-1.5 text-sm tabular-nums transition-colors ' +
                        (ativo
                          ? 'border-rose-500/45 bg-rose-500/15 text-rose-200'
                          : 'border-[rgba(212,168,83,0.2)] text-[#b8957f] hover:text-[#edd9c4]')
                      }
                    >
                      {formatDataCurtaBr(f.data)}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <Field label="Data do documento">
            <DateInput
              value={dataDocumento}
              onChange={(v) => setDataDocumento(v || pontoDataLocal())}
              disabled={readOnly}
            />
          </Field>
          <Field label="Cidade / UF">
            <input
              className="glass-input"
              value={cidadeUf}
              disabled={readOnly}
              onChange={(e) => setCidadeUf(e.target.value)}
              placeholder="Contagem/MG"
            />
          </Field>
        </div>
      </div>

      <div className="relative mt-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="section-label">Motivo (vai em destaque no PDF)</p>
          <button
            type="button"
            disabled={readOnly}
            onClick={aplicarMotivoPadrao}
            className="text-[0.65rem] uppercase tracking-wider text-[#f2d892] underline-offset-2 hover:underline disabled:opacity-40"
          >
            Montar com as datas
          </button>
        </div>
        <textarea
          className="glass-input min-h-[96px] resize-y text-sm leading-relaxed"
          value={motivo}
          disabled={readOnly}
          onChange={(e) => {
            setMotivo(e.target.value)
            setMotivoEditado(true)
          }}
          placeholder="Descreva o motivo da advertência…"
          aria-label="Motivo da advertência disciplinar"
        />
      </div>

      <dl className="relative mt-4 grid gap-2 rounded-xl border border-[rgba(212,168,83,0.15)] bg-[rgba(20,10,4,0.35)] px-4 py-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-[0.6rem] uppercase tracking-wider text-[#b8957f]">Funcionário</dt>
          <dd className="mt-0.5 text-[#edd9c4]">{funcionarioNome}</dd>
        </div>
        <div>
          <dt className="text-[0.6rem] uppercase tracking-wider text-[#b8957f]">Cargo</dt>
          <dd className="mt-0.5 text-[#edd9c4]">{cargo}</dd>
        </div>
        <div>
          <dt className="text-[0.6rem] uppercase tracking-wider text-[#b8957f]">Empresa</dt>
          <dd className="mt-0.5 text-[#edd9c4]">
            {empresaNome?.trim() || 'GARBO MOVELARIA'}
          </dd>
        </div>
      </dl>
    </section>
  )
}
