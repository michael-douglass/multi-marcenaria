import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile'
import { useEmpresaSupabase, useTableName } from '@/hooks/useEmpresaSupabase'
import { MASTER_TABLES } from '@/lib/empresa-tables'
import { adaptUserForAvatar } from '@/lib/adapters'
import { Mail, Shield, LogOut, Camera, Loader2, Phone, UserCircle, Building2 } from 'lucide-react'
import { EmpresaDadosForm } from '@/components/admin/EmpresaDadosForm'
import { toast } from 'sonner'
import { UserAvatar } from '@/components/ui/user-avatar'
import { ProfileAura } from '@/components/profile/ProfileAura'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { formatRolesLabel, roleLabel } from '@/lib/app-roles'
import type { AppUserRole } from '@/lib/resolve-auth-role'
import { cn } from '@/lib/utils'

/** Paleta clara do perfil (papel / ateliê) — legível sobre o fundo do paper-workspace. */
const ink = {
  title: 'text-[#2a1810]',
  body: 'text-[#3d2a1f]',
  muted: 'text-[#6b5244]',
  gold: 'text-[#8a5a1e]',
  card: 'border-[rgba(90,60,40,0.12)] bg-[#fffcf8]/95 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_12px_32px_rgba(42,24,18,0.06)]',
  cardLine: 'border-[rgba(90,60,40,0.1)]',
  row: 'border-[rgba(90,60,40,0.1)] bg-white/70',
  icon: 'bg-[rgba(138,90,30,0.1)] text-[#8a5a1e]',
}

export default function Profile() {
  const navigate = useNavigate()
  const { user, userRole, userRoles, signOut, hasRole } = useAuth()
  const podeEditarEmpresa = hasRole('admin')
  const location = useLocation()
  const db = useEmpresaSupabase()
  const table = useTableName()
  const { data: currentUserData, isLoading: isLoadingProfile, refetch } = useCurrentUserProfile()
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await signOut()
      navigate('/')
    } catch (error) {
      console.error('Erro no logout:', error)
      toast.error('Não foi possível sair. Tente novamente.')
    } finally {
      setIsLoggingOut(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return

    const maxSize = 2 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error('Arquivo muito grande. Máximo: 2MB')
      return
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida')
      return
    }

    setIsUploadingAvatar(true)

    try {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64String = reader.result as string

        const usuariosTable = table('usuarios', MASTER_TABLES.usuarios)
        const { error } = await db
          .from(usuariosTable)
          .update({ avatar_url: base64String })
          .eq('id', user.id)

        if (error) throw error
        await refetch()
        toast.success('Foto atualizada!')
        setIsUploadingAvatar(false)
      }
      reader.readAsDataURL(file)
    } catch {
      toast.error('Erro ao fazer upload da foto')
      setIsUploadingAvatar(false)
    }
  }

  const getRoleBadgeColor = (role?: string) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'bg-[#f2d892] text-[#2a1810] border-transparent'
      case 'projetista_admin':
        return 'bg-violet-100 text-violet-800 border-violet-200'
      case 'vendedor':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200'
      case 'projetista':
        return 'bg-violet-50 text-violet-700 border-violet-200'
      case 'marketing':
        return 'bg-teal-50 text-teal-800 border-teal-200'
      case 'nenhum':
        return 'bg-[#f3ebe3] text-[#6b5244] border-[rgba(90,60,40,0.14)]'
      default:
        return 'bg-[#f3ebe3] text-[#6b5244] border-[rgba(90,60,40,0.14)]'
    }
  }

  // Link "Editar em Perfil" (contratos) aponta para /profile#dados-empresa.
  useEffect(() => {
    if (location.hash !== '#dados-empresa' || isLoadingProfile || !podeEditarEmpresa) return
    document.getElementById('dados-empresa')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [location.hash, isLoadingProfile, podeEditarEmpresa])

  const displayRoles = (userRoles.length ? userRoles : userRole ? [userRole] : []) as AppUserRole[]

  if (isLoadingProfile) {
    return (
      <div className="profile-page relative flex min-h-[60vh] items-center justify-center overflow-hidden">
        <ProfileAura className="opacity-50" />
        <div className="relative z-[1] text-center">
          <Loader2 className={cn('mx-auto h-8 w-8 animate-spin', ink.gold)} />
          <p className={cn('mt-4 text-sm tracking-wide', ink.muted)}>Carregando perfil…</p>
        </div>
      </div>
    )
  }

  if (!currentUserData) {
    return (
      <div className="profile-page relative flex min-h-[60vh] items-center justify-center overflow-hidden p-6">
        <ProfileAura className="opacity-40" />
        <div
          className={cn(
            'relative z-[1] w-full max-w-md space-y-4 rounded-2xl border p-6 text-center',
            ink.card,
          )}
        >
          <p className={cn('text-sm leading-relaxed', ink.body)}>
            Não foi possível carregar seus dados. Verifique se sua conta está ativa na empresa correta.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              variant="outline"
              onClick={() => refetch()}
              className="border-[rgba(90,60,40,0.2)] text-[#8a5a1e] hover:bg-[rgba(138,90,30,0.08)]"
            >
              Tentar novamente
            </Button>
            <Button
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
              className="bg-[#8a5a1e] font-semibold text-white hover:bg-[#6b3f12]"
            >
              {isLoggingOut ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saindo…
                </>
              ) : (
                <>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    // h-full + overflow-y-auto: no desktop o layout trava a altura (md:flex-1);
    // sem isso, o conteúdo de "Dados da empresa" ficava cortado.
    <div className="profile-page relative isolate h-full min-h-0 overflow-x-hidden overflow-y-auto overscroll-y-contain px-4 py-6 pb-12 sm:px-6 sm:py-8 sm:pb-14">
      <ProfileAura className="opacity-55" />

      <div className="relative z-[1] mx-auto flex w-full max-w-2xl flex-col gap-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={cn('text-[0.62rem] font-semibold uppercase tracking-[0.18em]', ink.muted)}>
              Conta
            </p>
            <h1
              className={cn(
                'font-display mt-1 flex items-center gap-2 text-2xl tracking-wide sm:text-[1.75rem]',
                ink.title,
              )}
            >
              <UserCircle className={cn('h-7 w-7 shrink-0 opacity-90', ink.gold)} aria-hidden />
              Meu perfil
            </h1>
            <p className={cn('mt-1 text-sm', ink.muted)}>
              Foto, dados de acesso e permissões nesta empresa.
            </p>
          </div>

          <Button
            type="button"
            onClick={() => void handleLogout()}
            disabled={isLoggingOut}
            className={cn(
              'shrink-0 gap-2 border border-red-200 bg-red-50',
              'font-semibold text-red-700 shadow-sm',
              'transition-[transform,background-color,box-shadow] duration-200',
              'hover:bg-red-100 hover:text-red-800',
              'active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-red-300/50',
            )}
          >
            {isLoggingOut ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saindo…
              </>
            ) : (
              <>
                <LogOut className="h-4 w-4" />
                Sair
              </>
            )}
          </Button>
        </header>

        <section className={cn('overflow-hidden rounded-2xl border', ink.card)}>
          <div className={cn('border-b px-5 py-4 sm:px-6', ink.cardLine)}>
            <h2 className={cn('font-display text-lg tracking-widest', ink.gold)}>
              Informações pessoais
            </h2>
          </div>

          <div className="space-y-5 px-5 py-5 sm:px-6">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <UserAvatar
                  user={adaptUserForAvatar(currentUserData)}
                  size="lg"
                  className="h-16 w-16 ring-2 ring-[#8a5a1e]/25 ring-offset-2 ring-offset-[#fffcf8]"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <Button
                  size="icon"
                  type="button"
                  variant="outline"
                  className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full border-[rgba(90,60,40,0.18)] bg-white text-[#8a5a1e] shadow-sm hover:bg-[rgba(138,90,30,0.08)]"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  aria-label="Alterar foto"
                >
                  {isUploadingAvatar ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="min-w-0">
                <p className={cn('text-[0.65rem] font-semibold uppercase tracking-[0.12em]', ink.muted)}>
                  Nome
                </p>
                <p className={cn('truncate text-lg font-semibold', ink.title)}>
                  {currentUserData.nome}
                </p>
                <button
                  type="button"
                  className={cn(
                    'mt-0.5 text-xs font-medium underline-offset-2 transition-colors hover:underline disabled:opacity-50',
                    ink.gold,
                  )}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                >
                  Alterar foto
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-1">
              <div className={cn('flex items-center gap-3 rounded-xl border px-3 py-3', ink.row)}>
                <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', ink.icon)}>
                  <Mail className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className={cn('text-[0.65rem] font-semibold uppercase tracking-[0.12em]', ink.muted)}>
                    E-mail
                  </p>
                  <p className={cn('truncate font-medium', ink.body)}>
                    {currentUserData.email || 'Não informado'}
                  </p>
                </div>
              </div>

              {currentUserData.telefone && (
                <div className={cn('flex items-center gap-3 rounded-xl border px-3 py-3', ink.row)}>
                  <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', ink.icon)}>
                    <Phone className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className={cn('text-[0.65rem] font-semibold uppercase tracking-[0.12em]', ink.muted)}>
                      Telefone
                    </p>
                    <p className={cn('font-medium', ink.body)}>{currentUserData.telefone}</p>
                  </div>
                </div>
              )}

              <div className={cn('flex items-start gap-3 rounded-xl border px-3 py-3', ink.row)}>
                <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', ink.icon)}>
                  <Shield className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className={cn('text-[0.65rem] font-semibold uppercase tracking-[0.12em]', ink.muted)}>
                    Papel no sistema
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {displayRoles.length > 0 ? (
                      displayRoles.map((role) => (
                        <Badge key={role} className={cn('border', getRoleBadgeColor(role))}>
                          {roleLabel(role).toUpperCase()}
                        </Badge>
                      ))
                    ) : (
                      <Badge className={cn('border', getRoleBadgeColor('nenhum'))}>NENHUM</Badge>
                    )}
                  </div>
                  {displayRoles.length > 1 && (
                    <p className={cn('mt-1.5 text-xs', ink.muted)}>{formatRolesLabel(displayRoles)}</p>
                  )}
                </div>
              </div>
            </div>

            <div className={cn('border-t pt-4', ink.cardLine)}>
              <Button
                type="button"
                onClick={() => void handleLogout()}
                disabled={isLoggingOut}
                className={cn(
                  'h-11 w-full gap-2 border border-red-200',
                  'bg-gradient-to-r from-red-50 to-red-100/80',
                  'font-semibold tracking-wide text-red-700',
                  'transition-[transform,filter] duration-200',
                  'hover:from-red-100 hover:to-red-100 hover:text-red-800 active:scale-[0.99]',
                  'focus-visible:ring-2 focus-visible:ring-red-300/50',
                )}
              >
                {isLoggingOut ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Encerrando sessão…
                  </>
                ) : (
                  <>
                    <LogOut className="h-4 w-4" />
                    Sair da conta
                  </>
                )}
              </Button>
              <p className={cn('mt-2 text-center text-[0.65rem]', ink.muted)}>
                Você será desconectado deste aparelho e voltará à tela de entrada.
              </p>
            </div>
          </div>
        </section>

        {podeEditarEmpresa && (
          <section
            id="dados-empresa"
            className={cn('overflow-hidden rounded-2xl border', ink.card)}
          >
            <div className={cn('border-b px-5 py-4 sm:px-6', ink.cardLine)}>
              <h2 className={cn('font-display flex items-center gap-2 text-lg tracking-widest', ink.gold)}>
                <Building2 className="h-5 w-5 opacity-90" aria-hidden />
                Dados da empresa
              </h2>
              <p className={cn('mt-1 text-xs', ink.muted)}>
                Logo, CNPJ e dados cadastrais usados no menu, nos slides, contratos e PDFs. Só administradores veem esta seção.
              </p>
            </div>
            <div className="px-5 py-5 sm:px-6">
              <EmpresaDadosForm tom="perfil" />
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
