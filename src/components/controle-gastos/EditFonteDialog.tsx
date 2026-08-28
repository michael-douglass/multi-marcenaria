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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MktFonte, useMarketingGastos } from '@/hooks/useMarketingGastos';
import { Wallet, Globe, Facebook, Youtube, Instagram, Linkedin, Twitter, Megaphone, TrendingUp, Target, Zap, BarChart, Pencil } from 'lucide-react';

const ICON_OPTIONS = [
  { value: 'wallet', label: 'Carteira', icon: Wallet },
  { value: 'globe', label: 'Web', icon: Globe },
  { value: 'facebook', label: 'Facebook', icon: Facebook },
  { value: 'youtube', label: 'YouTube', icon: Youtube },
  { value: 'instagram', label: 'Instagram', icon: Instagram },
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { value: 'twitter', label: 'Twitter', icon: Twitter },
  { value: 'megaphone', label: 'Marketing', icon: Megaphone },
  { value: 'trendingUp', label: 'Tendência', icon: TrendingUp },
  { value: 'target', label: 'Alvo', icon: Target },
  { value: 'zap', label: 'Automação', icon: Zap },
  { value: 'barChart', label: 'Analytics', icon: BarChart },
];

const COLOR_OPTIONS = [
  { value: '#3b82f6', label: 'Azul' },
  { value: '#22c55e', label: 'Verde' },
  { value: '#f59e0b', label: 'Amarelo' },
  { value: '#ef4444', label: 'Vermelho' },
  { value: '#8b5cf6', label: 'Roxo' },
  { value: '#ec4899', label: 'Rosa' },
  { value: '#06b6d4', label: 'Ciano' },
  { value: '#f97316', label: 'Laranja' },
];

const formSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  icone: z.string(),
  cor: z.string(),
});

type FormData = z.infer<typeof formSchema>;

interface EditFonteDialogProps {
  fonte: MktFonte;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditFonteDialog({ fonte, open, onOpenChange }: EditFonteDialogProps) {
  const { updateFonte } = useMarketingGastos();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: fonte.nome,
      icone: fonte.icone,
      cor: fonte.cor,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        nome: fonte.nome,
        icone: fonte.icone,
        cor: fonte.cor,
      });
    }
  }, [open, fonte, form]);

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    const result = await updateFonte(fonte.id, data);
    setIsLoading(false);
    
    if (result) {
      onOpenChange(false);
    }
  };

  const selectedIcon = ICON_OPTIONS.find(opt => opt.value === form.watch('icone'));
  const SelectedIconComponent = selectedIcon?.icon || Wallet;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-muted-foreground" />
            Editar Fonte
          </DialogTitle>
          <DialogDescription>
            Atualize as informações da fonte de gastos
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Fonte</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Google Ads" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="icone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ícone</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ICON_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-2">
                              <option.icon className="h-4 w-4" />
                              {option.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cor</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COLOR_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-4 h-4 rounded-full" 
                                style={{ backgroundColor: option.value }}
                              />
                              {option.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
