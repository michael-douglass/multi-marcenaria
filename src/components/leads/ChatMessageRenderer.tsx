import { Download, FileText, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useRef } from 'react';

interface ChatMessageRendererProps {
  content: string;
  type: string;
  urlMidia?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  isFromLead: boolean;
}

export function ChatMessageRenderer({
  content,
  type,
  urlMidia,
  fileName,
  mimeType,
  isFromLead
}: ChatMessageRendererProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Normalizar tipo para formato consistente
  const normalizedType = (() => {
    switch (type) {
      case 'text':
      case 'texto':
        return 'texto';
      case 'image':
      case 'imagem':
        return 'imagem';
      case 'audio':
        return 'audio';
      case 'video':
        return 'video';
      case 'pdf':
      case 'document':
        return 'pdf';
      default:
        return 'texto';
    }
  })();

  // Determinar a URL de mídia a usar
  // Prioriza urlMidia, depois verifica se content é uma URL válida.
  // Também suporta mídia em base64 (sem prefixo) usando mimeType.
  const mediaUrl = (() => {
    const buildDataUrlIfBase64 = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return null;

      // Já é URL/data URL
      if (trimmed.startsWith('data:') || trimmed.startsWith('http')) return trimmed;

      // Heurística simples: base64 costuma ser grande e conter apenas charset base64
      const looksLikeBase64 =
        trimmed.length > 100 && /^[A-Za-z0-9+/]+={0,2}$/.test(trimmed);

      if (!looksLikeBase64) return null;

      const safeMime = mimeType?.trim() || 'application/octet-stream';
      return `data:${safeMime};base64,${trimmed}`;
    };

    // urlMidia tem prioridade se existir e não for vazia
    if (urlMidia && urlMidia.trim() !== '') {
      return buildDataUrlIfBase64(urlMidia);
    }

    // Verifica se content é uma URL ou base64
    if (content) {
      return buildDataUrlIfBase64(content);
    }

    return null;
  })();

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => {
        console.error('Erro ao reproduzir áudio:', err);
        setAudioError(true);
      });
    }
    setIsPlaying(!isPlaying);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const handleDownload = () => {
    if (mediaUrl) {
      const link = document.createElement('a');
      link.href = mediaUrl;
      link.download = fileName || 'arquivo';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Renderizar texto
  if (normalizedType === 'texto') {
    return (
      <p className="text-[14px] leading-[18px] text-[#111B21] dark:text-[#E9EDEF] break-words whitespace-pre-wrap overflow-hidden pr-1">
        {content}
      </p>
    );
  }

  // Renderizar imagem
  if (normalizedType === 'imagem' && mediaUrl) {
    return (
      <div className="relative overflow-hidden">
        <img 
          src={mediaUrl} 
          alt="Imagem enviada"
          className="max-w-full h-auto rounded-lg cursor-pointer hover:opacity-90 transition-opacity max-h-[300px] object-contain"
          onClick={() => window.open(mediaUrl, '_blank')}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <p className="text-[12px] text-[#667781] dark:text-[#8696A0] mt-1 italic">
          📷 Imagem
        </p>
      </div>
    );
  }

  // Renderizar vídeo
  if (normalizedType === 'video' && mediaUrl) {
    return (
      <div className="relative overflow-hidden">
        <video 
          src={mediaUrl} 
          controls
          className="max-w-full h-auto rounded-lg max-h-[300px] object-contain"
          preload="metadata"
          onError={(e) => {
            console.error('Erro ao carregar vídeo:', e);
          }}
        >
          Seu navegador não suporta o elemento de vídeo.
        </video>
        <p className="text-[12px] text-[#667781] dark:text-[#8696A0] mt-1 italic">
          🎬 Vídeo
        </p>
      </div>
    );
  }

  // Renderizar áudio
  if (normalizedType === 'audio' && mediaUrl) {
    return (
      <div className="flex items-center gap-2 min-w-[200px] max-w-[280px] overflow-hidden">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handlePlayPause}
          disabled={audioError}
          className={`h-8 w-8 sm:h-10 sm:w-10 rounded-full p-0 shrink-0 flex-shrink-0 ${
            isFromLead 
              ? 'bg-[#00A884] hover:bg-[#00A884]/90' 
              : 'bg-[#128C7E] hover:bg-[#128C7E]/90'
          }`}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
          ) : (
            <Play className="h-4 w-4 sm:h-5 sm:w-5 text-white ml-0.5" />
          )}
        </Button>
        
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="h-1.5 bg-[#667781]/30 rounded-full overflow-hidden">
            <div 
              className={`h-full ${isFromLead ? 'bg-[#00A884]' : 'bg-[#128C7E]'} rounded-full`}
              style={{ width: isPlaying ? '50%' : '0%', transition: 'width 0.3s' }}
            />
          </div>
          {audioError && (
            <p className="text-[10px] text-red-500 mt-1">Erro ao carregar áudio</p>
          )}
        </div>
        
        <audio 
          ref={audioRef}
          src={mediaUrl}
          onEnded={handleAudioEnded}
          onError={() => setAudioError(true)}
          preload="metadata"
        />
        
        <span className="text-[11px] text-[#667781] dark:text-[#8696A0] shrink-0 flex-shrink-0">
          🎵
        </span>
      </div>
    );
  }

  // Renderizar PDF/Documento
  if (normalizedType === 'pdf') {
    return (
      <div 
        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:opacity-80 transition-opacity overflow-hidden ${
          isFromLead 
            ? 'bg-[#E8E8E8] dark:bg-[#2A3942]' 
            : 'bg-[#C8E6C9] dark:bg-[#1A4A3E]'
        }`}
        onClick={handleDownload}
      >
        <div className={`p-2 rounded shrink-0 flex-shrink-0 ${isFromLead ? 'bg-[#667781]/20' : 'bg-[#128C7E]/20'}`}>
          <FileText className={`h-6 w-6 ${isFromLead ? 'text-[#667781]' : 'text-[#128C7E]'}`} />
        </div>
        
        <div className="flex-1 min-w-0 overflow-hidden">
          <p className="text-[13px] font-medium text-[#111B21] dark:text-[#E9EDEF] truncate">
            {fileName || 'Documento'}
          </p>
          <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">
            PDF • Clique para baixar
          </p>
        </div>
        
        <Download className="h-5 w-5 text-[#667781] dark:text-[#8696A0] shrink-0 flex-shrink-0" />
      </div>
    );
  }

  // Fallback para conteúdo não reconhecido
  return (
    <p className="text-[14px] leading-[18px] text-[#111B21] dark:text-[#E9EDEF] break-words whitespace-pre-wrap overflow-hidden pr-1">
      {content || '[Conteúdo não disponível]'}
    </p>
  );
}
