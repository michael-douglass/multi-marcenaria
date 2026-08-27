import { useEffect, useState } from 'react'
import { AlertTriangle, Camera, ChevronDown, ExternalLink, Loader2, MapPin, Pencil, UserX, X } from 'lucide-react'
import { PontoLocalizacaoLabel } from '@/components/ponto/PontoLocalizacaoLabel'
import { TimeInput } from '@/components/ui/TimeInput'
import {
  enrichMarcacaoUrls,
  formatAtrasoMinutos,
  formatHoraPonto,
  googleMapsUrl,
  horaPrevistaPorTipo,
  labelPontoTipo,
  marcacaoHoraEfetiva,
  PONTO_TIMEZONE,
} from '@/lib/funcionario-ponto'
import type {
  FuncionarioJornada,
  PontoControleJornadaResumo,
  PontoMarcacao,
  PontoMarcacaoComUrls,
} from '@/types'

interface Props {
  marcacoes: PontoMarcacao[]
  jornada?: FuncionarioJornada | PontoControleJornadaResumo | null
  /** Lista simples (hoje) ou detalhada expansível (RH). */
  variant?: 'compact' | 'detailed'
  /** Permite RH ajustar horário (só no variant detailed). */
  editable?: boolean
  onAjustarHorario?: (marcacaoId: string, hora: string, motivo: string) => Promise<void>
}

export function PontoHistoricoDia({
  marcacoes,
  jornada,
  variant = 'compact',
  editable = false,
  onAjustarHorario,
}: Props) {
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [horaEdit, setHoraEdit] = useState('')
  const [motivoEdit, setMotivoEdit] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erroEdit, setErroEdit] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ src: string; label: string } | null>(null)

  const abrirAjuste = (m: PontoMarcacao) => {
    setEditandoId(m.id)
    setHoraEdit(formatHoraPonto(marcacaoHoraEfetiva(m)))
    setMotivoEdit(m.ajuste_motivo ?? '')
    setErroEdit(null)
  }

  const cancelarAjuste = () => {
    setEditandoId(null)
    setHoraEdit('')
    setMotivoEdit('')
    setErroEdit(null)
  }

  const salvarAjuste = async (marcacaoId: string) => {
    if (!onAjustarHorario) return
    if (!horaEdit || horaEdit.length < 4) {
      setErroEdit('Informe o horário (hh:mm).')
      return
    }
    if (motivoEdit.trim().length < 3) {
      setErroEdit('Informe o motivo (mínimo 3 caracteres).')
      return
    }
    setSalvando(true)
    setErroEdit(null)
    try {
      await onAjustarHorario(marcacaoId, horaEdit, motivoEdit.trim())
      cancelarAjuste()
    } catch (e) {
      setErroEdit(e instanceof Error ? e.message : 'Não foi possível ajustar.')
    } finally {
      setSalvando(false)
    }
  }

  if (!marcacoes.length) {
    return (
      <p className="text-sm text-[#b8957f]">Nenhuma batida registrada.</p>
    )
  }

  if (variant === 'compact') {
    return (
      <ul className="space-y-2">
        {marcacoes.map(m => (
          <li
            key={m.id}
            className="flex items-center justify-between rounded-lg border border-[rgba(212,168,83,0.15)] px-3 py-2 text-sm"
          >
            <div>
              <span className="text-[#f2d892]">{labelPontoTipo(m.tipo)}</span>
              {m.nsr && (
                <span className="ml-2 text-[0.65rem] text-[#b8957f]">NSR {m.nsr}</span>
              )}
              {m.origem === 'rh_manual' && (
                <span className="ml-2 text-[0.6rem] uppercase tracking-wider text-amber-300">RH</span>
              )}
            </div>
            <div className="text-right text-[#edd9c4]">
              <div>
              {new Date(marcacaoHoraEfetiva(m)).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: PONTO_TIMEZONE,
              })}
              </div>
              {m.registrado_em_ajustado && (
                <div className="text-[0.65rem] text-amber-300/90">Ajustado</div>
              )}
              {m.status === 'atraso' && (
                <div className="text-xs text-amber-400">Atraso {formatAtrasoMinutos(m.atraso_minutos)}</div>
              )}
            </div>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <>
      <ul className="space-y-2">
        {marcacoes.map(m => (
          <PontoRegistroItem
            key={m.id}
            marcacao={m}
            jornada={jornada}
            editable={editable}
            editando={editandoId === m.id}
            horaEdit={horaEdit}
            motivoEdit={motivoEdit}
            salvando={salvando}
            erroEdit={erroEdit}
            onHoraEdit={setHoraEdit}
            onMotivoEdit={setMotivoEdit}
            onAbrirAjuste={() => abrirAjuste(m)}
            onCancelarAjuste={cancelarAjuste}
            onSalvarAjuste={() => void salvarAjuste(m.id)}
            onPreview={setPreview}
          />
        ))}
      </ul>
      {preview && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={preview.label}
          onClick={() => setPreview(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full border border-white/20 bg-black/40 p-2 text-white"
            aria-label="Fechar foto"
            onClick={() => setPreview(null)}
          >
            <X size={18} />
          </button>
          <img
            src={preview.src}
            alt={preview.label}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}

function PontoRegistroItem({
  marcacao,
  jornada,
  editable,
  editando,
  horaEdit,
  motivoEdit,
  salvando,
  erroEdit,
  onHoraEdit,
  onMotivoEdit,
  onAbrirAjuste,
  onCancelarAjuste,
  onSalvarAjuste,
  onPreview,
}: {
  marcacao: PontoMarcacao
  jornada?: FuncionarioJornada | PontoControleJornadaResumo | null
  editable: boolean
  editando: boolean
  horaEdit: string
  motivoEdit: string
  salvando: boolean
  erroEdit: string | null
  onHoraEdit: (v: string) => void
  onMotivoEdit: (v: string) => void
  onAbrirAjuste: () => void
  onCancelarAjuste: () => void
  onSalvarAjuste: () => void
  onPreview: (preview: { src: string; label: string }) => void
}) {
  const [enriched, setEnriched] = useState<PontoMarcacaoComUrls>(marcacao)
  const [carregandoMidia, setCarregandoMidia] = useState(false)
  const [midiaPedida, setMidiaPedida] = useState(false)

  useEffect(() => {
    setEnriched(prev => ({
      ...marcacao,
      fotoUrl: prev.id === marcacao.id ? prev.fotoUrl : undefined,
      assinaturaUrl: prev.id === marcacao.id ? prev.assinaturaUrl : undefined,
    }))
  }, [marcacao])

  const m = enriched
  const previsto = horaPrevistaPorTipo(m.tipo, jornada)
  const efetivoIso = marcacaoHoraEfetiva(m)
  const realizado = formatHoraPonto(efetivoIso)
  const original = formatHoraPonto(m.registrado_em)
  const temAjuste = Boolean(m.registrado_em_ajustado)
  const hasGeo = m.latitude != null && m.longitude != null
  const temSelfie = Boolean(m.foto_path)

  const carregarMidia = async () => {
    if (midiaPedida || (!m.foto_path && !m.assinatura_path)) return
    setMidiaPedida(true)
    setCarregandoMidia(true)
    try {
      const row = await enrichMarcacaoUrls(m)
      setEnriched(row)
    } finally {
      setCarregandoMidia(false)
    }
  }

  return (
    <li className="ponto-registro">
      <details
        className="ponto-registro__details"
        open={editando || undefined}
        onToggle={e => {
          if (e.currentTarget.open) void carregarMidia()
        }}
      >
        <summary className="ponto-registro__summary">
          <div className="min-w-0 flex-1">
            <span className="text-[#f2d892]">{labelPontoTipo(m.tipo)}</span>
            {m.nsr != null && (
              <span className="ml-2 text-[0.65rem] text-[#b8957f]">NSR {m.nsr}</span>
            )}
            {m.origem === 'rh_manual' && (
              <span className="ml-2 rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wider text-amber-300">
                RH
              </span>
            )}
            {temSelfie && (
              <span className="ml-2 inline-flex items-center gap-1 text-[0.6rem] uppercase tracking-wider text-[#f2d892]">
                <Camera size={11} />
                Foto
              </span>
            )}
            <p className="mt-0.5 text-xs text-[#b8957f]">
              Batido às <span className="text-[#edd9c4]">{realizado}</span>
              {temAjuste && (
                <span className="ml-1 text-amber-300/90">(ajustado · original {original})</span>
              )}
              {previsto && (
                <>
                  {' · '}
                  Previsto <span className="text-[#edd9c4]">{formatHoraPonto(previsto)}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {m.status === 'atraso' && m.atraso_minutos > 0 && (
              <span className="flex items-center gap-1 text-xs text-amber-400">
                <AlertTriangle size={12} />
                +{formatAtrasoMinutos(m.atraso_minutos)}
              </span>
            )}
            <ChevronDown size={16} className="ponto-registro__chevron text-[#b8957f]" />
          </div>
        </summary>

        <div className="ponto-registro__body">
          <dl className="ponto-registro__horarios">
            <div>
              <dt>Horário previsto</dt>
              <dd>{formatHoraPonto(previsto)}</dd>
            </div>
            <div>
              <dt>Horário batido</dt>
              <dd className="text-[#f2d892]">{realizado}</dd>
            </div>
            {temAjuste && (
              <div>
                <dt>Horário original</dt>
                <dd>{original}</dd>
              </div>
            )}
            <div>
              <dt>Data e hora completa</dt>
              <dd>
                {new Date(efetivoIso).toLocaleString('pt-BR', {
                  weekday: 'short',
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: PONTO_TIMEZONE,
                })}
              </dd>
            </div>
          </dl>

          {temAjuste && m.ajuste_motivo && (
            <p className="mt-2 text-xs text-[#b8957f]">
              Motivo do ajuste: <span className="text-[#edd9c4]">{m.ajuste_motivo}</span>
            </p>
          )}
          {m.origem === 'rh_manual' && m.registro_motivo && (
            <p className="mt-2 text-xs text-[#b8957f]">
              Lançado pelo RH: <span className="text-[#edd9c4]">{m.registro_motivo}</span>
            </p>
          )}

          {editable && (
            <div className="mt-3 border-t border-[rgba(212,168,83,0.12)] pt-3">
              {!editando ? (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={e => {
                    e.preventDefault()
                    onAbrirAjuste()
                  }}
                >
                  <Pencil size={14} />
                  Ajustar horário
                </button>
              ) : (
                <div className="space-y-3" onClick={e => e.preventDefault()}>
                  <p className="text-xs text-[#b8957f]">
                    O horário original da batida é preservado. Só a exibição e o atraso são atualizados.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs text-[#b8957f]">
                      Novo horário
                      <TimeInput
                        className="glass-input mt-1"
                        value={horaEdit}
                        onChange={v => onHoraEdit(v ?? '')}
                      />
                    </label>
                    <label className="block text-xs text-[#b8957f]">
                      Motivo
                      <input
                        className="glass-input mt-1"
                        value={motivoEdit}
                        onChange={e => onMotivoEdit(e.target.value)}
                        placeholder="Ex.: correção de saída antecipada"
                      />
                    </label>
                  </div>
                  {erroEdit && (
                    <p className="text-sm text-red-300">{erroEdit}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-gold btn-sm"
                      disabled={salvando}
                      onClick={onSalvarAjuste}
                    >
                      {salvando ? <Loader2 size={14} className="animate-spin" /> : null}
                      Salvar ajuste
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={salvando}
                      onClick={onCancelarAjuste}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {hasGeo ? (
            <a
              href={googleMapsUrl(m.latitude!, m.longitude!)}
              target="_blank"
              rel="noopener noreferrer"
              className="ponto-escala__map"
            >
              <MapPin size={14} />
              <PontoLocalizacaoLabel
                latitude={m.latitude!}
                longitude={m.longitude!}
                precisaoMetros={m.precisao_metros}
              />
              <ExternalLink size={12} className="shrink-0 opacity-70" />
            </a>
          ) : (
            <p className="text-xs text-[#b8957f]">Localização não registrada.</p>
          )}

          <div className="ponto-escala__midia">
            <MidiaThumb
              titulo="Selfie"
              url={m.fotoUrl}
              temArquivo={Boolean(m.foto_path)}
              carregando={carregandoMidia}
              vazioLabel="Sem selfie"
              onOpen={() => m.fotoUrl && onPreview({ src: m.fotoUrl, label: 'Selfie do ponto' })}
            />
            <MidiaThumb
              titulo="Assinatura"
              url={m.assinaturaUrl}
              temArquivo={Boolean(m.assinatura_path)}
              carregando={carregandoMidia}
              vazioLabel="Sem assinatura"
              assinatura
              onOpen={() => m.assinaturaUrl && onPreview({ src: m.assinaturaUrl, label: 'Assinatura do ponto' })}
            />
          </div>
        </div>
      </details>
    </li>
  )
}

function MidiaThumb({
  titulo,
  url,
  temArquivo,
  carregando,
  vazioLabel,
  assinatura,
  onOpen,
}: {
  titulo: string
  url?: string
  temArquivo: boolean
  carregando: boolean
  vazioLabel: string
  assinatura?: boolean
  onOpen: () => void
}) {
  return (
    <div className={`ponto-escala__thumb${assinatura ? ' ponto-escala__thumb--assinatura' : ''}`}>
      <p>{titulo}</p>
      {url ? (
        <button type="button" className="block h-full w-full" onClick={onOpen} aria-label={`Ampliar ${titulo.toLowerCase()}`}>
          <img
            src={url}
            alt={titulo}
            className={`h-full w-full ${assinatura ? 'object-contain bg-[#faf8f5] p-1' : 'object-cover'}`}
          />
        </button>
      ) : carregando && temArquivo ? (
        <div className="flex h-full items-center justify-center text-[#f2d892]">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : temArquivo ? (
        <div className="flex h-full items-center justify-center px-2 text-center text-[10px] text-amber-200/80">
          Foto indisponível
        </div>
      ) : (
        <div className={`flex h-full items-center justify-center ${assinatura ? 'bg-[#faf8f5] text-[10px] text-[#c4b8a8]' : 'text-[#6b5344]'}`}>
          {assinatura ? vazioLabel : <UserX size={24} strokeWidth={1.2} />}
        </div>
      )}
    </div>
  )
}
