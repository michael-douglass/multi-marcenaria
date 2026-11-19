import { useQuery } from '@tanstack/react-query'
import { useApp } from '@/context/AppContext'
import { supabase } from '@/lib/supabase'

/**
 * Estado da IA no card do lead para a empresa ativa (RPC `app_ia_card_lead_status`, docs/ia-lead).
 * Não traz modelo, prompt, chave nem números de consumo: só o que a tela precisa para habilitar
 * ou explicar por que os botões estão desabilitados. O motor e a chave são da plataforma.
 *
 * A query não é persistida (fora de `shouldDehydrateQuery` em main.tsx) e revalida ao focar a janela,
 * então a cota estourada/liberada aparece sem precisar recarregar a página.
 */
export interface IaCardLeadStatus {
  liberada: boolean
  motorPronto: boolean
  renderAtivo: boolean
  renderAmbienteAtivo: boolean
  cotaEstourada: boolean
}

type Row = {
  liberada: boolean
  motor_pronto: boolean
  render_ativo: boolean
  render_ambiente_ativo: boolean
  cota_estourada: boolean
}

const INDISPONIVEL: IaCardLeadStatus = {
  liberada: false,
  motorPronto: false,
  renderAtivo: false,
  renderAmbienteAtivo: false,
  cotaEstourada: false,
}

export function useIaCardLeadStatus() {
  const { empresa } = useApp()
  const query = useQuery({
    queryKey: ['ia-card-lead-status', empresa?.id ?? null],
    enabled: Boolean(empresa?.id),
    staleTime: 30_000,
    queryFn: async (): Promise<IaCardLeadStatus> => {
      // RPC fora dos tipos gerados: o cast fica localizado aqui.
      const call = supabase.rpc as unknown as (
        fn: string,
      ) => Promise<{ data: Row[] | null; error: { message: string } | null }>
      const { data, error } = await call.call(supabase, 'app_ia_card_lead_status')
      if (error) throw new Error(error.message)
      const r = data?.[0]
      if (!r) return INDISPONIVEL
      return {
        liberada: r.liberada,
        motorPronto: r.motor_pronto,
        renderAtivo: r.render_ativo,
        renderAmbienteAtivo: r.render_ambiente_ativo,
        cotaEstourada: r.cota_estourada,
      }
    },
  })
  return { status: query.data ?? INDISPONIVEL, isLoading: query.isLoading }
}

/** Mensagem para a empresa (sem citar chave, modelo ou tokens) quando a renderização não está disponível. */
export function mensagemIaIndisponivel(s: IaCardLeadStatus, recurso: 'render' | 'ambiente'): string | null {
  if (!s.liberada) return 'A IA no card do lead não está liberada no plano da sua empresa. Fale com o suporte para ativar.'
  if (s.cotaEstourada) return 'O limite mensal de uso da IA foi atingido. A renderização volta a funcionar no dia 1º ou após ajuste do plano.'
  if (!s.motorPronto) return 'A renderização por IA está temporariamente indisponível. Tente novamente mais tarde.'
  if (recurso === 'render' ? !s.renderAtivo : !s.renderAmbienteAtivo) return 'Este tipo de renderização não está disponível no momento.'
  return null
}
