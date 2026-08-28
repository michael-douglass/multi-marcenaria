import { useApp } from '../context/AppContext'

export function useAuthReady() {
  const { session, userProfile, crmProfile, authLoading, profileLoading } = useApp()
  const hasIdentity = Boolean(userProfile || crmProfile)

  return {
    isReady: !authLoading && !profileLoading && !!session && hasIdentity,
    session,
    userProfile,
    authLoading,
    profileLoading,
  }
}
