import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  CircleSlash,
  ExternalLink,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react';
import { MarkupIACadastroRapidoDialog } from '@/components/markup/MarkupIACadastroRapidoDialog';
import type { MarkupIACadastroRapidoPayload } from '@/components/markup/MarkupIACadastroRapidoDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { correspondeBuscaFlexivel } from '@/lib/markup-busca';
import { formatarMoedaMarkup } from '@/lib/markup-calculo';
import { contarItensPorConfianca } from '@/lib/markup-extracao';
import type { MarkupItemExtraido, MarkupMatchConfianca } from '@/lib/markup-match';
import type { MarkupCategoria, MarkupIALimitesAnexos, MarkupProduto } from '@/lib/markup-types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MarkupIAConferenciaDialogProps {
  open: boolean;
  itens: MarkupItemExtraido[];
  produtos: MarkupProduto[];
  categorias?: MarkupCategoria[];
  limites?: MarkupIALimitesAnexos | null;
  onChange: Dispatch<SetStateAction<MarkupItemExtraido[]>>;
  onConfirm: () => void;
  onCancel: () => void;
  onCadastrarProduto?: (
    payload: MarkupIACadastroRapidoPayload,
  ) => Promise<{ id: string; unidade: string } | null>;
  confirmando?: boolean;
}

function tomConfianca(confianca: MarkupMatchConfianca) {
  if (confianca === 'alta') return 'border-emerald-500/40 bg-emerald-500/10';
  if (confianca === 'media') return 'border-amber-500/40 bg-amber-500/10';
  if (confianca === 'baixa') return 'border-orange-500/40 bg-orange-500/10';
  return 'border-red-500/30 bg-red-500/10';
}

function rotuloConfianca(confianca: MarkupMatchConfianca) {
  if (confianca === 'alta') return 'Verde — casado';
  if (confianca === 'media') return 'Amarelo — conferir';
  if (confianca === 'baixa') return 'Amarelo — conferir';
  return 'Vermelho — não achou';
}

function ProdutoPicker({
  produtos,
  produtoId,
  onSelect,
}: {
  produtos: MarkupProduto[];
  produtoId: string | null;
  onSelect: (produtoId: string | null) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const escolhido = produtos.find((p) => p.id === produtoId);

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-full justify-start text-left text-[11px] font-normal"
        >
          <Search className="mr-1.5 h-3 w-3 shrink-0" />
          <span className="truncate">
            {escolhido
              ? `${escolhido.nome}${escolhido.variacao ? ` · ${escolhido.variacao}` : ''}`
              : 'Buscar no catálogo'}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Nome ou variação…" />
          <CommandList>
            <CommandEmpty>Nenhum produto com esse nome.</CommandEmpty>
            <CommandGroup>
              {produtos.map((produto) => (
                <CommandItem
                  key={produto.id}
                  value={`${produto.nome} ${produto.variacao ?? ''} ${produto.unidade}`}
                  onSelect={() => {
                    onSelect(produto.id);
                    setAberto(false);
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{produto.nome}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {produto.variacao ?? 'sem variação'} · {produto.unidade}
                      {produto.preco_unitario != null
                        ? ` · ${formatarMoedaMarkup(produto.preco_unitario)}`
                        : ''}
                    </p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function MarkupIAConferenciaDialog({
  open,
  itens,
  produtos,
  categorias = [],
  limites,
  onChange,
  onConfirm,
  onCancel,
  onCadastrarProduto,
  confirmando,
}: MarkupIAConferenciaDialogProps) {
  const [filtro, setFiltro] = useState('');
  const [itemCadastro, setItemCadastro] = useState<MarkupItemExtraido | null>(null);
  const [salvandoCadastro, setSalvandoCadastro] = useState(false);
  const contagem = contarItensPorConfianca(itens);
  const aceitos = itens.filter((item) => item.status_revisao === 'aceito' && item.produto_id).length;
  const amarelosPendentes = itens.filter(
    (item) =>
      (item.confianca === 'media' || item.confianca === 'baixa') &&
      item.status_revisao === 'pendente',
  ).length;

  const visiveis = useMemo(
    () =>
      itens.filter((item) =>
        correspondeBuscaFlexivel(
          `${item.nome} ${item.especificacao ?? ''} ${item.unidade ?? ''}`,
          filtro,
        ),
      ),
    [itens, filtro],
  );

  const atualizar = (id: string, patch: Partial<MarkupItemExtraido>) => {
    onChange((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const aceitarVerdes = () => {
    onChange((prev) =>
      prev.map((item) =>
        item.confianca === 'alta' && item.produto_id
          ? { ...item, status_revisao: 'aceito' }
          : item,
      ),
    );
  };

  const vincularProduto = (itemId: string, produtoId: string, unidade?: string | null) => {
    onChange((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              produto_id: produtoId,
              unidade: unidade ?? item.unidade,
              status_revisao: 'aceito',
              confianca: 'alta',
              score: 1,
            }
          : item,
      ),
    );
  };

  const salvarCadastro = async (payload: MarkupIACadastroRapidoPayload) => {
    if (!itemCadastro || !onCadastrarProduto) return;
    setSalvandoCadastro(true);
    try {
      const criado = await onCadastrarProduto(payload);
      if (criado) {
        vincularProduto(itemCadastro.id, criado.id, criado.unidade);
        setItemCadastro(null);
      }
    } finally {
      setSalvandoCadastro(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(next) => { if (!next && !itemCadastro) onCancel(); }}>
      <DialogContent
        overlayClassName="z-[80]"
        className="z-[80] flex max-h-[90vh] max-w-3xl flex-col gap-3 overflow-hidden"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-violet-600" />
            Conferir extração antes de fechar o preço
          </DialogTitle>
          <DialogDescription className="text-xs">
            Verde entra no markup. Amarelo precisa da sua escolha. Vermelho fica de fora até você
            casar no catálogo ou ignorar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5 text-[11px]">
          <Badge className="bg-emerald-600 hover:bg-emerald-600">{contagem.alta} verde</Badge>
          <Badge variant="outline" className="border-amber-500/50 text-amber-800">
            {contagem.media + contagem.baixa} amarelo
          </Badge>
          <Badge variant="outline" className="border-red-500/40 text-red-700">
            {contagem.nenhuma} vermelho
          </Badge>
        </div>

        {limites?.avisos && limites.avisos.length > 0 && (
          <ul className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-900">
            {limites.avisos.map((aviso) => (
              <li key={aviso}>{aviso}</li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Filtrar itens extraídos"
            className="h-8 max-w-xs text-xs"
          />
          <Button type="button" variant="secondary" size="sm" className="h-8 text-xs" onClick={aceitarVerdes}>
            Aceitar todos os verdes
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" asChild>
            <Link to="/markup/configuracoes" target="_blank" rel="noreferrer">
              Abrir catálogo
              <ExternalLink className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>

        <ScrollArea className="min-h-0 flex-1 rounded-md border">
          <ul className="divide-y">
            {visiveis.map((item) => {
              const aceito = item.status_revisao === 'aceito';
              const ignorado = item.status_revisao === 'ignorado';
              return (
                <li key={item.id} className={cn('space-y-2 p-3', tomConfianca(item.confianca))}>
                  <div className="flex items-start gap-2">
                    <Checkbox
                      checked={aceito}
                      disabled={!item.produto_id}
                      onCheckedChange={(value) =>
                        atualizar(item.id, {
                          status_revisao: value === true ? 'aceito' : 'pendente',
                        })
                      }
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          aria-label={`Quantidade de ${item.nome}`}
                          className="h-7 w-[4.5rem] text-xs tabular-nums"
                          value={item.quantidade}
                          onChange={(e) => {
                            const qtd = Number(e.target.value);
                            atualizar(item.id, {
                              quantidade: Number.isFinite(qtd) ? Math.max(0, qtd) : 0,
                            });
                          }}
                        />
                        <p className="text-xs font-medium">
                          {item.nome}
                          {item.especificacao ? ` · ${item.especificacao}` : ''}
                          {item.unidade ? ` (${item.unidade})` : ''}
                        </p>
                        <Badge variant="outline" className="text-[9px] font-normal">
                          {rotuloConfianca(item.confianca)}
                        </Badge>
                      </div>
                      <ProdutoPicker
                        produtos={produtos}
                        produtoId={item.produto_id}
                        onSelect={(produtoId) =>
                          atualizar(item.id, {
                            produto_id: produtoId,
                            status_revisao: produtoId ? 'aceito' : 'pendente',
                            confianca: produtoId ? item.confianca : 'nenhuma',
                          })
                        }
                      />
                      {((item.alternativas ?? []).length > 0) && item.confianca !== 'alta' && (
                        <div className="flex flex-wrap gap-1">
                          {(item.alternativas ?? []).slice(0, 3).map((alt) => (
                            <Button
                              key={alt.produto_id}
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 max-w-full text-[10px]"
                              onClick={() =>
                                vincularProduto(
                                  item.id,
                                  alt.produto_id,
                                  produtos.find((p) => p.id === alt.produto_id)?.unidade,
                                )
                              }
                            >
                              Usar {alt.nome}
                              {alt.variacao ? ` · ${alt.variacao}` : ''}
                            </Button>
                          ))}
                        </div>
                      )}
                      {!item.produto_id && onCadastrarProduto && item.status_revisao !== 'ignorado' && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-[10px]"
                          onClick={() => setItemCadastro(item)}
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          Cadastrar este item
                        </Button>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant={ignorado ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-8 shrink-0 text-[10px]"
                      onClick={() =>
                        atualizar(item.id, {
                          status_revisao: ignorado ? 'pendente' : 'ignorado',
                          produto_id: ignorado ? item.produto_id : null,
                        })
                      }
                    >
                      {ignorado ? (
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                      ) : (
                        <CircleSlash className="mr-1 h-3 w-3" />
                      )}
                      {ignorado ? 'Desfazer' : 'Ignorar'}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:justify-between">
          <p className="text-[11px] text-muted-foreground">
            {aceitos > 0
              ? `${aceitos} item(ns) vão para o preço`
              : 'Nenhum material confirmado — entram só serviços e despesas'}
            {amarelosPendentes > 0 ? ` · ${amarelosPendentes} amarelo(s) ainda sem decisão` : ''}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={confirmando}
              onClick={() => {
                toast.info('Conferência cancelada — o preço do card não foi alterado.');
                onCancel();
              }}
            >
              Não aplicar
            </Button>
            <Button
              type="button"
              onClick={onConfirm}
              disabled={confirmando || (aceitos === 0 && amarelosPendentes > 0)}
            >
              Aplicar no markup
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <MarkupIACadastroRapidoDialog
      open={Boolean(itemCadastro)}
      item={itemCadastro}
      categorias={categorias}
      salvando={salvandoCadastro}
      onClose={() => setItemCadastro(null)}
      onSalvar={salvarCadastro}
    />
    </>
  );
}
