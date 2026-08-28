import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Link2, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GARBO_APRESENTACAO_PUBLIC_PATH } from './garbo-apresentacao-content';
import { GARBO_APRESENTACAO_THEME } from './garbo-apresentacao-theme';

interface GarboApresentacaoToolbarProps {
  autoScrollPlaying?: boolean;
  autoScrollAvailable?: boolean;
  onToggleAutoScroll?: () => void;
  /** Oculta o botão de copiar link (ex.: página só do Pontua Garbo). */
  showCopyLink?: boolean;
  /** URL pública a copiar (padrão = apresentação da empresa). */
  publicPath?: string;
  backPath?: string;
}

export function GarboApresentacaoToolbar({
  autoScrollPlaying = false,
  autoScrollAvailable = false,
  onToggleAutoScroll,
  showCopyLink = true,
  publicPath = GARBO_APRESENTACAO_PUBLIC_PATH,
  backPath = '/marketing-conteudo',
}: GarboApresentacaoToolbarProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const handleCopyLink = useCallback(async () => {
    const url = `${window.location.origin}${publicPath}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copie o link da apresentação:', url);
    }
  }, [publicPath]);

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-3 px-4 py-3 sm:px-6"
      style={{
        background: 'linear-gradient(180deg, rgba(8,6,4,0.85) 0%, rgba(8,6,4,0) 100%)',
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
      }}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => navigate(backPath)}
        className="min-h-11 gap-2 text-white/90 hover:bg-white/10 hover:text-white"
        aria-label="Voltar ao marketing"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Voltar</span>
      </Button>

      <div className="flex items-center gap-1 sm:gap-2">
        {autoScrollAvailable && onToggleAutoScroll && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleAutoScroll}
            className="min-h-11 gap-2 text-white/90 hover:bg-white/10 hover:text-white"
            aria-label={
              autoScrollPlaying
                ? 'Pausar rolagem automática'
                : 'Iniciar rolagem automática'
            }
            aria-pressed={autoScrollPlaying}
          >
            {autoScrollPlaying ? (
              <Pause className="h-4 w-4" aria-hidden />
            ) : (
              <Play className="h-4 w-4" aria-hidden />
            )}
            <span className="hidden sm:inline">
              {autoScrollPlaying ? 'Pausar' : 'Rolagem auto'}
            </span>
          </Button>
        )}

        {showCopyLink && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopyLink}
            className="min-h-11 gap-2 hover:bg-white/10"
            style={{ color: copied ? GARBO_APRESENTACAO_THEME.gold : 'rgba(255,250,244,0.9)' }}
            aria-label={copied ? 'Link copiado' : 'Copiar link público'}
          >
            {copied ? (
              <Check className="h-4 w-4" aria-hidden />
            ) : (
              <Link2 className="h-4 w-4" aria-hidden />
            )}
            <span className="hidden sm:inline">{copied ? 'Copiado!' : 'Copiar link'}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
