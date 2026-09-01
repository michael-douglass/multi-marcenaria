import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  PenLine,
  ShieldCheck,
} from 'lucide-react'
import { AssinaturaCanvas } from '@/components/ui/AssinaturaCanvas'
import { PontoHistoricoDia } from '@/components/ponto/PontoHistoricoDia'
import { PontoLocalizacaoLabel } from '@/components/ponto/PontoLocalizacaoLabel'
import { PontoSelfieCapture } from '@/components/ponto/PontoSelfieCapture'
import { PontoStatusCard } from '@/components/ponto/PontoStatusCard'
import { PontoWizardStep } from '@/components/ponto/PontoWizardStep'
import { ErrorState, LoadingState } from '@/components/ui/EmptyState'
import { labelPontoTipo, formatJornadaResumo } from '@/lib/funcionario-ponto'
import { isGeolocationPermissionDenied } from '@/lib/geolocation'
import { useBaterPonto } from '@/hooks/useBaterPonto'

const STEPS = ['Localização', 'Selfie', 'Assinatura', 'Confirmar']
const STEP_INDEX: Record<string, number> = {
  permissoes: 1,
  selfie: 2,
  assinatura: 3,
  confirmar: 4,
  sucesso: 5,
}

export function BaterPonto({ embedded }: { embedded?: boolean } = {}) {
  const {
    step,
    status,
    geo,
    fotoPreview,
    assinaturaDataUrl,
    loading,
    submitting,
    statusError,
    error,
    resultado,
    reload,
    solicitarLocalizacao,
    definirSelfie,
    definirAssinatura,
    registrar,
    reiniciar,
  } = useBaterPonto()

  const stepNum = STEP_INDEX[step] ?? 1
  const bloqueado = !status?.jornada || !!status?.ocorrencia || !status?.proximo_tipo

  return (
    <div className={embedded ? 'flex flex-col gap-6' : 'fade-in obra-page-shell mx-auto flex max-w-lg flex-col gap-6 p-1 pb-10'}>
      {!embedded && (
        <div>
          <h1 className="font-display flex items-center gap-2 text-[2rem] tracking-wide text-[#f2d892]">
            <Clock size={28} />
            Bater Ponto
          </h1>
          <p className="section-label mt-1">
            Registre sua jornada com localização, foto e assinatura
          </p>
        </div>
      )}

      {loading && <LoadingState message="Carregando seu ponto…" />}

      {!loading && statusError && (
        <div className="flex flex-col items-center gap-3">
          <ErrorState message={statusError} />
          <button type="button" className="btn btn-outline" onClick={() => void reload()}>
            Tentar de novo
          </button>
        </div>
      )}

      {!loading && !statusError && !status && (
        <ErrorState
          message="Só funcionários cadastrados pela empresa podem bater ponto. Peça ao RH para vincular sua pasta."
        />
      )}

      {!loading && status && (
        <>
          {status.jornada && (
            <p className="text-center text-sm text-[#edd9c4]">
              Horário de hoje:{' '}
              <strong className="text-[#f2d892]">{formatJornadaResumo(status.jornada)}</strong>
            </p>
          )}
          <PontoStatusCard status={status} />

          {bloqueado && step !== 'sucesso' && (
            <div className="glass-card border border-amber-500/30 p-5 text-center text-[#edd9c4]">
              {!status.jornada && (
                <p>Aguardando o RH configurar sua jornada de trabalho.</p>
              )}
              {status.ocorrencia && (
                <p>Hoje consta como <strong>{status.ocorrencia}</strong>. Não é possível bater ponto.</p>
              )}
              {!status.proximo_tipo && status.jornada && !status.ocorrencia && (
                <p>Você já completou todas as batidas de hoje.</p>
              )}
            </div>
          )}

          {!bloqueado && step !== 'sucesso' && (
            <div className="glass-card p-5">
              <PontoWizardStep current={stepNum} total={4} labels={STEPS} />

              {error && step !== 'permissoes' && (
                <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              {step === 'permissoes' && (
                <div className="space-y-4 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(212,168,83,0.35)] bg-[rgba(201,160,69,0.1)]">
                    <MapPin size={28} className="text-[#f2d892]" />
                  </div>
                  <p className="text-sm text-[#edd9c4]">
                    Precisamos da sua localização para registrar onde você está batendo ponto.
                    Toque em permitir quando o celular pedir.
                  </p>
                  {error && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-left text-sm text-red-200">
                      <p>{error}</p>
                      {isGeolocationPermissionDenied(error) && (
                        <ol className="mt-3 list-decimal space-y-1.5 pl-4 text-xs text-red-100/90">
                          <li>
                            iPhone: Ajustes → Privacidade e Segurança → Serviços de Localização
                            (ligue) → Safari ou GARBO → Ao Usar o App.
                          </li>
                          <li>
                            Android: toque no cadeado ao lado do endereço do site → Permissões
                            → Localização → Permitir.
                          </li>
                          <li>Volte nesta tela e toque de novo no botão abaixo.</li>
                        </ol>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    className="btn btn-gold w-full"
                    disabled={submitting}
                    onClick={() => solicitarLocalizacao()}
                  >
                    {submitting ? <Loader2 size={18} className="animate-spin" /> : <MapPin size={18} />}
                    {error ? 'Tentar localização de novo' : 'Permitir localização'}
                  </button>
                </div>
              )}

              {step === 'selfie' && (
                <div className="space-y-4">
                  {geo && (
                    <p className="text-center text-xs text-emerald-300">
                      Localização obtida (±{Math.round(geo.accuracy)}m)
                    </p>
                  )}
                  <p className="text-center text-sm text-[#edd9c4]">
                    Tire uma selfie para confirmar sua identidade. A foto fica nesta tela —
                    você não precisa sair do aplicativo.
                  </p>
                  <PontoSelfieCapture
                    submitting={submitting}
                    onCapture={file => void definirSelfie(file)}
                  />
                </div>
              )}

              {step === 'assinatura' && (
                <div className="space-y-4">
                  {fotoPreview && (
                    <img
                      src={fotoPreview}
                      alt="Preview selfie"
                      className="mx-auto h-24 w-24 rounded-full border-2 border-[rgba(212,168,83,0.4)] object-cover"
                    />
                  )}
                  <AssinaturaCanvas
                    onExport={definirAssinatura}
                    hint="Assine na área abaixo e toque em Salvar quando terminar"
                  />
                </div>
              )}

              {step === 'confirmar' && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-[rgba(212,168,83,0.2)] bg-[rgba(36,16,8,0.45)] p-4">
                    <dl className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-[#b8957f]">Batida</dt>
                        <dd className="font-medium text-[#f2d892]">
                          {labelPontoTipo(status.proximo_tipo)}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[#b8957f]">Horário</dt>
                        <dd className="text-[#edd9c4]">
                          {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </dd>
                      </div>
                      {geo && (
                        <div className="flex justify-between gap-4">
                          <dt className="text-[#b8957f]">Local</dt>
                          <dd className="text-right text-xs text-[#edd9c4]">
                            <PontoLocalizacaoLabel
                              latitude={geo.latitude}
                              longitude={geo.longitude}
                              precisaoMetros={geo.accuracy}
                            />
                          </dd>
                        </div>
                      )}
                    </dl>
                    <div className="mt-4 flex justify-center gap-4">
                      {fotoPreview && (
                        <img src={fotoPreview} alt="" className="h-16 w-16 rounded-lg object-cover" />
                      )}
                      {assinaturaDataUrl && (
                        <img src={assinaturaDataUrl} alt="" className="h-16 w-28 rounded-lg bg-white object-contain" />
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-gold w-full"
                    disabled={submitting}
                    onClick={() => void registrar()}
                  >
                    {submitting ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <ShieldCheck size={18} />
                    )}
                    Registrar ponto
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 'sucesso' && resultado && (
            <div className="glass-card animate-in fade-in border border-emerald-500/30 p-8 text-center">
              <CheckCircle2 size={48} className="mx-auto text-emerald-400" />
              <h2 className="mt-4 font-display text-2xl text-[#f2d892]">Ponto registrado!</h2>
              <p className="mt-2 text-[#edd9c4]">
                {labelPontoTipo(resultado.tipo)} — NSR {resultado.nsr}
              </p>
              <p className="mt-1 text-sm text-[#b8957f]">
                Comprovante salvo na sua pasta de documentos.
              </p>
              <div className="mt-6 flex flex-col gap-2">
                <Link to="/meu-perfil" className="btn btn-gold">
                  Ver meu perfil
                </Link>
                <button type="button" className="btn btn-outline" onClick={reiniciar}>
                  Nova batida
                </button>
              </div>
            </div>
          )}

          {status.marcacoes.length > 0 && step !== 'sucesso' && (
            <div className="glass-card p-5">
              <h3 className="mb-3 flex items-center gap-2 font-display text-lg text-[#f2d892]">
                <PenLine size={18} />
                Batidas de hoje
              </h3>
              <PontoHistoricoDia marcacoes={status.marcacoes} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
