import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function OutOfAccessHours() {
  const { signOut, accessHours } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await signOut();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const range =
    accessHours?.inicio && accessHours?.fim
      ? `${accessHours.inicio} às ${accessHours.fim}`
      : '—';

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center space-y-6">
          <div className="flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
              <Clock className="h-10 w-10 text-destructive" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">Fora do horário de acesso</h2>
            <p className="text-muted-foreground">
              Seu acesso está permitido apenas no horário configurado: <strong>{range}</strong>.
            </p>
            <p className="text-sm text-muted-foreground pt-4">
              Entre em contato com o administrador para alterar o horário ou tente novamente dentro do período.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleLogout}
            disabled={isLoading}
            className="w-full"
          >
            <LogOut className="mr-2 h-4 w-4" />
            {isLoading ? 'Saindo...' : 'Voltar para tela de login'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
