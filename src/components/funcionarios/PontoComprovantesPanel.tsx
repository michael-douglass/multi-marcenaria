import { useMemo, useState } from 'react'
import { FileText, Loader2, Printer } from 'lucide-react'
import { AnexoLightbox } from '@/components/contas-pagar/AnexoLightbox'
import {
  imprimirPontoComprovantes,
  marcacaoIdFromComprovantePath,
  prepararComprovantesPonto,
} from '@/lib/funcionario-ponto-comprovante'
import {
  filterMarcacoesNoPeriodo,
  formatHoraPonto,
  labelPontoTipo,
  periodoMesCorrente,
  periodoSemanaCorrente,
  pontoDataLocal,
  PONTO_TIMEZONE,
} from '@/lib/funcionario-ponto'
import type { FuncionarioDocumento, PontoMarcacao } from '@/types'

interface Props {
  funcionarioNome: string
  marcacoes: PontoMarcacao[]
  documentos: FuncionarioDocumento[]
  repCnpj?: string | null
}

type PeriodoPreset = 'semana' | 'mes' | 'personalizado'

export function PontoComprovantesPanel({
  funcionarioNome,
  marcacoes,
  documentos,
  repCnpj,
}: Props) {
  const hoje = pontoDataLocal()
  const mes = periodoMesCorrente()
  const [preset, setPreset] = useState<PeriodoPreset>('mes')
  const [de, setDe] = useState(mes.de)
  const [ate, setAte] = useState(mes.ate)
  const [imprimindo, setImprimindo] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<FuncionarioDocumento | null>(null)

  const marcacoesNoPeriodo = useMemo(
    () => filterMarcacoesNoPeriodo(marcacoes, de, ate),
    [marcacoes, de, ate],
  )

  const docsNoPeriodo = useMemo(() => {
    const ids = new Set(marcacoesNoPeriodo.map(m => m.id))
    return documentos.filter(doc => {
      const id = marcacaoIdFromComprovantePath(doc.storage_path)
      return id != null && ids.has(id)
    })
  }, [documentos, marcacoesNoPeriodo])

  const aplicarPreset = (p: PeriodoPreset) => {
    setPreset(p)
    if (p === 'semana') {
      const per = periodoSemanaCorrente()
      setDe(per.de)
      setAte(per.ate)
    } else if (p === 'mes') {
      const per = periodoMesCorrente()
      setDe(per.de)
      setAte(per.ate)
    }
  }

  const imprimirPeriodo = async (lista: PontoMarcacao[]) => {
    if (!lista.length) return
    setImprimindo(true)
    try {
      const inputs = await prepararComprovantesPonto(funcionarioNome, lista, repCnpj)
      imprimirPontoComprovantes(inputs)
    } finally {
      setImprimindo(false)
    }
  }

  const imprimirUma = async (marcacaoId: string) => {
    const m = marcacoes.find(x => x.id === marcacaoId)
    if (!m) return
    await imprimirPeriodo([m])
  }

  return (
    <div className="space-y-4">
      <div className="glass-card space-y-4 p-5">
        <h3 className="font-display text-lg text-[#f2d892]">Gerar comprovantes</h3>
        <p className="text-sm text-[#b8957f]">
          PDF timbrado com nome, selfie, assinatura e localização de cada batida.
          Use &quot;Salvar como PDF&quot; na janela de impressão.
        </p>

        <div className="flex flex-wrap gap-2">
          {(['semana', 'mes', 'personalizado'] as const).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => aplicarPreset(p)}
              className={`rounded-lg px-3 py-1.5 text-xs uppercase tracking-wider ${
                preset === p
                  ? 'bg-[rgba(240,210,140,0.14)] text-[#f2d892]'
                  : 'border border-[rgba(212,168,83,0.2)] text-[#b8957f] hover:text-[#edd9c4]'
              }`}
            >
              {p === 'semana' ? 'Esta semana' : p === 'mes' ? 'Este mês' : 'Dias específicos'}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="section-label">De</span>
            <input
              type="date"
              className="glass-input w-full"
              value={de}
              max={ate}
              onChange={e => {
                setPreset('personalizado')
                setDe(e.target.value)
              }}
            />
          </label>
          <label className="block space-y-1">
            <span className="section-label">Até</span>
            <input
              type="date"
              className="glass-input w-full"
              value={ate}
              min={de}
              max={hoje}
              onChange={e => {
                setPreset('personalizado')
                setAte(e.target.value)
              }}
            />
          </label>
        </div>

        <button
          type="button"
          className="btn btn-gold"
          disabled={imprimindo || marcacoesNoPeriodo.length === 0}
          onClick={() => void imprimirPeriodo(marcacoesNoPeriodo)}
        >
          {imprimindo ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
          Imprimir {marcacoesNoPeriodo.length} comprovante(s) do período
        </button>
      </div>

      {marcacoesNoPeriodo.length === 0 && (
        <p className="text-sm text-[#b8957f]">Nenhuma batida no período selecionado.</p>
      )}

      <ul className="space-y-2">
        {marcacoesNoPeriodo.map(m => {
          const doc = docsNoPeriodo.find(
            d => marcacaoIdFromComprovantePath(d.storage_path) === m.id,
          )
          const dia = new Date(m.registrado_em).toLocaleDateString('pt-BR', {
            timeZone: PONTO_TIMEZONE,
          })

          return (
            <li
              key={m.id}
              className="glass-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm text-[#f2d892]">
                  {labelPontoTipo(m.tipo)}
                  <span className="ml-2 text-[#b8957f]">NSR {m.nsr}</span>
                </p>
                <p className="text-xs text-[#b8957f]">
                  {dia} · {formatHoraPonto(m.registrado_em)}
                  {m.latitude != null && m.longitude != null && ' · com localização'}
                </p>
                {doc && (
                  <p className="mt-1 truncate text-xs text-[#6b5344]">{doc.nome_arquivo}</p>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-gold btn-sm"
                  disabled={imprimindo}
                  onClick={() => void imprimirUma(m.id)}
                >
                  <Printer size={14} />
                  Imprimir PDF
                </button>
                {doc && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setPreviewDoc(doc)}
                  >
                    <FileText size={14} />
                    Arquivo salvo
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {previewDoc && (
        <AnexoLightbox
          open
          imageUrl={previewDoc.previewSignedUrl ?? previewDoc.signedUrl ?? ''}
          title={previewDoc.nome_arquivo}
          kind={previewDoc.kind}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  )
}
