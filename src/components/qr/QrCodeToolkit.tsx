import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Camera, Copy, QrCode, RefreshCw } from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { copyText } from '@/lib/qr/copy-text'
import { generateQrDataUrl, prepareQrPayload } from '@/lib/qr/generate-qr'
import { showToast } from '@/lib/toast'
import { cn } from '@/lib/utils'

type Tab = 'gerar' | 'ler'

interface QrCodeToolkitProps {
  /** Classe extra no botão do ícone (ex.: alinhamento no header). */
  className?: string
}

export function QrCodeToolkit({ className }: QrCodeToolkitProps) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('gerar')

  const [input, setInput] = useState('')
  const [payload, setPayload] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const [scannedText, setScannedText] = useState('')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)

  const scannerRegionId = useId().replace(/:/g, '')
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const handledScanRef = useRef(false)

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current
    scannerRef.current = null
    setScanning(false)
    if (!scanner) return
    try {
      if (scanner.isScanning) {
        await scanner.stop()
      }
      scanner.clear()
    } catch {
      // câmera já pode ter sido liberada
    }
  }, [])

  const close = useCallback(() => {
    void stopCamera()
    setOpen(false)
  }, [stopCamera])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    setScannedText('')
    handledScanRef.current = false
    await stopCamera()

    const el = document.getElementById(scannerRegionId)
    if (!el) {
      setCameraError('Área da câmera não encontrada. Tente de novo.')
      return
    }

    try {
      const scanner = new Html5Qrcode(scannerRegionId)
      scannerRef.current = scanner
      setScanning(true)

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 8,
          qrbox: { width: 240, height: 240 },
          aspectRatio: 1,
        },
        async decoded => {
          if (handledScanRef.current) return
          handledScanRef.current = true
          const text = decoded.trim()
          setScannedText(text)
          await copyText(text, 'Número completo copiado')
          await stopCamera()
        },
        () => {
          // frames sem QR — ignorar
        },
      )
    } catch (err) {
      setScanning(false)
      scannerRef.current = null
      const msg =
        err instanceof Error
          ? err.message
          : 'Não foi possível acessar a câmera. Verifique a permissão no navegador.'
      setCameraError(msg)
      showToast('Câmera indisponível ou sem permissão.', 'error')
    }
  }, [scannerRegionId, stopCamera])

  useEffect(() => {
    if (!open) return
    if (tab === 'ler') {
      // espera o DOM do modal montar a div do scanner
      const t = window.setTimeout(() => {
        void startCamera()
      }, 80)
      return () => {
        window.clearTimeout(t)
        void stopCamera()
      }
    }
    void stopCamera()
  }, [open, tab, startCamera, stopCamera])

  useEffect(() => {
    if (!open) {
      void stopCamera()
    }
  }, [open, stopCamera])

  const handleGenerate = async () => {
    const prepared = prepareQrPayload(input)
    if (!prepared.payload) {
      showToast('Cole ou digite um número/código para gerar o QR.', 'error')
      return
    }

    setGenerating(true)
    try {
      const url = await generateQrDataUrl(prepared.payload)
      setPayload(prepared.payload)
      setQrDataUrl(url)
      if (prepared.compacted) {
        showToast('Linha compactada: sem espaços/pontos no QR.')
      }
    } catch {
      showToast('Não foi possível gerar o QR Code.', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const handleCopyPayload = () => {
    void copyText(payload || input, 'Número copiado')
  }

  const handleCopyScanned = () => {
    void copyText(scannedText, 'Número completo copiado')
  }

  const handleLerOutro = () => {
    void startCamera()
  }

  return (
    <>
      <button
        type="button"
        className={cn('btn btn-outline btn-sm !px-2.5 !py-1.5', className)}
        onClick={() => {
          setTab('gerar')
          setOpen(true)
        }}
        title="QR Code — gerar ou ler"
        aria-label="Abrir ferramenta de QR Code"
      >
        <QrCode className="h-4 w-4" />
      </button>

      <Modal open={open} onClose={close} title="QR Code">
        <div className="space-y-4">
          <div className="flex p-1 gap-1 rounded-lg bg-black/20 w-fit border border-white/5">
            <button
              type="button"
              onClick={() => setTab('gerar')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-all',
                tab === 'gerar'
                  ? 'bg-[#f2d892] text-[#2a1812]'
                  : 'text-[#edd9c4] hover:text-cream hover:bg-white/5',
              )}
            >
              <QrCode className="w-3.5 h-3.5" />
              Gerar
            </button>
            <button
              type="button"
              onClick={() => setTab('ler')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-all',
                tab === 'ler'
                  ? 'bg-[#f2d892] text-[#2a1812]'
                  : 'text-[#edd9c4] hover:text-cream hover:bg-white/5',
              )}
            >
              <Camera className="w-3.5 h-3.5" />
              Ler
            </button>
          </div>

          {tab === 'gerar' ? (
            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-[0.7rem] uppercase tracking-wider text-[#edd9c4] font-bold">
                  Número, ID, telefone ou linha digitável
                </span>
                <textarea
                  className="glass-input w-full min-h-[7rem] resize-y font-mono text-sm"
                  placeholder="Cole aqui a linha do boleto ou outro código…"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="bg-[#f2d892] text-[#2a1812] hover:bg-[#e8c878]"
                  disabled={generating || !input.trim()}
                  onClick={() => void handleGenerate()}
                >
                  {generating ? 'Gerando…' : 'Gerar QR'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!payload && !input.trim()}
                  onClick={handleCopyPayload}
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copiar número
                </Button>
              </div>

              {qrDataUrl && payload ? (
                <div className="space-y-3 rounded-lg border border-white/10 bg-black/20 p-4">
                  <div className="flex justify-center">
                    <img
                      src={qrDataUrl}
                      alt="QR Code gerado"
                      width={280}
                      height={280}
                      className="rounded-md bg-white p-2"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[0.7rem] uppercase tracking-wider text-[#edd9c4] font-bold">
                      Texto gravado no QR
                      {payload !== input.trim() ? (
                        <span className="ml-2 normal-case tracking-normal font-semibold text-[#f2d892]">
                          (sem espaços/pontos)
                        </span>
                      ) : null}
                    </p>
                    <p className="break-all font-mono text-sm text-cream select-all">{payload}</p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-[#edd9c4]">
                Aponte a câmera para o QR. O número completo será copiado automaticamente.
              </p>

              <div
                id={scannerRegionId}
                className={cn(
                  'overflow-hidden rounded-lg border border-white/10 bg-black/40 min-h-[220px]',
                  !scanning && !cameraError ? 'flex items-center justify-center' : '',
                )}
              >
                {!scanning && !cameraError && !scannedText ? (
                  <span className="text-xs text-[#edd9c4]">Iniciando câmera…</span>
                ) : null}
              </div>

              {cameraError ? (
                <div className="space-y-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                  <p className="text-sm text-red-200">{cameraError}</p>
                  <Button type="button" size="sm" variant="outline" onClick={() => void startCamera()}>
                    <RefreshCw className="w-3.5 h-3.5" />
                    Tentar de novo
                  </Button>
                </div>
              ) : null}

              {scannedText ? (
                <div className="space-y-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <p className="text-[0.7rem] uppercase tracking-wider text-emerald-300 font-bold">
                    Valor lido
                  </p>
                  <p className="break-all font-mono text-sm text-cream select-all">{scannedText}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={handleCopyScanned}>
                      <Copy className="w-3.5 h-3.5" />
                      Copiar de novo
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="bg-[#f2d892] text-[#2a1812] hover:bg-[#e8c878]"
                      onClick={handleLerOutro}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Ler outro
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}
