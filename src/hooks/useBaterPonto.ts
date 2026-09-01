import { useCallback, useEffect, useState } from 'react'
import { createId } from '@/lib/utils'
import { compressImageToJpeg, dataUrlToBlob } from '@/lib/compress-image'
import {
  baterPonto,
  fetchPontoStatusDia,
  requestGeolocation,
  sha256Hex,
  uploadPontoArquivo,
  type GeoPosition,
} from '@/lib/funcionario-ponto'
import type { PontoMarcacao, PontoStatusDiaPayload } from '@/types'
import { useAuthReady } from './useAuthReady'

export type BaterPontoStep = 'permissoes' | 'selfie' | 'assinatura' | 'confirmar' | 'sucesso'

const DRAFT_KEY = 'movelaria-ponto-draft'
const RESUME_KEY = 'movelaria-ponto-resume'

interface PontoDraft {
  step: BaterPontoStep
  geo: GeoPosition | null
  fotoDataUrl: string | null
  assinaturaDataUrl: string | null
  savedAt: number
}

function readDraft(): PontoDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const draft = JSON.parse(raw) as PontoDraft
    if (!draft?.step || Date.now() - (draft.savedAt ?? 0) > 1000 * 60 * 60) return null
    if (draft.step === 'sucesso' || draft.step === 'permissoes') return null
    return draft
  } catch {
    return null
  }
}

function writeDraft(draft: Omit<PontoDraft, 'savedAt'>) {
  try {
    if (draft.step === 'permissoes' || draft.step === 'sucesso') {
      sessionStorage.removeItem(DRAFT_KEY)
      sessionStorage.removeItem(RESUME_KEY)
      return
    }
    sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ ...draft, savedAt: Date.now() } satisfies PontoDraft),
    )
    sessionStorage.setItem(RESUME_KEY, '1')
  } catch {
    // Storage cheio ou bloqueado: o fluxo continua sem rascunho.
  }
}

function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY)
    sessionStorage.removeItem(RESUME_KEY)
  } catch {
    // ignore
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Falha ao ler a foto.'))
    reader.readAsDataURL(blob)
  })
}

export function peekPontoResumeFlag(): boolean {
  try {
    return sessionStorage.getItem(RESUME_KEY) === '1'
  } catch {
    return false
  }
}

export function consumePontoResumeFlag(): boolean {
  try {
    const should = sessionStorage.getItem(RESUME_KEY) === '1'
    if (should) sessionStorage.removeItem(RESUME_KEY)
    return should
  } catch {
    return false
  }
}

export function useBaterPonto() {
  const { isReady } = useAuthReady()
  const initialDraft = typeof window !== 'undefined' ? readDraft() : null
  const [step, setStep] = useState<BaterPontoStep>(initialDraft?.step ?? 'permissoes')
  const [status, setStatus] = useState<PontoStatusDiaPayload | null>(null)
  const [geo, setGeo] = useState<GeoPosition | null>(initialDraft?.geo ?? null)
  const [fotoBlob, setFotoBlob] = useState<Blob | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(initialDraft?.fotoDataUrl ?? null)
  const [assinaturaDataUrl, setAssinaturaDataUrl] = useState<string | null>(
    initialDraft?.assinaturaDataUrl ?? null,
  )
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<PontoMarcacao | null>(null)

  // Restaura o blob da foto a partir do rascunho (necessário para registrar depois).
  useEffect(() => {
    if (!initialDraft?.fotoDataUrl || fotoBlob) return
    try {
      setFotoBlob(dataUrlToBlob(initialDraft.fotoDataUrl))
    } catch {
      // Foto do rascunho inválida: usuário refaz a selfie.
      setStep(s => (s === 'assinatura' || s === 'confirmar' ? 'selfie' : s))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na montagem
  }, [])

  useEffect(() => {
    writeDraft({
      step,
      geo,
      fotoDataUrl: fotoPreview,
      assinaturaDataUrl,
    })
  }, [step, geo, fotoPreview, assinaturaDataUrl])

  // Se o app for para segundo plano no meio do fluxo, marca retomada.
  useEffect(() => {
    const markResume = () => {
      if (step !== 'permissoes' && step !== 'sucesso') {
        try {
          sessionStorage.setItem(RESUME_KEY, '1')
        } catch {
          // ignore
        }
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') markResume()
    }
    window.addEventListener('pagehide', markResume)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', markResume)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [step])

  const reload = useCallback(async () => {
    if (!isReady) return
    setLoading(true)
    setStatusError(null)
    try {
      const data = await fetchPontoStatusDia()
      setStatus(data)
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : 'Erro ao carregar status do ponto.')
    } finally {
      setLoading(false)
    }
  }, [isReady])

  useEffect(() => {
    void reload()
  }, [reload])

  const solicitarLocalizacao = () => {
    setError(null)
    setSubmitting(true)
    // Chama o GPS ainda no toque do botão. Se esperarmos (await) e tentarmos
    // de novo depois, o iPhone trata como se a pessoa tivesse recusado.
    requestGeolocation()
      .then((pos) => {
        setGeo(pos)
        setStep('selfie')
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Não foi possível obter sua localização.')
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  const confirmarLocalizacaoManual = (pos: GeoPosition) => {
    setError(null)
    setGeo({ ...pos, origem: 'manual' })
    setStep('selfie')
  }

  const definirSelfie = async (file: File | Blob) => {
    setError(null)
    setSubmitting(true)
    try {
      const blob = await compressImageToJpeg(file)
      setFotoBlob(blob)
      if (fotoPreview?.startsWith('blob:')) URL.revokeObjectURL(fotoPreview)
      const preview = await blobToDataUrl(blob)
      setFotoPreview(preview)
      setStep('assinatura')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao processar foto.')
    } finally {
      setSubmitting(false)
    }
  }

  const definirAssinatura = (dataUrl: string) => {
    setAssinaturaDataUrl(dataUrl)
    setStep('confirmar')
  }

  const registrar = async () => {
    if (!geo || !fotoBlob || !assinaturaDataUrl || !status?.funcionario_id) {
      setError('Complete todos os passos antes de registrar.')
      return
    }
    setSubmitting(true)
    setError(null)
    const marcacaoId = createId()
    try {
      const fotoPath = await uploadPontoArquivo(status.funcionario_id, marcacaoId, 'foto', fotoBlob)
      const assinaturaBlob = dataUrlToBlob(assinaturaDataUrl)
      const assinaturaPath = await uploadPontoArquivo(
        status.funcionario_id,
        marcacaoId,
        'assinatura',
        assinaturaBlob,
      )
      const hashPayload = JSON.stringify({
        marcacaoId,
        geo,
        fotoPath,
        assinaturaPath,
        tipo: status.proximo_tipo,
        ts: new Date().toISOString(),
      })
      const hash = await sha256Hex(hashPayload)
      const res = await baterPonto({
        marcacaoId,
        fotoPath,
        assinaturaPath,
        geo,
        hashSha256: hash,
      })
      clearDraft()
      setResultado(res.marcacao)
      setStep('sucesso')
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao registrar ponto.')
    } finally {
      setSubmitting(false)
    }
  }

  const reiniciar = () => {
    clearDraft()
    setStep('permissoes')
    setGeo(null)
    setFotoBlob(null)
    if (fotoPreview?.startsWith('blob:')) URL.revokeObjectURL(fotoPreview)
    setFotoPreview(null)
    setAssinaturaDataUrl(null)
    setResultado(null)
    setError(null)
  }

  return {
    step,
    setStep,
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
    confirmarLocalizacaoManual,
    definirSelfie,
    definirAssinatura,
    registrar,
    reiniciar,
  }
}
