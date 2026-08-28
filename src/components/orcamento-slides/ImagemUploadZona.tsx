import { Loader2, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FormatoImagemSelector } from '@/components/orcamento-slides/FormatoImagemSelector';
import {
  aspectRatioSlide,
  FORMATO_IMAGEM_SLIDE_HINT,
  labelOrientacaoSlide,
  type ImagemOrientacaoSlide,
} from '@/lib/orcamento-slide-imagem-spec';

interface ImagemUploadZonaProps {
  label: string;
  descricao?: string;
  valor: string;
  onUpload: (file: File) => void;
  onRemover: () => void;
  isUploading: boolean;
  accept?: string;
  altura?: number;
  /** Quando true, permite escolher 1920×1080 ou 1080×1920 antes do envio. */
  formatoSlide?: boolean;
  orientacao?: ImagemOrientacaoSlide;
  onOrientacaoChange?: (orientacao: ImagemOrientacaoSlide) => void;
}

export function ImagemUploadZona({
  label,
  descricao,
  valor,
  onUpload,
  onRemover,
  isUploading,
  accept = 'image/jpeg,image/png,image/webp',
  altura = 80,
  formatoSlide = false,
  orientacao = 'paisagem',
  onOrientacaoChange,
}: ImagemUploadZonaProps) {
  const ratio = formatoSlide ? aspectRatioSlide(orientacao) : undefined;
  const boxStyle = ratio
    ? { aspectRatio: ratio, width: '100%', maxHeight: orientacao === 'retrato' ? 200 : 120 }
    : { height: altura };

  const hint = formatoSlide
    ? (descricao ? `${descricao} ${FORMATO_IMAGEM_SLIDE_HINT}` : FORMATO_IMAGEM_SLIDE_HINT)
    : descricao;

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs">{label}</Label>
      {hint && <p className="text-xs text-muted-foreground -mt-1">{hint}</p>}

      {formatoSlide && onOrientacaoChange && (
        <FormatoImagemSelector value={orientacao} onChange={onOrientacaoChange} />
      )}

      {valor ? (
        <div
          className="relative group rounded-xl overflow-hidden border border-border/60 bg-muted"
          style={boxStyle}
        >
          <img src={valor} alt={label} className="w-full h-full object-cover" />
          <div className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
            {labelOrientacaoSlide(orientacao)}
          </div>
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Button
              size="sm"
              variant="destructive"
              onClick={onRemover}
              className="h-7 text-xs gap-1"
              type="button"
            >
              <Trash2 className="h-3 w-3" />
              Remover
            </Button>
          </div>
        </div>
      ) : (
        <label
          className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border/60 hover:border-amber-500/50 hover:bg-amber-500/5 transition-colors cursor-pointer w-full"
          style={boxStyle}
        >
          {isUploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="h-5 w-5 text-muted-foreground" />
          )}
          <span className="text-xs text-muted-foreground text-center px-2">
            {isUploading ? 'Enviando...' : `Enviar ${labelOrientacaoSlide(orientacao)}`}
          </span>
          <input
            type="file"
            accept={accept}
            className="sr-only"
            disabled={isUploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = '';
            }}
          />
        </label>
      )}
    </div>
  );
}
