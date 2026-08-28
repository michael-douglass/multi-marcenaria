import { useState } from 'react';
import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  coletarIdsChecklist,
  contarChecklistAtivo,
  criarCategoriaVerificacao,
  criarItemVerificacao,
  MARKUP_IA_VERIFICACAO_PADRAO,
  normalizarChecklistVerificacao,
  type MarkupIAVerificacaoCategoria,
  type MarkupIAVerificacaoPrioridade,
} from '@/lib/markup-ia-verificacao';
import { cn } from '@/lib/utils';

interface MarkupIAVerificacaoChecklistProps {
  value: MarkupIAVerificacaoCategoria[];
  onChange: (value: MarkupIAVerificacaoCategoria[]) => void;
  className?: string;
}

interface ItemFormState {
  nome: string;
  variacoes: string;
  prioridade: MarkupIAVerificacaoPrioridade;
  somente_referencia: boolean;
  nota: string;
}

const ITEM_FORM_VAZIO: ItemFormState = {
  nome: '',
  variacoes: '',
  prioridade: 'normal',
  somente_referencia: false,
  nota: '',
};

export function MarkupIAVerificacaoChecklist({
  value,
  onChange,
  className,
}: MarkupIAVerificacaoChecklistProps) {
  const checklist = normalizarChecklistVerificacao(value);
  const { categorias, itens } = contarChecklistAtivo(checklist);

  const [dialogCategoria, setDialogCategoria] = useState(false);
  const [nomeCategoria, setNomeCategoria] = useState('');
  const [dialogItem, setDialogItem] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<ItemFormState>(ITEM_FORM_VAZIO);
  const [removerCategoriaId, setRemoverCategoriaId] = useState<string | null>(null);

  const updateCategoria = (catId: string, patch: Partial<MarkupIAVerificacaoCategoria>) => {
    onChange(checklist.map((c) => (c.id === catId ? { ...c, ...patch } : c)));
  };

  const updateItem = (
    catId: string,
    itemId: string,
    patch: Partial<MarkupIAVerificacaoCategoria['itens'][0]>,
  ) => {
    onChange(
      checklist.map((c) =>
        c.id === catId
          ? {
              ...c,
              itens: c.itens.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
            }
          : c,
      ),
    );
  };

  const restaurarPadrao = () => {
    onChange(structuredClone(MARKUP_IA_VERIFICACAO_PADRAO));
  };

  const abrirDialogItem = (catId: string) => {
    setItemForm(ITEM_FORM_VAZIO);
    setDialogItem(catId);
  };

  const salvarCategoria = () => {
    const nome = nomeCategoria.trim();
    if (!nome) return;
    const ids = coletarIdsChecklist(checklist);
    const maxOrdem = checklist.reduce((max, c) => Math.max(max, c.ordem), 0);
    const nova = criarCategoriaVerificacao(nome, maxOrdem + 1, ids);
    onChange([...checklist, nova]);
    setNomeCategoria('');
    setDialogCategoria(false);
  };

  const salvarItem = () => {
    if (!dialogItem) return;
    const nome = itemForm.nome.trim();
    if (!nome) return;
    const ids = coletarIdsChecklist(checklist);
    const novoItem = criarItemVerificacao(nome, itemForm.variacoes, {
      prioridade: itemForm.prioridade,
      somente_referencia: itemForm.somente_referencia,
      nota: itemForm.nota,
    }, ids);
    onChange(
      checklist.map((c) =>
        c.id === dialogItem ? { ...c, itens: [...c.itens, novoItem] } : c,
      ),
    );
    setDialogItem(null);
    setItemForm(ITEM_FORM_VAZIO);
  };

  const removerItem = (catId: string, itemId: string) => {
    onChange(
      checklist.map((c) =>
        c.id === catId ? { ...c, itens: c.itens.filter((i) => i.id !== itemId) } : c,
      ),
    );
  };

  const confirmarRemoverCategoria = () => {
    if (!removerCategoriaId) return;
    onChange(checklist.filter((c) => c.id !== removerCategoriaId));
    setRemoverCategoriaId(null);
  };

  const categoriaParaRemover = checklist.find((c) => c.id === removerCategoriaId);

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Label className="text-sm font-medium">Checklist de verificação Cortecloud</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            {categorias} categorias ativas · {itens} itens monitorados · itens{' '}
            <strong>críticos</strong> disparam retry automático se faltarem na composição
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setDialogCategoria(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Adicionar categoria
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={restaurarPadrao}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Restaurar padrão
          </Button>
        </div>
      </div>

      <Accordion type="multiple" className="rounded-lg border bg-card/50">
        {checklist
          .slice()
          .sort((a, b) => a.ordem - b.ordem)
          .map((cat) => {
            const itensAtivos = cat.itens.filter((i) => i.ativo).length;
            return (
              <AccordionItem key={cat.id} value={cat.id} className="border-b last:border-0 px-3">
                <div className="flex items-center gap-2 py-1">
                  <Switch
                    checked={cat.ativo}
                    onCheckedChange={(ativo) => updateCategoria(cat.id, { ativo })}
                    aria-label={`Ativar categoria ${cat.nome}`}
                  />
                  <AccordionTrigger className="flex-1 py-3 hover:no-underline">
                    <div className="flex flex-1 items-center justify-between gap-2 pr-2 text-left">
                      <span className="text-sm font-medium">{cat.nome}</span>
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        {itensAtivos} itens
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setRemoverCategoriaId(cat.id)}
                    aria-label={`Remover categoria ${cat.nome}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <AccordionContent className="pb-4 pt-0">
                  <ul className="space-y-2 pl-1">
                    {cat.itens.map((item) => (
                      <li
                        key={item.id}
                        className={cn(
                          'flex flex-wrap items-start gap-2 rounded-md border px-3 py-2 text-sm',
                          !item.ativo && 'opacity-50',
                          item.somente_referencia && 'border-dashed bg-muted/30',
                        )}
                      >
                        <Switch
                          checked={item.ativo}
                          onCheckedChange={(ativo) => updateItem(cat.id, item.id, { ativo })}
                          className="mt-0.5"
                          aria-label={`Ativar ${item.nome}`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium">{item.nome}</span>
                            {item.prioridade === 'alta' && (
                              <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 text-[10px]">
                                crítico — gate retry
                              </Badge>
                            )}
                            {item.somente_referencia && (
                              <Badge variant="outline" className="text-[10px]">
                                só referência
                              </Badge>
                            )}
                          </div>
                          {item.variacoes.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {item.variacoes.map((v) => (
                                <Badge key={v} variant="secondary" className="text-[10px] font-mono">
                                  {v}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {item.nota && (
                            <p className="mt-1 text-xs text-muted-foreground">{item.nota}</p>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removerItem(cat.id, item.id)}
                          aria-label={`Remover ${item.nome}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => abrirDialogItem(cat.id)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Adicionar item
                  </Button>
                </AccordionContent>
              </AccordionItem>
            );
          })}
      </Accordion>

      <Dialog open={dialogCategoria} onOpenChange={setDialogCategoria}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova categoria de verificação</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="nome-categoria">Nome da categoria</Label>
            <Input
              id="nome-categoria"
              value={nomeCategoria}
              onChange={(e) => setNomeCategoria(e.target.value)}
              placeholder="Ex.: Puxadores e acessórios"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogCategoria(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={salvarCategoria} disabled={!nomeCategoria.trim()}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogItem !== null} onOpenChange={(open) => !open && setDialogItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar item de verificação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome-item">Nome do material</Label>
              <Input
                id="nome-item"
                value={itemForm.nome}
                onChange={(e) => setItemForm((prev) => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex.: PUXADOR ALUMINIO"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="variacoes-item">Variações</Label>
              <Textarea
                id="variacoes-item"
                value={itemForm.variacoes}
                onChange={(e) => setItemForm((prev) => ({ ...prev, variacoes: e.target.value }))}
                placeholder="Separe por vírgula ou quebra de linha. Ex.: 22, 35, 64"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prioridade-item">Prioridade</Label>
              <select
                id="prioridade-item"
                className="w-full h-10 rounded-md border bg-background px-3 text-base md:text-sm"
                value={itemForm.prioridade}
                onChange={(e) =>
                  setItemForm((prev) => ({
                    ...prev,
                    prioridade: e.target.value as MarkupIAVerificacaoPrioridade,
                  }))
                }
              >
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
              </select>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>Somente referência</Label>
                <p className="text-xs text-muted-foreground">
                  Não entra como material (ex.: Serviço).
                </p>
              </div>
              <Switch
                checked={itemForm.somente_referencia}
                onCheckedChange={(checked) =>
                  setItemForm((prev) => ({ ...prev, somente_referencia: checked }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nota-item">Nota (opcional)</Label>
              <Input
                id="nota-item"
                value={itemForm.nota}
                onChange={(e) => setItemForm((prev) => ({ ...prev, nota: e.target.value }))}
                placeholder="Instrução extra para a Íris"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogItem(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={salvarItem} disabled={!itemForm.nome.trim()}>
              Adicionar item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={removerCategoriaId !== null} onOpenChange={(open) => !open && setRemoverCategoriaId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              A categoria &quot;{categoriaParaRemover?.nome}&quot; e todos os seus{' '}
              {categoriaParaRemover?.itens.length ?? 0} itens serão removidos do checklist.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarRemoverCategoria}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
