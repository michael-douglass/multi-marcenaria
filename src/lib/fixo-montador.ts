import { supabase } from '@/lib/supabase'
import type { MontadorFixoMensal, UserRole, UsuarioMontador } from '@/types'

/** Perfis que podem gerar cobranças de fixo mensal dos montadores. */
export function podeExpandirFixoMontadores(roles: UserRole[]): boolean {
  return roles.some(
    r =>
      r === 'Administrador'
      || r === 'Financeiro'
      || r === 'MontadorAdmin'
      || r === 'AdministradorObras',
  )
}

function mapFixoRow(row: Record<string, unknown>): MontadorFixoMensal {
  return {
    montador_id: String(row.montador_id),
    montador_nome: String(row.montador_nome ?? 'Montador'),
    valor_fixo_mensal: Number(row.valor_fixo_mensal) || 0,
    primeiro_vencimento: row.primeiro_vencimento
      ? String(row.primeiro_vencimento).slice(0, 10)
      : null,
    status_mes: (row.status_mes as MontadorFixoMensal['status_mes']) ?? 'sem_fixo',
    conta_pagar_id: row.conta_pagar_id ? String(row.conta_pagar_id) : null,
  }
}

export async function fetchMontadoresAtivos(): Promise<UsuarioMontador[]> {
  const { data, error } = await supabase.rpc('movelaria_listar_montadores')
  if (error) throw error
  return (data ?? []) as UsuarioMontador[]
}

export async function fetchFixoMontadores(
  mes: number,
  ano: number,
): Promise<MontadorFixoMensal[]> {
  const { data, error } = await supabase.rpc('movelaria_listar_fixo_montadores', {
    p_mes: mes,
    p_ano: ano,
  })
  if (error) throw error
  return (data ?? []).map((row: Record<string, unknown>) => mapFixoRow(row))
}

export function mergeMontadoresComFixo(
  montadores: UsuarioMontador[],
  fixos: MontadorFixoMensal[],
): MontadorFixoMensal[] {
  const fixoPorId = new Map(fixos.map(f => [f.montador_id, f]))

  return montadores.map(m => {
    const fixo = fixoPorId.get(m.id)
    const nome = m.nome?.trim() || m.email.split('@')[0] || 'Montador'
    return fixo ?? {
      montador_id: m.id,
      montador_nome: nome,
      valor_fixo_mensal: 0,
      primeiro_vencimento: null,
      status_mes: 'sem_fixo',
      conta_pagar_id: null,
    }
  })
}

export async function atualizarFixoMontador(
  montadorId: string,
  valor: number,
  primeiroVencimento?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('movelaria_atualizar_fixo_montador', {
    p_montador_id: montadorId,
    p_valor: valor,
    p_primeiro_vencimento: primeiroVencimento || null,
  })
  if (error) throw error
}

/** Garante que todo fixo cadastrado tenha cobranças em Contas a Pagar. */
export async function expandirTodosFixoMontadores(): Promise<void> {
  const { error } = await supabase.rpc('movelaria_expandir_todos_fixo_montadores')
  if (error) throw error
}
