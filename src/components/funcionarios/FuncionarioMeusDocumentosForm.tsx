import { useEffect, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Upload } from 'lucide-react'
import { Field } from '@/components/ui/Field'
import { ValeTransporteFields } from '@/components/funcionarios/ValeTransporteFields'
import { salvarMeuFuncionario } from '@/lib/meu-perfil-api'
import { buildAdmissaoSavePayload } from '@/lib/funcionario-admissao-api'
import { ADMISSAO_DOC_TIPOS, ADMISSAO_STATUS_LABEL } from '@/lib/funcionario-constants'
import {
  buildPendingFuncionarioDoc,
  deleteFuncionarioDocumento,
  revokePendingFuncionarioDocUrls,
  uploadFuncionarioDocumento,
} from '@/lib/funcionario-documentos'
import type { FuncionarioAdmissaoDados, FuncionarioDocumento, MeuFuncionarioPayload } from '@/types'

interface Props {
  payload: MeuFuncionarioPayload
  onReload: () => void
  mode?: 'self' | 'rh'
  readOnly?: boolean
  onSaveRh?: (dados: FuncionarioAdmissaoDados, finalizar: boolean) => Promise<void>
  documentosAdmissao?: FuncionarioDocumento[]
  permiteSubstituirDocumentos?: boolean
}

type Step = 1 | 2 | 3

export function FuncionarioMeusDocumentosForm({
  payload,
  onReload,
  mode = 'self',
  readOnly = false,
  onSaveRh,
  documentosAdmissao = [],
  permiteSubstituirDocumentos = false,
}: Props) {
  const isRh = mode === 'rh'
  const [step, setStep] = useState<Step>(1)
  const [dados, setDados] = useState<FuncionarioAdmissaoDados>(payload.admissao_dados ?? {})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** Prestador sempre pode editar dados e anexar docs; só o modo RH respeita readOnly. */
  const bloqueado = isRh ? readOnly : false
  const jaEnviadoRh =
    !isRh
    && (payload.admissao_status === 'preenchido_funcionario' || payload.admissao_status === 'completo')
  const [enviado, setEnviado] = useState(jaEnviadoRh)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    setDados(payload.admissao_dados ?? {})
  }, [payload.id, payload.admissao_dados])

  useEffect(() => {
    setEnviado(jaEnviadoRh)
  }, [jaEnviadoRh])

  const setDado = (key: keyof FuncionarioAdmissaoDados, value: string | boolean) => {
    setDados(prev => ({ ...prev, [key]: value }))
  }

  const patchDados = (patch: Partial<FuncionarioAdmissaoDados>) => {
    setDados(prev => ({ ...prev, ...patch }))
  }

  const docsEnviados = new Set(payload.documentos.map(d => d.tipo_documento))
  const qtdPorTipo = payload.documentos.reduce<Record<string, number>>((acc, d) => {
    acc[d.tipo_documento] = (acc[d.tipo_documento] ?? 0) + 1
    return acc
  }, {})
  const paginasPorTipo = payload.documentos.reduce<Record<string, number>>((acc, d) => {
    const paginas =
      Array.isArray(d.preview_paths) && d.preview_paths.length > 0
        ? d.preview_paths.length
        : 1
    acc[d.tipo_documento] = (acc[d.tipo_documento] ?? 0) + paginas
    return acc
  }, {})
  const progress = Math.round(
    (ADMISSAO_DOC_TIPOS.filter(d => docsEnviados.has(d.id)).length / ADMISSAO_DOC_TIPOS.length) * 100,
  )
  /** Prestador pode anexar vários arquivos do mesmo tipo; só o RH substitui/exclui. */
  const podeAdicionarMais = !isRh

  const dadosParaSalvar = (): FuncionarioAdmissaoDados => ({
    ...dados,
    cpf: dados.cpf ?? payload.cpf ?? undefined,
    telefone: dados.telefone ?? payload.telefone ?? undefined,
    email: dados.email_pessoal ?? payload.email ?? undefined,
  })

  const salvarRascunho = async () => {
    setSaving(true)
    setError(null)
    try {
      const payloadDados = dadosParaSalvar()
      if (isRh) {
        if (!onSaveRh) throw new Error('Salvamento indisponível.')
        await onSaveRh(payloadDados, false)
      } else {
        await salvarMeuFuncionario(payloadDados, false)
      }
      onReload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const enviarFinal = async () => {
    setSaving(true)
    setError(null)
    try {
      const payloadDados = dadosParaSalvar()
      if (isRh) {
        if (!onSaveRh) throw new Error('Salvamento indisponível.')
        await onSaveRh(payloadDados, true)
        onReload()
        return
      }
      // Se o RH já concluiu, só atualiza os dados (não tenta “finalizar” de novo).
      const finalizar = payload.admissao_status !== 'completo'
      await salvarMeuFuncionario(payloadDados, finalizar)
      setEnviado(true)
      onReload()
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar.')
    } finally {
      setSaving(false)
    }
  }

  const uploadDocs = async (tipoId: string, files: File[]) => {
    if (!files.length) return
    setUploading(tipoId)
    setError(null)
    const pendingList: Awaited<ReturnType<typeof buildPendingFuncionarioDoc>>[] = []
    try {
      const existente = documentosAdmissao.find(d => d.tipo_documento === tipoId)
        ?? payload.documentos.find(d => d.tipo_documento === tipoId)

      // RH com permissão: substitui o arquivo anterior. Prestador: só adiciona (não exclui).
      if (existente && permiteSubstituirDocumentos && documentosAdmissao.length > 0) {
        const docsDoTipo = documentosAdmissao.filter(d => d.tipo_documento === tipoId)
        for (const docCompleto of docsDoTipo) {
          await deleteFuncionarioDocumento(docCompleto)
        }
      } else if (existente && !podeAdicionarMais && !permiteSubstituirDocumentos) {
        setError('Este documento já foi enviado. Somente o administrador pode excluí-lo para reenviar.')
        return
      }

      for (const file of files) {
        const pending = await buildPendingFuncionarioDoc(file, tipoId, 'admissao')
        pendingList.push(pending)
        await uploadFuncionarioDocumento(
          payload.id,
          pending,
          isRh ? 'admin' : 'funcionario_sistema',
        )
      }
      onReload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro no upload.')
    } finally {
      revokePendingFuncionarioDocUrls(pendingList)
      setUploading(null)
    }
  }

  return (
    <div className={`fade-in ${isRh ? 'w-full' : 'mx-auto max-w-2xl'}`}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="section-label">Formulário de admissão</p>
          <h2 className="font-display mt-1 text-2xl tracking-wide text-[#f2d892]">
            {isRh ? `Dados de ${payload.nome}` : 'Meus documentos'}
          </h2>
          {isRh && (
            <p className="mt-1 text-sm text-[#b8957f]">
              Preencha em nome do colaborador e anexe os documentos solicitados.
            </p>
          )}
        </div>
        <span className="rounded-full border border-[rgba(212,168,83,0.3)] px-3 py-1 text-xs text-[#edd9c4]">
          {ADMISSAO_STATUS_LABEL[payload.admissao_status]}
        </span>
      </div>

      <div className="mb-8 flex justify-center gap-2">
        {[1, 2, 3].map(n => (
          <div
            key={n}
            className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition ${
              step === n
                ? 'border-[#f2d892] bg-[rgba(242,216,146,0.15)] text-[#f2d892]'
                : step > n
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                  : 'border-[rgba(212,168,83,0.2)] text-[#b8957f]'
            }`}
          >
            {step > n ? <Check size={16} /> : n}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="glass-card space-y-4 p-6">
          <h3 className="font-semibold text-[#f2d892]">Dados pessoais</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="CPF">
              <input
                className="glass-input"
                disabled={bloqueado}
                value={String(dados.cpf ?? payload.cpf ?? '')}
                onChange={e => setDado('cpf', e.target.value)}
              />
            </Field>
            <Field label="PIS">
              <input
                className="glass-input"
                disabled={bloqueado}
                value={dados.pis ?? ''}
                onChange={e => setDado('pis', e.target.value)}
              />
            </Field>
            <Field label="Telefone">
              <input
                className="glass-input"
                disabled={bloqueado}
                value={String(dados.telefone ?? payload.telefone ?? '')}
                onChange={e => setDado('telefone', e.target.value)}
              />
            </Field>
            <Field label="E-mail">
              <input
                type="email"
                className="glass-input"
                disabled={bloqueado}
                value={dados.email_pessoal ?? payload.email ?? ''}
                onChange={e => setDado('email_pessoal', e.target.value)}
              />
            </Field>
            <Field label="Endereço completo">
              <input
                className="glass-input"
                disabled={bloqueado}
                value={dados.endereco ?? ''}
                onChange={e => setDado('endereco', e.target.value)}
              />
            </Field>
            <Field label="Escolaridade">
              <select
                className="glass-input"
                disabled={bloqueado}
                value={dados.escolaridade ?? ''}
                onChange={e => setDado('escolaridade', e.target.value)}
              >
                <option value="">— Selecione —</option>
                <option value="1o_grau">1º Grau</option>
                <option value="2o_grau">2º Grau</option>
                <option value="superior">Superior</option>
              </select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-[#edd9c4]">
            <input
              type="checkbox"
              disabled={bloqueado}
              checked={!!dados.tem_filhos}
              onChange={e => setDado('tem_filhos', e.target.checked)}
            />
            Possuo filho(a) menor
          </label>
          {dados.tem_filhos && (
            <Field label="Informações sobre filhos">
              <textarea
                className="glass-input min-h-[80px]"
                disabled={bloqueado}
                value={dados.filhos_info ?? ''}
                onChange={e => setDado('filhos_info', e.target.value)}
              />
            </Field>
          )}
          <div className="border-t border-[rgba(212,168,83,0.2)] pt-4">
            <h4 className="mb-3 text-sm font-medium text-[#f2d892]">Vale-transporte</h4>
            <ValeTransporteFields
              dados={dados}
              disabled={bloqueado}
              onChange={(key, value) => setDado(key, value)}
              onPatch={patchDados}
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="glass-card p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="font-semibold text-[#f2d892]">Documentos solicitados</h3>
            <span className="text-sm text-[#b8957f]">{progress}% enviado</span>
          </div>
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-[rgba(0,0,0,0.3)]">
            <div className="h-full bg-gradient-to-r from-[#c9a045] to-[#f2d892] transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mb-4 text-xs text-[#b8957f]">
            Envie PDF ou foto (JPG, PNG, WebP). Pode enviar vários arquivos do mesmo item.
            {podeAdicionarMais && ' Depois de enviar, não é possível excluir — só o administrador remove.'}
          </p>
          <div className="space-y-3">
            {ADMISSAO_DOC_TIPOS.map(doc => {
              const enviadoDoc = docsEnviados.has(doc.id)
              const qtd = qtdPorTipo[doc.id] ?? 0
              const paginas = paginasPorTipo[doc.id] ?? 0
              const podeEnviar =
                !bloqueado && (!enviadoDoc || permiteSubstituirDocumentos || podeAdicionarMais)
              const rotuloBotao = (() => {
                if (uploading === doc.id) return 'Enviando…'
                if (!enviadoDoc) return 'Enviar'
                if (permiteSubstituirDocumentos) return 'Substituir'
                if (podeAdicionarMais) return 'Adicionar mais'
                return 'Enviado'
              })()
              return (
                <div
                  key={doc.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[rgba(212,168,83,0.15)] p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {enviadoDoc && <Check size={16} className="shrink-0 text-emerald-400" />}
                      <span className="text-sm text-[#f0e0d2]">{doc.label}</span>
                    </div>
                    {qtd > 0 && (
                      <p className="mt-1 text-xs text-[#b8957f]">
                        {qtd} arquivo{qtd > 1 ? 's' : ''} enviado{qtd > 1 ? 's' : ''}
                        {paginas > qtd ? ` · ${paginas} páginas` : ''}
                      </p>
                    )}
                  </div>
                  <input
                    ref={el => { fileRefs.current[doc.id] = el }}
                    type="file"
                    multiple={podeAdicionarMais || permiteSubstituirDocumentos}
                    accept="image/*,application/pdf"
                    className="hidden"
                    disabled={!podeEnviar}
                    onChange={e => {
                      const files = e.target.files ? Array.from(e.target.files) : []
                      if (files.length) void uploadDocs(doc.id, files)
                      e.target.value = ''
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={!podeEnviar || uploading === doc.id}
                    onClick={() => fileRefs.current[doc.id]?.click()}
                  >
                    <Upload size={14} />
                    {rotuloBotao}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="glass-card p-6 text-center">
          {!isRh && enviado ? (
            <>
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#d4a853] bg-[rgba(212,168,83,0.12)]">
                <Check size={28} className="text-[#f2d892]" />
              </div>
              <h3 className="font-semibold text-[#f2d892]">Documentos enviados</h3>
              <p className="mt-3 text-sm text-[#b8957f]">
                Obrigado, {payload.nome}. Você pode voltar para alterar dados ou anexar mais documentos.
                {payload.admissao_status === 'completo'
                  ? ' Sua admissão já foi concluída pelo RH.'
                  : ' Aguarde a validação da equipe.'}
              </p>
              <button
                type="button"
                className="btn btn-gold btn-lg mt-6"
                disabled={saving || bloqueado}
                onClick={() => void enviarFinal()}
              >
                {saving ? 'Salvando…' : 'Salvar alterações'}
              </button>
            </>
          ) : (
            <>
              <h3 className="font-semibold text-[#f2d892]">
                {isRh ? 'Salvar admissão' : 'Revisão e envio'}
              </h3>
              <p className="mt-3 text-sm text-[#b8957f]">
                {isRh
                  ? 'Salve o rascunho ou marque o formulário como preenchido pelo RH.'
                  : 'Confirme o envio do formulário e dos documentos para o RH.'}
              </p>
              <button
                type="button"
                className="btn btn-gold btn-lg mt-6"
                disabled={saving || bloqueado}
                onClick={() => void enviarFinal()}
              >
                {saving
                  ? 'Salvando…'
                  : isRh
                    ? 'Salvar como preenchido'
                    : 'Confirmar envio'}
              </button>
            </>
          )}
        </div>
      )}

      {!bloqueado && (
        <div className="mt-6 flex justify-between gap-3">
          {step > 1 && (
            <button type="button" className="btn btn-outline btn-md" onClick={() => setStep((step - 1) as Step)}>
              <ChevronLeft size={16} />
              Voltar
            </button>
          )}
          <div className="ml-auto flex gap-2">
            {step < 3 && (
              <>
                <button type="button" className="btn btn-outline btn-md" disabled={saving} onClick={() => void salvarRascunho()}>
                  Salvar rascunho
                </button>
                <button type="button" className="btn btn-gold btn-md" onClick={() => setStep((step + 1) as Step)}>
                  Próximo
                  <ChevronRight size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
