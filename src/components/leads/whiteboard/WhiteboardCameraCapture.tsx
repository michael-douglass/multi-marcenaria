import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Camera, Loader2, RefreshCw, SwitchCamera, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { isLikelyImageFile } from '@/lib/whiteboard-image-upload';

interface WhiteboardCameraCaptureProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File) => void | Promise<void>;
  disabled?: boolean;
}

export interface WhiteboardCameraCaptureHandle {
  /**
   * Dispara a captura no mesmo gesto do toque/clique.
   * No celular/tablet abre a câmera nativa (com zoom); no PC abre a webcam.
   */
  requestCapture: () => void;
}

type FacingMode = 'user' | 'environment';

/** Celular, tablet e iPad (até quando o UA finge ser Mac). */
export function prefersNativeDeviceCamera(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const touchPoints = navigator.maxTouchPoints ?? 0;
  const ua = navigator.userAgent || '';
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile|Tablet|webOS|BlackBerry/i.test(ua);
  // iPadOS 13+ se identifica como Macintosh, mas tem multi-touch
  const iPadOsDesktopUa = navigator.platform === 'MacIntel' && touchPoints > 1;

  return coarsePointer || mobileUa || iPadOsDesktopUa || touchPoints > 1;
}

function fileFromCameraInput(fileList: FileList | null): File | null {
  const file = fileList?.[0];
  if (!file) return null;
  if (!isLikelyImageFile(file)) {
    toast.error('Selecione uma imagem válida');
    return null;
  }
  // Tablet às vezes devolve nome sem extensão — garante um nome usável no upload.
  if (!file.name || !file.name.includes('.')) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const mime = file.type.startsWith('image/') ? file.type : 'image/jpeg';
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    return new File([file], `camera-${stamp}.${ext}`, {
      type: mime || 'image/jpeg',
      lastModified: file.lastModified || Date.now(),
    });
  }
  return file;
}

/**
 * Captura de foto nas “Fotos do lead”:
 * - Tablet/celular: câmera nativa do aparelho (zoom, foco e qualidade do sistema)
 * - Desktop: webcam via getUserMedia
 */
export const WhiteboardCameraCapture = forwardRef<
  WhiteboardCameraCaptureHandle,
  WhiteboardCameraCaptureProps
>(function WhiteboardCameraCapture(
  { open, onOpenChange, onCapture, disabled = false },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nativeInputRef = useRef<HTMLInputElement>(null);
  const [facingMode, setFacingMode] = useState<FacingMode>('environment');
  const [isStarting, setIsStarting] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  const stopStream = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const deliverFile = useCallback(
    async (file: File) => {
      setIsCapturing(true);
      try {
        await onCapture(file);
        onOpenChange(false);
      } catch (err) {
        console.error(err);
        toast.error('Não foi possível usar a foto');
      } finally {
        setIsCapturing(false);
      }
    },
    [onCapture, onOpenChange],
  );

  const openNativeCamera = useCallback(() => {
    const input = nativeInputRef.current;
    if (!input || disabled) return;
    // Limpa para permitir tirar outra foto igual à anterior.
    input.value = '';
    // Mesmo gesto do usuário — obrigatório no iOS/Android.
    // showPicker (quando existir) evita falhas dentro de Dialogs aninhados.
    const picker = input as HTMLInputElement & { showPicker?: () => void };
    try {
      if (typeof picker.showPicker === 'function') {
        picker.showPicker();
      } else {
        input.click();
      }
    } catch {
      input.click();
    }
    toast.message('Câmera do aparelho', {
      description: 'Use o zoom e o foco nativos do celular ou tablet. Ao confirmar, a foto sobe na lousa.',
      duration: 3200,
    });
  }, [disabled]);

  useImperativeHandle(
    ref,
    () => ({
      requestCapture: () => {
        if (disabled) return;
        if (prefersNativeDeviceCamera()) {
          openNativeCamera();
          return;
        }
        onOpenChange(true);
      },
    }),
    [disabled, openNativeCamera, onOpenChange],
  );

  const startCamera = useCallback(
    async (facing: FacingMode) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Este navegador não permite acessar a câmera. Use HTTPS ou outro navegador.');
        return;
      }
      setIsStarting(true);
      setError(null);
      stopStream();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {
            /* autoplay policy — play após interação já ok */
          });
        }
      } catch (err) {
        console.error('Webcam:', err);
        const name = err instanceof DOMException ? err.name : '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setError('Permissão da câmera negada. Libere o acesso nas configurações do navegador.');
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          setError('Nenhuma câmera encontrada neste computador.');
        } else {
          setError('Não foi possível abrir a câmera. Verifique se outro app não está usando.');
        }
      } finally {
        setIsStarting(false);
      }
    },
    [stopStream],
  );

  // Desktop: webcam só quando o dialog abre.
  // Mobile/tablet: o dialog não deve abrir — a captura nativa vem de requestCapture()
  // (mesmo gesto do toque; abrir input no useEffect quebra no iOS).
  useEffect(() => {
    if (!open) {
      stopStream();
      setError(null);
      return;
    }
    if (prefersNativeDeviceCamera()) {
      onOpenChange(false);
      return;
    }
    void startCamera(facingMode);
    void navigator.mediaDevices?.enumerateDevices?.().then((devices) => {
      setHasMultipleCameras(devices.filter((d) => d.kind === 'videoinput').length > 1);
    });
    return () => stopStream();
  }, [open, facingMode, startCamera, stopStream, onOpenChange]);

  const handleCapture = async () => {
    const video = videoRef.current;
    if (!video || !streamRef.current || disabled) return;
    if (video.readyState < 2 || video.videoWidth < 2) {
      toast.error('Aguarde a imagem da câmera carregar');
      return;
    }
    setIsCapturing(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas indisponível');
      ctx.drawImage(video, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.92),
      );
      if (!blob) throw new Error('Falha ao gerar a foto');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const file = new File([blob], `camera-${stamp}.jpg`, { type: 'image/jpeg' });
      await deliverFile(file);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível capturar a foto');
      setIsCapturing(false);
    }
  };

  const flipCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const onNativeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = fileFromCameraInput(e.target.files);
    // Não limpar value aqui no iOS antes de processar — alguns WebViews perdem o File.
    if (!file) {
      e.target.value = '';
      return;
    }
    void deliverFile(file).finally(() => {
      e.target.value = '';
    });
  };

  const nativeInput = (
    /*
      Fora do Dialog do lead (portal no body): no iPad/Android o input
      com display:none ou preso no focus-trap do Radix costuma não devolver a foto.
    */
    <input
      ref={nativeInputRef}
      type="file"
      accept="image/*,image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
      capture="environment"
      className="fixed left-0 top-0 h-px w-px opacity-0"
      style={{ zIndex: -1 }}
      tabIndex={-1}
      aria-hidden
      onChange={onNativeInputChange}
    />
  );

  return (
    <>
      {typeof document !== 'undefined' ? createPortal(nativeInput, document.body) : nativeInput}

      {/* Desktop: preview via webcam */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          overlayClassName="!z-[10990]"
          className={cn(
            '!z-[11000] max-w-lg gap-0 overflow-hidden border-gold-border-subtle/30 bg-mahogany-panel p-0 sm:rounded-xl',
            '[&>button]:hidden',
          )}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader className="space-y-1 border-b border-border/60 px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <DialogTitle className="text-base">Tirar foto</DialogTitle>
                <DialogDescription className="text-xs">
                  Webcam do computador. No celular ou tablet, abrimos a câmera do aparelho com zoom.
                </DialogDescription>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                onClick={() => onOpenChange(false)}
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="relative aspect-[4/3] w-full bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={cn(
                'h-full w-full object-cover',
                facingMode === 'user' && 'scale-x-[-1]',
              )}
            />
            {isStarting && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-white">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="text-sm">Abrindo câmera…</span>
              </div>
            )}
            {error && !isStarting && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 px-6 text-center text-white">
                <Camera className="h-10 w-10 opacity-60" />
                <p className="text-sm leading-relaxed">{error}</p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-2"
                  onClick={() => void startCamera(facingMode)}
                >
                  <RefreshCw className="h-4 w-4" />
                  Tentar de novo
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border/60 px-4 py-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasMultipleCameras || isStarting || !!error}
              className="gap-2"
              onClick={flipCamera}
              title="Trocar câmera"
            >
              <SwitchCamera className="h-4 w-4" />
              <span className="hidden sm:inline">Trocar</span>
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-2 min-w-[7.5rem]"
                disabled={disabled || isStarting || isCapturing || !!error}
                onClick={() => void handleCapture()}
              >
                {isCapturing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                Capturar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});
