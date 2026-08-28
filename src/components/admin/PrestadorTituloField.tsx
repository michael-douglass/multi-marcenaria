import { useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Check, ChevronsUpDown, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePrestadorTitulos } from '@/hooks/usePrestadorTitulos';

interface PrestadorTituloFieldProps {
  id: string;
  value: string;
  onChange: (titulo: string) => void;
}

export function PrestadorTituloField({ id, value, onChange }: PrestadorTituloFieldProps) {
  const { titulos, isLoading, createTitulo, isCreating } = usePrestadorTitulos();
  const [comboOpen, setComboOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState('');

  const selectedLabel = useMemo(() => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const match = titulos.find((t) => t.nome.toLowerCase() === trimmed.toLowerCase());
    return match?.nome ?? trimmed;
  }, [titulos, value]);

  const handleAddTitulo = async () => {
    const nome = novoTitulo.trim();
    if (!nome) return;
    try {
      const created = await createTitulo(nome);
      onChange(created.nome);
      setNovoTitulo('');
      setAddOpen(false);
      setComboOpen(false);
    } catch {
      /* toast no hook */
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        Título do Prestador
        <span className="ml-1 text-xs text-muted-foreground">(exibido para o usuário)</span>
      </Label>
      <div className="flex gap-2">
        <Popover open={comboOpen} onOpenChange={setComboOpen}>
          <PopoverTrigger asChild>
            <Button
              id={id}
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={comboOpen}
              disabled={isLoading}
              className={cn(
                'flex-1 justify-between font-normal h-10',
                !selectedLabel && 'text-muted-foreground',
              )}
            >
              <span className="truncate text-left">
                {isLoading
                  ? 'Carregando títulos...'
                  : selectedLabel ?? 'Buscar ou selecionar título'}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] p-0 z-[10050]"
            align="start"
          >
            <Command shouldFilter>
              <CommandInput placeholder="Buscar título (ex: Arquiteto)..." />
              <CommandList>
                <CommandEmpty>
                  Nenhum título encontrado. Use o botão + para cadastrar.
                </CommandEmpty>
                <CommandGroup>
                  {titulos.map((t) => (
                    <CommandItem
                      key={t.id}
                      value={t.nome}
                      onSelect={() => {
                        onChange(t.nome);
                        setComboOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4 shrink-0',
                          selectedLabel?.toLowerCase() === t.nome.toLowerCase()
                            ? 'opacity-100'
                            : 'opacity-0',
                        )}
                      />
                      {t.nome}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Popover open={addOpen} onOpenChange={setAddOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0 h-10 w-10"
              aria-label="Cadastrar novo título"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 space-y-3 z-[10050]" align="end">
            <p className="text-sm font-medium">Cadastrar título</p>
            <Input
              placeholder="Ex: Arquiteto, Nutricionista..."
              value={novoTitulo}
              onChange={(e) => setNovoTitulo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleAddTitulo();
                }
              }}
            />
            <Button
              type="button"
              className="w-full"
              disabled={!novoTitulo.trim() || isCreating}
              onClick={() => void handleAddTitulo()}
            >
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Salvar título'
              )}
            </Button>
          </PopoverContent>
        </Popover>
      </div>
      {selectedLabel && (
        <p className="text-xs text-muted-foreground">
          Selecionado: <strong className="text-foreground">{selectedLabel}</strong>
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Digite na busca para filtrar. Use + para cadastrar um título novo (ex: Arquiteto).
      </p>
    </div>
  );
}
