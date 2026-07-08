import { useState } from 'react'
import { Clock, LayoutGrid, UserCheck } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { canAccessSection, isFuncionarioCampo } from '@/lib/role-access'
import { BaterPonto } from '@/pages/BaterPonto'
import { PontoControleFuncionarios } from '@/components/ponto/PontoControleFuncionarios'

type PontoTab = 'bater' | 'controle'

function isRh(roles: string[]): boolean {
  return roles.includes('Administrador') || roles.includes('Financeiro')
}

export function PontoPage() {
  const { roles } = useApp()
  const showBater = canAccessSection(roles, 'baterPonto') && isFuncionarioCampo(roles)
  const showControle = isRh(roles)

  const [tab, setTab] = useState<PontoTab>(
    showControle && !showBater ? 'controle' : 'bater',
  )

  const onlyBater = showBater && !showControle
  const onlyControle = showControle && !showBater
  const onlyOne = onlyBater || onlyControle

  if (!showBater && !showControle) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-[#edd9c4]">Você não tem acesso ao módulo de ponto.</p>
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
                tab === 'bater'
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
                tab === 'controle'
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

      {tab === 'bater' && showBater && (
        <div className="mx-auto w-full max-w-lg">
          <BaterPonto embedded />
        </div>
      )}
      {tab === 'controle' && showControle && (
        <div className="mx-auto w-full max-w-6xl">
          <PontoControleFuncionarios />
        </div>
      )}
    </div>
  )
}
