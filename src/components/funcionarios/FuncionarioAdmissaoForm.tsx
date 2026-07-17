import { useEffect, useRef, useState } from 'react'
import { Field } from '@/components/ui/Field'
import { DateInput } from '@/components/ui/DateInput'
import { HorariosSemanaFields } from '@/components/funcionarios/HorariosSemanaFields'
import { ValeTransporteFields } from '@/components/funcionarios/ValeTransporteFields'
import { ADMISSAO_STATUS_LABEL } from '@/lib/funcionario-constants'
import { fmtCur } from '@/lib/utils'
import type { Funcionario, FuncionarioAdmissaoDados, FuncionarioInput } from '@/types'

interface Props {
  funcionario: Funcionario
  /** Fixo mensal do usuário vinculado — preenche o salário se ainda estiver vazio. */
  salarioFixoMensal?: number | null
  readOnly?: boolean
  onUpdate: (input: Partial<FuncionarioInput>) => Promise<void>
  saving?: boolean
}

const SAVE_DEBOUNCE_MS = 450

export function FuncionarioAdmissaoForm({
  funcionario,
  salarioFixoMensal,
  readOnly,
  onUpdate,
  saving,
}: Props) {
  const [draft, setDraft] = useState<FuncionarioAdmissaoDados>(
    () => funcionario.admissao_dados ?? {},
  )
  const draftRef = useRef(draft)
  draftRef.current = draft
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seededSalarioRef = useRef(false)

  const salarioFixoFormatado =
    salarioFixoMensal != null && salarioFixoMensal > 0 ? fmtCur(salarioFixoMensal) : ''
  const salarioExibido = (draft.salario ?? '').trim() || salarioFixoFormatado

  // Ao trocar de funcionário, recarrega o rascunho.
  useEffect(() => {
    setDraft(funcionario.admissao_dados ?? {})
    seededSalarioRef.current = false
  }, [funcionario.id])

  const flushSave = (dados: FuncionarioAdmissaoDados) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    void onUpdate({ admissao_dados: dados })
  }

  const scheduleSave = (dados: FuncionarioAdmissaoDados) => {
    if (readOnly) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      void onUpdate({ admissao_dados: dados })
    }, SAVE_DEBOUNCE_MS)
  }

  // Salva o que ficou pendente se sair da tela.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        void onUpdate({ admissao_dados: draftRef.current })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só no unmount
  }, [])

  // Preenche uma vez com o fixo vinculado quando o salário ainda está vazio.
  useEffect(() => {
    if (readOnly || seededSalarioRef.current) return
    if ((draft.salario ?? '').trim()) {
      seededSalarioRef.current = true
      return
    }
    if (!salarioFixoFormatado) return
    seededSalarioRef.current = true
    const next = { ...draftRef.current, salario: salarioFixoFormatado }
    setDraft(next)
    flushSave(next)
  }, [readOnly, salarioFixoFormatado, draft.salario])

  const setDado = (key: keyof FuncionarioAdmissaoDados, value: string | boolean) => {
    setDraft(prev => {
      const next = { ...prev, [key]: value }
      scheduleSave(next)
      return next
    })
  }

  const patchDados = (patch: Partial<FuncionarioAdmissaoDados>) => {
    setDraft(prev => {
      const next = { ...prev, ...patch }
      scheduleSave(next)
      return next
    })
  }

  const marcarCompleto = async () => {
    flushSave(draftRef.current)
    await onUpdate({ admissao_status: 'completo' })
  }

  const temDadosFuncionario =
    !!(draft.pis || draft.endereco || draft.usa_vale_transporte || draft.vt_quantidade_dia)

  return (
    <div className="space-y-6">
      <div className="glass-card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-[#f2d892]">Admissão do funcionário</h3>
            <p className="mt-1 text-sm text-[#b8957f]">
              O colaborador envia documentos em <strong className="text-[#edd9c4]">Meu Perfil</strong>.
              O administrador também pode preencher o formulário e anexar documentos nesta aba.
            </p>
          </div>
          <span className="rounded-full border border-[rgba(212,168,83,0.3)] px-3 py-1 text-xs text-[#edd9c4]">
            {ADMISSAO_STATUS_LABEL[funcionario.admissao_status]}
          </span>
        </div>

        {!funcionario.usuario_id && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            Pasta sem usuário vinculado. Se o login já existir com o mesmo e-mail, o vínculo ocorre
            automaticamente. Caso contrário, crie o usuário em Configurações ou vincule manualmente abaixo.
          </p>
        )}
      </div>

      <div className="glass-card p-5">
        <h3 className="mb-4 font-semibold text-[#f2d892]">Preenchimento da empresa contratante</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Data de admissão">
            <DateInput
              disabled={readOnly}
              value={draft.data_admissao ?? ''}
              onChange={iso => setDado('data_admissao', iso ?? '')}
            />
          </Field>
          <Field label="Salário">
            <input
              className="glass-input"
              disabled={readOnly}
              value={salarioExibido}
              onChange={e => setDado('salario', e.target.value)}
              placeholder={salarioFixoFormatado || 'R$ 0,00'}
            />
            {salarioFixoFormatado && (
              <p className="mt-1 text-xs text-[#b8957f]">
                Valor do fixo do usuário vinculado em Vínculos. Pode alterar.
              </p>
            )}
          </Field>
          <Field label="Função">
            <input
              className="glass-input"
              disabled={readOnly}
              value={draft.funcao ?? ''}
              onChange={e => setDado('funcao', e.target.value)}
            />
          </Field>
          <Field label="Telefone">
            <input
              className="glass-input"
              disabled={readOnly}
              value={draft.telefone_empresa ?? ''}
              onChange={e => setDado('telefone_empresa', e.target.value)}
            />
          </Field>
          <Field label="E-mail">
            <input
              type="email"
              className="glass-input"
              disabled={readOnly}
              value={draft.email_pessoal ?? funcionario.email ?? ''}
              onChange={e => setDado('email_pessoal', e.target.value)}
            />
          </Field>
          <Field label="Escolaridade">
            <select
              className="glass-input"
              disabled={readOnly}
              value={draft.escolaridade ?? ''}
              onChange={e => setDado('escolaridade', e.target.value)}
            >
              <option value="">— Selecione —</option>
              <option value="1o_grau">1º Grau</option>
              <option value="2o_grau">2º Grau</option>
              <option value="superior">Superior</option>
            </select>
          </Field>
        </div>

        <div className="mt-5">
          <HorariosSemanaFields
            value={draft.horarios_semana}
            diasAtivos={draft.horarios_dias_ativos}
            disabled={readOnly}
            onChange={({ horarios_semana, horarios_dias_ativos }) =>
              patchDados({ horarios_semana, horarios_dias_ativos })
            }
          />
        </div>

        <div className="mt-4">
          <ValeTransporteFields
            dados={draft}
            disabled={readOnly}
            onChange={(key, value) => setDado(key, value)}
            onPatch={patchDados}
          />
        </div>

        {!readOnly && funcionario.admissao_status === 'preenchido_funcionario' && (
          <button
            type="button"
            className="btn btn-gold btn-md mt-5"
            disabled={saving}
            onClick={() => void marcarCompleto()}
          >
            Marcar admissão como completa
          </button>
        )}
      </div>

      {temDadosFuncionario && (
        <div className="glass-card p-5">
          <h3 className="mb-3 font-semibold text-[#f2d892]">Dados preenchidos pelo funcionário</h3>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            {draft.pis && (
              <div>
                <dt className="text-[#b8957f]">PIS</dt>
                <dd className="text-[#f0e0d2]">{draft.pis}</dd>
              </div>
            )}
            {draft.endereco && (
              <div>
                <dt className="text-[#b8957f]">Endereço</dt>
                <dd className="text-[#f0e0d2]">{draft.endereco}</dd>
              </div>
            )}
            {funcionario.cpf && (
              <div>
                <dt className="text-[#b8957f]">CPF</dt>
                <dd className="text-[#f0e0d2]">{funcionario.cpf}</dd>
              </div>
            )}
            {funcionario.telefone && (
              <div>
                <dt className="text-[#b8957f]">Telefone</dt>
                <dd className="text-[#f0e0d2]">{funcionario.telefone}</dd>
              </div>
            )}
            {draft.usa_vale_transporte != null && (
              <div>
                <dt className="text-[#b8957f]">Usa vale-transporte</dt>
                <dd className="text-[#f0e0d2]">{draft.usa_vale_transporte ? 'Sim' : 'Não'}</dd>
              </div>
            )}
            {draft.usa_vale_transporte && draft.vt_quantidade_dia && (
              <div>
                <dt className="text-[#b8957f]">VT — quantidade por dia</dt>
                <dd className="text-[#f0e0d2]">{draft.vt_quantidade_dia}</dd>
              </div>
            )}
            {draft.usa_vale_transporte && draft.vt_valor_unitario && (
              <div>
                <dt className="text-[#b8957f]">VT — valor unitário</dt>
                <dd className="text-[#f0e0d2]">R$ {draft.vt_valor_unitario}</dd>
              </div>
            )}
            {draft.usa_vale_transporte && (draft.vt_valor_diario || draft.vt_quantidade_dia) && (
              <div>
                <dt className="text-[#b8957f]">VT — total do dia</dt>
                <dd className="text-[#f0e0d2]">
                  {draft.vt_valor_diario
                    ? `R$ ${draft.vt_valor_diario}`
                    : '—'}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  )
}
