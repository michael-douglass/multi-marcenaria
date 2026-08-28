import { useState, useRef } from 'react';
import { useMarketingMedias, MarketingMedia } from '@/hooks/useMarketingMedias';
import { useMarketingMediaFolders, MarketingMediaFolder } from '@/hooks/useMarketingMediaFolders';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Upload, 
  Image as ImageIcon, 
  Video, 
  Music, 
  Trash2, 
  Edit2, 
  Copy, 
  Check,
  Loader2,
  FileUp,
  Download,
  Play,
  Eye,
  FileText,
  Folder,
  FolderPlus,
  FolderOpen,
  ArrowLeft,
  MoreVertical
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';

export function MarketingMediasTab() {
  const { medias, isLoading, uploadFile, updateMedia, deleteMedia } = useMarketingMedias();
  const { folders, isLoading: foldersLoading, createFolder, updateFolder, deleteFolder } = useMarketingMediaFolders();
  
  const [uploading, setUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [editFolderDialogOpen, setEditFolderDialogOpen] = useState(false);
  const [deleteFolderDialogOpen, setDeleteFolderDialogOpen] = useState(false);
  
  const [selectedMedia, setSelectedMedia] = useState<MarketingMedia | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<MarketingMediaFolder | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  
  const [newTitle, setNewTitle] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDescription, setNewFolderDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadFolderId, setUploadFolderId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const multipleFileInputRef = useRef<HTMLInputElement>(null);

  // Filtrar mídias pela pasta atual
  const currentFolderMedias = medias.filter(m => m.folder_id === currentFolderId);
  const currentFolderData = folders.find(f => f.id === currentFolderId);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setNewTitle(file.name.split('.')[0]);
      setUploadFolderId(currentFolderId);
      setUploadDialogOpen(true);
    }
  };

  const handleMultipleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const title = file.name.split('.')[0];
      try {
        await uploadFile(file, title, currentFolderId);
        successCount++;
      } catch {
        errorCount++;
      }
    }

    setUploading(false);
    if (multipleFileInputRef.current) {
      multipleFileInputRef.current.value = '';
    }

    if (successCount > 0) {
      toast({ 
        title: `${successCount} arquivo(s) enviado(s)`, 
        description: errorCount > 0 ? `${errorCount} falha(s)` : undefined 
      });
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !newTitle.trim()) return;
    
    setUploading(true);
    await uploadFile(selectedFile, newTitle.trim(), uploadFolderId);
    setUploading(false);
    setUploadDialogOpen(false);
    setSelectedFile(null);
    setNewTitle('');
    setUploadFolderId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleEdit = (media: MarketingMedia) => {
    setSelectedMedia(media);
    setNewTitle(media.titulo);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedMedia || !newTitle.trim()) return;
    await updateMedia({ id: selectedMedia.id, titulo: newTitle.trim() });
    setEditDialogOpen(false);
    setSelectedMedia(null);
    setNewTitle('');
  };

  const handleDeleteConfirm = async () => {
    if (!selectedMedia) return;
    await deleteMedia(selectedMedia.id);
    setDeleteDialogOpen(false);
    setSelectedMedia(null);
  };

  const handleCopyTag = (media: MarketingMedia) => {
    const tag = `[media:${media.id}]`;
    navigator.clipboard.writeText(tag);
    setCopiedId(media.id);
    toast({ title: 'Tag copiada!', description: 'Cole no Script de Copy para inserir esta mídia.' });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePreview = (media: MarketingMedia) => {
    setSelectedMedia(media);
    setPreviewDialogOpen(true);
  };

  const handleDownload = async (media: MarketingMedia) => {
    try {
      const response = await fetch(media.file_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = media.file_name || `${media.titulo}.${media.tipo}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: 'Download iniciado!' });
    } catch {
      toast({ title: 'Erro ao baixar arquivo', variant: 'destructive' });
    }
  };

  // Folder handlers
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    await createFolder({ nome: newFolderName.trim(), descricao: newFolderDescription.trim() || null });
    setFolderDialogOpen(false);
    setNewFolderName('');
    setNewFolderDescription('');
  };

  const handleEditFolder = (folder: MarketingMediaFolder) => {
    setSelectedFolder(folder);
    setNewFolderName(folder.nome);
    setNewFolderDescription(folder.descricao || '');
    setEditFolderDialogOpen(true);
  };

  const handleSaveEditFolder = async () => {
    if (!selectedFolder || !newFolderName.trim()) return;
    await updateFolder({ 
      id: selectedFolder.id, 
      nome: newFolderName.trim(), 
      descricao: newFolderDescription.trim() || null 
    });
    setEditFolderDialogOpen(false);
    setSelectedFolder(null);
    setNewFolderName('');
    setNewFolderDescription('');
  };

  const handleDeleteFolderConfirm = async () => {
    if (!selectedFolder) return;
    await deleteFolder(selectedFolder.id);
    setDeleteFolderDialogOpen(false);
    setSelectedFolder(null);
    if (currentFolderId === selectedFolder.id) {
      setCurrentFolderId(null);
    }
  };

  const getMediaIcon = (tipo: string) => {
    switch (tipo) {
      case 'video': return <Video className="h-5 w-5" />;
      case 'audio': return <Music className="h-5 w-5" />;
      case 'pdf': return <FileText className="h-5 w-5" />;
      default: return <ImageIcon className="h-5 w-5" />;
    }
  };

  const getMediaPreview = (media: MarketingMedia) => {
    if (media.tipo === 'imagem') {
      return (
        <img 
          src={media.file_url} 
          alt={media.titulo} 
          className="w-full h-24 sm:h-32 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => handlePreview(media)}
        />
      );
    }
    if (media.tipo === 'video') {
      return (
        <div 
          className="w-full h-24 sm:h-32 relative cursor-pointer group"
          onClick={() => handlePreview(media)}
        >
          <video 
            src={media.file_url} 
            className="w-full h-24 sm:h-32 object-cover rounded"
          />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded group-hover:bg-black/50 transition-colors">
            <Play className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
          </div>
        </div>
      );
    }
    if (media.tipo === 'audio') {
      return (
        <div className="w-full h-24 sm:h-32 bg-muted rounded flex items-center justify-center">
          <Music className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground" />
        </div>
      );
    }
    if (media.tipo === 'pdf') {
      return (
        <div 
          className="w-full h-24 sm:h-32 bg-muted rounded flex items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors"
          onClick={() => handlePreview(media)}
        >
          <FileText className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground" />
        </div>
      );
    }
    return null;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderPreviewContent = () => {
    if (!selectedMedia) return null;

    if (selectedMedia.tipo === 'imagem') {
      return (
        <img 
          src={selectedMedia.file_url} 
          alt={selectedMedia.titulo} 
          className="max-w-full max-h-[70vh] object-contain mx-auto"
        />
      );
    }
    if (selectedMedia.tipo === 'video') {
      return (
        <video 
          src={selectedMedia.file_url} 
          controls 
          autoPlay
          className="max-w-full max-h-[70vh] mx-auto"
        />
      );
    }
    if (selectedMedia.tipo === 'audio') {
      return (
        <div className="flex flex-col items-center gap-4 p-8">
          <Music className="h-20 w-20 text-muted-foreground" />
          <audio 
            src={selectedMedia.file_url} 
            controls 
            autoPlay
            className="w-full max-w-md"
          />
        </div>
      );
    }
    if (selectedMedia.tipo === 'pdf') {
      return (
        <iframe 
          src={selectedMedia.file_url} 
          className="w-full h-[70vh]"
          title={selectedMedia.titulo}
        />
      );
    }
    return null;
  };

  const loading = isLoading || foldersLoading;

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-4">
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <FileUp className="h-4 w-4 sm:h-5 sm:w-5" />
            Biblioteca de Mídias
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Organize suas imagens, vídeos, áudios e PDFs em pastas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 mb-4 sm:mb-6">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,audio/*,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <input
              ref={multipleFileInputRef}
              type="file"
              accept="image/*,video/*,audio/*,application/pdf"
              multiple
              onChange={handleMultipleFileSelect}
              className="hidden"
            />
            
            <Button 
              onClick={() => fileInputRef.current?.click()}
              className="gap-2 text-xs sm:text-sm"
              size="sm"
            >
              <Upload className="h-3 w-3 sm:h-4 sm:w-4" />
              Upload
            </Button>
            
            <Button 
              onClick={() => multipleFileInputRef.current?.click()}
              variant="outline"
              className="gap-2 text-xs sm:text-sm"
              size="sm"
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
              ) : (
                <Upload className="h-3 w-3 sm:h-4 sm:w-4" />
              )}
              <span className="hidden sm:inline">Upload Múltiplo</span>
              <span className="sm:hidden">Múltiplo</span>
            </Button>

            <Button
              onClick={() => setFolderDialogOpen(true)}
              variant="outline"
              className="gap-2 text-xs sm:text-sm"
              size="sm"
            >
              <FolderPlus className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Nova Pasta</span>
              <span className="sm:hidden">Pasta</span>
            </Button>
          </div>

          {/* Breadcrumb / Navigation */}
          {currentFolderId && (
            <div className="flex items-center gap-2 mb-4 p-2 bg-muted rounded-lg">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentFolderId(null)}
                className="gap-1 text-xs sm:text-sm"
              >
                <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                Voltar
              </Button>
              <span className="text-muted-foreground">/</span>
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">{currentFolderData?.nome}</span>
              </div>
            </div>
          )}

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <ScrollArea className="h-[350px] sm:h-[400px]">
              {/* Folders - Only show when not inside a folder */}
              {!currentFolderId && folders.length > 0 && (
                <div className="mb-4 sm:mb-6">
                  <h3 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 sm:mb-3">Pastas</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
                    {folders.map((folder) => {
                      const folderMediaCount = medias.filter(m => m.folder_id === folder.id).length;
                      return (
                        <Card 
                          key={folder.id} 
                          className="cursor-pointer hover:bg-accent/50 transition-colors"
                          onClick={() => setCurrentFolderId(folder.id)}
                        >
                          <CardContent className="p-3 sm:p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex flex-col items-center flex-1 min-w-0">
                                <Folder className="h-8 w-8 sm:h-10 sm:w-10 text-primary mb-1 sm:mb-2" />
                                <p className="font-medium text-xs sm:text-sm text-center truncate w-full">{folder.nome}</p>
                                <p className="text-[10px] sm:text-xs text-muted-foreground">{folderMediaCount} item(s)</p>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-7 sm:w-7 shrink-0">
                                    <MoreVertical className="h-3 w-3 sm:h-4 sm:w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditFolder(folder);
                                  }}>
                                    <Edit2 className="h-4 w-4 mr-2" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedFolder(folder);
                                      setDeleteFolderDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Media Grid */}
              {!currentFolderId && (
                <h3 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 sm:mb-3">
                  Arquivos sem pasta
                </h3>
              )}
              
              {currentFolderMedias.length === 0 ? (
                <div className="text-center py-6 sm:py-8 text-muted-foreground">
                  <FileUp className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma mídia {currentFolderId ? 'nesta pasta' : 'sem pasta'}</p>
                  <p className="text-xs">Clique em "Upload" para adicionar</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
                  {currentFolderMedias.map((media) => (
                    <Card key={media.id} className="overflow-hidden">
                      {getMediaPreview(media)}
                      <div className="p-2 sm:p-3 space-y-1 sm:space-y-2">
                        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                          <Badge variant="outline" className="gap-1 text-[10px] sm:text-xs px-1 sm:px-2">
                            {getMediaIcon(media.tipo)}
                            <span className="hidden sm:inline">{media.tipo}</span>
                          </Badge>
                          <span className="text-[10px] sm:text-xs text-muted-foreground">
                            {formatFileSize(media.file_size)}
                          </span>
                        </div>
                        <p className="font-medium text-xs sm:text-sm truncate" title={media.titulo}>
                          {media.titulo}
                        </p>
                        <div className="flex gap-0.5 sm:gap-1 flex-wrap">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 sm:h-7 sm:w-7"
                            onClick={() => handlePreview(media)}
                            title={media.tipo === 'video' ? 'Reproduzir vídeo' : 'Visualizar'}
                          >
                            {media.tipo === 'video' ? (
                              <Play className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                            ) : (
                              <Eye className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 sm:h-7 sm:w-7"
                            onClick={() => handleDownload(media)}
                            title="Baixar arquivo"
                          >
                            <Download className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 sm:h-7 sm:w-7"
                            onClick={() => handleCopyTag(media)}
                            title="Copiar tag para inserir no script"
                          >
                            {copiedId === media.id ? (
                              <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 sm:h-7 sm:w-7"
                            onClick={() => handleEdit(media)}
                            title="Editar título"
                          >
                            <Edit2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 sm:h-7 sm:w-7 text-destructive"
                            onClick={() => {
                              setSelectedMedia(media);
                              setDeleteDialogOpen(true);
                            }}
                            title="Excluir"
                          >
                            <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="truncate pr-4">{selectedMedia?.titulo}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectedMedia && handleDownload(selectedMedia)}
                className="gap-1"
              >
                <Download className="h-4 w-4" />
                Baixar
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {renderPreviewContent()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar Mídia</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedFile && (
              <div className="text-sm text-muted-foreground">
                Arquivo: {selectedFile.name} ({formatFileSize(selectedFile.size)})
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="titulo">Título da Mídia</Label>
              <Input
                id="titulo"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Digite o título"
              />
            </div>
            <div className="space-y-2">
              <Label>Pasta (opcional)</Label>
              <Select value={uploadFolderId || 'none'} onValueChange={(v) => setUploadFolderId(v === 'none' ? null : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem pasta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem pasta</SelectItem>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>{folder.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpload} disabled={uploading || !newTitle.trim()}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Media Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Mídia</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-titulo">Título</Label>
              <Input
                id="edit-titulo"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Digite o título"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={!newTitle.trim()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Media Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Mídia</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{selectedMedia?.titulo}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Folder Dialog */}
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Pasta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folder-nome">Nome da Pasta</Label>
              <Input
                id="folder-nome"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Digite o nome"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="folder-descricao">Descrição (opcional)</Label>
              <Input
                id="folder-descricao"
                value={newFolderDescription}
                onChange={(e) => setNewFolderDescription(e.target.value)}
                placeholder="Digite uma descrição"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
              Criar Pasta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Folder Dialog */}
      <Dialog open={editFolderDialogOpen} onOpenChange={setEditFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Pasta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-folder-nome">Nome</Label>
              <Input
                id="edit-folder-nome"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Digite o nome"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-folder-descricao">Descrição (opcional)</Label>
              <Input
                id="edit-folder-descricao"
                value={newFolderDescription}
                onChange={(e) => setNewFolderDescription(e.target.value)}
                placeholder="Digite uma descrição"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFolderDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEditFolder} disabled={!newFolderName.trim()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Folder Confirmation */}
      <AlertDialog open={deleteFolderDialogOpen} onOpenChange={setDeleteFolderDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Pasta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a pasta "{selectedFolder?.nome}"? 
              As mídias dentro dela ficarão sem pasta, mas não serão excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFolderConfirm} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
