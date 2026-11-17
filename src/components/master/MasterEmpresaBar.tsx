import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Crown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from '@/context/AppContext'
import { useMasterEmpresas } from '@/hooks/useMaster'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

/**
 * Faixa visível só para o usuário master: mostra em qual marcenaria ele está trabalhando,
 * permite trocar de empresa e leva ao Painel Master.
 */
export function MasterEmpresaBar() {
  const { isMaster, empresa, trocarEmpresa } = useApp()
  const { data: empresas = [], isLoading } = useMasterEmpresas(isMaster)
  const [trocando, setTrocando] = useState(false)

  if (!isMaster) return null

  const onTrocar = async (id: string) => {
    if (id === empresa?.id) return
    setTrocando(true)
    try {
      await trocarEmpresa(id)
    } catch (err) {
      setTrocando(false)
      toast.error(err instanceof Error ? err.message : 'Não foi possível trocar de empresa')
    }
  }

  return (
    <div className="relative z-[2] flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-amber-500/30 bg-amber-950/70 px-3 py-2 text-xs text-amber-100 sm:px-5">
      <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-[0.14em] text-amber-300">
        <Crown className="h-3.5 w-3.5" aria-hidden />
        Master
      </span>
      <span className="inline-flex items-center gap-1.5 text-amber-100/80">
        <Building2 className="h-3.5 w-3.5" aria-hidden />
        Você está vendo:
      </span>
      <div className="min-w-[12rem] max-w-[18rem] flex-1 sm:flex-none">
        <Select value={empresa?.id} onValueChange={(v) => void onTrocar(v)} disabled={trocando || isLoading}>
          <SelectTrigger className="h-8 border-amber-500/40 bg-black/30 text-xs text-amber-50">
            <SelectValue placeholder={empresa?.nome ?? 'Selecione a empresa'} />
          </SelectTrigger>
          <SelectContent>
            {empresas.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.nome}
                {e.status !== 'ativa' ? ` (${e.status})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {trocando ? <Loader2 className="h-4 w-4 animate-spin text-amber-300" aria-label="Trocando de empresa" /> : null}
      <Link
        to="/master"
        className="ml-auto inline-flex min-h-8 items-center rounded-md border border-amber-500/40 px-3 font-semibold text-amber-200 transition-colors hover:bg-amber-500/15"
      >
        Painel Master
      </Link>
    </div>
  )
}
