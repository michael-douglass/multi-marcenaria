import { Monitor, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  labelOrientacaoSlide,
  type ImagemOrientacaoSlide,
} from '@/lib/orcamento-slide-imagem-spec';

interface FormatoImagemSelectorProps {
  value: ImagemOrientacaoSlide;
  onChange: (value: ImagemOrientacaoSlide) => void;
  className?: string;
}

export function FormatoImagemSelector({ value, onChange, className }: FormatoImagemSelectorProps) {
  const opcoes: { id: ImagemOrientacaoSlide; icon: typeof Monitor; titulo: string }[] = [
    { id: 'paisagem', icon: Monitor, titulo: 'Paisagem' },
    { id: 'retrato', icon: Smartphone, titulo: 'Retrato' },
  ];

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-[11px] text-muted-foreground">Formato da imagem</span>
      <div className="grid grid-cols-2 gap-2">
        {opcoes.map(({ id, icon: Icon, titulo }) => {
          const ativo = value === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs transition-colors',
                ativo
                  ? 'border-[#8d5e22]/50 bg-[#f3ebe1] text-[#6b3d12]'
                  : 'border-border/60 bg-muted/20 text-muted-foreground hover:border-amber-500/30',
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="font-medium">{titulo}</span>
              <span className="text-[10px] opacity-80">{labelOrientacaoSlide(id)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
