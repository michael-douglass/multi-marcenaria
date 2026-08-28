import { useState, useRef } from 'react';
import { Ban } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
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
import { toast } from 'sonner';
import { NumerosNegativadosList } from '@/components/automacoes/NumerosNegativadosList';
import { NegativacaoWebhookConfig } from '@/components/automacoes/NegativacaoWebhookConfig';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';

export default function Automacoes() {
  const [numero, setNumero] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const numerosListRef = useRef<{ refreshNumeros: () => void }>(null);

  const validateNumero = (value: string): boolean => {
    // Aceita qualquer sequência numérica com pelo menos 8 dígitos
    const regex = /^\d{8,}$/;
    return regex.test(value.trim());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateNumero(numero)) {
      toast.error('Formato inválido! Insira apenas números (mínimo 8 dígitos)');
      return;
    }

    setIsModalOpen(true);
  };

  const handleConfirm = async () => {
    setIsLoading(true);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('Usuário não autenticado');
      }

      const { data, error } = await supabase.functions.invoke('adicionar-numero-negativado', {
        body: { numeroTelefone: numero.trim() },
      });

      if (error) throw error;

      if (data?.success) {
        if (data?.alreadyExists) {
          toast.warning('Este número já está negativado!');
        } else {
          toast.success('Número negativado com sucesso!');
        }
        setNumero('');
        
        // Atualizar lista de números após negativar
        if (numerosListRef.current) {
          numerosListRef.current.refreshNumeros();
        }
      } else {
        throw new Error(data?.error || 'Erro ao negativar número');
      }
    } catch (error: any) {
      console.error('Erro ao negativar número:', error);
      toast.error(error?.message || 'Erro ao negativar número. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Automações</h1>
        <p className="text-muted-foreground mt-2">
          Configure e gerencie automações do sistema
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-2 border-destructive/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-destructive" />
              Negativação de Números
            </CardTitle>
            <CardDescription>
              Adicione números de telefone para bloquear no sistema de IA
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="numero">Número de Telefone</Label>
                <Input
                  id="numero"
                  type="text"
                  placeholder="Ex: 5531999999999"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  disabled={isLoading}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Insira o número no formato desejado (mínimo 8 dígitos)
                </p>
              </div>
              <Button 
                type="submit" 
                disabled={isLoading || !numero.trim()}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Ban className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Ban className="mr-2 h-4 w-4" />
                    Negativar Número
                  </>
                )}
              </Button>
            </form>

            <Separator />

            <NegativacaoWebhookConfig />

            <Separator />

            <div className="h-[350px] overflow-hidden">
              <NumerosNegativadosList ref={numerosListRef} />
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Negativação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja negativar o número <strong>{numero}</strong>?
              Esta ação irá adicionar o número à lista de bloqueio da IA.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sim, Negativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
