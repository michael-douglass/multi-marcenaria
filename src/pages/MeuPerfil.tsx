import { useState } from 'react'
import { LogOut, Receipt, UserCircle } from 'lucide-react'
import { MeuPontoSection } from '@/components/ponto/MeuPontoSection'
import { FuncionarioFotoPerfil } from '@/components/funcionarios/FuncionarioFotoPerfil'
import { FuncionarioMeusDocumentosForm } from '@/components/funcionarios/FuncionarioMeusDocumentosForm'
import { PrestadorRecibosTab } from '@/components/funcionarios/PrestadorRecibosTab'
import { ErrorState, LoadingState } from '@/components/ui/EmptyState'
import { useMeuFuncionario } from '@/hooks/useMeuFuncionario'
import { useApp } from '@/context/AppContext'

function SairDoSistemaButton({
  saindo,
  onSair,
}: {
  saindo: boolean
  onSair: () => void
}) {
  return (
    <button
      type="button"
      className="btn btn-danger w-full shrink-0 sm:w-auto"
      onClick={onSair}
      disabled={saindo}
      aria-label="Sair do sistema"
    >
      <LogOut size={18} />
      {saindo ? 'Saindo…' : 'Sair do sistema'}
    </button>
  )
}

export function MeuPerfil() {
  const { data, loading, error, reload } = useMeuFuncionario()
  const { roles, signOut } = useApp()
  const [saindo, setSaindo] = useState(false)
  const temMeuFinanceiro = roles.some(r => r === 'Montador' || r === 'MontadorAdmin')

  async function handleSair() {
    if (saindo) return
    setSaindo(true)
    try {
      await signOut()
    } finally {
      setSaindo(false)
    }
  }

  return (
    <div className="fade-in obra-page-shell flex flex-col gap-6 p-1">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display flex items-center gap-2 text-[2rem] tracking-wide text-[#f2d892]">
            <UserCircle size={28} />
            Meu Perfil
          </h1>
          <p className="section-label mt-1">
            Atualize sua foto, preencha o formulário de admissão e envie os documentos solicitados
          </p>
        </div>
        <SairDoSistemaButton saindo={saindo} onSair={() => void handleSair()} />
      </div>

      {loading && <LoadingState message="Carregando seu cadastro…" />}

      {!loading && error && (
        <ErrorState message={error} onRetry={() => void reload()} />
      )}

      {!loading && !error && !data && (
        <div className="glass-card p-8 text-center">
          <p className="text-[#edd9c4]">
            Seu usuário ainda não está vinculado a um cadastro de funcionário.
          </p>
          <p className="mt-2 text-sm text-[#b8957f]">
            Pastas são criadas automaticamente para Financeiro, Montador, Montador Admin
            e Adm. Obras. Se você acabou de receber o perfil, atualize a página. Caso persista,
            contate o administrador.
          </p>
        </div>
      )}

      {!loading && !error && data && (
        <>
          <FuncionarioFotoPerfil
            funcionarioId={data.id}
            fotoPath={data.foto_perfil_path}
            nome={data.nome}
            onUpdated={() => void reload()}
          />
          <FuncionarioMeusDocumentosForm payload={data} onReload={() => void reload()} />
          <MeuPontoSection funcionarioTipo={data.tipo} />
          {!temMeuFinanceiro && (
            <div className="glass-card p-5">
              <h2 className="mb-4 flex items-center gap-2 font-display text-xl text-[#f2d892]">
                <Receipt size={20} />
                Meus recibos
              </h2>
              <PrestadorRecibosTab />
            </div>
          )}

          <div className="glass-card flex flex-col items-stretch gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[#b8957f]">
              Encerrar a sessão neste aparelho.
            </p>
            <SairDoSistemaButton saindo={saindo} onSair={() => void handleSair()} />
          </div>
        </>
      )}
    </div>
  )
}
