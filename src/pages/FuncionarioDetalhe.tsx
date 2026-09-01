import { useState, useEffect } from 'react'
import { ArrowLeft, Clock, FileText, FolderOpen, Link2, Receipt, UserMinus } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useFuncionarioDetalhe } from '@/hooks/useFuncionarioDetalhe'
import { useFuncionarios } from '@/hooks/useFuncionarios'
import { useUsuarios } from '@/hooks/useUsuarios'
import { useApp } from '@/context/AppContext'
import { FuncionarioAdmissaoForm } from '@/components/funcionarios/FuncionarioAdmissaoForm'
import { FuncionarioDocumentosPanel } from '@/components/funcionarios/FuncionarioDocumentosPanel'
import { FuncionarioMeusDocumentosForm } from '@/components/funcionarios/FuncionarioMeusDocumentosForm'
import { FuncionarioPontoPanel } from '@/components/funcionarios/FuncionarioPontoPanel'
import { FuncionarioRecibosPanel } from '@/components/funcionarios/FuncionarioRecibosPanel'
import { FuncionarioVinculosPanel } from '@/components/funcionarios/FuncionarioVinculosPanel'
import { FuncionariosPageAura } from '@/components/funcionarios/FuncionariosPageAura'
import { LoadingState, ErrorState } from '@/components/ui/EmptyState'
import { buildAdmissaoSavePayload } from '@/lib/funcionario-admissao-api'
import { isAdministrador, isPastaPontoRegistrosRestrita, podeEditarPontoRegistrosTerceiro } from '@/lib/role-access'
import { FUNCIONARIO_TIPO_LABEL } from '@/lib/funcionario-constants'
import type { FuncionarioAdmissaoDados, FuncionarioInput, MeuFuncionarioPayload } from '@/types'

type Tab = 'vinculos' | 'admissao' | 'documentos' | 'recibos' | 'ponto'

const TABS: { id: Tab; label: string; icon: typeof FolderOpen }[] = [
  { id: 'vinculos', label: 'Vínculos', icon: Link2 },
  { id: 'admissao', label: 'Admissão', icon: FileText },
  { id: 'ponto', label: 'Ponto', icon: Clock },
  { id: 'documentos', label: 'Documentos', icon: FolderOpen },
  { id: 'recibos', label: 'Recibos', icon: Receipt },
]

interface Props {
  readOnly?: boolean
}

export function FuncionarioDetalhe({ readOnly }: Props) {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const abaOrigem = searchParams.get('aba')
  const tabParam = searchParams.get('tab')
  const tabInicial: Tab =
    tabParam === 'vinculos'
    || tabParam === 'admissao'
    || tabParam === 'documentos'
    || tabParam === 'recibos'
    || tabParam === 'ponto'
      ? tabParam
      : 'vinculos'
  const { roles, user } = useApp()
  const pastaPontoRestrita = isPastaPontoRegistrosRestrita(roles)
  const { funcionario, documentos, recibos, contasPagar, valorFixoMensal, loading, error, reload, applyLocalPatch } = useFuncionarioDetalhe(id)
  const { update, dispensar } = useFuncionarios()
  const { data: usuarios } = useUsuarios()
  const [tab, setTab] = useState<Tab>(pastaPontoRestrita ? 'ponto' : tabInicial)
  const [saving, setSaving] = useState(false)
  const [dispensando, setDispensando] = useState(false)

  useEffect(() => {
    if (pastaPontoRestrita && tab !== 'ponto') setTab('ponto')
  }, [pastaPontoRestrita, tab])

  if (loading) return <LoadingState />
  if (error || !funcionario) return <ErrorState message={error ?? 'Funcionário não encontrado.'} />

  const somenteHistorico = !funcionario.ativo
  const edicaoBloqueada = readOnly || somenteHistorico
  const podeGerenciarAdmissao = isAdministrador(roles) && !edicaoBloqueada

  const handleUpdate = async (input: Partial<FuncionarioInput>) => {
    if (!id || edicaoBloqueada) return
    // Atualiza a tela na hora (sem “piscar”) e grava no banco em segundo plano.
    applyLocalPatch(input)
    setSaving(true)
    try {
      await update(id, input)
      if (input.usuario_id !== undefined) {
        await reload({ silent: true })
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDispensar = async () => {
    if (!id || !funcionario.ativo || !isAdministrador(roles)) return
    const ok = window.confirm(
      `Dispensar ${funcionario.nome}?\n\nEle sairá do ponto e das listagens ativas, mas documentos, recibos e batidas antigas serão mantidos no histórico.`,
    )
    if (!ok) return
    setDispensando(true)
    try {
      await dispensar(id)
      navigate('/funcionarios?aba=dispensados')
    } finally {
      setDispensando(false)
    }
  }

  const documentosAdmissao = documentos.filter(d => d.categoria === 'admissao')
  const admissaoPayload: MeuFuncionarioPayload = {
    id: funcionario.id,
    nome: funcionario.nome,
    tipo: funcionario.tipo,
    cpf: funcionario.cpf,
    telefone: funcionario.telefone,
    email: funcionario.email,
    admissao_status: funcionario.admissao_status,
    admissao_dados: funcionario.admissao_dados ?? {},
    foto_perfil_path: funcionario.foto_perfil_path,
    documentos: documentosAdmissao.map(d => ({
      id: d.id,
      tipo_documento: d.tipo_documento,
      nome_arquivo: d.nome_arquivo,
      kind: d.kind,
      storage_path: d.storage_path,
      preview_path: d.preview_path,
      preview_paths: d.preview_paths,
      criado_em: d.criado_em,
    })),
  }

  const salvarAdmissaoRh = async (dados: FuncionarioAdmissaoDados, finalizar: boolean) => {
    await handleUpdate(
      buildAdmissaoSavePayload(
        dados,
        funcionario.admissao_dados ?? {},
        funcionario.admissao_status,
        finalizar,
      ),
    )
  }

  return (
    <div className="cobrancas-page-shell funcionarios-page-shell fade-in relative -mx-2 -mt-2 min-h-[calc(100svh-4.25rem)] px-3 pb-10 sm:-mx-3 sm:-mt-3 sm:px-4 md:px-8">
      <FuncionariosPageAura />
      <div className="relative z-[1] mx-auto max-w-6xl pt-4 md:pt-8">
      <Link
        to={abaOrigem === 'dispensados' ? '/funcionarios?aba=dispensados' : '/funcionarios'}
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-[#4a3428] hover:text-[#6b3f12]"
      >
        <ArrowLeft size={16} />
        Voltar às pastas
      </Link>

      {somenteHistorico && (
        <div className="glass-card mb-5 border border-violet-800/25 bg-violet-50 p-4">
          <p className="font-medium text-violet-900">Funcionário dispensado</p>
          <p className="mt-1 text-sm text-[#4a3428]">
            Esta pasta é somente leitura. O histórico de ponto, documentos e recibos foi preservado.
            {funcionario.dispensado_em && (
              <> Dispensado em {new Date(funcionario.dispensado_em).toLocaleString('pt-BR')}.</>
            )}
          </p>
        </div>
      )}

      <header className="mb-6 overflow-hidden rounded-2xl border border-[rgba(26,16,12,0.12)] bg-[#fffaf4] px-5 py-6 shadow-[0_12px_32px_rgba(42,24,18,0.06)] sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="relative pl-4">
            <div className="absolute left-0 top-1 h-[calc(100%-0.25rem)] w-1 rounded-full bg-gradient-to-b from-[#c4963a] to-[#6b3f12]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6b3f12]">
              {FUNCIONARIO_TIPO_LABEL[funcionario.tipo]}
            </p>
            <h1 className="mt-1 font-display text-3xl tracking-wide text-[#1a100c] sm:text-5xl">{funcionario.nome}</h1>
          </div>
          {funcionario.ativo && isAdministrador(roles) && !readOnly && (
            <button
              type="button"
              className="btn btn-outline border-red-800/40 text-red-800 hover:bg-red-50"
              disabled={dispensando}
              onClick={() => void handleDispensar()}
            >
              <UserMinus size={16} />
              {dispensando ? 'Dispensando…' : 'Dispensar funcionário'}
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row">
        <nav className="flex shrink-0 flex-row gap-1 overflow-x-auto rounded-xl border border-[rgba(26,16,12,0.12)] bg-[#fffaf4] p-1 lg:w-52 lg:flex-col">
          {(pastaPontoRestrita ? TABS.filter(t => t.id === 'ponto') : TABS).map(t => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 rounded-lg px-4 py-3 text-left text-sm font-medium transition ${
                  active
                    ? 'bg-[#f4e4c4] text-[#6b3f12]'
                    : 'text-[#4a3428] hover:bg-[rgba(26,16,12,0.04)] hover:text-[#1a100c]'
                }`}
              >
                <Icon size={16} />
                {t.label}
                {t.id === 'recibos' && recibos.filter(r => r.status !== 'assinado').length > 0 && (
                  <span className="ml-auto rounded-full bg-amber-100 px-1.5 text-[0.6rem] font-semibold text-amber-900">
                    {recibos.filter(r => r.status !== 'assinado').length}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="min-w-0 flex-1">
          {!pastaPontoRestrita && tab === 'vinculos' && (
            <FuncionarioVinculosPanel
              funcionario={funcionario}
              usuarios={usuarios}
              contasPagar={contasPagar}
              readOnly={edicaoBloqueada}
              onUpdate={handleUpdate}
              saving={saving}
            />
          )}
          {!pastaPontoRestrita && tab === 'admissao' && (
            <div className="space-y-8">
              <FuncionarioAdmissaoForm
                funcionario={funcionario}
                salarioFixoMensal={valorFixoMensal}
                readOnly={edicaoBloqueada}
                onUpdate={handleUpdate}
                saving={saving}
              />
              {podeGerenciarAdmissao && (
                <FuncionarioMeusDocumentosForm
                  mode="rh"
                  payload={admissaoPayload}
                  documentosAdmissao={documentosAdmissao}
                  permiteSubstituirDocumentos
                  onSaveRh={salvarAdmissaoRh}
                  onReload={() => void reload()}
                />
              )}
            </div>
          )}
          {tab === 'ponto' && (
            <FuncionarioPontoPanel
              funcionarioId={funcionario.id}
              funcionarioNome={funcionario.nome}
              funcionarioTipo={funcionario.tipo}
              funcionarioCpf={funcionario.cpf}
              documentos={documentos}
              admissaoDados={funcionario.admissao_dados}
              readOnly={edicaoBloqueada}
              somenteRegistros={pastaPontoRestrita}
              podeEditarRegistros={
                !edicaoBloqueada
                && podeEditarPontoRegistrosTerceiro(roles, funcionario.usuario_id, user?.id)
              }
              onReload={() => void reload()}
              onSyncAdmissaoHorarios={
                pastaPontoRestrita
                  ? undefined
                  : async patch => {
                      await handleUpdate({
                        admissao_dados: {
                          ...(funcionario.admissao_dados ?? {}),
                          ...patch,
                        },
                      })
                    }
              }
            />
          )}
          {!pastaPontoRestrita && tab === 'documentos' && (
            <FuncionarioDocumentosPanel
              funcionarioId={funcionario.id}
              funcionarioNome={funcionario.nome}
              funcionarioCpf={funcionario.cpf}
              funcionarioTelefone={funcionario.telefone}
              funcionarioEmail={funcionario.email}
              admissaoDados={funcionario.admissao_dados}
              salarioFixoMensal={valorFixoMensal}
              documentos={documentos}
              readOnly={edicaoBloqueada}
              onReload={() => void reload()}
            />
          )}
          {!pastaPontoRestrita && tab === 'recibos' && (
            <FuncionarioRecibosPanel
              recibos={recibos}
              readOnly={edicaoBloqueada}
              onReload={() => void reload()}
            />
          )}
        </div>
      </div>
      </div>
    </div>
  )
}
