import { useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus, Loader2, SwitchCamera } from 'lucide-react'

interface Props {
  submitting?: boolean
  onCapture: (file: File) => void | Promise<void>
}

/**
 * Selfie na própria tela (getUserMedia).
 * Evita abrir a câmera nativa do celular, que costuma matar o PWA
 * e devolver o usuário na página inicial no meio do fluxo de ponto.
 */
export function PontoSelfieCapture({ submitting = false, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [starting, setStarting] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function startCamera() {
      setStarting(true)
      setCameraReady(false)
      setCameraError(null)
      stopStream()

      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) {
          setCameraError('Câmera na tela indisponível neste aparelho. Use a galeria abaixo.')
          setStarting(false)
        }
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 720 },
            height: { ideal: 720 },
          },
        })
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          await video.play().catch(() => undefined)
        }
        setCameraReady(true)
      } catch {
        if (!cancelled) {
          setCameraError(
            'Não foi possível abrir a câmera na tela. Você pode escolher uma foto da galeria.',
          )
        }
      } finally {
        if (!cancelled) setStarting(false)
      }
    }

    void startCamera()
    return () => {
      cancelled = true
      stopStream()
    }
  }, [facingMode])

  function stopStream() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    const video = videoRef.current
    if (video) video.srcObject = null
  }

  const tirarFoto = async () => {
    const video = videoRef.current
    if (!video || !cameraReady || submitting) return

    const w = video.videoWidth || 640
    const h = video.videoHeight || 640
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, w, h)

    const blob = await new Promise<Blob | null>(resolve => {
      canvas.toBlob(resolve, 'image/jpeg', 0.85)
    })
    if (!blob) return

    const file = new File([blob], `selfie-${Date.now()}.jpg`, { type: 'image/jpeg' })
    stopStream()
    await onCapture(file)
  }

  return (
    <div className="space-y-4">
      <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl border border-[rgba(212,168,83,0.35)] bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="h-full w-full object-cover"
          style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : undefined }}
        />
        {(starting || !cameraReady) && !cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-sm text-[#edd9c4]">
            <Loader2 size={28} className="animate-spin text-[#f2d892]" />
            Abrindo câmera…
          </div>
        )}
        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-[rgba(36,16,8,0.92)] p-6 text-center text-sm text-[#edd9c4]">
            {cameraError}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {cameraReady && (
          <button
            type="button"
            className="btn btn-gold w-full"
            disabled={submitting}
            onClick={() => void tirarFoto()}
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
            Tirar selfie
          </button>
        )}

        {cameraReady && (
          <button
            type="button"
            className="btn btn-outline w-full"
            disabled={submitting || starting}
            onClick={() => setFacingMode(m => (m === 'user' ? 'environment' : 'user'))}
          >
            <SwitchCamera size={18} />
            Inverter câmera
          </button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) void onCapture(f)
            e.target.value = ''
          }}
        />
        <button
          type="button"
          className="btn btn-outline w-full"
          disabled={submitting}
          onClick={() => fileRef.current?.click()}
        >
          {submitting ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
          Escolher da galeria
        </button>
      </div>
    </div>
  )
}
