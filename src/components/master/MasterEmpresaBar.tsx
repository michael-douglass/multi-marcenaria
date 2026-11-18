import { useEffect, useState } from 'react'
import { Eye, Loader2, LogOut, PencilLine } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from '@/context/AppContext'

/**
 * Faixa de inspeção: aparece só quando o master está dentro de uma marcenaria.
 * Âmbar = somente leitura (o banco recusa alterações); tijolo = acesso total. "Sair" volta ao console.
 */
export function MasterEmpresaBar() {
  const { isMaster, empresa, sairInspecao } = useApp()
  const [saindo, setSaindo] = useState(false)

  // O cliente Supabase avisa quando o banco recusa uma gravação durante a inspeção somente leitura.
  useEffect(() => {
    const aviso = () =>
      toast.warning('Modo somente leitura: a alteração não foi salva. Saia e entre com acesso total para alterar.')
    window.addEventListener('master:somente-leitura', aviso)
    return () => window.removeEventListener('master:somente-leitura', aviso)
  }, [])

  if (!isMaster || !empresa) return null
  const leitura = empresa.somenteLeitura
  const bloqueadas = empresa.paginasBloqueadas.length

  const sair = async () => {
    setSaindo(true)
    try {
      await sairInspecao()
    } catch (err) {
      setSaindo(false)
      toast.error(err instanceof Error ? err.message : 'Não foi possível sair da marcenaria')
    }
  }

  return (
    <div
      role="status"
      className={
        leitura
          ? 'relative z-[2] flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#e0a54a] bg-[#fff1d6] px-3 py-2 text-[13px] text-[#4a2c00] sm:px-5'
          : 'relative z-[2] flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#7a2318] bg-[#9b2f22] px-3 py-2 text-[13px] text-white sm:px-5'
      }
    >
      <span className="inline-flex items-center gap-2 font-semibold">
        {leitura ? <Eye className="h-4 w-4" aria-hidden /> : <PencilLine className="h-4 w-4" aria-hidden />}
        {leitura ? 'Somente leitura' : 'Acesso total'}
      </span>
      <span>
        Você está dentro de <strong>{empresa.nome}</strong>
        {leitura ? ', sem poder alterar nada.' : ' e suas alterações valem de verdade.'}
      </span>
      {bloqueadas > 0 ? (
        <span className="opacity-80">
          {bloqueadas} {bloqueadas === 1 ? 'página bloqueada' : 'páginas bloqueadas'} para esta marcenaria.
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => void sair()}
        disabled={saindo}
        className={
          leitura
            ? 'ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[#b9852f] px-3 font-semibold hover:bg-[#ffe6b3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a5200]'
            : 'ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-md border border-white/50 px-3 font-semibold hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white'
        }
      >
        {saindo ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <LogOut className="h-4 w-4" aria-hidden />}
        Sair da marcenaria
      </button>
    </div>
  )
}
