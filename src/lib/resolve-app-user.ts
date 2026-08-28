import type { User as SupabaseUser } from '@supabase/supabase-js';
import { adaptUserFromDatabase } from '@/lib/adapters';
import type { DatabaseUser } from '@/hooks/useUsers';
import type { User } from '@/types/selletos';

type AuthRole = 'admin' | 'vendedor' | 'marketing' | 'nenhum' | null;

/** Monta o usuário da UI a partir do Auth + perfil no schema da empresa (sem mock). */
export function resolveAppUser(
  authUser: SupabaseUser | null,
  profile: DatabaseUser | null | undefined,
  userRole: AuthRole,
): User {
  if (profile) {
    return adaptUserFromDatabase(profile);
  }

  const email = authUser?.email ?? '';
  const meta = authUser?.user_metadata as { name?: string; full_name?: string } | undefined;
  const displayName =
    meta?.name || meta?.full_name || (email ? email.split('@')[0] : 'Usuário');

  const roleUpper = (userRole ?? 'nenhum').toUpperCase() as User['role'];

  return {
    id: 0,
    name: displayName,
    email,
    role: roleUpper,
    inviteSent: true,
    createdAt: new Date().toISOString(),
  };
}
