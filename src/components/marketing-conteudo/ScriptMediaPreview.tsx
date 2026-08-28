import { useMemo } from 'react';
import { useMarketingMedias, MarketingMedia } from '@/hooks/useMarketingMedias';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Image as ImageIcon, Video, Music, X, ExternalLink } from 'lucide-react';

interface ScriptMediaPreviewProps {
  scriptContent: string;
  onRemoveMedia?: (mediaId: string) => void;
}

export function ScriptMediaPreview({ scriptContent, onRemoveMedia }: ScriptMediaPreviewProps) {
  const { medias } = useMarketingMedias();

  // Extract media IDs from script content
  const insertedMediaIds = useMemo(() => {
    const regex = /\[media:([a-f0-9-]+)\]/gi;
    const ids: string[] = [];
    let match;
    while ((match = regex.exec(scriptContent)) !== null) {
      if (!ids.includes(match[1])) {
        ids.push(match[1]);
      }
    }
    return ids;
  }, [scriptContent]);

  // Get the actual media objects
  const insertedMedias = useMemo(() => {
    return insertedMediaIds
      .map(id => medias.find(m => m.id === id))
      .filter((m): m is MarketingMedia => m !== undefined);
  }, [insertedMediaIds, medias]);

  if (insertedMedias.length === 0) {
    return null;
  }

  const getMediaIcon = (tipo: string) => {
    switch (tipo) {
      case 'video': return <Video className="h-4 w-4" />;
      case 'audio': return <Music className="h-4 w-4" />;
      default: return <ImageIcon className="h-4 w-4" />;
    }
  };

  const renderMediaPreview = (media: MarketingMedia) => {
    if (media.tipo === 'imagem') {
      return (
        <img 
          src={media.file_url} 
          alt={media.titulo} 
          className="w-full h-32 object-cover rounded-t"
        />
      );
    }
    if (media.tipo === 'video') {
      return (
        <video 
          src={media.file_url} 
          controls
          className="w-full h-32 object-cover rounded-t"
        />
      );
    }
    if (media.tipo === 'audio') {
      return (
        <div className="w-full p-4 bg-muted rounded-t">
          <audio src={media.file_url} controls className="w-full" />
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-3 mt-4 p-4 bg-muted/30 rounded-lg border">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <ImageIcon className="h-4 w-4" />
          Mídias no Script ({insertedMedias.length})
        </h4>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {insertedMedias.map((media) => (
          <div key={media.id} className="bg-background rounded-lg border overflow-hidden group">
            {renderMediaPreview(media)}
            <div className="p-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant="outline" className="shrink-0 gap-1 text-xs">
                  {getMediaIcon(media.tipo)}
                  {media.tipo}
                </Badge>
                <span className="text-xs font-medium truncate" title={media.titulo}>
                  {media.titulo}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={media.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 hover:bg-muted rounded transition-colors"
                  title="Abrir em nova aba"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </a>
                {onRemoveMedia && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={() => onRemoveMedia(media.id)}
                    title="Remover do script"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
