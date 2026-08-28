import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileText, MoreVertical, Trash2, Star, Edit } from 'lucide-react';
import { MarketingBoardTemplate } from '@/hooks/useMarketingBoardTemplates';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TemplatesListProps {
  templates: MarketingBoardTemplate[];
  onSelect: (template: MarketingBoardTemplate) => void;
  onDelete: (id: string) => void;
  onToggleCentral: (template: MarketingBoardTemplate) => void;
}

export function TemplatesList({
  templates,
  onSelect,
  onDelete,
  onToggleCentral,
}: TemplatesListProps) {
  if (templates.length === 0) {
    return (
      <Card className="p-4 text-center text-muted-foreground">
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhum template salvo</p>
        <p className="text-xs mt-1">Use o botão de salvar na lousa para criar templates</p>
      </Card>
    );
  }

  return (
    <Card className="p-2">
      <ScrollArea className="max-h-[400px]">
        <div className="space-y-1">
          {templates.map((template) => (
            <div
              key={template.id}
              className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 group"
            >
              <button
                onClick={() => onSelect(template)}
                className="flex-1 flex items-center gap-2 text-left min-w-0"
              >
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{template.nome}</span>
                    {template.tipo === 'central' && (
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        <Star className="h-3 w-3 mr-1 fill-current" />
                        Central
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(template.criado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onSelect(template)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onToggleCentral(template)}>
                    <Star className="h-4 w-4 mr-2" />
                    {template.tipo === 'central' ? 'Remover de Central' : 'Tornar Central'}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDelete(template.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}
