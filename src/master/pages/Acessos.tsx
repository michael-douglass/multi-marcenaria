import { useAcessosMaster } from '@/hooks/useMaster'
import { AcessosTabela } from '@/master/components/AcessosTabela'
import { MasterPage, Vazio } from '@/master/components/MasterUi'

/** Todas as entradas do master nas marcenarias, da mais recente para a mais antiga. */
export default function Acessos() {
  const { data: acessos = [], isLoading } = useAcessosMaster()
  return (
    <MasterPage
      titulo="Entradas nas marcenarias"
      resumo="Cada vez que você entra numa marcenaria, o modo escolhido e a duração ficam registrados aqui."
    >
      {isLoading ? <Vazio>Carregando…</Vazio> : <AcessosTabela acessos={acessos} mostrarEmpresa />}
    </MasterPage>
  )
}
