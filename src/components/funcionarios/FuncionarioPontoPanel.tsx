import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarOff,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Loader2,
  Save,
  Trash2,
  XCircle,
} from 'lucide-react'
import { DateInput } from '@/components/ui/DateInput'
import { TimeInput } from '@/components/ui/TimeInput'
import { PontoHistoricoDia } from '@/components/ponto/PontoHistoricoDia'
import { PontoComprovantesPanel } from '@/components/funcionarios/PontoComprovantesPanel'
import { AdvertenciaDisciplinarPanel } from '@/components/funcionarios/AdvertenciaDisciplinarPanel'
import { LoadingState } from '@/components/ui/EmptyState'
import {
  DIAS_SEMANA_LABEL,
  PONTO_OCORRENCIA_LABEL,
} from '@/lib/funcionario-constants'
import { getRepArquivoSignedUrl, pontoDataLocal, PONTO_TIMEZONE } from '@/lib/funcionario-ponto'
import { exportarRepArquivos } from '@/lib/rep/rep-export'
import { formatarCnpj, validarExportacaoRep } from '@/lib/rep/rep-validation'
import { showToast } from '@/lib/toast'
import { useFuncionarioPonto, filterPontoDocumentos } from '@/hooks/useFuncionarioPonto'
import type { FuncionarioDocumento, FuncionarioJornada, FuncionarioTipo, RepArquivo } from '@/types'
interface Props {
  funcionarioId: string
  funcionarioNome: string
  funcionarioTipo: FuncionarioTipo
  funcionarioCpf?: string | null
  documentos: FuncionarioDocumento[]
  readOnly?: boolean
  onReload?: () => void
}

const DEFAULT_JORNADA: Omit<FuncionarioJornada, 'id' | 'funcionario_id' | 'criado_em' | 'atualizado_em'> = {
  hora_entrada: '08:00',
  hora_saida_intervalo: '12:00',
  hora_retorno_intervalo: '13:00',
  hora_saida: '17:00',
  tolerancia_minutos: 5,
  dias_uteis: [1, 2, 3, 4, 5],
  ativo: true,
}

type SubTab = 'jornada' | 'registros' | 'ocorrencias' | 'documentos' | 'fiscal'

export function FuncionarioPontoPanel({
  funcionarioId,
  funcionarioNome,
  funcionarioTipo,
  funcionarioCpf,
  documentos,
  readOnly,
  onReload,
}: Props) {
  const {
    jornada,
    marcacoes,
    ocorrencias,
    repConfig,
    repArquivos,
    loading,
    saveJornada,
    addOcorrencia,
    deleteOcorrencia,
    adjustMarcacao,
    reload,
  } = useFuncionarioPonto(funcionarioId)

  const [subTab, setSubTab] = useState<SubTab>('jornada')
  const [form, setForm] = useState(DEFAULT_JORNADA)
  const [saving, setSaving] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [baixandoId, setBaixandoId] = useState<string | null>(null)
  const [ocData, setOcData] = useState(pontoDataLocal())
  const [ocTipo, setOcTipo] = useState<'folga' | 'falta' | 'abono'>('folga')
  const [ocObs, setOcObs] = useState('')
  const [periodoInicio, setPeriodoInicio] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [periodoFim, setPeriodoFim] = useState(pontoDataLocal())

  const pontoDocs = useMemo(() => filterPontoDocumentos(documentos), [documentos])

  const checklistExport = useMemo(() => validarExportacaoRep({
    tipo: 'afd',
    repConfig,
    funcionarioCpf: funcionarioCpf ?? '',
    jornada,
    marcacoes,
    periodoInicio,
    periodoFim,
  }), [repConfig, funcionarioCpf, jornada, marcacoes, periodoInicio, periodoFim])
  const marcacoesPorDia = useMemo(() => {
    const map = new Map<string, typeof marcacoes>()
    for (const m of marcacoes) {
      const dia = new Date(m.registrado_em).toLocaleDateString('pt-BR', { timeZone: PONTO_TIMEZONE })
      if (!map.has(dia)) map.set(dia, [])
      map.get(dia)!.push(m)
    }
    return [...map.entries()]
  }, [marcacoes])

  useEffect(() => {
    if (jornada) {      setForm({
        hora_entrada: jornada.hora_entrada?.slice(0, 5) ?? '08:00',
        hora_saida_intervalo: jornada.hora_saida_intervalo?.slice(0, 5) ?? '12:00',
        hora_retorno_intervalo: jornada.hora_retorno_intervalo?.slice(0, 5) ?? '13:00',
        hora_saida: jornada.hora_saida?.slice(0, 5) ?? '17:00',
        tolerancia_minutos: jornada.tolerancia_minutos ?? 5,
        dias_uteis: jornada.dias_uteis ?? [1, 2, 3, 4, 5],
        ativo: jornada.ativo ?? true,
      })
    }
  }, [jornada])

  if (loading) return <LoadingState message="Carregando ponto…" />

  const handleSaveJornada = async () => {
    setSaving(true)
    try {
      await saveJornada(form)
      onReload?.()
    } finally {
      setSaving(false)
    }
  }

  const handleOcorrencia = async () => {
    setSaving(true)
    try {
      await addOcorrencia(ocData, ocTipo, ocObs || undefined)
      setOcObs('')
    } finally {
      setSaving(false)
    }
  }

  const handleExport = async (tipo: 'afd' | 'aej') => {
    const check = validarExportacaoRep({
      tipo,
      repConfig,
      funcionarioCpf: funcionarioCpf ?? '',
      jornada,
      marcacoes,
      periodoInicio,
      periodoFim,
    })
    if (!check.ok) {
      showToast(check.erros[0] ?? 'Verifique os requisitos da exportação fiscal.', 'error')
      return
    }
    if (!jornada) return

    setExportando(true)
    try {
      await exportarRepArquivos({
        tipo,
        funcionarioId,
        funcionarioNome,
        funcionarioCpf: funcionarioCpf ?? '',
        jornada,
        marcacoes,
        ocorrencias,
        repConfig,
        periodoInicio,
        periodoFim,
      })
      await reload()
      showToast(tipo === 'afd' ? 'Arquivo AFD gerado e baixado.' : 'Arquivo AEJ gerado e baixado.')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao gerar arquivo fiscal.', 'error')
    } finally {
      setExportando(false)
    }
  }

  const handleDownloadArquivo = async (arquivo: RepArquivo) => {
    setBaixandoId(arquivo.id)
    try {
      const url = await getRepArquivoSignedUrl(arquivo.arquivo_path)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao baixar arquivo.', 'error')
    } finally {
      setBaixandoId(null)
    }
  }

  const SUB_TABS: { id: SubTab; label: string }[] = [    { id: 'jornada', label: 'Jornada' },
    { id: 'registros', label: 'Registros' },
    { id: 'ocorrencias', label: 'Ocorrências' },
    { id: 'documentos', label: 'Comprovantes' },
    { id: 'fiscal', label: 'Exportação Fiscal' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 border-b border-[rgba(212,168,83,0.15)] pb-3">
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-[0.72rem] uppercase tracking-wider transition-colors ${
              subTab === t.id
                ? 'bg-[rgba(240,210,140,0.12)] text-[#f2d892]'
                : 'text-[#b8957f] hover:text-[#edd9c4]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'jornada' && (
        <div className="glass-card space-y-4 p-5">
          <h3 className="flex items-center gap-2 font-display text-lg text-[#f2d892]">
            <Clock size={18} />
            Horários de trabalho
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Entrada">
              <TimeInput value={form.hora_entrada} onChange={v => setForm(p => ({ ...p, hora_entrada: v ?? '08:00' }))} disabled={readOnly} />
            </Field>
            <Field label="Saída almoço">
              <TimeInput value={form.hora_saida_intervalo} onChange={v => setForm(p => ({ ...p, hora_saida_intervalo: v ?? '12:00' }))} disabled={readOnly} />
            </Field>
            <Field label="Retorno almoço">
              <TimeInput value={form.hora_retorno_intervalo} onChange={v => setForm(p => ({ ...p, hora_retorno_intervalo: v ?? '13:00' }))} disabled={readOnly} />
            </Field>
            <Field label="Saída">
              <TimeInput value={form.hora_saida} onChange={v => setForm(p => ({ ...p, hora_saida: v ?? '17:00' }))} disabled={readOnly} />
            </Field>
          </div>
          <Field label="Tolerância (minutos)">
            <input
              type="number"
              min={0}
              max={60}
              className="glass-input w-24"
              value={form.tolerancia_minutos}
              disabled={readOnly}
              onChange={e => setForm(p => ({ ...p, tolerancia_minutos: Number(e.target.value) || 0 }))}
            />
          </Field>
          <div>
            <p className="section-label mb-2">Dias úteis</p>
            <div className="flex flex-wrap gap-2">
              {DIAS_SEMANA_LABEL.map((label, i) => {
                const dow = i + 1
                const active = form.dias_uteis.includes(dow)
                return (
                  <button
                    key={label}
                    type="button"
                    disabled={readOnly}
                    onClick={() => setForm(p => ({
                      ...p,
                      dias_uteis: active
                        ? p.dias_uteis.filter(d => d !== dow)
                        : [...p.dias_uteis, dow].sort(),
                    }))}
                    className={`rounded-full px-3 py-1 text-xs uppercase tracking-wider ${
                      active
                        ? 'border border-[#f2d892]/40 bg-[#f2d892]/10 text-[#f2d892]'
                        : 'border border-[rgba(212,168,83,0.2)] text-[#b8957f]'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
          {!readOnly && (
            <button type="button" className="btn btn-gold" disabled={saving} onClick={() => void handleSaveJornada()}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Salvar jornada
            </button>
          )}
        </div>
      )}

      {subTab === 'registros' && (
        <div className="space-y-4">
          {marcacoesPorDia.length === 0 && (
            <p className="text-sm text-[#b8957f]">Nenhum registro de ponto ainda.</p>
          )}
          {marcacoesPorDia.map(([dia, items]) => (
            <div key={dia} className="glass-card p-4">
              <h4 className="mb-3 font-display text-[#f2d892]">{dia}</h4>
              <PontoHistoricoDia
                marcacoes={items}
                jornada={jornada}
                variant="detailed"
                editable={!readOnly}
                onAjustarHorario={
                  readOnly
                    ? undefined
                    : async (marcacaoId, hora, motivo) => {
                        try {
                          await adjustMarcacao(marcacaoId, hora, motivo)
                          showToast('Horário ajustado com sucesso.')
                        } catch (e) {
                          showToast(e instanceof Error ? e.message : 'Erro ao ajustar horário.', 'error')
                          throw e
                        }
                      }
                }
              />
            </div>
          ))}
        </div>
      )}

      {subTab === 'ocorrencias' && (
        <div className="space-y-4">
          <AdvertenciaDisciplinarPanel
            funcionarioNome={funcionarioNome}
            funcionarioTipo={funcionarioTipo}
            funcionarioCpf={funcionarioCpf}
            ocorrencias={ocorrencias}
            empresaNome={repConfig?.razao_social}
            empresaCnpj={repConfig?.cnpj}
            readOnly={readOnly}
          />

          {!readOnly && (
            <div className="glass-card space-y-3 p-5">
              <h3 className="flex items-center gap-2 font-display text-lg text-[#f2d892]">
                <CalendarOff size={18} />
                Registrar folga / falta / abono
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Data">
                  <input type="date" className="glass-input" value={ocData} onChange={e => setOcData(e.target.value)} />
                </Field>
                <Field label="Tipo">
                  <select className="glass-input" value={ocTipo} onChange={e => setOcTipo(e.target.value as typeof ocTipo)}>
                    <option value="folga">Folga</option>
                    <option value="falta">Falta</option>
                    <option value="abono">Abono</option>
                  </select>
                </Field>
                <Field label="Observação">
                  <input className="glass-input" value={ocObs} onChange={e => setOcObs(e.target.value)} placeholder="Opcional" />
                </Field>
              </div>
              <button type="button" className="btn btn-gold btn-sm" disabled={saving} onClick={() => void handleOcorrencia()}>
                Registrar ocorrência
              </button>
            </div>
          )}
          <ul className="space-y-2">
            {ocorrencias.map(o => (
              <li key={o.id} className="glass-card flex items-center justify-between gap-3 p-4 text-sm">
                <div>
                  <span className="text-[#f2d892]">{PONTO_OCORRENCIA_LABEL[o.tipo]}</span>
                  <span className="mx-2 text-[#b8957f]">·</span>
                  <span className="text-[#edd9c4]">{new Date(o.data + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                  {o.observacao && <p className="mt-1 text-[#b8957f]">{o.observacao}</p>}
                  {o.automatica && <span className="text-xs text-amber-400"> (automática)</span>}
                </div>
                {!readOnly && (
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => void deleteOcorrencia(o.id)}>
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {subTab === 'documentos' && (
        <PontoComprovantesPanel
          funcionarioNome={funcionarioNome}
          marcacoes={marcacoes}
          documentos={pontoDocs}
          repCnpj={repConfig?.cnpj}
        />
      )}

      {subTab === 'fiscal' && (
        <div className="space-y-4">
          {repConfig && (
            <div className="glass-card flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div>
                <p className="text-[#edd9c4]">{repConfig.razao_social}</p>
                <p className="text-[#b8957f]">
                  CNPJ {formatarCnpj(repConfig.cnpj)} · NSR {repConfig.nsr_atual}
                  {repConfig.certificado_configurado && ' · Certificado digital ativo'}
                </p>
              </div>
              <Link to="/configuracoes?tab=ponto" className="btn btn-outline btn-sm inline-flex items-center gap-1.5">
                <ExternalLink size={14} />
                Configurar empresa
              </Link>
            </div>
          )}

          <div className="glass-card space-y-4 p-5">
            <h3 className="font-display text-lg text-[#f2d892]">Exportar arquivos fiscais</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Período início (dia / mês / ano)">
                <DateInput
                  value={periodoInicio}
                  onChange={iso => {
                    if (iso) setPeriodoInicio(iso)
                  }}
                  aria-label="Período início"
                />
              </Field>
              <Field label="Período fim (dia / mês / ano)">
                <DateInput
                  value={periodoFim}
                  onChange={iso => {
                    if (iso) setPeriodoFim(iso)
                  }}
                  aria-label="Período fim"
                />
              </Field>
            </div>

            <div className="space-y-2 rounded-lg border border-[rgba(212,168,83,0.15)] p-4">
              <p className="section-label">Requisitos para exportação</p>
              {checklistExport.erros.map(msg => (
                <p key={msg} className="flex items-start gap-2 text-sm text-red-300">
                  <XCircle size={16} className="mt-0.5 shrink-0" />
                  {msg}
                </p>
              ))}
              {checklistExport.erros.length === 0 && (
                <p className="flex items-center gap-2 text-sm text-emerald-300">
                  <CheckCircle2 size={16} />
                  Todos os requisitos obrigatórios estão atendidos.
                </p>
              )}
              {checklistExport.avisos.map(msg => (
                <p key={msg} className="flex items-start gap-2 text-sm text-amber-300">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  {msg}
                </p>
              ))}
            </div>

            {!readOnly && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-gold btn-sm"
                  disabled={exportando || !checklistExport.ok}
                  onClick={() => void handleExport('afd')}
                >
                  {exportando ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  Gerar AFD
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={exportando || !checklistExport.ok}
                  onClick={() => void handleExport('aej')}
                >
                  Gerar AEJ
                </button>
              </div>
            )}

            <p className="text-xs text-[#b8957f]">
              AFD: arquivo fonte de dados com as marcações de ponto. AEJ: arquivo eletrônico de jornada com horários, batidas e ocorrências.
            </p>
          </div>

          {repArquivos.length > 0 && (
            <div className="glass-card space-y-3 p-5">
              <h4 className="font-display text-[#f2d892]">Arquivos gerados deste funcionário</h4>
              <ul className="space-y-2">
                {repArquivos.map(a => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[rgba(212,168,83,0.12)] p-3 text-sm">
                    <div>
                      <p className="text-[#edd9c4]">{a.tipo.toUpperCase()} — {a.periodo_inicio} a {a.periodo_fim}</p>
                      {a.criado_em && (
                        <p className="text-xs text-[#b8957f]">
                          Gerado em {new Date(a.criado_em).toLocaleString('pt-BR')}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={baixandoId === a.id}
                      onClick={() => void handleDownloadArquivo(a)}
                    >
                      {baixandoId === a.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                      Baixar
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="section-label">{label}</span>
      {children}
    </label>
  )
}
