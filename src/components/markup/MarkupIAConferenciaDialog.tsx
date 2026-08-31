import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  CircleSlash,
  ExternalLink,
  Search,
  Sparkles,
} from 'lucide-react';
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
import type { MarkupIALimitesAnexos, MarkupProduto } from '@/lib/markup-types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MarkupIAConferenciaDialogProps {
  open: boolean;
  itens: MarkupItemExtraido[];
  produtos: MarkupProduto[];
  limites?: MarkupIALimitesAnexos | null;
  onChange: (itens: MarkupItemExtraido[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
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
  limites,
  onChange,
  onConfirm,
  onCancel,
  confirmando,
}: MarkupIAConferenciaDialogProps) {
  const [filtro, setFiltro] = useState('');
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
    onChange(itens.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const aceitarVerdes = () => {
    onChange(
      itens.map((item) =>
        item.confianca === 'alta' && item.produto_id
          ? { ...item, status_revisao: 'aceito' }
          : item,
      ),
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
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
              Cadastrar no catálogo
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
                        <p className="text-xs font-medium">
                          {item.quantidade}× {item.nome}
                          {item.especificacao ? ` · ${item.especificacao}` : ''}
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
            {aceitos} item(ns) vão para o preço
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
            <Button type="button" onClick={onConfirm} disabled={confirmando || aceitos === 0}>
              Aplicar no markup
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
