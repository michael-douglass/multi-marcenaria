import { useEffect, useState } from 'react';
import { Film } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  urlImagemApresentacao,
  type SlideImagemRedimensionar,
  type SlideImagemTamanho,
} from '@/lib/orcamento-slide-imagem-url';
import { isOrcamentoMidiaVideo } from '@/lib/orcamento-slide-midia-video';

interface SlideImagemProps {
  src: string;
  alt?: string;
  mobile: boolean;
  tamanho?: SlideImagemTamanho;
  /** cover = preenche e recorta; contain = exibe a foto inteira (ex.: imagens do orçamento). */
  redimensionar?: SlideImagemRedimensionar;
  /** Primeira imagem visível (capa) — carrega antes das demais. */
  priority?: boolean;
  className?: string;
  /** Marca ícones de ferragem para otimização no PDF/imagem celular. */
  'data-orcamento-icone-ferragem'?: string;
}

/**
 * Imagem (ou vídeo) da apresentação.
 * Se a URL for .mp4/.webm etc., renderiza <video> — evita <img src="…mp4"> quebrado.
 */
export function SlideImagem({
  src,
  alt = '',
  mobile,
  tamanho = 'medium',
  redimensionar = 'cover',
  priority = false,
  className,
  'data-orcamento-icone-ferragem': dataIconeFerragem,
}: SlideImagemProps) {
  const isVideo = isOrcamentoMidiaVideo({ file_url: src });

  if (isVideo) {
    return (
      <div
        data-orcamento-video=""
        className={cn('relative h-full w-full overflow-hidden bg-stone-950', className)}
      >
        <video
          src={src}
          className={cn(
            'h-full w-full',
            redimensionar === 'contain' ? 'object-contain' : 'object-cover',
          )}
          controls
          playsInline
          muted
          loop
          autoPlay
          preload="metadata"
          aria-label={alt || 'Vídeo'}
        />
        <div className="pointer-events-none absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-100">
          <Film className="h-2.5 w-2.5 text-amber-300" aria-hidden />
          Vídeo
        </div>
      </div>
    );
  }

  const optimizedSrc = urlImagemApresentacao(src, mobile, tamanho, redimensionar);
  const [srcAtual, setSrcAtual] = useState(optimizedSrc);

  useEffect(() => {
    setSrcAtual(optimizedSrc);
  }, [optimizedSrc]);

  return (
    <img
      data-orcamento-imagem=""
      {...(dataIconeFerragem !== undefined ? { 'data-orcamento-icone-ferragem': dataIconeFerragem } : {})}
      src={srcAtual}
      alt={alt}
      className={cn(className)}
      crossOrigin={srcAtual.startsWith('http') ? 'anonymous' : undefined}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      {...(priority ? { fetchpriority: 'high' as const } : {})}
      onError={() => {
        if (srcAtual !== src) setSrcAtual(src);
      }}
    />
  );
}
