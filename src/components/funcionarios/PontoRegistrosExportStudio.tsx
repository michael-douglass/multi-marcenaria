import { useMemo, useState, type ReactNode } from 'react'
import {
  Camera,
  FileDown,
  FileImage,
  FileText,
  Loader2,
  PenLine,
  ScrollText,
} from 'lucide-react'
import { DateInput } from '@/components/ui/DateInput'
import { Modal } from '@/components/ui/Modal'
import { PontoExportShaderBackdrop } from '@/components/ponto/PontoExportShaderBackdrop'
import {
  formatMinutosComSinal,
  formatMinutosHoraExtra,
  periodoMesCorrente,
  periodoSemanaCorrente,
  pontoDataLocal,
} from '@/lib/funcionario-ponto'
import { montarEspelhoPontoPeriodo } from '@/lib/ponto-espelho-periodo'
import {
  baixarEspelhoPontoJpg,
  buildEspelhoPontoHtml,
  imprimirEspelhoPontoPdf,
  prepararEspelhoPontoExport,
  type PontoRegistrosExportOptions,
} from '@/lib/ponto-registros-export'
import { formatDataCurtaPonto } from '@/lib/resumo-ponto-pdf'
import { showToast } from '@/lib/toast'
import type {
  FuncionarioJornada,
  FuncionarioTipo,
  PontoMarcacao,
  PontoOcorrencia,
} from '@/types'

interface Props {
  funcionarioId: string
  funcionarioNome: string
  funcionarioTipo: FuncionarioTipo
  jornada: FuncionarioJornada | null
  marcacoes: PontoMarcacao[]
  ocorrencias: PontoOcorrencia[]
  repCnpj?: string | null
}

type PeriodoPreset = 'semana' | 'mes' | 'personalizado'

function ToggleMidia({
  checked,
  onChange,
  icon,
  title,
  hint,
  disabled,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  icon: ReactNode
  title: string
  hint: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={
        'flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition ' +
        (checked
          ? 'border-[rgba(242,216,146,0.45)] bg-[rgba(242,216,146,0.10)]'
          : 'border-[rgba(212,168,83,0.18)] bg-[rgba(20,10,4,0.28)] hover:border-[rgba(212,168,83,0.35)]')
      }
    >
      <span
        className={
          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ' +
          (checked
            ? 'border-[rgba(242,216,146,0.55)] text-[#f2d892]'
            : 'border-[rgba(212,168,83,0.25)] text-[#b8957f]')
        }
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-[#edd9c4]">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-[#b8957f]">{hint}</span>
      </span>
      <span
        className={
          'relative mt-1 h-5 w-9 shrink-0 rounded-full transition-colors ' +
          (checked ? 'bg-[#f2d892]' : 'bg-[rgba(80,52,36,0.9)]')
        }
      >
        <span
          className={
            'absolute top-0.5 h-4 w-4 rounded-full transition-transform ' +
            (checked ? 'translate-x-4 bg-[#2a1812]' : 'translate-x-0.5 bg-[#edd9c4]')
          }
        />
      </span>
    </button>
  )
}

export function PontoRegistrosExportStudio({
  funcionarioId,
  funcionarioNome,
  funcionarioTipo,
  jornada,
  marcacoes,
  ocorrencias,
  repCnpj,
}: Props) {
  const hoje = pontoDataLocal()
  const mes = periodoMesCorrente()
  const [open, setOpen] = useState(false)
  const [preset, setPreset] = useState<PeriodoPreset>('mes')
  const [de, setDe] = useState(mes.de)
  const [ate, setAte] = useState(mes.ate)
  const [incluirFoto, setIncluirFoto] = useState(true)
  const [incluirAssinatura, setIncluirAssinatura] = useState(true)
  const [exportando, setExportando] = useState<'pdf' | 'jpg' | null>(null)

  const aplicarPreset = (p: PeriodoPreset) => {
    setPreset(p)
    if (p === 'semana') {
      const per = periodoSemanaCorrente()
      setDe(per.de)
      setAte(per.ate)
    } else if (p === 'mes') {
      const per = periodoMesCorrente()
      setDe(per.de)
      setAte(per.ate)
    }
  }

  const periodoLabel =
    preset === 'semana' ? 'Esta semana' : preset === 'mes' ? 'Este mês' : 'Personalizado'
  const intervaloLabel = `${formatDataCurtaPonto(de)} a ${formatDataCurtaPonto(ate)}`

  const espelho = useMemo(
    () =>
      montarEspelhoPontoPeriodo({
        funcionarioId,
        funcionarioNome,
        funcionarioTipo,
        jornada,
        marcacoes,
        ocorrencias,
        de,
        ate,
      }),
    [funcionarioId, funcionarioNome, funcionarioTipo, jornada, marcacoes, ocorrencias, de, ate],
  )

  const options: PontoRegistrosExportOptions = {
    incluirFoto,
    incluirAssinatura,
    periodoLabel,
    intervaloLabel,
    jornada,
    repCnpj,
  }

  const paginasEstimadas =
    1 + (incluirFoto || incluirAssinatura ? espelho.marcacoes.length : 0)

  const exportar = async (modo: 'pdf' | 'jpg') => {
    if (exportando) return
    if (de > ate) {
      showToast('A data inicial não pode ser depois da final.', 'error')
      return
    }
    setExportando(modo)
    try {
      const midia = await prepararEspelhoPontoExport(espelho, options)
      if (modo === 'pdf') {
        imprimirEspelhoPontoPdf(buildEspelhoPontoHtml(espelho, options, midia))
        showToast('Espelho aberto — escolha “Salvar como PDF” na impressão.')
      } else {
        const n = await baixarEspelhoPontoJpg(espelho, options, midia)
        showToast(n === 1 ? 'Imagem do espelho baixada.' : `${n} imagens do espelho baixadas.`)
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Não foi possível exportar o espelho de ponto.',
        'error',
      )
    } finally {
      setExportando(null)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative inline-flex items-center gap-2 overflow-hidden rounded-lg border border-[rgba(107,63,18,0.35)] bg-[#f4e4c4] px-3.5 py-2 text-[0.78rem] font-semibold uppercase tracking-wider text-[#6b3f12] shadow-[0_8px_24px_rgba(42,24,18,0.08)] transition duration-300 hover:-translate-y-0.5 hover:border-[rgba(107,63,18,0.55)] hover:text-[#1a100c]"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100"
          style={{
            background:
              'radial-gradient(circle at 20% 0%, rgba(242,216,146,0.18), transparent 55%)',
          }}
        />
        <FileDown size={15} className="relative" />
        <span className="relative">Exportar espelho</span>
      </button>

      <Modal
        open={open}
        onClose={() => !exportando && setOpen(false)}
        title="ESPELHO DE PONTO"
        wide
        closeOnBackdrop={!exportando}
      >
        <div className="space-y-5">
          <div className="relative overflow-hidden rounded-xl border border-[rgba(212,168,83,0.28)]">
            <PontoExportShaderBackdrop />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.12]"
              style={{
                backgroundImage:
                  'url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%222%22/></filter><rect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22 opacity=%220.55%22/></svg>")',
              }}
            />
            <div className="relative z-[1] flex items-start gap-3 p-4">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[rgba(107,63,18,0.35)] bg-[#f4e4c4] text-[#6b3f12]">
                <ScrollText size={18} />
              </div>
              <div>
                <p className="font-display text-lg tracking-wide text-[#1a100c]">
                  Documento completo do período
                </p>
                <p className="mt-1 text-sm leading-relaxed text-[#4a3428]">
                  Junta horas extras, faltas, folgas e abonos numa folha só — e, se você quiser,
                  imprime também a foto e a assinatura de cada batida.
                </p>
              </div>
            </div>
          </div>

          <div>
            <p className="section-label mb-2">Período</p>
            <div className="flex flex-wrap gap-2">
              {(['semana', 'mes', 'personalizado'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => aplicarPreset(p)}
                  className={`rounded-lg px-3 py-1.5 text-xs uppercase tracking-wider ${
                    preset === p
                      ? 'bg-[#f4e4c4] text-[#6b3f12]'
                      : 'border border-[rgba(26,16,12,0.16)] text-[#4a3428] hover:text-[#1a100c]'
                  }`}
                >
                  {p === 'semana' ? 'Esta semana' : p === 'mes' ? 'Este mês' : 'Dias específicos'}
                </button>
              ))}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="section-label">De</span>
                <DateInput
                  value={de}
                  onChange={(iso) => {
                    if (!iso) return
                    setPreset('personalizado')
                    setDe(iso)
                  }}
                  aria-label="Data inicial do espelho"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="section-label">Até</span>
                <DateInput
                  value={ate}
                  onChange={(iso) => {
                    if (!iso) return
                    setPreset('personalizado')
                    setAte(iso > hoje ? hoje : iso)
                  }}
                  aria-label="Data final do espelho"
                />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Kpi label="Hora extra" value={formatMinutosHoraExtra(espelho.horaExtraMinutos)} tone={espelho.horaExtraMinutos > 0 ? 'pos' : 'muted'} />
            <Kpi
              label="Atrasos"
              value={espelho.atrasoMinutos > 0 ? `−${formatMinutosHoraExtra(espelho.atrasoMinutos)}` : '0min'}
              tone={espelho.atrasoMinutos > 0 ? 'neg' : 'muted'}
            />
            <Kpi label="Faltas" value={String(espelho.row.faltas)} tone={espelho.row.faltas > 0 ? 'neg' : 'muted'} />
            <Kpi
              label="Saldo"
              value={formatMinutosComSinal(espelho.saldoMinutos)}
              tone={espelho.saldoMinutos > 0 ? 'pos' : espelho.saldoMinutos < 0 ? 'neg' : 'muted'}
            />
          </div>
          <p className="text-xs text-[#b8957f]">
            {espelho.marcacoes.length} batida{espelho.marcacoes.length === 1 ? '' : 's'}
            {' · '}
            {espelho.folgas.length} folga{espelho.folgas.length === 1 ? '' : 's'}
            {' · '}
            {espelho.abonos.length} abono{espelho.abonos.length === 1 ? '' : 's'}
            {' · '}
            {espelho.batidasComFoto} com foto
            {' · '}
            {espelho.batidasComAssinatura} com assinatura
            {' · '}
            cerca de {paginasEstimadas} página{paginasEstimadas === 1 ? '' : 's'}
          </p>

          <div className="space-y-2">
            <p className="section-label">O que imprimir nas batidas</p>
            <ToggleMidia
              checked={incluirFoto}
              onChange={setIncluirFoto}
              disabled={!!exportando}
              icon={<Camera size={16} />}
              title="Imprimir foto de batida"
              hint={
                espelho.batidasComFoto
                  ? `${espelho.batidasComFoto} selfie${espelho.batidasComFoto === 1 ? '' : 's'} neste período.`
                  : 'Nenhuma selfie neste período — o quadro sai em branco.'
              }
            />
            <ToggleMidia
              checked={incluirAssinatura}
              onChange={setIncluirAssinatura}
              disabled={!!exportando}
              icon={<PenLine size={16} />}
              title="Imprimir assinatura do funcionário"
              hint={
                espelho.batidasComAssinatura
                  ? `${espelho.batidasComAssinatura} assinatura${espelho.batidasComAssinatura === 1 ? '' : 's'} neste período.`
                  : 'Nenhuma assinatura neste período — o quadro sai em branco.'
              }
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-gold btn-md flex-1 sm:flex-none"
              disabled={!!exportando}
              onClick={() => void exportar('pdf')}
            >
              {exportando === 'pdf' ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <FileText size={15} />
              )}
              Exportar PDF
            </button>
            <button
              type="button"
              className="btn btn-outline btn-md flex-1 sm:flex-none"
              disabled={!!exportando}
              onClick={() => void exportar('jpg')}
            >
              {exportando === 'jpg' ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <FileImage size={15} />
              )}
              Exportar imagem
            </button>
          </div>

          <p className="text-xs text-[#8a6d5c]">
            No PDF, use “Salvar como PDF” na janela de impressão. A imagem baixa uma folha A4 por
            vez no computador.
          </p>
        </div>
      </Modal>
    </>
  )
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'pos' | 'neg' | 'muted'
}) {
  const toneClass =
    tone === 'pos' ? 'text-[#86efac]' : tone === 'neg' ? 'text-[#fca5a5]' : 'text-[#f2d892]'
  return (
    <div className="rounded-xl border border-[rgba(212,168,83,0.18)] bg-[rgba(20,10,4,0.28)] px-3 py-2.5">
      <p className="section-label mb-1">{label}</p>
      <p className={`font-display text-xl tabular-nums tracking-wide ${toneClass}`}>
        {value}
      </p>
    </div>
  )
}
