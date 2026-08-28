import { useRef } from 'react';
import { Label } from '@/components/ui/label';
import { usePrestadorBannerSlides, MAX_SLIDES } from '@/hooks/usePrestadorBannerSlides';
import { formatMaxMb, MAX_EMPRESA_BANNER_BYTES, validateEmpresaBannerFile } from '@/lib/empresa-branding-upload';
import { ImagePlus, Loader2, Monitor, Smartphone, Trash2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

interface SlideManagerProps {
  label: string;
  icon: typeof Monitor;
  slot: 'desktop' | 'mobile';
  aspectLabel: string;
  slides: string[];
  onAdd: (slot: 'desktop' | 'mobile', file: File) => void;
  onRemove: (slot: 'desktop' | 'mobile', index: number) => void;
  isPending: boolean;
}

function SlideManager({
  label,
  icon: Icon,
  slot,
  aspectLabel,
  slides,
  onAdd,
  onRemove,
  isPending,
}: SlideManagerProps) {
  const ref = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateEmpresaBannerFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    if (file.size > 1.5 * 1024 * 1024) {
      toast.info('Otimizando imagem…', {
        description: 'Fotos do celular são reduzidas automaticamente para envio mais rápido.',
        duration: 4000,
      });
    }
    onAdd(slot, file);
    e.target.value = '';
  };

  const canAdd = slides.length < MAX_SLIDES;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium cursor-default">{label}</Label>
          <span className="text-xs text-muted-foreground">{aspectLabel}</span>
        </div>
        <span
          className="text-xs tabular-nums"
          style={{ color: slides.length >= MAX_SLIDES ? 'var(--destructive)' : 'var(--muted-foreground)' }}
        >
          {slides.length} / {MAX_SLIDES}
        </span>
      </div>

      {/* Slide strip */}
      <div className="flex gap-3 overflow-x-auto pb-2 min-h-[88px] items-center">
        {slides.map((url, i) => (
          <div
            key={url}
            className="relative group shrink-0 rounded-lg overflow-hidden border"
            style={{
              width: 140,
              height: 88,
              borderColor: 'rgba(255,255,255,0.06)',
              background: '#111',
            }}
          >
            <img
              src={url}
              alt={`Slide ${i + 1}`}
              className="w-full h-full object-cover"
              draggable={false}
            />

            {/* Index badge */}
            <div
              className="absolute bottom-1.5 left-1.5 text-[10px] font-mono px-1 rounded pointer-events-none"
              style={{
                background: 'rgba(0,0,0,0.55)',
                color: 'rgba(255,255,255,0.5)',
                backdropFilter: 'blur(4px)',
              }}
            >
              {i + 1}
            </div>

            {/* Hover overlay */}
            <div
              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'rgba(0,0,0,0.65)' }}
            >
              <button
                type="button"
                onClick={() => onRemove(slot, i)}
                disabled={isPending}
                className="p-2 rounded-full transition-colors"
                style={{ color: '#f87171', background: 'rgba(239,68,68,0.15)' }}
                title="Remover slide"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}

        {/* Add button */}
        {canAdd && (
          <button
            type="button"
            onClick={() => ref.current?.click()}
            disabled={isPending}
            className="shrink-0 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-colors"
            style={{
              width: 140,
              height: 88,
              borderColor: 'rgba(255,255,255,0.08)',
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')
            }
          >
            <input
              ref={ref}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
            />
            {isPending ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <>
                <ImagePlus className="h-5 w-5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Adicionar</span>
              </>
            )}
          </button>
        )}

        {/* Empty state */}
        {slides.length === 0 && !canAdd && (
          <p className="text-xs text-muted-foreground">Nenhuma imagem</p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        PNG, JPG ou WebP — máximo {formatMaxMb(MAX_EMPRESA_BANNER_BYTES)} por imagem.
      </p>
      {slides.length > 1 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <GripVertical className="h-3 w-3" />
          As imagens passam em sequência no portal do prestador.
        </p>
      )}
    </div>
  );
}

export function PrestadorBannerForm() {
  const { empresa, adicionarSlide, removerSlide, slidesFor } = usePrestadorBannerSlides();

  if (!empresa) {
    return (
      <p className="text-sm text-muted-foreground">
        Selecione uma empresa para configurar os banners.
      </p>
    );
  }

  const isPending = adicionarSlide.isPending || removerSlide.isPending;

  return (
    <div className="space-y-8">
      <SlideManager
        label="Desktop"
        icon={Monitor}
        slot="desktop"
        aspectLabel="16:9 · recomendado 1920×1080"
        slides={slidesFor('desktop')}
        onAdd={(s, f) => adicionarSlide.mutate({ slot: s, file: f })}
        onRemove={(s, i) => removerSlide.mutate({ slot: s, index: i })}
        isPending={isPending}
      />

      <div className="h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />

      <SlideManager
        label="Mobile"
        icon={Smartphone}
        slot="mobile"
        aspectLabel="9:16 · recomendado 1080×1920"
        slides={slidesFor('mobile')}
        onAdd={(s, f) => adicionarSlide.mutate({ slot: s, file: f })}
        onRemove={(s, i) => removerSlide.mutate({ slot: s, index: i })}
        isPending={isPending}
      />
    </div>
  );
}
