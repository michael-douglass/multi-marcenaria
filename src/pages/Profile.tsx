import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { useEmpresaSupabase, useTableName } from '@/hooks/useEmpresaSupabase';
import { MASTER_TABLES } from '@/lib/empresa-tables';
import { Mail, Shield, LogOut, Camera, Loader2, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatRolesLabel, roleLabel } from '@/lib/app-roles';
import type { AppUserRole } from '@/lib/resolve-auth-role';

export default function Profile() {
  const navigate = useNavigate();
  const { user, userRole, userRoles, signOut } = useAuth();
  const db = useEmpresaSupabase();
  const table = useTableName();
  const { data: currentUserData, isLoading: isLoadingProfile, refetch } = useCurrentUserProfile();
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogout = async () => {
    if (isLoggingOut) return; // Prevenir múltiplos cliques
    
    setIsLoggingOut(true);
    try {
      await signOut();
      navigate('/');
    } catch (error: any) {
      console.error('Erro no logout:', error);
    } finally {
      // Garantir que sempre limpa o estado, mesmo com erro
      setIsLoggingOut(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      toast.error('Arquivo muito grande. Máximo: 2MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida');
      return;
    }

    setIsUploadingAvatar(true);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        
        const usuariosTable = table('usuarios', MASTER_TABLES.usuarios);
        const { error } = await db
          .from(usuariosTable)
          .update({ avatar_url: base64String })
          .eq('id', user.id);

        if (error) throw error;
        await refetch();
        toast.success('Foto atualizada!');
        setIsUploadingAvatar(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error('Erro ao fazer upload da foto');
      setIsUploadingAvatar(false);
    }
  };

  const getRoleBadgeColor = (role?: string) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'bg-primary text-primary-foreground';
      case 'projetista_admin':
        return 'bg-violet-600 text-white';
      case 'vendedor':
        return 'bg-success text-success-foreground';
      case 'projetista':
        return 'bg-violet-100 text-violet-800';
      case 'marketing':
        return 'bg-emerald-100 text-emerald-800';
      case 'nenhum':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const displayRoles = (userRoles.length ? userRoles : userRole ? [userRole] : []) as AppUserRole[];

  if (isLoadingProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  if (!currentUserData) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-3">
            <p className="text-muted-foreground">
              Não foi possível carregar seus dados. Verifique se sua conta está ativa na empresa correta.
            </p>
            <Button variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Informações Pessoais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <UserAvatar user={adaptUserForAvatar(currentUserData)} size="lg" />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <Button
                  size="icon"
                  variant="outline"
                  className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                >
                  {isUploadingAvatar ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Nome</p>
                <p className="font-semibold text-foreground">{currentUserData.nome}</p>
                <Button 
                  variant="link" 
                  className="h-auto p-0 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                >
                  Alterar foto
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                <Mail className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-semibold text-foreground">{currentUserData.email || 'Não informado'}</p>
              </div>
            </div>

            {currentUserData.telefone && (
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                  <Phone className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Telefone</p>
                  <p className="font-semibold text-foreground">{currentUserData.telefone}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Papel no Sistema</p>
                <div className="flex flex-wrap gap-1.5">
                  {displayRoles.length > 0 ? (
                    displayRoles.map((role) => (
                      <Badge key={role} className={getRoleBadgeColor(role)}>
                        {roleLabel(role).toUpperCase()}
                      </Badge>
                    ))
                  ) : (
                    <Badge className={getRoleBadgeColor('nenhum')}>NENHUM</Badge>
                  )}
                </div>
                {displayRoles.length > 1 && (
                  <p className="mt-1 text-xs text-muted-foreground">{formatRolesLabel(displayRoles)}</p>
                )}
              </div>
            </div>

            <Button 
              variant="outline" 
              onClick={handleLogout} 
              disabled={isLoggingOut}
              className="w-full mt-4"
            >
              {isLoggingOut ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saindo...
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
