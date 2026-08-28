import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Send, FileText, Mic, File, Trash2, StopCircle, Play, Pause, Upload, ImageIcon, Bell } from 'lucide-react';
import { useAtalhosPorTipo, useCreateAtalho, useDeleteAtalho } from '@/hooks/useAtalhos';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TemplatesDisparoTab } from '@/components/marketing/TemplatesDisparoTab';

export default function Marketing() {
  const location = useLocation();
  const defaultTab = (location.state as { defaultTab?: string })?.defaultTab || 'mensagens';
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    if (location.state?.defaultTab) {
      setActiveTab(location.state.defaultTab);
    }
  }, [location.state]);

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Marketing</h1>
        <p className="text-muted-foreground mt-2">
          Gerencie seus templates de mensagens, áudios e documentos
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="mensagens" className="flex gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Mensagens</span>
          </TabsTrigger>
          <TabsTrigger value="disparos" className="flex gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Disparos</span>
          </TabsTrigger>
          <TabsTrigger value="audios" className="flex gap-2">
            <Mic className="h-4 w-4" />
            <span className="hidden sm:inline">Áudios</span>
          </TabsTrigger>
          <TabsTrigger value="imagens" className="flex gap-2">
            <ImageIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Imagens</span>
          </TabsTrigger>
          <TabsTrigger value="pdfs" className="flex gap-2">
            <File className="h-4 w-4" />
            <span className="hidden sm:inline">PDFs</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mensagens">
          <MensagensTab />
        </TabsContent>

        <TabsContent value="disparos">
          <TemplatesDisparoTab />
        </TabsContent>

        <TabsContent value="audios">
          <AudiosTab />
        </TabsContent>

        <TabsContent value="imagens">
          <ImagensTab />
        </TabsContent>

        <TabsContent value="pdfs">
          <PDFsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MensagensTab() {
  const [titulo, setTitulo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [allCanSee, setAllCanSee] = useState(true);
  
  const { data: atalhos, isLoading } = useAtalhosPorTipo('texto');
  const createAtalho = useCreateAtalho();
  const deleteAtalho = useDeleteAtalho();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !mensagem.trim()) {
      toast.error('Preencha o título e a mensagem');
      return;
    }

    createAtalho.mutate({
      titulo: titulo.trim(),
      tipo: 'texto',
      mensagem: mensagem.trim(),
      all_can_see: allCanSee,
    }, {
      onSuccess: () => {
        setTitulo('');
        setMensagem('');
      }
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Novo Template de Mensagem
          </CardTitle>
          <CardDescription>
            Crie templates de texto para enviar rapidamente via WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="titulo">Título do Template</Label>
              <Input
                id="titulo"
                placeholder="Ex: Boas-vindas, Proposta comercial..."
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mensagem">Mensagem</Label>
              <Textarea
                id="mensagem"
                placeholder="Digite a mensagem do template..."
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={6}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="allCanSee"
                checked={allCanSee}
                onCheckedChange={setAllCanSee}
              />
              <Label htmlFor="allCanSee">Visível para todos os usuários</Label>
            </div>
            <Button type="submit" className="w-full" disabled={createAtalho.isPending}>
              {createAtalho.isPending ? 'Salvando...' : 'Salvar Template'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Templates Salvos</CardTitle>
          <CardDescription>
            {atalhos?.length || 0} templates de mensagem
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            {isLoading ? (
              <p className="text-muted-foreground text-center py-4">Carregando...</p>
            ) : atalhos?.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Nenhum template salvo</p>
            ) : (
              <div className="space-y-3">
                {atalhos?.map((atalho) => (
                  <div key={atalho.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{atalho.titulo}</h4>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteAtalho.mutate(atalho.id)}
                        disabled={deleteAtalho.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {atalho.mensagem}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function AudiosTab() {
  const [titulo, setTitulo] = useState('');
  const [allCanSee, setAllCanSee] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState<{ blob: Blob; url: string } | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  
  const { data: atalhos, isLoading } = useAtalhosPorTipo('audio');
  const createAtalho = useCreateAtalho();
  const deleteAtalho = useDeleteAtalho();

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
      
      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        
        if (audioBlob.size < 1000) {
          toast.error('Áudio muito curto');
          return;
        }
        
        const audioUrl = URL.createObjectURL(audioBlob);
        setRecordedAudio({ blob: audioBlob, url: audioUrl });
      };
      
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      toast.error('Erro ao acessar microfone');
      console.error(error);
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

  const cancelAudio = () => {
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

  const handleSaveAudio = async () => {
    if (!titulo.trim()) {
      toast.error('Digite um título para o áudio');
      return;
    }
    if (!recordedAudio) {
      toast.error('Grave um áudio primeiro');
      return;
    }

    const audioFile = new window.File([recordedAudio.blob], `${titulo}.webm`, { type: 'audio/webm' });
    
    createAtalho.mutate({
      titulo: titulo.trim(),
      tipo: 'audio',
      file: audioFile,
      all_can_see: allCanSee,
    }, {
      onSuccess: () => {
        setTitulo('');
        cancelAudio();
      }
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Novo Template de Áudio
          </CardTitle>
          <CardDescription>
            Grave áudios para enviar rapidamente via WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo-audio">Título do Template</Label>
            <Input
              id="titulo-audio"
              placeholder="Ex: Apresentação, Explicação..."
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>

          <Separator />

          <div className="space-y-4">
            {!recordedAudio && !isRecording && (
              <Button onClick={startRecording} className="w-full" variant="outline">
                <Mic className="mr-2 h-4 w-4" />
                Iniciar Gravação
              </Button>
            )}

            {isRecording && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-md animate-pulse">
                  <div className="h-2 w-2 rounded-full bg-destructive" />
                  <span className="font-medium">Gravando... {formatTime(recordingTime)}</span>
                </div>
                <Button onClick={stopRecording} className="w-full" variant="destructive">
                  <StopCircle className="mr-2 h-4 w-4" />
                  Parar Gravação
                </Button>
              </div>
            )}

            {recordedAudio && !isRecording && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={togglePlayPreview}
                  >
                    {isPlayingPreview ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </Button>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Áudio gravado</p>
                    <p className="text-xs text-muted-foreground">{formatTime(recordingTime)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={cancelAudio}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="allCanSee-audio"
              checked={allCanSee}
              onCheckedChange={setAllCanSee}
            />
            <Label htmlFor="allCanSee-audio">Visível para todos os usuários</Label>
          </div>

          <Button
            onClick={handleSaveAudio}
            className="w-full"
            disabled={createAtalho.isPending || !recordedAudio || !titulo.trim()}
          >
            {createAtalho.isPending ? 'Salvando...' : 'Salvar Áudio'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Áudios Salvos</CardTitle>
          <CardDescription>
            {atalhos?.length || 0} templates de áudio
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            {isLoading ? (
              <p className="text-muted-foreground text-center py-4">Carregando...</p>
            ) : atalhos?.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Nenhum áudio salvo</p>
            ) : (
              <div className="space-y-3">
                {atalhos?.map((atalho) => (
                  <div key={atalho.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{atalho.titulo}</h4>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteAtalho.mutate(atalho.id)}
                        disabled={deleteAtalho.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    {atalho.url_audio && (
                      <audio
                        controls
                        src={atalho.url_audio}
                        className="w-full h-8"
                        controlsList="nodownload"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}


function ImagensTab() {
  const [titulo, setTitulo] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [allCanSee, setAllCanSee] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { data: atalhos, isLoading } = useAtalhosPorTipo('imagem');
  const createAtalho = useCreateAtalho();
  const deleteAtalho = useDeleteAtalho();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Selecione apenas arquivos de imagem');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande! Máximo 10MB');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const clearFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveImage = async () => {
    if (!titulo.trim()) {
      toast.error('Digite um título para a imagem');
      return;
    }
    if (!selectedFile) {
      toast.error('Selecione uma imagem');
      return;
    }

    createAtalho.mutate({
      titulo: titulo.trim(),
      tipo: 'imagem',
      file: selectedFile,
      all_can_see: allCanSee,
    }, {
      onSuccess: () => {
        setTitulo('');
        clearFile();
      }
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Novo Template de Imagem
          </CardTitle>
          <CardDescription>
            Faça upload de imagens para enviar rapidamente via WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo-imagem">Título do Template</Label>
            <Input
              id="titulo-imagem"
              placeholder="Ex: Logo, Banner, Promoção..."
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Arquivo de Imagem</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            
            {selectedFile && previewUrl ? (
              <div className="relative border rounded-lg overflow-hidden bg-muted">
                <img 
                  src={previewUrl} 
                  alt="Preview" 
                  className="w-full h-48 object-contain"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm p-2 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate text-sm">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={clearFile}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full h-32 border-dashed"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-6 w-6" />
                  <span>Clique para selecionar uma imagem</span>
                  <span className="text-xs text-muted-foreground">PNG, JPG, WEBP (máx 10MB)</span>
                </div>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="allCanSee-imagem"
              checked={allCanSee}
              onCheckedChange={setAllCanSee}
            />
            <Label htmlFor="allCanSee-imagem">Visível para todos os usuários</Label>
          </div>

          <Button
            onClick={handleSaveImage}
            className="w-full"
            disabled={createAtalho.isPending || !selectedFile || !titulo.trim()}
          >
            {createAtalho.isPending ? 'Salvando...' : 'Salvar Imagem'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Imagens Salvas</CardTitle>
          <CardDescription>
            {atalhos?.length || 0} templates de imagem
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            {isLoading ? (
              <p className="text-muted-foreground text-center py-4">Carregando...</p>
            ) : atalhos?.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Nenhuma imagem salva</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {atalhos?.map((atalho) => (
                  <div key={atalho.id} className="border rounded-lg overflow-hidden group relative">
                    {atalho.url_img && (
                      <img 
                        src={atalho.url_img} 
                        alt={atalho.titulo || 'Template'} 
                        className="w-full h-24 object-cover"
                      />
                    )}
                    <div className="p-2 flex items-center justify-between bg-background">
                      <h4 className="font-medium text-sm truncate flex-1">{atalho.titulo}</h4>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => deleteAtalho.mutate(atalho.id)}
                        disabled={deleteAtalho.isPending}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function PDFsTab() {
  const [titulo, setTitulo] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [allCanSee, setAllCanSee] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { data: atalhos, isLoading } = useAtalhosPorTipo('pdf');
  const createAtalho = useCreateAtalho();
  const deleteAtalho = useDeleteAtalho();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Selecione apenas arquivos PDF');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error('Arquivo muito grande! Máximo 20MB');
      return;
    }

    setSelectedFile(file);
  };

  const handleSavePDF = async () => {
    if (!titulo.trim()) {
      toast.error('Digite um título para o PDF');
      return;
    }
    if (!selectedFile) {
      toast.error('Selecione um arquivo PDF');
      return;
    }

    createAtalho.mutate({
      titulo: titulo.trim(),
      tipo: 'pdf',
      file: selectedFile,
      all_can_see: allCanSee,
    }, {
      onSuccess: () => {
        setTitulo('');
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <File className="h-5 w-5" />
            Novo Template de PDF
          </CardTitle>
          <CardDescription>
            Faça upload de PDFs para enviar rapidamente via WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo-pdf">Título do Template</Label>
            <Input
              id="titulo-pdf"
              placeholder="Ex: Catálogo, Proposta, Contrato..."
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Arquivo PDF</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileSelect}
            />
            
            {selectedFile ? (
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted">
                <File className="h-8 w-8 text-red-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full h-24 border-dashed"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-6 w-6" />
                  <span>Clique para selecionar um PDF</span>
                </div>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="allCanSee-pdf"
              checked={allCanSee}
              onCheckedChange={setAllCanSee}
            />
            <Label htmlFor="allCanSee-pdf">Visível para todos os usuários</Label>
          </div>

          <Button
            onClick={handleSavePDF}
            className="w-full"
            disabled={createAtalho.isPending || !selectedFile || !titulo.trim()}
          >
            {createAtalho.isPending ? 'Salvando...' : 'Salvar PDF'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>PDFs Salvos</CardTitle>
          <CardDescription>
            {atalhos?.length || 0} templates de PDF
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            {isLoading ? (
              <p className="text-muted-foreground text-center py-4">Carregando...</p>
            ) : atalhos?.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Nenhum PDF salvo</p>
            ) : (
              <div className="space-y-3">
                {atalhos?.map((atalho) => (
                  <div key={atalho.id} className="border rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <File className="h-8 w-8 text-red-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{atalho.titulo}</h4>
                        {atalho.url_pdf && (
                          <a
                            href={atalho.url_pdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline"
                          >
                            Ver PDF
                          </a>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteAtalho.mutate(atalho.id)}
                        disabled={deleteAtalho.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
