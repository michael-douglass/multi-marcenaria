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

export function useBaterPonto() {
  const { isReady } = useAuthReady()
  const [step, setStep] = useState<BaterPontoStep>('permissoes')
  const [status, setStatus] = useState<PontoStatusDiaPayload | null>(null)
  const [geo, setGeo] = useState<GeoPosition | null>(null)
  const [fotoBlob, setFotoBlob] = useState<Blob | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [assinaturaDataUrl, setAssinaturaDataUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<PontoMarcacao | null>(null)

  const reload = useCallback(async () => {
    if (!isReady) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchPontoStatusDia()
      setStatus(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar status do ponto.')
    } finally {
      setLoading(false)
    }
  }, [isReady])

  useEffect(() => { void reload() }, [reload])

  const solicitarLocalizacao = async () => {
    setError(null)
    setSubmitting(true)
    try {
      const pos = await requestGeolocation()
      setGeo(pos)
      setStep('selfie')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao obter localização.')
    } finally {
      setSubmitting(false)
    }
  }

  const definirSelfie = async (file: File) => {
    setError(null)
    setSubmitting(true)
    try {
      const blob = await compressImageToJpeg(file)
      setFotoBlob(blob)
      if (fotoPreview) URL.revokeObjectURL(fotoPreview)
      setFotoPreview(URL.createObjectURL(blob))
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
    setStep('permissoes')
    setGeo(null)
    setFotoBlob(null)
    if (fotoPreview) URL.revokeObjectURL(fotoPreview)
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
    error,
    resultado,
    reload,
    solicitarLocalizacao,
    definirSelfie,
    definirAssinatura,
    registrar,
    reiniciar,
  }
}
