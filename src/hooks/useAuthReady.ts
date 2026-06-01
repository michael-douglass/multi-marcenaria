import { useApp } from '../context/AppContext'

export function useAuthReady() {
  const { session, userProfile, authLoading, profileLoading } = useApp()
  
  return {
    isReady: !authLoading && !profileLoading && !!session && !!userProfile,
    session,
    userProfile,
    authLoading,
    profileLoading,
  }
}
