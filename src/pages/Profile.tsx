import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile'
import { useEmpresaSupabase, useTableName } from '@/hooks/useEmpresaSupabase'
import { MASTER_TABLES } from '@/lib/empresa-tables'
import { adaptUserForAvatar } from '@/lib/adapters'
import { Mail, Shield, LogOut, Camera, Loader2, Phone, UserCircle } from 'lucide-react'
import { toast } from 'sonner'
import { UserAvatar } from '@/components/ui/user-avatar'
import { ProfileAura } from '@/components/profile/ProfileAura'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatRolesLabel, roleLabel } from '@/lib/app-roles'
import type { AppUserRole } from '@/lib/resolve-auth-role'
import { cn } from '@/lib/utils'

export default function Profile() {
  const navigate = useNavigate()
  const { user, userRole, userRoles, signOut } = useAuth()
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
        return 'bg-[#f2d892] text-[#1a0f0a] border-transparent'
      case 'projetista_admin':
        return 'bg-violet-600/90 text-white border-transparent'
      case 'vendedor':
        return 'bg-emerald-700/80 text-[#f5ebe0] border-transparent'
      case 'projetista':
        return 'bg-violet-500/25 text-[#d8b4fe] border-[rgba(216,180,254,0.35)]'
      case 'marketing':
        return 'bg-emerald-500/20 text-[#6ee7b7] border-[rgba(110,231,183,0.35)]'
      case 'nenhum':
        return 'bg-[rgba(40,24,16,0.6)] text-[#c4a88a] border-[rgba(240,210,140,0.2)]'
      default:
        return 'bg-[rgba(40,24,16,0.6)] text-[#c4a88a] border-[rgba(240,210,140,0.2)]'
    }
  }

  const displayRoles = (userRoles.length ? userRoles : userRole ? [userRole] : []) as AppUserRole[]

  if (isLoadingProfile) {
    return (
      <div className="relative flex min-h-[60vh] items-center justify-center overflow-hidden">
        <ProfileAura className="opacity-70" />
        <div className="relative z-[1] text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#f2d892]" />
          <p className="mt-4 text-sm tracking-wide text-[#edd9c4]">Carregando perfil…</p>
        </div>
      </div>
    )
  }

  if (!currentUserData) {
    return (
      <div className="relative flex min-h-[60vh] items-center justify-center overflow-hidden p-6">
        <ProfileAura className="opacity-60" />
        <div className="relative z-[1] w-full max-w-md space-y-4 rounded-2xl border border-[rgba(240,210,140,0.22)] bg-[rgba(18,10,6,0.82)] p-6 text-center shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
          <p className="text-sm leading-relaxed text-[#edd9c4]">
            Não foi possível carregar seus dados. Verifique se sua conta está ativa na empresa correta.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              variant="outline"
              onClick={() => refetch()}
              className="border-[rgba(240,210,140,0.35)] text-[#f2d892] hover:bg-[#f2d892]/10"
            >
              Tentar novamente
            </Button>
            <Button
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
              className="bg-[#f2d892] font-semibold text-[#1a0f0a] hover:bg-[#f2d892]/90"
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
    <div className="profile-page relative isolate min-h-[70vh] overflow-hidden px-4 py-6 sm:px-6 sm:py-8">
      <ProfileAura className="opacity-90" />

      <div className="relative z-[1] mx-auto flex w-full max-w-2xl flex-col gap-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[#c4a88a]">
              Conta
            </p>
            <h1 className="font-display mt-1 flex items-center gap-2 text-2xl tracking-wide text-[#f2d892] sm:text-[1.75rem]">
              <UserCircle className="h-7 w-7 shrink-0 opacity-90" aria-hidden />
              Meu perfil
            </h1>
            <p className="mt-1 text-sm text-[#edd9c4]/85">
              Foto, dados de acesso e permissões nesta empresa.
            </p>
          </div>

          <Button
            type="button"
            onClick={() => void handleLogout()}
            disabled={isLoggingOut}
            className={cn(
              'shrink-0 gap-2 border border-[rgba(239,68,68,0.35)] bg-[rgba(127,29,29,0.45)]',
              'font-semibold text-[#fecaca] shadow-[0_8px_24px_rgba(0,0,0,0.28)]',
              'transition-[transform,background-color,box-shadow] duration-200',
              'hover:bg-[rgba(153,27,27,0.65)] hover:text-white hover:shadow-[0_10px_28px_rgba(127,29,29,0.35)]',
              'active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-red-400/40',
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

        <section className="overflow-hidden rounded-2xl border border-[rgba(240,210,140,0.22)] bg-[rgba(14,8,4,0.78)] shadow-[0_1px_0_rgba(255,248,235,0.06)_inset,0_18px_48px_rgba(0,0,0,0.32)]">
          <div className="border-b border-[rgba(240,210,140,0.14)] px-5 py-4 sm:px-6">
            <h2 className="font-display text-lg tracking-widest text-[#f2d892]">
              Informações pessoais
            </h2>
          </div>

          <div className="space-y-5 px-5 py-5 sm:px-6">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <UserAvatar
                  user={adaptUserForAvatar(currentUserData)}
                  size="lg"
                  className="h-16 w-16 ring-2 ring-[#f2d892]/35 ring-offset-2 ring-offset-[#120a06]"
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
                  className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full border-[rgba(240,210,140,0.4)] bg-[rgba(26,15,10,0.92)] text-[#f2d892] hover:bg-[#f2d892]/15"
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
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#c4a88a]">
                  Nome
                </p>
                <p className="truncate text-lg font-semibold text-[#f5ebe0]">
                  {currentUserData.nome}
                </p>
                <button
                  type="button"
                  className="mt-0.5 text-xs font-medium text-[#f2d892] underline-offset-2 transition-colors hover:underline disabled:opacity-50"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                >
                  Alterar foto
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-1">
              <div className="flex items-center gap-3 rounded-xl border border-[rgba(240,210,140,0.12)] bg-[rgba(255,248,235,0.03)] px-3 py-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[rgba(242,216,146,0.12)] text-[#f2d892]">
                  <Mail className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#c4a88a]">
                    E-mail
                  </p>
                  <p className="truncate font-medium text-[#f5ebe0]">
                    {currentUserData.email || 'Não informado'}
                  </p>
                </div>
              </div>

              {currentUserData.telefone && (
                <div className="flex items-center gap-3 rounded-xl border border-[rgba(240,210,140,0.12)] bg-[rgba(255,248,235,0.03)] px-3 py-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[rgba(242,216,146,0.12)] text-[#f2d892]">
                    <Phone className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#c4a88a]">
                      Telefone
                    </p>
                    <p className="font-medium text-[#f5ebe0]">{currentUserData.telefone}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3 rounded-xl border border-[rgba(240,210,140,0.12)] bg-[rgba(255,248,235,0.03)] px-3 py-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[rgba(242,216,146,0.12)] text-[#f2d892]">
                  <Shield className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#c4a88a]">
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
                    <p className="mt-1.5 text-xs text-[#c4a88a]">{formatRolesLabel(displayRoles)}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-[rgba(240,210,140,0.14)] pt-4">
              <Button
                type="button"
                onClick={() => void handleLogout()}
                disabled={isLoggingOut}
                className={cn(
                  'h-11 w-full gap-2 border border-[rgba(239,68,68,0.4)]',
                  'bg-gradient-to-r from-[rgba(127,29,29,0.75)] to-[rgba(69,10,10,0.85)]',
                  'font-semibold tracking-wide text-[#fecaca]',
                  'transition-[transform,filter] duration-200',
                  'hover:brightness-110 hover:text-white active:scale-[0.99]',
                  'focus-visible:ring-2 focus-visible:ring-red-400/40',
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
              <p className="mt-2 text-center text-[0.65rem] text-[#c4a88a]/80">
                Você será desconectado deste aparelho e voltará à tela de entrada.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
