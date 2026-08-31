import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { MarkupItemExtraido } from '@/lib/markup-match';
import type { MarkupCategoria } from '@/lib/markup-types';

const UNIDADES = ['un', 'chapa', 'rolo', 'pct', 'm', 'kg'];

export interface MarkupIACadastroRapidoPayload {
  nome: string;
  variacao: string | null;
  unidade: string;
  preco_unitario: number | null;
  categoria_id: string;
}

interface MarkupIACadastroRapidoDialogProps {
  open: boolean;
  item: MarkupItemExtraido | null;
  categorias: MarkupCategoria[];
  salvando?: boolean;
  onClose: () => void;
  onSalvar: (payload: MarkupIACadastroRapidoPayload) => Promise<void>;
}

function sugerirUnidade(item: MarkupItemExtraido): string {
  const atual = (item.unidade ?? '').trim().toLowerCase();
  if (UNIDADES.includes(atual)) return atual;
  const texto = `${item.nome} ${item.especificacao ?? ''}`.toLowerCase();
  if (texto.includes('mdf') || texto.includes('chapa')) return 'chapa';
  if (texto.includes('fita')) return 'rolo';
  return 'un';
}

function sugerirCategoriaId(item: MarkupItemExtraido, categorias: MarkupCategoria[]): string {
  const texto = `${item.nome} ${item.especificacao ?? ''}`.toLowerCase();
  const pontuar = (categoria: MarkupCategoria): number => {
    const alvo = `${categoria.nome} ${categoria.slug} ${categoria.subcategoria ?? ''}`.toLowerCase();
    if (texto.includes('fita') && (alvo.includes('fita') || alvo.includes('borda'))) return 4;
    if (
      (texto.includes('mdf') || texto.includes('chapa')) &&
      (alvo.includes('chapa') || alvo.includes('mdf'))
    ) {
      return 4;
    }
    if (
      (texto.includes('dobradi') || texto.includes('corredi') || texto.includes('pist')) &&
      (alvo.includes('ferrag') || alvo.includes('corr') || alvo.includes('dobr'))
    ) {
      return 3;
    }
    return 0;
  };
  const ordenadas = [...categorias].sort((a, b) => pontuar(b) - pontuar(a));
  return ordenadas[0]?.id ?? '';
}

export function MarkupIACadastroRapidoDialog({
  open,
  item,
  categorias,
  salvando,
  onClose,
  onSalvar,
}: MarkupIACadastroRapidoDialogProps) {
  const [nome, setNome] = useState('');
  const [variacao, setVariacao] = useState('');
  const [unidade, setUnidade] = useState('un');
  const [preco, setPreco] = useState('');
  const [categoriaId, setCategoriaId] = useState('');

  useEffect(() => {
    if (!open || !item) return;
    setNome(item.nome);
    setVariacao(item.especificacao ?? '');
    setUnidade(sugerirUnidade(item));
    setPreco('');
    setCategoriaId(sugerirCategoriaId(item, categorias));
  }, [open, item, categorias]);

  const podeSalvar = Boolean(nome.trim() && categoriaId && !salvando);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        overlayClassName="z-[90]"
        className="z-[90] max-w-md gap-3"
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-base">Cadastrar no catálogo</DialogTitle>
          <DialogDescription className="text-xs">
            O item entra na tabela de preços da empresa e já fica marcado nesta conferência.
            Depois você pode ajustar o cadastro em Configurações.
          </DialogDescription>
        </DialogHeader>

        {categorias.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Não há categoria ativa. Abra Configurações de Markup e crie uma categoria antes.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cadastro-ia-nome">Nome</Label>
              <Input
                id="cadastro-ia-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cadastro-ia-variacao">Variação</Label>
              <Input
                id="cadastro-ia-variacao"
                value={variacao}
                onChange={(e) => setVariacao(e.target.value)}
                placeholder="Ex.: 15, RETA, 22"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cadastro-ia-categoria">Categoria</Label>
              <select
                id="cadastro-ia-categoria"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
              >
                {categorias.map((categoria) => (
                  <option key={categoria.id} value={categoria.id}>
                    {categoria.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cadastro-ia-preco">Preço unitário</Label>
                <Input
                  id="cadastro-ia-preco"
                  type="number"
                  min={0}
                  step={0.01}
                  value={preco}
                  onChange={(e) => setPreco(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cadastro-ia-unidade">Unidade</Label>
                <select
                  id="cadastro-ia-unidade"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={unidade}
                  onChange={(e) => setUnidade(e.target.value)}
                >
                  {UNIDADES.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!podeSalvar}
            onClick={() =>
              void onSalvar({
                nome: nome.trim(),
                variacao: variacao.trim() || null,
                unidade,
                preco_unitario: preco.trim() ? Number(preco) : null,
                categoria_id: categoriaId,
              })
            }
          >
            {salvando ? 'Salvando…' : 'Cadastrar e usar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
