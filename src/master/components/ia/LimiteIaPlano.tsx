import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { erroMsg } from '@/components/master/master-utils'
import { useSalvarLimiteIaPlano, type Plano } from '@/hooks/useMaster'
import { FUNCAO_IA_CARD_LEAD } from '@/lib/paginas-catalogo'
import { Painel } from '@/master/components/MasterUi'
import { tokensBR } from '@/master/components/ia/ConsumoIaPainel'

/** Limite mensal de tokens de IA do plano. Vazio = sem limite. Cada marcenaria pode ter ajuste próprio. */
export function LimiteIaPlano({ plano }: { plano: Plano }) {
  const salvar = useSalvarLimiteIaPlano()
  const atual = plano.ia_tokens_limite_mensal
  const [valor, setValor] = useState(atual == null ? '' : String(atual))
  useEffect(() => setValor(atual == null ? '' : String(atual)), [atual, plano.id])

  const bloqueada = plano.paginas_bloqueadas.includes(FUNCAO_IA_CARD_LEAD)
  const novo = valor.trim() === '' ? null : Math.max(0, Math.floor(Number(valor) || 0)) || null
  const sujo = novo !== atual

  return (
    <Painel
      titulo="Limite de tokens de IA"
      descricao={
        bloqueada
          ? 'A função “IA no card lead” está desligada neste plano; o limite só vale depois de ligá-la nas páginas abaixo.'
          : 'Tokens por mês que cada marcenaria deste plano pode gastar na IA do card do lead. Ao estourar, a renderização é bloqueada até o mês virar.'
      }
      className="mb-6"
      acao={
        <Button
          disabled={!sujo || salvar.isPending}
          onClick={async () => {
            try {
              await salvar.mutateAsync({ planoId: plano.id, limite: novo })
              toast.success(novo == null ? 'Plano sem limite de tokens.' : `Limite do plano: ${tokensBR(novo)} tokens/mês.`)
            } catch (err) {
              toast.error(erroMsg(err, 'Não foi possível salvar o limite'))
            }
          }}
        >
          {salvar.isPending ? 'Salvando…' : 'Salvar limite'}
        </Button>
      }
    >
      <div className="max-w-[22rem] space-y-1.5">
        <Label htmlFor={`limite-ia-${plano.id}`}>Tokens por mês por marcenaria</Label>
        <Input
          id={`limite-ia-${plano.id}`}
          type="number"
          min={0}
          inputMode="numeric"
          placeholder="Sem limite"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
        />
        <p className="text-[0.78rem] text-[var(--m-ink-2)]">Deixe vazio para não limitar.</p>
      </div>
    </Painel>
  )
}
