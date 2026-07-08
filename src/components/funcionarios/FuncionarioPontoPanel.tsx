import { useEffect, useMemo, useState } from 'react'
import {
  CalendarOff,
  Clock,
  Download,
  FileText,
  Loader2,
  Save,
  Trash2,
} from 'lucide-react'
import { TimeInput } from '@/components/ui/TimeInput'
import { PontoHistoricoDia } from '@/components/ponto/PontoHistoricoDia'
import { LoadingState } from '@/components/ui/EmptyState'
import { AnexoLightbox } from '@/components/contas-pagar/AnexoLightbox'
import {
  DIAS_SEMANA_LABEL,
  PONTO_OCORRENCIA_LABEL,
} from '@/lib/funcionario-constants'
import { labelPontoTipo } from '@/lib/funcionario-ponto'
import { exportarRepArquivos } from '@/lib/rep/rep-export'
import { useFuncionarioPonto, filterPontoDocumentos } from '@/hooks/useFuncionarioPonto'
import type { FuncionarioDocumento, FuncionarioJornada } from '@/types'

interface Props {
  funcionarioId: string
  funcionarioNome: string
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
    reload,
  } = useFuncionarioPonto(funcionarioId)

  const [subTab, setSubTab] = useState<SubTab>('jornada')
  const [form, setForm] = useState(DEFAULT_JORNADA)
  const [saving, setSaving] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [ocData, setOcData] = useState(new Date().toISOString().slice(0, 10))
  const [ocTipo, setOcTipo] = useState<'folga' | 'falta' | 'abono'>('folga')
  const [ocObs, setOcObs] = useState('')
  const [periodoInicio, setPeriodoInicio] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [periodoFim, setPeriodoFim] = useState(new Date().toISOString().slice(0, 10))
  const [previewDoc, setPreviewDoc] = useState<FuncionarioDocumento | null>(null)

  const pontoDocs = useMemo(() => filterPontoDocumentos(documentos), [documentos])

  const marcacoesPorDia = useMemo(() => {
    const map = new Map<string, typeof marcacoes>()
    for (const m of marcacoes) {
      const dia = new Date(m.registrado_em).toLocaleDateString('pt-BR')
      if (!map.has(dia)) map.set(dia, [])
      map.get(dia)!.push(m)
    }
    return [...map.entries()]
  }, [marcacoes])

  useEffect(() => {
    if (jornada) {
      setForm({
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
    if (!jornada) {
      alert('Configure a jornada antes de exportar arquivos fiscais.')
      return
    }
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
    } finally {
      setExportando(false)
    }
  }

  const SUB_TABS: { id: SubTab; label: string }[] = [
    { id: 'jornada', label: 'Jornada' },
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
              <PontoHistoricoDia marcacoes={items} />
            </div>
          ))}
        </div>
      )}

      {subTab === 'ocorrencias' && (
        <div className="space-y-4">
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
        <div className="space-y-2">
          {pontoDocs.length === 0 && (
            <p className="text-sm text-[#b8957f]">Nenhum comprovante de ponto.</p>
          )}
          {pontoDocs.map(doc => (
            <button
              key={doc.id}
              type="button"
              className="glass-card flex w-full items-center justify-between gap-3 p-4 text-left transition hover:border-[rgba(212,168,83,0.4)]"
              onClick={() => setPreviewDoc(doc)}
            >
              <div className="flex items-center gap-3">
                <FileText size={18} className="text-[#f2d892]" />
                <div>
                  <p className="text-sm text-[#edd9c4]">{doc.nome_arquivo}</p>
                  <p className="text-xs text-[#b8957f]">
                    {doc.criado_em ? new Date(doc.criado_em).toLocaleString('pt-BR') : ''}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {subTab === 'fiscal' && (
        <div className="glass-card space-y-4 p-5">
          <h3 className="font-display text-lg text-[#f2d892]">Arquivos REP-P</h3>
          {repConfig && (
            <p className="text-sm text-[#b8957f]">
              NSR atual: {repConfig.nsr_atual} · CNPJ: {repConfig.cnpj || '—'}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Período início">
              <input type="date" className="glass-input" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)} />
            </Field>
            <Field label="Período fim">
              <input type="date" className="glass-input" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)} />
            </Field>
          </div>
          {!readOnly && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-gold btn-sm" disabled={exportando} onClick={() => void handleExport('afd')}>
                {exportando ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                Gerar AFD
              </button>
              <button type="button" className="btn btn-outline btn-sm" disabled={exportando} onClick={() => void handleExport('aej')}>
                Gerar AEJ
              </button>
            </div>
          )}
          {repArquivos.length > 0 && (
            <ul className="space-y-2 text-sm">
              {repArquivos.map(a => (
                <li key={a.id} className="text-[#edd9c4]">
                  {a.tipo.toUpperCase()} — {a.periodo_inicio} a {a.periodo_fim}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {previewDoc && (
        <AnexoLightbox
          open
          imageUrl={previewDoc.previewSignedUrl ?? previewDoc.signedUrl ?? ''}
          title={previewDoc.nome_arquivo}
          kind={previewDoc.kind}
          onClose={() => setPreviewDoc(null)}
        />
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
