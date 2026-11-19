import { useState, type ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { APRESENTACAO_THEME } from './apresentacao-theme';

interface CoverImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string;
}

/** Foto de capa: se o arquivo faltar, mostra mogno em vez de ícone quebrado. */
export function CoverImage({
  src,
  alt = '',
  className,
  onError,
  ...props
}: CoverImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={cn(className)}
        aria-hidden
        style={{
          background: `
            radial-gradient(ellipse 70% 50% at 50% 40%, rgba(242,216,146,0.12), transparent 62%),
            linear-gradient(165deg, ${APRESENTACAO_THEME.bgMogno} 0%, ${APRESENTACAO_THEME.bgBase} 100%)
          `,
        }}
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
      {...props}
    />
  );
}
