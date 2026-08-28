import { useState } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  MoreVertical, 
  Pencil, 
  Trash2,
  ChevronRight,
  Layers,
  Table2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { MktFonte, MktSubFonte, useMarketingGastos } from '@/hooks/useMarketingGastos';
import { CreateSubFonteDialog } from './CreateSubFonteDialog';
import { EditSubFonteDialog } from './EditSubFonteDialog';
import * as LucideIcons from 'lucide-react';

interface SubFonteSheetProps {
  fonte: MktFonte;
  onBack: () => void;
  onSelectSubFonte: (subFonte: MktSubFonte) => void;
}

export function SubFonteSheet({ fonte, onBack, onSelectSubFonte }: SubFonteSheetProps) {
  const { subFontes, colunas, deleteSubFonte } = useMarketingGastos();
  const [createOpen, setCreateOpen] = useState(false);
  const [editSubFonte, setEditSubFonte] = useState<MktSubFonte | null>(null);
  const [deleteSubFonteId, setDeleteSubFonteId] = useState<string | null>(null);

  const fonteSubFontes = subFontes.filter(sf => sf.fonte_id === fonte.id);
  
  const IconComponent = (LucideIcons as Record<string, any>)[
    fonte.icone.charAt(0).toUpperCase() + fonte.icone.slice(1)
  ] || LucideIcons.Wallet;

  const handleDelete = async () => {
    if (deleteSubFonteId) {
      await deleteSubFonte(deleteSubFonteId);
      setDeleteSubFonteId(null);
    }
  };

  const getColunasCount = (subFonteId: string) => {
    return colunas.filter(c => c.sub_fonte_id === subFonteId).length;
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <div 
        className="px-6 py-6 border-b"
        style={{ 
          background: `linear-gradient(135deg, ${fonte.cor}10 0%, transparent 50%)` 
        }}
      >
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div 
            className="p-3 rounded-2xl shadow-lg"
            style={{ 
              backgroundColor: fonte.cor,
              boxShadow: `0 10px 25px -5px ${fonte.cor}40`
            }}
          >
            <IconComponent className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">{fonte.nome}</h1>
            <p className="text-muted-foreground text-sm">
              Gerencie as sub-fontes e configure as métricas
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Sub-fonte
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto">
        {fonteSubFontes.length === 0 ? (
          <Card className="border-dashed border-2 bg-muted/30">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="p-4 rounded-full bg-primary/10 mb-4">
                <Layers className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Nenhuma sub-fonte</h3>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Adicione sub-fontes para organizar seus gastos. Por exemplo: Rede de Pesquisa, Display, YouTube.
              </p>
              <Button onClick={() => setCreateOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Criar Sub-fonte
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fonteSubFontes.map(subFonte => (
              <Card 
                key={subFonte.id}
                className="group hover:shadow-lg hover:border-primary/30 transition-all cursor-pointer"
                onClick={() => onSelectSubFonte(subFonte)}
              >
                <CardHeader className="pb-2 flex flex-row items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="p-2 rounded-lg"
                      style={{ 
                        backgroundColor: `${fonte.cor}15`,
                        color: fonte.cor 
                      }}
                    >
                      <Table2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold group-hover:text-primary transition-colors">
                        {subFonte.nome}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {getColunasCount(subFonte.id)} colunas configuradas
                      </p>
                    </div>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditSubFonte(subFonte); }}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => { e.stopPropagation(); setDeleteSubFonteId(subFonte.id); }}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                
                <CardContent>
                  {subFonte.descricao && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {subFonte.descricao}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs">
                      Clique para abrir planilha
                    </Badge>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Add card */}
            <Card 
              className="border-dashed border-2 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group"
              onClick={() => setCreateOpen(true)}
            >
              <CardContent className="flex flex-col items-center justify-center h-full min-h-[180px] py-8">
                <div className="p-3 rounded-full bg-muted group-hover:bg-primary/10 transition-colors mb-3">
                  <Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <span className="text-muted-foreground group-hover:text-primary font-medium transition-colors">
                  Adicionar Sub-fonte
                </span>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <CreateSubFonteDialog
        fonteId={fonte.id}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      {editSubFonte && (
        <EditSubFonteDialog
          subFonte={editSubFonte}
          open={!!editSubFonte}
          onOpenChange={(open) => !open && setEditSubFonte(null)}
        />
      )}

      <AlertDialog open={!!deleteSubFonteId} onOpenChange={(open) => !open && setDeleteSubFonteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir sub-fonte?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá excluir a sub-fonte e todas as suas colunas e lançamentos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
