import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LayoutTemplate, FileText, Mic, File, Loader2, ImageIcon } from 'lucide-react';
import { useAtalhosAgrupados, Atalho } from '@/hooks/useAtalhos';
import { useSendWhatsAppMessage } from '@/hooks/useSendWhatsAppMessage';
import { toast } from 'sonner';

interface MarketingTemplatesDropdownProps {
  telefone: string;
  disabled?: boolean;
}

export function MarketingTemplatesDropdown({ telefone, disabled }: MarketingTemplatesDropdownProps) {
  const { data: agrupados, isLoading } = useAtalhosAgrupados();
  const { mutate: sendMessage, isPending } = useSendWhatsAppMessage();
  const [isOpen, setIsOpen] = useState(false);

  const hasTemplates = agrupados && (
    agrupados.texto.length > 0 || 
    agrupados.audio.length > 0 || 
    agrupados.pdf.length > 0 ||
    agrupados.imagem.length > 0
  );

  const fetchFileAsBase64 = async (url: string): Promise<string> => {
    const response = await fetch(url);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
    });
  };

  const handleSendTemplate = async (atalho: Atalho) => {
    setIsOpen(false);
    
    try {
      if (atalho.mensagem && !atalho.url_audio && !atalho.url_pdf && !atalho.url_img) {
        // Enviar mensagem de texto
        sendMessage({ telefone, mensagem: atalho.mensagem, tipo: 'texto' });
      } else if (atalho.url_audio) {
        // Enviar áudio
        const base64 = await fetchFileAsBase64(atalho.url_audio);
        sendMessage({ telefone, tipo: 'audio', arquivo: base64 });
      } else if (atalho.url_pdf) {
        // Enviar PDF
        const base64 = await fetchFileAsBase64(atalho.url_pdf);
        sendMessage({ telefone, tipo: 'pdf', arquivo: base64 });
      } else if (atalho.url_img) {
        // Enviar imagem
        const base64 = await fetchFileAsBase64(atalho.url_img);
        sendMessage({ telefone, tipo: 'imagem', arquivo: base64 });
      }
    } catch (error) {
      console.error('Erro ao enviar template:', error);
      toast.error('Erro ao enviar template');
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled || isPending || isLoading}
          title="Templates de Marketing"
          className="h-9 w-9 sm:h-10 sm:w-10"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
          ) : (
            <LayoutTemplate className="h-4 w-4 sm:h-5 sm:w-5" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 max-h-80 overflow-y-auto">
        <DropdownMenuLabel>Templates de Marketing</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {!hasTemplates ? (
          <div className="p-2 text-sm text-muted-foreground text-center">
            Nenhum template disponível
          </div>
        ) : (
          <>
            {agrupados.texto.length > 0 && (
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  Mensagens
                </DropdownMenuLabel>
                {agrupados.texto.map((atalho) => (
                  <DropdownMenuItem
                    key={atalho.id}
                    onClick={() => handleSendTemplate(atalho)}
                    className="cursor-pointer"
                  >
                    <FileText className="mr-2 h-4 w-4 text-blue-500" />
                    <span className="truncate">{atalho.titulo}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            )}

            {agrupados.audio.length > 0 && (
              <>
                {agrupados.texto.length > 0 && <DropdownMenuSeparator />}
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center gap-1">
                    <Mic className="h-3 w-3" />
                    Áudios
                  </DropdownMenuLabel>
                  {agrupados.audio.map((atalho) => (
                    <DropdownMenuItem
                      key={atalho.id}
                      onClick={() => handleSendTemplate(atalho)}
                      className="cursor-pointer"
                    >
                      <Mic className="mr-2 h-4 w-4 text-green-500" />
                      <span className="truncate">{atalho.titulo}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </>
            )}

            {agrupados.imagem.length > 0 && (
              <>
                {(agrupados.texto.length > 0 || agrupados.audio.length > 0) && <DropdownMenuSeparator />}
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center gap-1">
                    <ImageIcon className="h-3 w-3" />
                    Imagens
                  </DropdownMenuLabel>
                  {agrupados.imagem.map((atalho) => (
                    <DropdownMenuItem
                      key={atalho.id}
                      onClick={() => handleSendTemplate(atalho)}
                      className="cursor-pointer"
                    >
                      <ImageIcon className="mr-2 h-4 w-4 text-purple-500" />
                      <span className="truncate">{atalho.titulo}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </>
            )}

            {agrupados.pdf.length > 0 && (
              <>
                {(agrupados.texto.length > 0 || agrupados.audio.length > 0 || agrupados.imagem.length > 0) && <DropdownMenuSeparator />}
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center gap-1">
                    <File className="h-3 w-3" />
                    PDFs
                  </DropdownMenuLabel>
                  {agrupados.pdf.map((atalho) => (
                    <DropdownMenuItem
                      key={atalho.id}
                      onClick={() => handleSendTemplate(atalho)}
                      className="cursor-pointer"
                    >
                      <File className="mr-2 h-4 w-4 text-red-500" />
                      <span className="truncate">{atalho.titulo}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
