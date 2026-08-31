import { useMemo } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatarMoedaMarkup } from '@/lib/markup-calculo';
import { correspondeBuscaFlexivel } from '@/lib/markup-busca';
import {
  aplicarReordenacaoCatalogo,
  rotuloCategoriaProdutoMarkup,
} from '@/lib/markup-ui';
import type { MarkupLinhaOrigemIA, MarkupProduto } from '@/lib/markup-types';
import { cn } from '@/lib/utils';

interface MarkupCatalogoCategoriaCardProps {
  categoriaKey: string;
  /** Lista completa do card (já na ordem atual). */
  produtos: MarkupProduto[];
  qtdPorProduto: ReadonlyMap<string, number>;
  origemPorProduto: ReadonlyMap<string, MarkupLinhaOrigemIA>;
  /** Texto de busca; com busca ativa o arraste fica desligado. */
  termoBusca?: string;
  textoBuscaProduto: (produto: MarkupProduto) => string;
  onReorder: (categoriaKey: string, novaOrdemIds: string[]) => void;
  onQuantidadeChange: (produtoId: string, produto: MarkupProduto, qtd: number) => void;
}

interface SortableProdutoRowProps {
  produto: MarkupProduto;
  qtd: number;
  origem?: MarkupLinhaOrigemIA;
  reordenacaoHabilitada: boolean;
  podeSubir: boolean;
  podeDescer: boolean;
  onMover: (produtoId: string, direcao: 'up' | 'down') => void;
  onQuantidadeChange: (produtoId: string, produto: MarkupProduto, qtd: number) => void;
}

function SortableProdutoRow({
  produto,
  qtd,
  origem,
  reordenacaoHabilitada,
  podeSubir,
  podeDescer,
  onMover,
  onQuantidadeChange,
}: SortableProdutoRowProps) {
  const preco = produto.preco_unitario ?? 0;
  const selecionado = qtd > 0;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: produto.id,
    disabled: !reordenacaoHabilitada,
  });

  return (
    <TableRow
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        selecionado && 'bg-primary/5',
        isDragging && 'relative z-20 bg-background opacity-95 shadow-md ring-1 ring-primary/20',
      )}
    >
      <TableCell className="w-14 px-1">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className={cn(
              'touch-none rounded p-1 text-muted-foreground/50',
              reordenacaoHabilitada
                ? 'cursor-grab hover:text-muted-foreground active:cursor-grabbing'
                : 'cursor-not-allowed opacity-40',
            )}
            aria-label={`Arrastar ${produto.nome} para reordenar`}
            disabled={!reordenacaoHabilitada}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="flex flex-col">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground/60 hover:text-muted-foreground"
              aria-label={`Subir ${produto.nome}`}
              disabled={!reordenacaoHabilitada || !podeSubir}
              onClick={() => onMover(produto.id, 'up')}
            >
              <ArrowUp className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground/60 hover:text-muted-foreground"
              aria-label={`Descer ${produto.nome}`}
              disabled={!reordenacaoHabilitada || !podeDescer}
              onClick={() => onMover(produto.id, 'down')}
            >
              <ArrowDown className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </TableCell>
      <TableCell className="max-w-[140px] text-xs text-muted-foreground">
        <span className="line-clamp-2">{rotuloCategoriaProdutoMarkup(produto)}</span>
      </TableCell>
      <TableCell className="max-w-[160px]">
        <div className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-medium">{produto.nome}</span>
          {origem === 'projetista_complemento' && (
            <Badge
              variant="outline"
              className="w-fit border-sky-500/40 bg-sky-500/10 text-sky-600 text-[9px]"
            >
              Complemento
            </Badge>
          )}
          {origem === 'projetista' && (
            <Badge
              variant="outline"
              className="w-fit border-violet-500/40 bg-violet-500/10 text-violet-600 text-[9px]"
            >
              Projetista
            </Badge>
          )}
          {(origem === 'documento' || origem === 'cortecloud') && (
            <Badge
              variant="outline"
              className="w-fit border-emerald-500/40 bg-emerald-500/10 text-emerald-700 text-[9px]"
            >
              Documento
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground text-xs">{produto.variacao ?? '—'}</TableCell>
      <TableCell className="text-right text-sm tabular-nums">
        {produto.preco_unitario != null ? formatarMoedaMarkup(preco) : '—'}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{produto.unidade || '—'}</TableCell>
      <TableCell className="w-28 min-w-[7rem] px-2">
        <Input
          type="number"
          min={0}
          step={1}
          value={qtd || ''}
          disabled={produto.preco_unitario == null}
          onChange={(e) =>
            onQuantidadeChange(produto.id, produto, parseFloat(e.target.value) || 0)
          }
          className="h-8 w-full min-w-[5.5rem] text-right tabular-nums"
        />
      </TableCell>
      <TableCell className="text-right text-sm font-medium tabular-nums">
        {qtd > 0 ? formatarMoedaMarkup(qtd * preco) : '—'}
      </TableCell>
    </TableRow>
  );
}

export function MarkupCatalogoCategoriaCard({
  categoriaKey,
  produtos,
  qtdPorProduto,
  origemPorProduto,
  termoBusca = '',
  textoBuscaProduto,
  onReorder,
  onQuantidadeChange,
}: MarkupCatalogoCategoriaCardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const termo = termoBusca.trim();
  const reordenacaoHabilitada = !termo;

  const produtosVisiveis = useMemo(() => {
    if (!termo) return produtos;
    return produtos.filter((p) => correspondeBuscaFlexivel(textoBuscaProduto(p), termo));
  }, [produtos, termo, textoBuscaProduto]);

  const idsOrdenacao = useMemo(() => produtos.map((p) => p.id), [produtos]);
  const idsVisiveis = useMemo(() => produtosVisiveis.map((p) => p.id), [produtosVisiveis]);

  const handleDragEnd = (event: DragEndEvent) => {
    if (!reordenacaoHabilitada) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const novaOrdem = aplicarReordenacaoCatalogo(
      idsOrdenacao,
      String(active.id),
      String(over.id),
    );
    if (!novaOrdem) return;
    onReorder(categoriaKey, novaOrdem);
  };

  const handleMover = (produtoId: string, direcao: 'up' | 'down') => {
    if (!reordenacaoHabilitada) return;
    const index = idsOrdenacao.indexOf(produtoId);
    if (index < 0) return;
    const alvoIndex = direcao === 'up' ? index - 1 : index + 1;
    if (alvoIndex < 0 || alvoIndex >= idsOrdenacao.length) return;
    const overId = idsOrdenacao[alvoIndex];
    if (!overId) return;
    const novaOrdem = aplicarReordenacaoCatalogo(idsOrdenacao, produtoId, overId);
    if (!novaOrdem) return;
    onReorder(categoriaKey, novaOrdem);
  };

  if (produtosVisiveis.length === 0) return null;

  return (
    <div className="mb-6">
      <h4 className="sticky top-0 z-10 mb-2 bg-background py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {categoriaKey}
      </h4>
      <div className="overflow-x-auto -mx-1 px-1">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <Table className="min-w-[740px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-14 px-1" aria-label="Reordenar" />
                <TableHead>Categoria</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Var.</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead>Un.</TableHead>
                <TableHead className="w-28 min-w-[7rem] text-right">Qtd</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <SortableContext items={idsVisiveis} strategy={verticalListSortingStrategy}>
              <TableBody>
                {produtosVisiveis.map((p) => {
                  const indexFull = idsOrdenacao.indexOf(p.id);
                  return (
                    <SortableProdutoRow
                      key={p.id}
                      produto={p}
                      qtd={qtdPorProduto.get(p.id) ?? 0}
                      origem={origemPorProduto.get(p.id)}
                      reordenacaoHabilitada={reordenacaoHabilitada}
                      podeSubir={indexFull > 0}
                      podeDescer={indexFull >= 0 && indexFull < idsOrdenacao.length - 1}
                      onMover={handleMover}
                      onQuantidadeChange={onQuantidadeChange}
                    />
                  );
                })}
              </TableBody>
            </SortableContext>
          </Table>
        </DndContext>
      </div>
    </div>
  );
}
