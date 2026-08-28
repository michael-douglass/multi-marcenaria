import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Send, Loader2, Paperclip, Mic, StopCircle, X, Play, Pause, Trash2 } from 'lucide-react';
import { useSendWhatsAppMessage } from '@/hooks/useSendWhatsAppMessage';
import { toast } from 'sonner';
import { MarketingTemplatesDropdown } from './MarketingTemplatesDropdown';

interface WhatsAppMessageInputProps {
  telefone: string;
  leadName: string;
  onMessageSent?: () => void;
  autoFocus?: boolean;
}

export function WhatsAppMessageInput({ telefone, leadName, onMessageSent, autoFocus = false }: WhatsAppMessageInputProps) {
  const [mensagem, setMensagem] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<{
    url: string;
    type: 'imagem' | 'pdf' | 'audio';
  } | null>(null);
  
  // Estado para pré-visualização de áudio gravado
  const [recordedAudio, setRecordedAudio] = useState<{
    blob: Blob;
    url: string;
    duration: number;
  } | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  
  const { mutate: sendMessage, isPending } = useSendWhatsAppMessage();

  // Auto-focus real (mobile-friendly) quando solicitado
  useEffect(() => {
    if (!autoFocus) return;
    if (isPending || isRecording || selectedFile) return;

    const t = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);

    return () => window.clearTimeout(t);
  }, [autoFocus, isPending, isRecording, selectedFile]);

  // Cleanup de URLs ao desmontar
  useEffect(() => {
    return () => {
      if (filePreview) {
        URL.revokeObjectURL(filePreview.url);
      }
      if (recordedAudio) {
        URL.revokeObjectURL(recordedAudio.url);
      }
    };
  }, [filePreview, recordedAudio]);

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = reader.result as string;
        // Remove o prefixo "data:image/png;base64,"
        resolve(base64.split(',')[1]);
      };
      reader.onerror = reject;
    });
  };

  const getMimeType = (file: File): 'imagem' | 'pdf' | 'audio' | null => {
    if (file.type.startsWith('image/')) return 'imagem';
    if (file.type === 'application/pdf') return 'pdf';
    if (file.type.startsWith('audio/')) return 'audio';
    return null;
  };

  const generatePreviewUrl = (file: File): string => {
    return URL.createObjectURL(file);
  };

  const clearFileSelection = () => {
    if (filePreview) {
      URL.revokeObjectURL(filePreview.url);
    }
    setFilePreview(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const tipo = getMimeType(file);
    if (!tipo) {
      toast.error('Tipo de arquivo não suportado. Use imagem, PDF ou áudio.');
      return;
    }

    // Validar tamanho - NOVO LIMITE 20MB
    const maxSize = 20; // MB uniformizado para todos os tipos
    if (file.size > maxSize * 1024 * 1024) {
      toast.error(`Arquivo muito grande! Máximo ${maxSize}MB para ${tipo}.`);
      return;
    }

    // Gerar preview
    const previewUrl = generatePreviewUrl(file);
    setFilePreview({ url: previewUrl, type: tipo });
    setSelectedFile(file);
  };

  const handleSendFile = async (e?: React.FormEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    if (!selectedFile) return;

    const tipo = getMimeType(selectedFile);
    if (!tipo) return;

    try {
      const base64 = await convertToBase64(selectedFile);
      
      sendMessage(
        { telefone, tipo, arquivo: base64 },
        {
          onSuccess: () => {
            clearFileSelection();
          }
        }
      );
    } catch (error) {
      toast.error('Erro ao processar arquivo');
    }
  };

  const startRecording = async () => {
    try {
      // Configurações de alta qualidade com supressão de ruído
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: false }, // Desabilita amplificação de ruído de fundo
          sampleRate: { ideal: 48000 },
          channelCount: { ideal: 1 },
          // Constraints avançadas para navegadores Chromium (eliminam interferências)
          googEchoCancellation: true,
          googAutoGainControl: false,
          googNoiseSuppression: true,
          googHighpassFilter: true, // Filtra ruídos de baixa frequência (hum/estática)
        } as MediaTrackConstraints
      });
      mediaStreamRef.current = stream;
      
      const recorder = new MediaRecorder(stream, { 
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000, // 128kbps para melhor qualidade
      });
      
      audioChunksRef.current = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      
      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const duration = recordingTime;
        
        // Parar stream
        stream.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
        
        // Validar tamanho mínimo (evitar áudios vazios)
        if (audioBlob.size < 1000) { // menos de 1KB
          toast.error('Áudio muito curto. Grave por pelo menos 1 segundo.');
          return;
        }
        
        // Validar tamanho máximo (20MB)
        if (audioBlob.size > 20 * 1024 * 1024) {
          toast.error('Áudio muito grande. Máximo 20MB.');
          return;
        }
        
        // Criar URL para preview
        const audioUrl = URL.createObjectURL(audioBlob);
        setRecordedAudio({
          blob: audioBlob,
          url: audioUrl,
          duration
        });
        
        console.log('🎤 Áudio gravado para preview:', {
          size: audioBlob.size,
          type: audioBlob.type,
          duration
        });
      };
      
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      
      // Timer de gravação
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      toast.error('Erro ao acessar microfone. Verifique as permissões.');
      console.error('Erro ao gravar áudio:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const cancelRecordedAudio = () => {
    if (recordedAudio) {
      URL.revokeObjectURL(recordedAudio.url);
      setRecordedAudio(null);
    }
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      audioPreviewRef.current = null;
    }
    setIsPlayingPreview(false);
  };

  const togglePlayPreview = () => {
    if (!recordedAudio) return;
    
    if (!audioPreviewRef.current) {
      audioPreviewRef.current = new Audio(recordedAudio.url);
      audioPreviewRef.current.onended = () => setIsPlayingPreview(false);
    }
    
    if (isPlayingPreview) {
      audioPreviewRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      audioPreviewRef.current.play();
      setIsPlayingPreview(true);
    }
  };

  const sendRecordedAudio = async () => {
    if (!recordedAudio) return;
    
    try {
      // Converter para base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(recordedAudio.blob);
        reader.onloadend = () => {
          const result = reader.result as string;
          if (!result) {
            reject(new Error('Falha ao converter áudio'));
            return;
          }
          resolve(result.split(',')[1]);
        };
        reader.onerror = () => reject(new Error('Erro ao ler áudio'));
      });
      
      console.log('🎤 Enviando áudio:', {
        size: recordedAudio.blob.size,
        base64Length: base64.length
      });
      
      sendMessage(
        { telefone, tipo: 'audio', arquivo: base64 },
        {
          onSuccess: () => {
            toast.success('Áudio enviado!');
            cancelRecordedAudio();
          },
          onError: (error) => {
            console.error('❌ Erro ao enviar áudio:', error);
            toast.error('Falha ao enviar áudio. Tente novamente.');
          }
        }
      );
    } catch (error) {
      console.error('❌ Erro ao processar áudio:', error);
      toast.error('Erro ao processar áudio gravado');
    }
  };

  const handleSendText = (e?: React.FormEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    if (!mensagem.trim()) return;

    sendMessage(
      { telefone, mensagem: mensagem.trim(), tipo: 'texto' },
      {
        onSuccess: () => {
          setMensagem('');
        }
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-2">
      {/* Preview de arquivo selecionado */}
      {selectedFile && filePreview && (
        <div className="border rounded-lg p-3 bg-muted space-y-2">
          {/* Cabeçalho com nome e botão fechar */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium truncate flex-1">
              {selectedFile.name}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0"
              onClick={clearFileSelection}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Preview baseado no tipo */}
          {filePreview.type === 'imagem' && (
            <div className="relative w-full aspect-video bg-background rounded overflow-hidden">
              <img
                src={filePreview.url}
                alt="Preview"
                className="w-full h-full object-contain"
              />
            </div>
          )}

          {filePreview.type === 'audio' && (
            <div className="bg-background rounded p-3">
              <audio
                controls
                src={filePreview.url}
                className="w-full"
                controlsList="nodownload"
              />
            </div>
          )}

          {filePreview.type === 'pdf' && (
            <div className="bg-background rounded p-4 flex items-center gap-3">
              <div className="h-16 w-16 bg-red-100 dark:bg-red-900/20 rounded flex items-center justify-center flex-shrink-0">
                <svg
                  className="h-8 w-8 text-red-600 dark:text-red-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-muted-foreground">
                  Documento PDF
                </p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
          )}

          {/* Informações do arquivo */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
            <span className="uppercase">{filePreview.type}</span>
          </div>
        </div>
      )}

      {/* Indicador de gravação */}
      {isRecording && (
        <div className="flex items-center gap-2 p-2 bg-destructive/10 rounded-md animate-pulse">
          <div className="h-2 w-2 rounded-full bg-destructive" />
          <span className="text-sm font-medium">Gravando... {formatTime(recordingTime)}</span>
        </div>
      )}

      {/* Preview de áudio gravado */}
      {recordedAudio && !isRecording && (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border">
          {/* Botão Play/Pause */}
          <Button
            variant="ghost"
            size="icon"
            onClick={togglePlayPreview}
            className="h-10 w-10 shrink-0"
            title={isPlayingPreview ? "Pausar" : "Ouvir"}
          >
            {isPlayingPreview ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5" />
            )}
          </Button>
          
          {/* Barra de progresso visual e duração */}
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
              <div 
                className={`h-full bg-primary transition-all ${isPlayingPreview ? 'animate-pulse' : ''}`}
                style={{ width: isPlayingPreview ? '100%' : '0%' }}
              />
            </div>
            <span className="text-sm font-medium text-muted-foreground min-w-[40px]">
              {formatTime(recordedAudio.duration)}
            </span>
          </div>
          
          {/* Botão Cancelar */}
          <Button
            variant="ghost"
            size="icon"
            onClick={cancelRecordedAudio}
            className="h-10 w-10 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            title="Cancelar"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
          
          {/* Botão Enviar */}
          <Button
            size="icon"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              sendRecordedAudio();
            }}
            disabled={isPending}
            className="h-10 w-10 shrink-0"
            title="Enviar áudio"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}

      {/* Input normal - esconde quando tem áudio gravado */}
      {!recordedAudio && (
        <div className="flex gap-1 sm:gap-2 items-end w-full">
          {/* Botões de ação */}
          <div className="flex gap-0.5 sm:gap-1 shrink-0">
            <Input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,application/pdf,audio/*"
              onChange={handleFileSelect}
              disabled={isPending || isRecording}
            />
            
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              disabled={isPending || isRecording || !!selectedFile}
              title="Anexar arquivo"
              className="h-9 w-9 sm:h-10 sm:w-10"
            >
              <Paperclip className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>

            <Button
              variant={isRecording ? "destructive" : "ghost"}
              size="icon"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                isRecording ? stopRecording() : startRecording();
              }}
              disabled={isPending || !!selectedFile}
              title={isRecording ? "Parar gravação" : "Gravar áudio"}
              className="h-9 w-9 sm:h-10 sm:w-10"
            >
              {isRecording ? (
                <StopCircle className="h-4 w-4 sm:h-5 sm:w-5" />
              ) : (
                <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </Button>

            {/* Dropdown de Templates de Marketing */}
            <MarketingTemplatesDropdown
              telefone={telefone}
              disabled={isPending || isRecording || !!selectedFile}
            />
          </div>

          {/* Campo de texto */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <Textarea
              ref={textareaRef}
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Mensagem..."
              className="min-h-[40px] sm:min-h-[50px] resize-none text-sm w-full"
              autoFocus={autoFocus}
              inputMode="text"
              enterKeyHint="send"
              disabled={isPending || isRecording || !!selectedFile}
            />
          </div>

          {/* Botão enviar */}
          <Button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              selectedFile ? handleSendFile(e) : handleSendText(e);
            }}
            disabled={(!mensagem.trim() && !selectedFile) || isPending || isRecording}
            size="icon"
            className="h-[40px] w-[40px] sm:h-[50px] sm:w-[50px] shrink-0"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
