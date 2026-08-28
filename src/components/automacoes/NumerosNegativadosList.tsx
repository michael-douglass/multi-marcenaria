import { useState, forwardRef, useImperativeHandle } from 'react';
import { Search, Trash2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { useNumerosNegativados } from '@/hooks/useNumerosNegativados';
import { formatPhoneNumber } from '@/lib/utils';

export const NumerosNegativadosList = forwardRef<{ refreshNumeros: () => void }>((props, ref) => {
  const { hasPermission } = usePermissions();
  const { numeros, isLoading, searchTerm, setSearchTerm, deleteNumero, refreshNumeros } = useNumerosNegativados();
  const [numeroToDelete, setNumeroToDelete] = useState<{ id: number; numero: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const canViewNumeros = hasPermission('numeros_negativados', 'view');

  useImperativeHandle(ref, () => ({
    refreshNumeros
  }));

  // Se não tiver permissão, mostrar mensagem
  if (!canViewNumeros) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        Você não tem permissão para visualizar a lista de números negativados.
        <br />
        Entre em contato com um administrador.
      </div>
    );
  }

  const handleDeleteClick = (id: number, numero: string) => {
    setNumeroToDelete({ id, numero });
  };

  const handleConfirmDelete = async () => {
    if (!numeroToDelete) return;

    setIsDeleting(true);
    const success = await deleteNumero(numeroToDelete.id);
    setIsDeleting(false);
    
    if (success) {
      setNumeroToDelete(null);
    }
  };

  const handleClearSearch = () => {
    setSearchTerm('');
  };

  // Identificar os últimos 10 números adicionados
  const ultimosDez = numeros.slice(0, 10).map(n => n.id);

  return (
    <>
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Números Negativados</h3>

        {/* Campo de Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar número..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-9"
            disabled={isLoading}
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
              onClick={handleClearSearch}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Tabela */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Carregando...
          </div>
        ) : numeros.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm ? 'Nenhum número encontrado' : 'Nenhum número negativado ainda'}
          </div>
        ) : (
          <ScrollArea className="h-[300px] w-full rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número Telefone</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {numeros.map((numero) => {
                  const telefoneStr = numero.numeroTelefone?.toString() ?? '';
                  return (
                    <TableRow 
                      key={numero.id}
                      className={ultimosDez.includes(numero.id) ? 'bg-yellow-50 dark:bg-yellow-950/20' : ''}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {telefoneStr ? formatPhoneNumber(telefoneStr) : '-'}
                          {ultimosDez.includes(numero.id) && (
                            <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-0.5 rounded">
                              Recente
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(numero.id, telefoneStr)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        )}

        {/* Contador */}
        {!isLoading && numeros.length > 0 && (
          <p className="text-sm text-muted-foreground text-center">
            Mostrando {numeros.length} {numeros.length === 1 ? 'número' : 'números'}
            {numeros.length > 10 && (
              <span className="text-yellow-600 dark:text-yellow-400 ml-1">
                ({Math.min(ultimosDez.length, numeros.length)} recentes destacados)
              </span>
            )}
          </p>
        )}
      </div>

      {/* Modal de Confirmação */}
      <AlertDialog open={!!numeroToDelete} onOpenChange={() => setNumeroToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Número da Negativação?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o número{' '}
              <strong>{numeroToDelete && formatPhoneNumber(numeroToDelete.numero)}</strong> da lista de
              bloqueio?
              <br />
              <br />
              Esta ação irá remover o número da lista de negativação e notificar o sistema externo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Removendo...' : 'Sim, Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});

NumerosNegativadosList.displayName = 'NumerosNegativadosList';
