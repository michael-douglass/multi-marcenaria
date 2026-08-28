import { useState, useEffect, useCallback, useMemo } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { invalidateCache, OBRAS_CACHE_KEY } from '../lib/data-cache'
import { canUseRealtime } from '../lib/device'
import { toUserNetworkError } from '../lib/network-error'
import { supabase } from '../lib/supabase'
import { mapCrmProfile, type CrmProfile } from '../lib/crm-identity'
import type { UserProfile, UserRole } from '../types'

const PROFILE_RPC_TIMEOUT_MS = 12_000
const AUTH_BOOT_TIMEOUT_MS = 4_000

export interface AuthState {
  session: Session | null
  user: User | null
  userProfile: UserProfile | null
  crmProfile: CrmProfile | null
  role: UserRole | null
  roles: UserRole[]
  loading: boolean
  profileLoading: boolean
  profileError: string | null
  signOut: () => Promise<void>
  retryProfile: () => void
}

const PERFIL_TO_ROLE: Record<UserProfile['perfil'], UserRole> = {
  administrador: 'Administrador',
  financeiro: 'Financeiro',
  marceneiro: 'Marceneiro',
  montador: 'Montador',
  montador_admin: 'MontadorAdmin',
  administrador_obras: 'AdministradorObras',
  visualizador: 'Visualizador',
}

function perfilToRole(perfil: UserProfile['perfil']): UserRole {
  return PERFIL_TO_ROLE[perfil]
}

function computeRoles(profile: UserProfile): UserRole[] {
  const primary = PERFIL_TO_ROLE[profile.perfil]
  const extras = (profile.perfis_extras ?? [])
    .map(p => PERFIL_TO_ROLE[p as UserProfile['perfil']])
    .filter(Boolean)
  const seen = new Set<UserRole>()
  const result: UserRole[] = []
  for (const r of [primary, ...extras]) {
    if (r && !seen.has(r)) { seen.add(r); result.push(r) }
  }
  return result
}

function mapRpcProfile(row: Record<string, unknown>): UserProfile {
  return {
    id: String(row.id),
    email: String(row.email),
    nome: row.nome ? String(row.nome) : undefined,
    perfil: row.perfil as UserProfile['perfil'],
    perfis_extras: Array.isArray(row.perfis_extras) ? row.perfis_extras.map(String) : [],
    ativo: row.ativo === true,
    criado_em: String(row.criado_em ?? ''),
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

async function fetchIdentity(): Promise<{ movelaria: UserProfile | null; crm: CrmProfile | null }> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), PROFILE_RPC_TIMEOUT_MS)

  try {
    const { data, error } = await supabase
      .rpc('movelaria_obter_minha_identidade')
      .abortSignal(controller.signal)

    if (error) throw new Error(error.message)

    const payload = asRecord(data)
    const movelariaRow = asRecord(payload?.movelaria)
    return {
      movelaria: movelariaRow ? mapRpcProfile(movelariaRow) : null,
      crm: mapCrmProfile(asRecord(payload?.crm)),
    }
  } catch (err) {
    if (err instanceof Error && (err.name === 'AbortError' || /abort/i.test(err.message))) {
      throw new Error(
        'Não foi possível conectar ao banco de dados. Verifique se o projeto Supabase está ativo.',
      )
    }
    throw err
  } finally {
    window.clearTimeout(timer)
  }
}

async function fetchIdentityWithRetry(attempts = 2): Promise<{ movelaria: UserProfile | null; crm: CrmProfile | null }> {
  let lastError: unknown = null

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fetchIdentity()
    } catch (err) {
      lastError = err
    }

    if (attempt < attempts - 1) {
      await new Promise(resolve => window.setTimeout(resolve, 250 * (attempt + 1)))
    }
  }

  if (lastError) throw lastError
  return { movelaria: null, crm: null }
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [crmProfile, setCrmProfile] = useState<CrmProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileRetryKey, setProfileRetryKey] = useState(0)

  useEffect(() => {
    let active = true
    let initialResolved = false

    const handleRateLimited = () => {
      if (!active) return
      setSession(null)
      setUser(null)
      setUserProfile(null)
      setCrmProfile(null)
      setProfileError(null)
      setProfileLoading(false)
      setLoading(false)
    }

    window.addEventListener('supabase:auth-rate-limited', handleRateLimited)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return

      if (event === 'INITIAL_SESSION') {
        initialResolved = true
        setSession(nextSession)
        setUser(nextSession?.user ?? null)
        setLoading(false)
        return
      }

      if (event === 'SIGNED_OUT') {
        invalidateCache(OBRAS_CACHE_KEY)
        setSession(null)
        setUser(null)
        setUserProfile(null)
        setCrmProfile(null)
        setProfileError(null)
        setProfileLoading(false)
        setLoading(false)
        return
      }

      if (event === 'TOKEN_REFRESHED') {
        setSession(nextSession)
        return
      }

      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      setLoading(false)
    })

    const bootTimer = window.setTimeout(() => {
      if (!active || initialResolved) return
      initialResolved = true
      setLoading(false)
    }, AUTH_BOOT_TIMEOUT_MS)

    return () => {
      active = false
      window.clearTimeout(bootTimer)
      window.removeEventListener('supabase:auth-rate-limited', handleRateLimited)
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) {
      setUserProfile(null)
      setCrmProfile(null)
      setProfileError(null)
      setProfileLoading(false)
      return
    }

    let active = true
    setProfileLoading(true)
    setProfileError(null)

    const run = () => {
      void (async () => {
        try {
          const identity = await fetchIdentityWithRetry()
          if (!active) return

          const movelaria = identity.movelaria
          const crm = identity.crm
          const movelariaOk = movelaria?.ativo === true
          const crmOk = crm?.statusConvite === 'ATIVO'

          if (!movelaria && !crm) {
            setUserProfile(null)
            setCrmProfile(null)
            setProfileError('Perfil não encontrado no sistema. Contate o administrador.')
            return
          }

          if (!movelariaOk && !crmOk) {
            setUserProfile(null)
            setCrmProfile(crm)
            if (movelaria && movelaria.ativo === false) {
              setProfileError(
                'Conta pendente de aprovação. Aguarde o administrador ativar seu acesso em Configurações.',
              )
            } else {
              setProfileError('Perfil não encontrado no sistema. Contate o administrador.')
            }
            return
          }

          setUserProfile(movelariaOk ? movelaria : null)
          setCrmProfile(crmOk ? crm : crm)
        } catch (err) {
          if (!active) return
          const message = toUserNetworkError(err, 'Erro ao carregar perfil.')
          console.error('[useAuth] Erro ao buscar perfil:', err)
          setUserProfile(null)
          setCrmProfile(null)
          setProfileError(message)
        } finally {
          if (active) setProfileLoading(false)
        }
      })()
    }

    const deferId = window.setTimeout(run, 250)

    return () => {
      active = false
      window.clearTimeout(deferId)
    }
  }, [session?.user?.id, profileRetryKey])

  useEffect(() => {
    const token = session?.access_token
    if (!token || !canUseRealtime()) return
    const timer = window.setTimeout(() => {
      supabase.realtime.setAuth(token)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [session?.access_token])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const retryProfile = useCallback(() => {
    setProfileRetryKey(k => k + 1)
  }, [])

  const role = userProfile ? perfilToRole(userProfile.perfil) : null
  const roles = useMemo(
    () => (userProfile ? computeRoles(userProfile) : []),
    [userProfile],
  )

  return {
    session,
    user,
    userProfile,
    crmProfile,
    role,
    roles,
    loading,
    profileLoading,
    profileError,
    signOut,
    retryProfile,
  }
}
