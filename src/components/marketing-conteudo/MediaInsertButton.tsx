import { useState, useRef } from 'react';
import { useMarketingMedias, MarketingMedia } from '@/hooks/useMarketingMedias';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Image as ImageIcon, Video, Music, FileUp, Loader2, Plus, Upload } from 'lucide-react';

interface MediaInsertButtonProps {
  onInsert: (tag: string) => void;
}

export function MediaInsertButton({ onInsert }: MediaInsertButtonProps) {
  const { medias, isLoading, uploadFile } = useMarketingMedias();
  const [open, setOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelect = (media: MarketingMedia) => {
    const tag = `[media:${media.id}]`;
    onInsert(tag);
    setOpen(false);
    setShowUploadForm(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const title = uploadTitle.trim() || file.name.replace(/\.[^/.]+$/, '');
    
    setIsUploading(true);
    try {
      const newMedia = await uploadFile(file, title);
      if (newMedia) {
        // Auto-select the newly uploaded media
        handleSelect(newMedia);
      }
    } finally {
      setIsUploading(false);
      setUploadTitle('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getMediaIcon = (tipo: string) => {
    switch (tipo) {
      case 'video': return <Video className="h-4 w-4" />;
      case 'audio': return <Music className="h-4 w-4" />;
      default: return <ImageIcon className="h-4 w-4" />;
    }
  };

  const getPreview = (media: MarketingMedia) => {
    if (media.tipo === 'imagem') {
      return (
        <img 
          src={media.file_url} 
          alt={media.titulo} 
          className="w-12 h-12 object-cover rounded"
        />
      );
    }
    return (
      <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
        {getMediaIcon(media.tipo)}
      </div>
    );
  };

  return (
    <Popover open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) {
        setShowUploadForm(false);
        setUploadTitle('');
      }
    }}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileUp className="h-4 w-4" />
          Inserir Mídia
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-background z-50" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-sm">Selecione uma mídia</h4>
              <p className="text-xs text-muted-foreground">
                Clique para inserir no script de copy
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-1 text-xs"
              onClick={() => setShowUploadForm(!showUploadForm)}
            >
              <Plus className="h-3 w-3" />
              Nova
            </Button>
          </div>

          {/* Upload Form */}
          {showUploadForm && (
            <div className="p-3 border rounded-lg bg-muted/30 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="media-title" className="text-xs">Título (opcional)</Label>
                <Input
                  id="media-title"
                  placeholder="Nome da mídia..."
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,audio/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="media-upload-input"
                />
                <Button
                  variant="default"
                  size="sm"
                  className="w-full gap-2"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Selecionar Arquivo
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
          
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : medias.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              <FileUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma mídia disponível</p>
              <p className="text-xs mt-1">Clique em "Nova" acima para fazer upload</p>
            </div>
          ) : (
            <ScrollArea className="h-52">
              <div className="space-y-2">
                {medias.map((media) => (
                  <button
                    key={media.id}
                    onClick={() => handleSelect(media)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors text-left"
                  >
                    {getPreview(media)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{media.titulo}</p>
                      <Badge variant="outline" className="text-xs gap-1 mt-1">
                        {getMediaIcon(media.tipo)}
                        {media.tipo}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
