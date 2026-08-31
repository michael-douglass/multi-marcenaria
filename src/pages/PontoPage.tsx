import { useState } from 'react'
import { Clock, LayoutGrid, UserCheck } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { podeBaterPontoPorTipo } from '@/lib/funcionario-constants'
import { useMeuFuncionario } from '@/hooks/useMeuFuncionario'
import { BaterPonto } from '@/pages/BaterPonto'
import { PontoControleFuncionarios } from '@/components/ponto/PontoControleFuncionarios'
import { LoadingState } from '@/components/ui/EmptyState'

type PontoTab = 'bater' | 'controle'

function isRh(roles: string[]): boolean {
  return roles.includes('Administrador') || roles.includes('Financeiro')
}

export function PontoPage() {
  const { roles } = useApp()
  const { data: funcionario, loading: cadastroLoading } = useMeuFuncionario()
  const showBater = podeBaterPontoPorTipo(funcionario?.tipo)
  const showControle = isRh(roles)
  const [tab, setTab] = useState<PontoTab | null>(null)

  const onlyBater = showBater && !showControle
  const onlyControle = showControle && !showBater
  const onlyOne = onlyBater || onlyControle
  const activeTab = tab ?? (showBater ? 'bater' : 'controle')

  if (cadastroLoading) {
    return <LoadingState message="Verificando seu cadastro de funcionário…" />
  }

  if (!showBater && !showControle) {
    return (
      <div className="fade-in obra-page-shell mx-auto flex max-w-lg flex-col gap-4 p-1 pb-10">
        <h1 className="font-display flex items-center gap-2 text-[2rem] tracking-wide text-[#f2d892]">
          <Clock size={28} />
          Bater Ponto
        </h1>
        <div className="glass-card p-8 text-center">
          <p className="text-[#edd9c4]">
            Só funcionários cadastrados pela empresa podem bater ponto.
          </p>
          <p className="mt-2 text-sm text-[#b8957f]">
            Peça ao RH para criar ou vincular sua pasta em Funcionários.
            Sem esse cadastro, o ponto não abre.
          </p>
        </div>
      </div>
    )
  }

  // Montador / Montador Admin / Adm. Obras: página completa de bater ponto com status e batidas
  if (onlyBater) {
    return <BaterPonto />
  }

  return (
    <div className="fade-in obra-page-shell flex flex-col gap-6 p-1 pb-10">
      <div>
        <h1 className="font-display flex items-center gap-2 text-[2rem] tracking-wide text-[#f2d892]">
          <Clock size={28} />
          Ponto
        </h1>
        <p className="section-label mt-1">
          {showControle && showBater
            ? 'Registre sua jornada ou acompanhe a equipe'
            : 'Controle diário de chegadas e batidas'}
        </p>
      </div>

      {!onlyOne && (
        <nav
          className="flex gap-1 rounded-xl border border-[rgba(212,168,83,0.2)] bg-[rgba(36,16,8,0.45)] p-1"
          aria-label="Abas do ponto"
        >
          {showBater && (
            <button
              type="button"
              onClick={() => setTab('bater')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                activeTab === 'bater'
                  ? 'bg-[rgba(240,210,140,0.14)] text-[#f2d892] shadow-sm'
                  : 'text-[#b8957f] hover:text-[#edd9c4]'
              }`}
            >
              <UserCheck size={16} />
              Bater ponto
            </button>
          )}
          {showControle && (
            <button
              type="button"
              onClick={() => setTab('controle')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                activeTab === 'controle'
                  ? 'bg-[rgba(240,210,140,0.14)] text-[#f2d892] shadow-sm'
                  : 'text-[#b8957f] hover:text-[#edd9c4]'
              }`}
            >
              <LayoutGrid size={16} />
              Controle de funcionários
            </button>
          )}
        </nav>
      )}

      {activeTab === 'bater' && showBater && (
        <div className="mx-auto w-full max-w-lg">
          <BaterPonto embedded />
        </div>
      )}
      {activeTab === 'controle' && showControle && (
        <div className="mx-auto w-full max-w-6xl">
          <PontoControleFuncionarios />
        </div>
      )}
    </div>
  )
}
