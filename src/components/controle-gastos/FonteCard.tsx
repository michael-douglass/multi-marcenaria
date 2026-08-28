import { ChevronRight, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MktFonte, useMarketingGastos } from '@/hooks/useMarketingGastos';
import { cn } from '@/lib/utils';
import * as LucideIcons from 'lucide-react';
import { useState } from 'react';
import { EditFonteDialog } from './EditFonteDialog';
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

interface FonteCardProps {
  fonte: MktFonte;
  subFontesCount: number;
  onClick: () => void;
}

export function FonteCard({ fonte, subFontesCount, onClick }: FonteCardProps) {
  const { deleteFonte } = useMarketingGastos();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Dynamically get icon
  const IconComponent = (LucideIcons as Record<string, any>)[
    fonte.icone.charAt(0).toUpperCase() + fonte.icone.slice(1)
  ] || LucideIcons.Wallet;

  const handleDelete = async () => {
    await deleteFonte(fonte.id);
    setDeleteOpen(false);
  };

  return (
    <>
      <Card 
        className="group hover:shadow-lg hover:border-primary/30 transition-all cursor-pointer relative overflow-hidden"
        onClick={onClick}
      >
        {/* Decorative gradient */}
        <div 
          className="absolute top-0 left-0 w-full h-1"
          style={{ backgroundColor: fonte.cor }}
        />
        
        <CardHeader className="pb-2 flex flex-row items-start justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="p-2.5 rounded-xl shadow-sm"
              style={{ 
                backgroundColor: `${fonte.cor}15`,
                color: fonte.cor 
              }}
            >
              <IconComponent className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                {fonte.nome}
              </h3>
              <p className="text-sm text-muted-foreground">
                {subFontesCount} {subFontesCount === 1 ? 'sub-fonte' : 'sub-fontes'}
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
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditOpen(true); }}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={(e) => { e.stopPropagation(); setDeleteOpen(true); }}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Clique para gerenciar
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
        </CardContent>
      </Card>

      <EditFonteDialog
        fonte={fonte}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fonte "{fonte.nome}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá excluir a fonte e todas as suas sub-fontes, colunas e lançamentos. Esta ação não pode ser desfeita.
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
    </>
  );
}
