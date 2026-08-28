import { useState, memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Send, Trash2, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarketingPlanningNode } from '@/hooks/useMarketingConteudo';

interface PlanningNodeData {
  titulo: string;
  conteudo: string;
  classificacao: 'planejamento_central' | 'plano_postagem' | 'plano_trafego' | null;
  enviado_producao: boolean;
  dbId: string;
  onUpdate: (id: string, updates: Partial<MarketingPlanningNode>) => void;
  onDelete: (id: string) => void;
  onSendToProduction: (node: MarketingPlanningNode) => void;
}

function PlanningNodeComponentInner({ data, id, selected }: NodeProps & { data: PlanningNodeData }) {
  const [isEditing, setIsEditing] = useState(false);
  const [titulo, setTitulo] = useState(data.titulo);
  const [conteudo, setConteudo] = useState(data.conteudo || '');
  const [classificacao, setClassificacao] = useState(data.classificacao || '');

  const classificacaoLabels: Record<string, string> = {
    planejamento_central: 'Planejamento Central',
    plano_postagem: 'Plano de Postagem',
    plano_trafego: 'Plano de Tráfego',
  };

  const handleSave = () => {
    data.onUpdate(data.dbId, {
      titulo,
      conteudo: conteudo || null,
      classificacao: (classificacao as MarketingPlanningNode['classificacao']) || null,
    });
    setIsEditing(false);
  };

  const handleSendToProduction = () => {
    const node: MarketingPlanningNode = {
      id: data.dbId,
      titulo,
      conteudo,
      classificacao: (classificacao as MarketingPlanningNode['classificacao']) || null,
      position_x: 0,
      position_y: 0,
      enviado_producao: false,
      card_id: null,
      criado_em: '',
      atualizado_em: '',
    };
    data.onSendToProduction(node);
  };

  const handleStyle = 'w-3 h-3 !bg-primary border-2 border-background';

  return (
    <>
      {/* Handles nos 4 lados */}
      <Handle type="target" position={Position.Top} className={handleStyle} />
      <Handle type="source" position={Position.Top} id="top" className={handleStyle} />
      <Handle type="target" position={Position.Bottom} className={handleStyle} />
      <Handle type="source" position={Position.Bottom} id="bottom" className={handleStyle} />
      <Handle type="target" position={Position.Left} className={handleStyle} />
      <Handle type="source" position={Position.Left} id="left" className={handleStyle} />
      <Handle type="target" position={Position.Right} className={handleStyle} />
      <Handle type="source" position={Position.Right} id="right" className={handleStyle} />

      <Card
        className={cn(
          'p-4 min-w-[250px] max-w-[350px] shadow-lg',
          data.enviado_producao && 'opacity-60 border-green-500',
          selected && 'ring-2 ring-primary ring-offset-2'
        )}
      >
        {isEditing ? (
          <div className="space-y-3">
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título"
              className="font-medium"
            />
            <Textarea
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              placeholder="Conteúdo do planejamento..."
              className="min-h-[100px] text-sm"
            />
            <Select value={classificacao} onValueChange={setClassificacao}>
              <SelectTrigger>
                <SelectValue placeholder="Classificação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="planejamento_central">Planejamento Central</SelectItem>
                <SelectItem value="plano_postagem">Plano de Postagem</SelectItem>
                <SelectItem value="plano_trafego">Plano de Tráfego</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave}>
                <Save className="h-3 w-3 mr-1" />
                Salvar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2" onDoubleClick={() => setIsEditing(true)}>
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-medium text-sm">{data.titulo || 'Sem título'}</h4>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => data.onDelete(data.dbId)}
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
            
            {data.classificacao && (
              <Badge variant="secondary" className="text-xs">
                {classificacaoLabels[data.classificacao]}
              </Badge>
            )}
            
            {data.conteudo && (
              <p className="text-xs text-muted-foreground line-clamp-3">{data.conteudo}</p>
            )}

            {!data.enviado_producao && (
              <Button
                size="sm"
                variant="default"
                className="w-full mt-2"
                onClick={handleSendToProduction}
              >
                <Send className="h-3 w-3 mr-1" />
                Enviar para Produção
              </Button>
            )}

            {data.enviado_producao && (
              <Badge variant="default" className="w-full justify-center bg-green-600">
                ✓ Enviado para Produção
              </Badge>
            )}

            <p className="text-xs text-muted-foreground text-center mt-2">
              Clique duas vezes para editar
            </p>
          </div>
        )}
      </Card>
    </>
  );
}

export const PlanningNodeComponent = memo(PlanningNodeComponentInner);
