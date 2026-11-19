import { useEffect, useMemo, useRef, useState } from 'react'
import { ApresentacaoEmpresa } from '@/components/marketing/apresentacao-empresa/ApresentacaoEmpresa'
import type { ApresentacaoConteudoValor } from '@/components/marketing/apresentacao-empresa/ApresentacaoConteudoContext'
import {
  CONTEUDO_NEUTRO,
  PONTUA_NEUTRO,
  aplicarNome,
  resolverPontua,
  type PontuaInterface,
} from '@/components/marketing/apresentacao-empresa/apresentacao-conteudo'
import { MARCA_PADRAO_LOGO } from '@/lib/marca-padrao'

/** Largura de referência (desktop) em que o banner é desenhado antes de ser reduzido para caber. */
const LARGURA = 1280
const ALTURA = 720
const NOME_EXEMPLO = 'Sua empresa'

/**
 * Prévia do banner principal da Pontua para uma interface, com conteúdo de exemplo (o master não lê o
 * texto salvo da empresa-modelo: a RLS isola). É o mesmo `ApresentacaoEmpresa` do editor da empresa,
 * então o que se vê aqui é o que a empresa recebe. Carregado com `lazy()` por trazer a cena Three.js.
 */
export default function PontuaInterfacePreview({ interfaceId }: { interfaceId: PontuaInterface }) {
  const caixaRef = useRef<HTMLDivElement>(null)
  const [escala, setEscala] = useState(0.5)

  useEffect(() => {
    const el = caixaRef.current
    if (!el) return
    const ajustar = () => setEscala(Math.max(0.2, el.clientWidth / LARGURA))
    ajustar()
    const ro = new ResizeObserver(ajustar)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const valor = useMemo<ApresentacaoConteudoValor>(
    () => ({
      conteudo: aplicarNome(CONTEUDO_NEUTRO, NOME_EXEMPLO),
      pontua: resolverPontua({ ...PONTUA_NEUTRO, interface: interfaceId }, NOME_EXEMPLO),
      empresaId: null,
      publicPath: null,
      previa: true,
      nomeEmpresa: NOME_EXEMPLO,
      nomePrograma: `Pontua ${NOME_EXEMPLO}`,
      logoUrl: MARCA_PADRAO_LOGO,
    }),
    [interfaceId],
  )

  return (
    <div
      ref={caixaRef}
      className="relative w-full overflow-hidden rounded-md border border-[var(--m-line)] bg-black"
      style={{ height: ALTURA * escala }}
      role="img"
      aria-label={`Pré-visualização da Pontua, interface ${interfaceId === 'classica' ? 'clássica' : 'sem marca'}`}
    >
      {/* transform cria o bloco de contenção (elementos fixed da página ficam dentro da prévia) */}
      <div
        className="pointer-events-none absolute left-0 top-0 origin-top-left"
        style={{ width: LARGURA, height: ALTURA, transform: `scale(${escala})` }}
        aria-hidden
      >
        {/* key: ao trocar a interface a cena 3D é recriada (o cleanup devolve o contexto WebGL) */}
        <ApresentacaoEmpresa key={interfaceId} conteudo={valor} semIntro somentePontua />
      </div>
    </div>
  )
}
