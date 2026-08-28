import { Logo } from '@/components/Logo'
import { useApp } from '@/context/AppContext'

export function ForaDoHorario() {
  const { crmProfile, signOut } = useApp()
  const inicio = crmProfile?.horarioAcessoInicio
  const fim = crmProfile?.horarioAcessoFim
  const range = inicio && fim ? `${inicio} às ${fim}` : inicio ? `a partir de ${inicio}` : fim ? `até ${fim}` : '—'

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#2a1812] px-6 font-raleway text-center">
      <div className="max-w-md">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <p className="mb-1 text-lg font-semibold text-[#f2d892]">Fora do horário de acesso</p>
        <p className="text-sm text-[#edd9c4]">
          Seu acesso ao CRM está permitido apenas no horário configurado: <strong className="text-cream">{range}</strong>.
        </p>
        <p className="mt-3 text-xs text-[#b8957f]">
          Fale com o administrador se precisar entrar fora desse período.
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-6 text-xs font-semibold text-[#f2d892] underline opacity-80 hover:opacity-100"
        >
          Sair
        </button>
      </div>
    </div>
  )
}
