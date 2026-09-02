import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLeadOrigins } from '@/hooks/useLeadOrigins';
import { usePrestadorTitulos } from '@/hooks/usePrestadorTitulos';
import { PrestadorTituloField } from '@/components/admin/PrestadorTituloField';
import { Switch } from '@/components/ui/switch';
import {
  Shield, Users as UsersIcon, UserPlus, Plus, Trash2,
  Tag, Pencil, KeyRound, Clock, Unlock, Palette, Briefcase,
  UserCheck, Star, Trophy, Loader2, Link, ExternalLink, Copy,
} from 'lucide-react';
import { EmpresaBrandingForm } from '@/components/admin/EmpresaBrandingForm';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PermissionsTable } from '@/components/admin/PermissionsTable';
import { RoleMultiSelect } from '@/components/admin/RoleMultiSelect';
import { GerenciamentoUsoContent } from '@/components/admin/GerenciamentoUsoContent';
import { normalizeRoles, rolesEqual, roleLabel } from '@/lib/app-roles';
import type { AppUserRole } from '@/lib/resolve-auth-role';
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
import { useUsers, DatabaseUser, TipoUsuario } from '@/hooks/useUsers';
import { useEnsurePontuaGarboPartnerLead } from '@/hooks/usePontuaGarboPartnerLeads';
import { PASSWORD_MIN_LENGTH, PASSWORD_RULES_HINT, validateCrmPassword } from '@/lib/password-rules';
import { buildAcessoUsuarioTexto } from '@/lib/acesso-usuario-texto';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { resolveAppUser } from '@/lib/resolve-app-user';
import { toast } from 'sonner';
import { z } from 'zod';
import { UserAvatar } from '@/components/ui/user-avatar';

/** Aceita DDD+número (10/11) ou com 55; devolve só dígitos normalizados. */
function normalizeBrasilPhoneDigits(raw: string | null | undefined): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

// ─── Schema de validação ──────────────────────────────────────────────────────
const createUserSchema = z.object({
  name: z.string()
    .trim()
    .min(3, { message: 'Nome deve ter no mínimo 3 caracteres' })
    .max(100, { message: 'Nome deve ter no máximo 100 caracteres' }),
  email: z.string()
    .trim()
    .email({ message: 'Email inválido' })
    .max(255, { message: 'Email deve ter no máximo 255 caracteres' }),
  phone: z
    .string()
    .optional()
    .transform((v) => normalizeBrasilPhoneDigits(v))
    .pipe(
      z.union([
        z.literal(''),
        z
          .string()
          .regex(
            /^55[1-9]\d{9,10}$/,
            'Telefone inválido. Use DDD + número (ex: 31999999999)',
          ),
      ]),
    ),
  role: z.enum(['ADMIN', 'VENDEDOR', 'MARKETING', 'NENHUM']).optional(),
  roles: z.array(z.enum(['admin', 'vendedor', 'marketing', 'projetista', 'projetista_admin', 'nenhum'])).optional(),
});

type TipoFiltro = 'todos' | TipoUsuario;

// ─── Helpers de exibição ──────────────────────────────────────────────────────
function getTipoLabel(tipo: TipoUsuario): string {
  switch (tipo) {
    case 'colaborador': return 'Colaborador';
    case 'lead': return 'Lead';
    case 'prestador_servico': return 'Prestador de Serviço';
  }
}

function getRoleBadgeClass(role: AppUserRole): string {
  switch (role) {
    case 'admin':
      return 'bg-destructive/10 text-destructive border-destructive/20';
    case 'projetista_admin':
      return 'bg-violet-100 text-violet-700 border-violet-300';
    case 'vendedor':
      return 'bg-primary/10 text-primary border-primary/20';
    case 'projetista':
      return 'bg-violet-50 text-violet-600 border-violet-200';
    case 'marketing':
      return 'bg-emerald-100 text-emerald-700 border-emerald-300';
    default:
      return 'bg-muted text-muted-foreground border-muted';
  }
}

function getRoleBadges(user: DatabaseUser): Array<{ label: string; className: string }> {
  const tipo = user.tipo_usuario ?? 'colaborador';

  if (tipo === 'lead') {
    return [{ label: 'LEAD', className: 'bg-blue-100 text-blue-700 border-blue-200' }];
  }

  if (tipo === 'prestador_servico') {
    return [{
      label: user.titulo || 'PRESTADOR',
      className: 'bg-violet-100 text-violet-700 border-violet-200',
    }];
  }

  const roles = normalizeRoles(user.roles?.length ? user.roles : [user.role]);
  return roles.map((role) => ({
    label: roleLabel(role).toUpperCase(),
    className: getRoleBadgeClass(role),
  }));
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Admin() {
  const { user: authUser, userRole } = useAuth();
  const { empresa, isSuperAdmin, schemaEmpresa } = useEmpresa();
  const { data: profileUser } = useCurrentUserProfile();
  const {
    users: dbUsers,
    isLoading: loadingUsers,
    updateUserRoles,
    updateUser,
    deleteUser,
    createUser,
    resetUserPassword,
    empresaAtiva,
    hasEmpresaSelecionada,
  } = useUsers();
  const ensurePontuaGarboLead = useEnsurePontuaGarboPartnerLead();
  const { origins, createOrigin, deleteOrigin } = useLeadOrigins();
  const { titulos: prestadorTitulos, deleteTitulo } = usePrestadorTitulos();
  const navigate = useNavigate();

  const currentUser = useMemo(
    () => (authUser ? resolveAppUser(authUser, profileUser, userRole) : null),
    [authUser, profileUser, userRole],
  );

  const canAccessAdmin = userRole === 'admin' || isSuperAdmin;

  // ── Filtro por tipo ──────────────────────────────────────────────────────────
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('todos');

  const filteredUsers = useMemo(() => {
    if (!dbUsers) return [];
    if (tipoFiltro === 'todos') return dbUsers;
    return dbUsers.filter(u => (u.tipo_usuario ?? 'colaborador') === tipoFiltro);
  }, [dbUsers, tipoFiltro]);

  const contagens = useMemo(() => {
    if (!dbUsers) return { todos: 0, colaborador: 0, lead: 0, prestador_servico: 0 };
    return {
      todos: dbUsers.length,
      colaborador: dbUsers.filter(u => (u.tipo_usuario ?? 'colaborador') === 'colaborador').length,
      lead: dbUsers.filter(u => u.tipo_usuario === 'lead').length,
      prestador_servico: dbUsers.filter(u => u.tipo_usuario === 'prestador_servico').length,
    };
  }, [dbUsers]);

  // ── Estado: diálogos ─────────────────────────────────────────────────────────
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<DatabaseUser | null>(null);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferToUserId, setTransferToUserId] = useState<string>('');
  const [newOriginDialogOpen, setNewOriginDialogOpen] = useState(false);
  const [newOriginName, setNewOriginName] = useState('');

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    roles: ['nenhum'] as AppUserRole[],
    horario_acesso_inicio: '' as string,
    horario_acesso_fim: '' as string,
    tipo_usuario: 'colaborador' as TipoUsuario,
    titulo: '',
    comissao_ativa: false,
  });

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createFormError, setCreateFormError] = useState<string | null>(null);
  const [createFormData, setCreateFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    roles: ['vendedor'] as AppUserRole[],
    tipo_usuario: 'colaborador' as TipoUsuario,
    titulo: '',
    comissao_ativa: false,
  });

  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [resetPasswordUserName, setResetPasswordUserName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [copyAccessLoadingId, setCopyAccessLoadingId] = useState<string | null>(null);
  const [fixAccessLoading, setFixAccessLoading] = useState<string | null>(null);
  const queryClient = useQueryClient();

  if (!canAccessAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardContent className="pt-6 text-center space-y-4">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-semibold">Acesso Restrito</h2>
            <p className="text-muted-foreground">
              Você não tem permissão para acessar esta área.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleOpenEditDialog = (user: DatabaseUser) => {
    setEditUserId(user.id);
    setEditFormData({
      nome: user.nome,
      email: user.email || '',
      telefone: user.telefone || '',
      roles: normalizeRoles(user.roles?.length ? user.roles : [user.role]),
      horario_acesso_inicio: user.horario_acesso_inicio ? String(user.horario_acesso_inicio).slice(0, 5) : '',
      horario_acesso_fim: user.horario_acesso_fim ? String(user.horario_acesso_fim).slice(0, 5) : '',
      tipo_usuario: user.tipo_usuario ?? 'colaborador',
      titulo: user.titulo ?? '',
      comissao_ativa: user.comissao_ativa ?? false,
    });
    setEditDialogOpen(true);
  };

  const formatHorarioAcesso = (user: DatabaseUser) => {
    const ini = user.horario_acesso_inicio ? String(user.horario_acesso_inicio).slice(0, 5) : null;
    const fim = user.horario_acesso_fim ? String(user.horario_acesso_fim).slice(0, 5) : null;
    if (ini && fim) return `${ini} - ${fim}`;
    if (ini || fim) return ini || fim || '—';
    return 'Sem restrição';
  };

  const handleUpdateUser = () => {
    if (!editUserId) return;

    try {
      const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
      if (editFormData.horario_acesso_inicio && !timeRegex.test(editFormData.horario_acesso_inicio)) {
        toast.error('Horário de acesso (início) deve estar no formato 24h, ex.: 08:00');
        return;
      }
      if (editFormData.horario_acesso_fim && !timeRegex.test(editFormData.horario_acesso_fim)) {
        toast.error('Horário de acesso (fim) deve estar no formato 24h, ex.: 18:00');
        return;
      }

      createUserSchema.parse({
        name: editFormData.nome,
        email: editFormData.email,
        phone: normalizeBrasilPhoneDigits(editFormData.telefone),
        roles: editFormData.roles,
      });

      updateUser.mutate({
        userId: editUserId,
        updates: {
          nome: editFormData.nome,
          email: editFormData.email,
          telefone: normalizeBrasilPhoneDigits(editFormData.telefone) || editFormData.telefone,
          horario_acesso_inicio: editFormData.horario_acesso_inicio || null,
          horario_acesso_fim: editFormData.horario_acesso_fim || null,
          tipo_usuario: editFormData.tipo_usuario,
          titulo: editFormData.tipo_usuario === 'prestador_servico'
            ? (editFormData.titulo || null)
            : null,
          comissao_ativa: editFormData.tipo_usuario === 'prestador_servico'
            ? editFormData.comissao_ativa
            : false,
        },
      });

      if (
        editFormData.tipo_usuario === 'prestador_servico' &&
        editFormData.comissao_ativa
      ) {
        void ensurePontuaGarboLead.mutateAsync({
          usuarioId: editUserId,
          nome: editFormData.nome,
          email: editFormData.email,
          telefone: editFormData.telefone,
        });
      }

      const currentEditUser = dbUsers?.find(u => u.id === editUserId);
      const currentRoles = normalizeRoles(
        currentEditUser?.roles?.length
          ? currentEditUser.roles
          : currentEditUser
            ? [currentEditUser.role]
            : ['nenhum'],
      );
      const nextRoles = normalizeRoles(editFormData.roles);
      if (!rolesEqual(currentRoles, nextRoles)) {
        updateUserRoles.mutate({
          userId: editUserId,
          roles: nextRoles,
        });
      }

      setEditDialogOpen(false);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error('Erro de validação', {
          description: error.issues[0]?.message ?? 'Dados inválidos',
        });
      }
    }
  };

  const formatPhone = (value: string) => value.replace(/\D/g, '');

  const displayPhone = (phone: string) => {
    if (!phone) return '';
    const numbers = phone.replace(/\D/g, '');
    if (numbers.length >= 11) {
      const ddi = numbers.slice(0, 2);
      const ddd = numbers.slice(2, 4);
      const parte1 = numbers.slice(4, 9);
      const parte2 = numbers.slice(9);
      return `+${ddi} (${ddd}) ${parte1}-${parte2}`;
    }
    return phone;
  };

  const handleCreateUser = async () => {
    try {
      setCreateFormError(null);

      if (!hasEmpresaSelecionada) {
        const msg =
          'Vá em Gerenciamento de Empresas → Entrar na empresa antes de cadastrar usuários.';
        setCreateFormError(msg);
        toast.error('Selecione uma empresa', { description: msg });
        return;
      }

      const phoneDigits = normalizeBrasilPhoneDigits(createFormData.telefone);
      const createRoles =
        createFormData.tipo_usuario === 'colaborador'
          ? normalizeRoles(createFormData.roles)
          : createFormData.tipo_usuario === 'prestador_servico'
            ? (['vendedor'] as AppUserRole[])
            : (['nenhum'] as AppUserRole[]);

      if (
        createFormData.tipo_usuario === 'colaborador' &&
        (createRoles.length === 0 || (createRoles.length === 1 && createRoles[0] === 'nenhum'))
      ) {
        const msg = 'Selecione ao menos uma função (ex.: Vendedor, Projetista ou Marketing).';
        setCreateFormError(msg);
        toast.error('Selecione ao menos uma função', { description: msg });
        return;
      }

      createUserSchema.parse({
        name: createFormData.nome,
        email: createFormData.email,
        phone: phoneDigits,
        roles: createRoles,
      });

      if (
        createFormData.tipo_usuario === 'prestador_servico' &&
        !createFormData.titulo.trim()
      ) {
        const msg = 'Selecione ou cadastre o título do prestador (ex: Arquiteto).';
        setCreateFormError(msg);
        toast.error('Título obrigatório', { description: msg });
        return;
      }

      await createUser.mutateAsync({
        nome: createFormData.nome.trim(),
        email: createFormData.email.trim(),
        telefone: phoneDigits || undefined,
        roles: createRoles,
        tipo_usuario: createFormData.tipo_usuario,
        titulo:
          createFormData.tipo_usuario === 'prestador_servico'
            ? createFormData.titulo.trim()
            : undefined,
        comissao_ativa:
          createFormData.tipo_usuario === 'prestador_servico'
            ? createFormData.comissao_ativa
            : false,
      });

      setCreateDialogOpen(false);
      setCreateFormError(null);
      setCreateFormData({
        nome: '',
        email: '',
        telefone: '',
        roles: ['vendedor'],
        tipo_usuario: 'colaborador',
        titulo: '',
        comissao_ativa: false,
      });
    } catch (error) {
      const msg =
        error instanceof z.ZodError
          ? String(error.issues[0]?.message ?? 'Dados inválidos')
          : error instanceof Error && typeof error.message === 'string' && error.message.trim() && !error.message.startsWith('[')
            ? error.message
            : 'Não foi possível cadastrar o usuário. Tente novamente.';
      setCreateFormError(msg);
      if (error instanceof z.ZodError) {
        toast.error('Erro de validação', { description: msg });
      }
    }
  };

  const handleDeleteOrigin = async (originId: string) => {
    try {
      await deleteOrigin(originId);
    } catch {
      // Error já tratado no hook
    }
  };

  const handleAddOrigin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newOriginName.trim()) {
      toast.error('Nome da origem não pode estar vazio');
      return;
    }
    if (newOriginName.trim().length < 3) {
      toast.error('Nome deve ter no mínimo 3 caracteres');
      return;
    }

    try {
      await createOrigin(newOriginName.trim());
      setNewOriginName('');
      setNewOriginDialogOpen(false);
    } catch {
      // Error já tratado no hook
    }
  };

  const handleDeleteUser = () => {
    if (!userToDelete) return;
    deleteUser.mutate(
      { userId: userToDelete.id, transferToUserId: transferToUserId || undefined },
      {
        onError: (error: any) => {
          if (error.message === 'LEADS_ASSOCIATED') {
            setDeleteDialogOpen(false);
            setTransferToUserId('');
            setTransferDialogOpen(true);
            return;
          }
        },
      }
    );
    setDeleteDialogOpen(false);
  };

  const handleTransferAndDelete = () => {
    if (!userToDelete || !transferToUserId) return;
    deleteUser.mutate({ userId: userToDelete.id, transferToUserId });
    setTransferDialogOpen(false);
    setTransferToUserId('');
    setUserToDelete(null);
  };

  const handleOpenDeleteDialog = (user: DatabaseUser) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleOpenResetPasswordDialog = (user: DatabaseUser) => {
    setResetPasswordUserId(user.id);
    setResetPasswordUserName(user.nome);
    setNewPassword('');
    setConfirmPassword('');
    setResetPasswordDialogOpen(true);
  };

  /** Um clique: senha = telefone do usuário; copia site + login + senha (sem popup). */
  const handleCopiarAcesso = async (user: DatabaseUser) => {
    if (!canAccessAdmin) {
      toast.error('Apenas administradores podem copiar o acesso do usuário');
      return;
    }
    if (!user.email?.trim()) {
      toast.error('Usuário sem e-mail — não é possível montar o login');
      return;
    }

    const senha = (user.telefone || '').replace(/\D/g, '');
    if (senha.length < PASSWORD_MIN_LENGTH) {
      toast.error('Usuário sem telefone válido', {
        description: `Cadastre o telefone do usuário (mín. ${PASSWORD_MIN_LENGTH} dígitos). A senha será o telefone.`,
      });
      return;
    }

    setCopyAccessLoadingId(user.id);

    try {
      await resetUserPassword.mutateAsync({
        userId: user.id,
        newPassword: senha,
        silent: true,
      });
    } catch {
      setCopyAccessLoadingId(null);
      return;
    }

    const texto = buildAcessoUsuarioTexto({
      site: window.location.origin,
      login: user.email.trim(),
      senha,
      nome: user.nome,
    });

    try {
      await navigator.clipboard.writeText(texto);
      toast.success('Credenciais copiadas!', {
        description: 'Senha = telefone. Site, login e senha prontos para colar.',
      });
    } catch {
      toast.error('Senha definida, mas não foi possível copiar automaticamente.', {
        description: `Senha (telefone): ${senha}`,
      });
    } finally {
      setCopyAccessLoadingId(null);
    }
  };

  const handleResetPassword = () => {
    if (!resetPasswordUserId) return;

    const passwordError = validateCrmPassword(newPassword);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    resetUserPassword.mutate(
      { userId: resetPasswordUserId, newPassword },
      {
        onSuccess: () => {
          setResetPasswordDialogOpen(false);
          setNewPassword('');
          setConfirmPassword('');
        },
      }
    );
  };

  const handleFixAccess = async (user: DatabaseUser) => {
    if (!user.email) {
      toast.error('Usuário sem email; não é possível corrigir acesso.');
      return;
    }
    setFixAccessLoading(user.id);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('fix-user-access', {
        body: { email: user.email },
      });
      if (invokeError) {
        toast.error(invokeError.message || 'Erro ao chamar correção de acesso.');
        return;
      }
      if (data?.success) {
        toast.success(data.message ?? 'Acesso corrigido.');
        queryClient.invalidateQueries({ queryKey: ['users'] });
      } else {
        toast.error(data?.error ?? 'Erro ao corrigir acesso.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao corrigir acesso.';
      toast.error(msg);
    } finally {
      setFixAccessLoading(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="p-8 space-y-6">
      <Tabs defaultValue="usuarios">
        <TabsList>
          <TabsTrigger value="usuarios">
            <UsersIcon className="h-4 w-4 mr-2" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="gerenciamento-uso">
            <Clock className="h-4 w-4 mr-2" />
            Gerenciamento de Uso
          </TabsTrigger>
          {(userRole === 'admin' || isSuperAdmin) && (
            <TabsTrigger value="marca-empresa">
              <Palette className="h-4 w-4 mr-2" />
              Logo e Nome
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── Aba Usuários ──────────────────────────────────────────────────── */}
        <TabsContent value="usuarios" className="mt-6 space-y-6">
          {isSuperAdmin && !hasEmpresaSelecionada && (
            <Alert>
              <AlertDescription>
                Para cadastrar usuários, a casa já está definida (Garbo). Use a aba{' '}
                <button
                  type="button"
                  className="text-primary underline font-medium"
                  onClick={() => navigate('/admin/marca')}
                >
                  Logo e Nome
                </button>
                {' '}se precisar ajustar a marca.
              </AlertDescription>
            </Alert>
          )}
          {empresaAtiva && (
            <p className="text-sm text-muted-foreground">
              Empresa ativa: <strong>{empresaAtiva.nome}</strong> ({empresaAtiva.schema_nome})
            </p>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle>Usuários do Sistema</CardTitle>
              <Button
                onClick={() => {
                  setCreateFormError(null);
                  setCreateDialogOpen(true);
                }}
                disabled={!hasEmpresaSelecionada}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Cadastrar Usuário
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* ── Filtros por tipo ──────────────────────────────────────── */}
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { key: 'todos', label: 'Todos', icon: UsersIcon },
                    { key: 'colaborador', label: 'Colaboradores', icon: UserCheck },
                    { key: 'lead', label: 'Leads', icon: Star },
                    { key: 'prestador_servico', label: 'Prestadores', icon: Briefcase },
                  ] as const
                ).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTipoFiltro(key)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium border transition-colors
                      ${tipoFiltro === key
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                      }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                    <span className={`ml-0.5 rounded-full px-1.5 text-xs
                      ${tipoFiltro === key ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {contagens[key]}
                    </span>
                  </button>
                ))}
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Tipo / Papel</TableHead>
                      <TableHead>Horários de acesso</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingUsers ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          Carregando usuários...
                        </TableCell>
                      </TableRow>
                    ) : filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          {tipoFiltro === 'todos'
                            ? 'Nenhum usuário encontrado'
                            : `Nenhum ${getTipoLabel(tipoFiltro as TipoUsuario).toLowerCase()} encontrado`}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user) => {
                        const badges = getRoleBadges(user);
                        return (
                          <TableRow key={user.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <UserAvatar user={{ name: user.nome, avatarUrl: user.avatar_url || undefined }} size="sm" />
                                <div>
                                  <p className="font-medium">{user.nome}</p>
                                  {user.tipo_usuario && user.tipo_usuario !== 'colaborador' && (
                                    <p className="text-xs text-muted-foreground">{getTipoLabel(user.tipo_usuario)}</p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>{displayPhone(user.telefone || '')}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {badges.map((badge) => (
                                  <Badge key={`${user.id}-${badge.label}`} variant="outline" className={badge.className}>
                                    {badge.label}
                                  </Badge>
                                ))}
                                {user.tipo_usuario === 'prestador_servico' && user.comissao_ativa && (
                                  <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] gap-0.5 px-1.5 py-0.5">
                                    <Trophy className="h-2.5 w-2.5" /> Pontua Garbo
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {formatHorarioAcesso(user)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 justify-end">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleFixAccess(user)}
                                  disabled={fixAccessLoading === user.id}
                                  title="Corrigir acesso"
                                >
                                  <Unlock className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => void handleCopiarAcesso(user)}
                                  disabled={!user.email || !canAccessAdmin || copyAccessLoadingId === user.id}
                                  title="Copiar site, login e senha (telefone)"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleOpenResetPasswordDialog(user)}
                                  title="Redefinir senha"
                                >
                                  <KeyRound className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleOpenEditDialog(user)}
                                  disabled={currentUser?.email === user.email}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleOpenDeleteDialog(user)}
                                  disabled={currentUser?.email === user.email}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* ── Links de Cadastro Público ─────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <Link className="h-5 w-5" />
                Links de Cadastro
              </CardTitle>
              <p className="text-sm text-muted-foreground font-normal">
                Compartilhe estes links para que novos usuários se cadastrem diretamente na categoria correta.
                {!hasEmpresaSelecionada && (
                  <span className="block mt-1 text-amber-600 font-medium">
                    ⚠ Selecione uma empresa para gerar links válidos.
                  </span>
                )}
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  {
                    tipo: 'prestador',
                    label: 'Prestador de Serviço',
                    desc: 'Profissionais externos',
                    color: 'bg-violet-50 border-violet-200 text-violet-700',
                    badgeClass: 'bg-violet-100 text-violet-700 border-violet-200',
                  },
                  {
                    tipo: 'lead',
                    label: 'Cliente / Lead',
                    desc: 'Clientes e prospects',
                    color: 'bg-blue-50 border-blue-200 text-blue-700',
                    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
                  },
                  {
                    tipo: 'colaborador',
                    label: 'Colaborador & Vendedor',
                    desc: 'Equipe de vendas',
                    color: 'bg-emerald-50 border-emerald-200 text-emerald-700',
                    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-300',
                  },
                  {
                    tipo: 'marketing',
                    label: 'Marketing',
                    desc: 'Equipe de marketing',
                    color: 'bg-amber-50 border-amber-200 text-amber-700',
                    badgeClass: 'bg-amber-100 text-amber-700 border-amber-200',
                  },
                ].map(({ tipo, label, desc, color, badgeClass }) => {
                  const params = hasEmpresaSelecionada && empresaAtiva
                    ? `?e=${empresaAtiva.id}&s=${encodeURIComponent(schemaEmpresa ?? '')}`
                    : '';
                  const url = `${window.location.origin}/cadastro/${tipo}${params}`;
                  return (
                    <div
                      key={tipo}
                      className={`flex items-start justify-between gap-2 rounded-lg border p-3 ${color}`}
                    >
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-sm font-semibold truncate">{label}</span>
                        <span className="text-xs opacity-70">{desc}</span>
                        <code className="text-[10px] opacity-60 truncate mt-0.5 font-mono">
                          /cadastro/{tipo}
                        </code>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          type="button"
                          title="Copiar link"
                          onClick={() => {
                            navigator.clipboard.writeText(url);
                            toast.success(`Link copiado: ${url}`);
                          }}
                          className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium border ${badgeClass} hover:opacity-80 transition-opacity cursor-pointer`}
                        >
                          <Link className="h-2.5 w-2.5" />
                          Copiar
                        </button>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium border ${badgeClass} hover:opacity-80 transition-opacity`}
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                          Abrir
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Informações sobre tipos */}
            <Card>
              <CardHeader>
                <CardTitle>Informações sobre Tipos de Usuário</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Colaboradores</p>
                    <div className="pl-2 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs">ADMIN</Badge>
                        <span className="text-xs text-muted-foreground">Acesso total, incluindo gestão de usuários</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">VENDEDOR</Badge>
                        <span className="text-xs text-muted-foreground">Pipeline e leads próprios</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300 text-xs">MARKETING</Badge>
                        <span className="text-xs text-muted-foreground">Conteúdo e campanhas de marketing</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 text-xs mt-0.5 shrink-0">LEAD</Badge>
                    <span className="text-xs text-muted-foreground">Prospect ou cliente cadastrado. Acesso ao sistema desativado por padrão.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="bg-violet-100 text-violet-700 border-violet-200 text-xs mt-0.5 shrink-0">PRESTADOR</Badge>
                    <span className="text-xs text-muted-foreground">Prestador de serviço com título personalizado. Acesso básico ao sistema.</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Origens de leads */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  Origens de Leads
                </CardTitle>
                <Button onClick={() => setNewOriginDialogOpen(true)} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Origem
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {origins.map(origin => (
                    <div key={origin.id} className="flex items-center justify-between border rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <Badge variant={origin.is_default ? 'default' : 'secondary'}>
                          {origin.nome}
                        </Badge>
                        {origin.is_default && (
                          <span className="text-xs text-muted-foreground">Padrão</span>
                        )}
                      </div>
                      {!origin.is_default && (
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteOrigin(origin.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Títulos de Prestador
                </CardTitle>
                <p className="text-sm text-muted-foreground font-normal">
                  Lista usada ao cadastrar prestadores de serviço. Cadastre novos títulos no formulário de usuário (botão +) ou remova abaixo.
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {prestadorTitulos.map((titulo) => (
                    <div
                      key={titulo.id}
                      className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 bg-muted/30"
                    >
                      <Badge variant="secondary">{titulo.nome}</Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={`Remover título ${titulo.nome}`}
                        onClick={() => void deleteTitulo(titulo.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  {prestadorTitulos.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Nenhum título cadastrado. Use o botão + no cadastro de prestador.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Permissões */}
          <Card>
            <CardHeader>
              <CardTitle>Gestão de Permissões</CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure o que cada tipo de colaborador pode visualizar e editar
              </p>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="vendedor">
                <TabsList>
                  <TabsTrigger value="vendedor">Vendedor</TabsTrigger>
                  <TabsTrigger value="nenhum">Nenhum</TabsTrigger>
                </TabsList>
                <TabsContent value="vendedor" className="mt-6">
                  <PermissionsTable role="vendedor" />
                </TabsContent>
                <TabsContent value="nenhum" className="mt-6">
                  <PermissionsTable role="nenhum" />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gerenciamento-uso" className="mt-6">
          <GerenciamentoUsoContent />
        </TabsContent>

        <TabsContent value="marca-empresa" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Logo e nome no menu lateral</CardTitle>
            </CardHeader>
            <CardContent>
              <EmpresaBrandingForm empresa={empresa} />
              {isSuperAdmin && !empresa && (
                <p className="mt-4 text-sm text-muted-foreground">
                  Como super administrador, configure a marca desta casa abaixo. A Garbo não usa seletor de empresas.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ══════════════════════ DIALOGS ══════════════════════════════════════ */}

      {/* Confirmar exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{userToDelete?.nome}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transferir leads antes de excluir */}
      <Dialog open={transferDialogOpen} onOpenChange={(open) => {
        setTransferDialogOpen(open);
        if (!open) { setUserToDelete(null); setTransferToUserId(''); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir Leads</DialogTitle>
            <DialogDescription>
              <strong>{userToDelete?.nome}</strong> possui leads associados. Escolha para quem transferi-los antes de excluir.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Transferir leads para:</Label>
            <Select value={transferToUserId} onValueChange={setTransferToUserId}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Selecione um usuário..." />
              </SelectTrigger>
              <SelectContent>
                {dbUsers
                  ?.filter(u => u.id !== userToDelete?.id && (u.roles?.includes('admin') || u.roles?.includes('vendedor') || u.role === 'admin' || u.role === 'vendedor'))
                  .map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome} ({normalizeRoles(u.roles?.length ? u.roles : [u.role]).map(roleLabel).join(' + ')})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTransferDialogOpen(false); setUserToDelete(null); setTransferToUserId(''); }}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!transferToUserId || deleteUser.isPending}
              onClick={handleTransferAndDelete}
            >
              {deleteUser.isPending ? 'Transferindo...' : 'Transferir e Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nova origem de lead */}
      <Dialog open={newOriginDialogOpen} onOpenChange={setNewOriginDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Origem de Lead</DialogTitle>
            <DialogDescription>Adicione uma nova fonte de captação de leads</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddOrigin}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="origin-name">Nome da Origem *</Label>
                <Input
                  id="origin-name"
                  placeholder="Ex: LinkedIn, Evento, Parceria..."
                  value={newOriginName}
                  onChange={(e) => setNewOriginName(e.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setNewOriginDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">Adicionar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Cadastrar Usuário ────────────────────────────────────── */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[90dvh] flex flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
            <DialogTitle>Cadastrar Novo Usuário</DialogTitle>
            <DialogDescription>
              Somente administradores podem cadastrar usuários.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-2">
          <div className="space-y-5 pb-2">
            {/* Seletor de tipo */}
            <div className="space-y-2">
              <Label>Tipo de Usuário</Label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    {
                      value: 'colaborador' as TipoUsuario,
                      label: 'Colaborador',
                      desc: 'Admin, Vendedor ou Marketing',
                      icon: UserCheck,
                    },
                    {
                      value: 'lead' as TipoUsuario,
                      label: 'Lead',
                      desc: 'Prospect ou cliente',
                      icon: Star,
                    },
                    {
                      value: 'prestador_servico' as TipoUsuario,
                      label: 'Prestador',
                      desc: 'Serviço com título próprio',
                      icon: Briefcase,
                    },
                  ]
                ).map(({ value, label, desc, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCreateFormData(prev => ({ ...prev, tipo_usuario: value }))}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-all
                      ${createFormData.tipo_usuario === value
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border bg-background hover:border-primary/40 hover:bg-muted/40'
                      }`}
                  >
                    <Icon className={`h-5 w-5 ${createFormData.tipo_usuario === value ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`text-xs font-semibold ${createFormData.tipo_usuario === value ? 'text-primary' : 'text-foreground'}`}>
                      {label}
                    </span>
                    <span className="text-[10px] text-muted-foreground leading-tight">{desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Campos comuns */}
            <div className="space-y-2">
              <Label htmlFor="create-name">Nome Completo</Label>
              <Input
                id="create-name"
                value={createFormData.nome}
                onChange={(e) => {
                  setCreateFormError(null);
                  setCreateFormData({ ...createFormData, nome: e.target.value });
                }}
                placeholder="Nome completo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-email">Email</Label>
              <Input
                id="create-email"
                type="email"
                value={createFormData.email}
                onChange={(e) => {
                  setCreateFormError(null);
                  setCreateFormData({ ...createFormData, email: e.target.value });
                }}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-phone">Telefone (Opcional)</Label>
              <Input
                id="create-phone"
                type="tel"
                value={createFormData.telefone}
                onChange={(e) => {
                  setCreateFormError(null);
                  setCreateFormData({ ...createFormData, telefone: formatPhone(e.target.value) });
                }}
                placeholder="31999999999"
                maxLength={15}
              />
              <p className="text-xs text-muted-foreground">
                Pode digitar só DDD + número. O sistema completa o 55 automaticamente.
              </p>
            </div>

            {/* Campo: Funções — somente para colaboradores */}
            {createFormData.tipo_usuario === 'colaborador' && (
              <div className="space-y-2">
                <Label>Funções</Label>
                <RoleMultiSelect
                  idPrefix="create-role"
                  value={createFormData.roles}
                  onChange={(roles) => {
                    setCreateFormError(null);
                    setCreateFormData({ ...createFormData, roles });
                  }}
                />
              </div>
            )}

            {/* Campo: Título — somente para prestadores */}
            {createFormData.tipo_usuario === 'prestador_servico' && (
              <>
                <PrestadorTituloField
                  id="create-titulo"
                  value={createFormData.titulo}
                  onChange={(titulo) => {
                    setCreateFormError(null);
                    setCreateFormData({ ...createFormData, titulo });
                  }}
                />

                {/* Toggle Pontua Garbo */}
                <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">Comissão — Programa Pontua Garbo</p>
                      <p className="text-xs text-amber-600">Permite receber comissão sobre orçamentos de leads</p>
                    </div>
                  </div>
                  <Switch
                    checked={createFormData.comissao_ativa}
                    onCheckedChange={(v) => setCreateFormData({ ...createFormData, comissao_ativa: v })}
                  />
                </div>
              </>
            )}

            {/* Info de lead */}
            {createFormData.tipo_usuario === 'lead' && (
              <Alert>
                <Star className="h-4 w-4" />
                <AlertDescription>
                  O Lead será cadastrado sem acesso ao sistema. O administrador pode ativar o acesso a qualquer momento editando o usuário.
                </AlertDescription>
              </Alert>
            )}

            {createFormError && (
              <Alert variant="destructive">
                <AlertDescription>{createFormError}</AlertDescription>
              </Alert>
            )}
          </div>
          </div>

          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleCreateUser()}
              disabled={createUser.isPending}
            >
              {createUser.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4 mr-2" />
              )}
              {createUser.isPending ? 'Cadastrando...' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Editar Usuário ───────────────────────────────────────── */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90dvh] flex flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>Atualize as informações do usuário</DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-2">
          <div className="space-y-4 pb-2">
            {/* Exibe tipo (informativo) */}
            <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
              {editFormData.tipo_usuario === 'colaborador' && <UserCheck className="h-4 w-4 text-muted-foreground" />}
              {editFormData.tipo_usuario === 'lead' && <Star className="h-4 w-4 text-blue-500" />}
              {editFormData.tipo_usuario === 'prestador_servico' && <Briefcase className="h-4 w-4 text-violet-500" />}
              <span className="text-sm text-muted-foreground">
                Tipo: <strong className="text-foreground">{getTipoLabel(editFormData.tipo_usuario)}</strong>
              </span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome Completo</Label>
              <Input
                id="edit-name"
                value={editFormData.nome}
                onChange={(e) => setEditFormData({ ...editFormData, nome: e.target.value })}
                placeholder="Nome completo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Telefone</Label>
              <Input
                id="edit-phone"
                type="tel"
                value={editFormData.telefone}
                onChange={(e) => setEditFormData({ ...editFormData, telefone: formatPhone(e.target.value) })}
                placeholder="553199999999"
                maxLength={15}
              />
            </div>

            {/* Funções — somente colaboradores */}
            {editFormData.tipo_usuario === 'colaborador' && (
              <div className="space-y-2">
                <Label>Funções</Label>
                <RoleMultiSelect
                  idPrefix="edit-role"
                  value={editFormData.roles}
                  onChange={(roles) => setEditFormData({ ...editFormData, roles })}
                />
              </div>
            )}

            {/* Título — somente prestadores */}
            {editFormData.tipo_usuario === 'prestador_servico' && (
              <>
                <PrestadorTituloField
                  id="edit-titulo"
                  value={editFormData.titulo}
                  onChange={(titulo) => setEditFormData({ ...editFormData, titulo })}
                />

                {/* Toggle Pontua Garbo */}
                <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">Comissão — Programa Pontua Garbo</p>
                      <p className="text-xs text-amber-600">Permite receber comissão sobre orçamentos de leads</p>
                    </div>
                  </div>
                  <Switch
                    checked={editFormData.comissao_ativa}
                    onCheckedChange={(v) => setEditFormData({ ...editFormData, comissao_ativa: v })}
                  />
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-horario-inicio">Horário início</Label>
                <Input
                  id="edit-horario-inicio"
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="08:00"
                  value={editFormData.horario_acesso_inicio}
                  onChange={(e) => setEditFormData({ ...editFormData, horario_acesso_inicio: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Vazio = sem restrição</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-horario-fim">Horário fim</Label>
                <Input
                  id="edit-horario-fim"
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="18:00"
                  value={editFormData.horario_acesso_fim}
                  onChange={(e) => setEditFormData({ ...editFormData, horario_acesso_fim: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Ex.: 18:00</p>
              </div>
            </div>
          </div>
          </div>

          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateUser}>Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Redefinir Senha ──────────────────────────────────────── */}
      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
            <DialogDescription>
              Redefina a senha de <strong>{resetPasswordUserName}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova Senha</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Digite a nova senha"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Senha</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirme a nova senha"
              />
            </div>
            <Alert>
              <KeyRound className="h-4 w-4" />
              <AlertDescription>
                {PASSWORD_RULES_HINT}
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setResetPasswordDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={!newPassword || !confirmPassword || resetUserPassword.isPending}
            >
              {resetUserPassword.isPending ? 'Redefinindo...' : 'Redefinir Senha'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
