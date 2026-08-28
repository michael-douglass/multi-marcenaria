import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { MktSubFonte, useMarketingGastos } from '@/hooks/useMarketingGastos';
import { Pencil } from 'lucide-react';

const formSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  descricao: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface EditSubFonteDialogProps {
  subFonte: MktSubFonte;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditSubFonteDialog({ subFonte, open, onOpenChange }: EditSubFonteDialogProps) {
  const { updateSubFonte } = useMarketingGastos();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: subFonte.nome,
      descricao: subFonte.descricao || '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        nome: subFonte.nome,
        descricao: subFonte.descricao || '',
      });
    }
  }, [open, subFonte, form]);

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    const result = await updateSubFonte(subFonte.id, {
      nome: data.nome,
      descricao: data.descricao || null,
    });
    setIsLoading(false);
    
    if (result) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-muted-foreground" />
            Editar Sub-fonte
          </DialogTitle>
          <DialogDescription>
            Atualize as informações da sub-fonte
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Rede de Pesquisa" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição (opcional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Descrição adicional sobre esta sub-fonte..." 
                      className="resize-none"
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
