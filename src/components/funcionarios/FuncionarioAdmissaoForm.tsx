import { useEffect, useRef, useState } from 'react'
import { Save } from 'lucide-react'
import { Field } from '@/components/ui/Field'
import { DateInput } from '@/components/ui/DateInput'
import { HorariosSemanaFields } from '@/components/funcionarios/HorariosSemanaFields'
import { ValeTransporteFields } from '@/components/funcionarios/ValeTransporteFields'
import { ADMISSAO_STATUS_LABEL } from '@/lib/funcionario-constants'
import {
  admissaoTemHorariosPreenchidos,
  horariosAdmissaoFromJornada,
  jornadaFromHorariosAdmissao,
} from '@/lib/funcionario-horarios'
import { fetchJornada, salvarJornada } from '@/lib/funcionario-ponto'
import { showToast } from '@/lib/toast'
import { fmtCur, parseMoneyBr } from '@/lib/utils'
import type { Funcionario, FuncionarioAdmissaoDados, FuncionarioInput } from '@/types'

interface Props {
  funcionario: Funcionario
  /** Fixo mensal do usuário vinculado — preenche o salário se ainda estiver vazio. */
  salarioFixoMensal?: number | null
  readOnly?: boolean
  onUpdate: (input: Partial<FuncionarioInput>) => Promise<void>
  /**
   * Espelha o salário da admissão no fixo de Métricas / Contas a Pagar.
   * Recebe o valor numérico já interpretado (0 = zerar fixo).
   */
  onSyncSalarioFixo?: (valor: number) => Promise<void>
  /** Chamado após sincronizar a jornada do ponto a partir dos horários da admissão. */
  onJornadaSynced?: () => void
  saving?: boolean
}

const SAVE_DEBOUNCE_MS = 500

type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

function serializeAdmissao(dados: FuncionarioAdmissaoDados): string {
  return JSON.stringify(dados ?? {})
}

export function FuncionarioAdmissaoForm({
  funcionario,
  salarioFixoMensal,
  readOnly,
  onUpdate,
  onSyncSalarioFixo,
  onJornadaSynced,
  saving,
}: Props) {
  const [draft, setDraft] = useState<FuncionarioAdmissaoDados>(
    () => funcionario.admissao_dados ?? {},
  )
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const draftRef = useRef(draft)
  draftRef.current = draft
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fixoSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seededHorariosRef = useRef(false)
  const syncingJornadaRef = useRef(false)
  const syncingSalarioFixoRef = useRef(false)
  const lastSyncedSalarioRef = useRef<number | null>(null)
  const lastSavedSerializedRef = useRef(serializeAdmissao(funcionario.admissao_dados ?? {}))
  const dirtyRef = useRef(false)
  const persistingRef = useRef(false)
  const pendingSyncJornadaRef = useRef(false)
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate
  const onSyncSalarioFixoRef = useRef(onSyncSalarioFixo)
  onSyncSalarioFixoRef.current = onSyncSalarioFixo
  const onJornadaSyncedRef = useRef(onJornadaSynced)
  onJornadaSyncedRef.current = onJornadaSynced

  const salarioFixoFormatado =
    salarioFixoMensal != null && salarioFixoMensal > 0 ? fmtCur(salarioFixoMensal) : ''
  const salarioExibido = (draft.salario ?? '').trim() || salarioFixoFormatado

  // Ao trocar de funcionário, recarrega o rascunho.
  useEffect(() => {
    const dados = funcionario.admissao_dados ?? {}
    setDraft(dados)
    draftRef.current = dados
    lastSavedSerializedRef.current = serializeAdmissao(dados)
    dirtyRef.current = false
    seededHorariosRef.current = false
    lastSyncedSalarioRef.current = null
    setSaveStatus('idle')
  }, [funcionario.id])

  // Se o banco atualizou (ex.: aba Ponto salvou a jornada), espelha na Admissão sem apagar digitação.
  useEffect(() => {
    if (dirtyRef.current || saveTimerRef.current) return
    const incoming = funcionario.admissao_dados ?? {}
    const serialized = serializeAdmissao(incoming)
    if (serialized === lastSavedSerializedRef.current) return
    if (serialized === serializeAdmissao(draftRef.current)) {
      lastSavedSerializedRef.current = serialized
      return
    }
    setDraft(incoming)
    draftRef.current = incoming
    lastSavedSerializedRef.current = serialized
  }, [funcionario.admissao_dados])

  const syncJornadaFromAdmissao = async (dados: FuncionarioAdmissaoDados) => {
    if (readOnly || syncingJornadaRef.current) return
    const jornada = jornadaFromHorariosAdmissao(
      dados.horarios_semana,
      dados.horarios_dias_ativos,
    )
    if (!jornada) return
    syncingJornadaRef.current = true
    try {
      await salvarJornada(funcionario.id, {
        ...jornada,
        horarios_semana: dados.horarios_semana ?? null,
        horarios_dias_ativos: dados.horarios_dias_ativos ?? null,
      })
      onJornadaSyncedRef.current?.()
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : 'Não foi possível sincronizar a jornada do ponto.',
        'error',
      )
      throw e
    } finally {
      syncingJornadaRef.current = false
    }
  }

  const persistAdmissao = async (syncJornada: boolean) => {
    if (readOnly) return false
    if (syncJornada) pendingSyncJornadaRef.current = true

    // Evita corrida: um salvamento antigo não pode sobrescrever o horário novo.
    if (persistingRef.current) {
      dirtyRef.current = true
      if (!saveTimerRef.current) {
        saveTimerRef.current = setTimeout(() => {
          saveTimerRef.current = null
          void persistAdmissao(false)
        }, SAVE_DEBOUNCE_MS)
      }
      return false
    }
    persistingRef.current = true
    setSaveStatus('saving')

    try {
      do {
        const dados = draftRef.current
        const wantSync = pendingSyncJornadaRef.current
          || syncJornada
          || admissaoTemHorariosPreenchidos(dados)
        pendingSyncJornadaRef.current = false

        await onUpdateRef.current({ admissao_dados: dados })
        if (wantSync) {
          await syncJornadaFromAdmissao(draftRef.current)
        }

        const serialized = serializeAdmissao(dados)
        // Se o usuário alterou de novo enquanto salvava, grava de novo com o rascunho atual.
        if (serializeAdmissao(draftRef.current) !== serialized) {
          pendingSyncJornadaRef.current = true
          continue
        }

        lastSavedSerializedRef.current = serializeAdmissao(draftRef.current)
        dirtyRef.current = false
        setSaveStatus('saved')
        return true
      } while (true)
    } catch (e) {
      setSaveStatus('error')
      showToast(
        e instanceof Error ? e.message : 'Não foi possível salvar a admissão.',
        'error',
      )
      return false
    } finally {
      persistingRef.current = false
    }
  }

  const scheduleSave = (syncJornada = false) => {
    if (readOnly) return
    dirtyRef.current = true
    if (syncJornada) pendingSyncJornadaRef.current = true
    setSaveStatus('pending')
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      void persistAdmissao(syncJornada)
    }, SAVE_DEBOUNCE_MS)
  }

  const flushSave = () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    void persistAdmissao(true)
  }

  // Se a admissão ainda não tem horários, copia da jornada do ponto (quando existir).
  useEffect(() => {
    if (readOnly || seededHorariosRef.current) return
    if (admissaoTemHorariosPreenchidos(draftRef.current)) {
      seededHorariosRef.current = true
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const jornada = await fetchJornada(funcionario.id)
        if (cancelled || !jornada) {
          seededHorariosRef.current = true
          return
        }
        const patch = horariosAdmissaoFromJornada(jornada)
        seededHorariosRef.current = true
        setDraft(prev => {
          if (admissaoTemHorariosPreenchidos(prev)) return prev
          const next = { ...prev, ...patch }
          draftRef.current = next
          dirtyRef.current = true
          void persistAdmissao(false)
          return next
        })
      } catch {
        seededHorariosRef.current = true
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao abrir o funcionário
  }, [funcionario.id, readOnly])

  // Salva o que ficou pendente se sair da tela.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        const pending = draftRef.current
        void onUpdateRef.current({ admissao_dados: pending })
        void syncJornadaFromAdmissao(pending)
      }
      if (fixoSyncTimerRef.current) {
        clearTimeout(fixoSyncTimerRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só no unmount
  }, [])

  // Preenche / atualiza o salário da admissão quando o fixo de Métricas muda.
  useEffect(() => {
    if (readOnly) return
    if (salarioFixoMensal == null || salarioFixoMensal <= 0) return
    const atual = parseMoneyBr((draftRef.current.salario ?? '').trim())
    if (Math.abs(atual - salarioFixoMensal) < 0.009 && (draftRef.current.salario ?? '').trim()) {
      lastSyncedSalarioRef.current = salarioFixoMensal
      return
    }
    if (lastSyncedSalarioRef.current === salarioFixoMensal && (draftRef.current.salario ?? '').trim()) {
      return
    }
    lastSyncedSalarioRef.current = salarioFixoMensal
    const next = {
      ...draftRef.current,
      salario: salarioFixoFormatado || String(salarioFixoMensal),
    }
    setDraft(next)
    draftRef.current = next
    scheduleSave(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só quando o fixo muda
  }, [readOnly, salarioFixoMensal, salarioFixoFormatado])

  const syncSalarioParaFixo = (dados: FuncionarioAdmissaoDados) => {
    if (readOnly || !onSyncSalarioFixoRef.current) return
    if (fixoSyncTimerRef.current) clearTimeout(fixoSyncTimerRef.current)
    fixoSyncTimerRef.current = setTimeout(() => {
      fixoSyncTimerRef.current = null
      if (syncingSalarioFixoRef.current) return
      const valor = parseMoneyBr((dados.salario ?? '').trim())
      if (lastSyncedSalarioRef.current != null && Math.abs(lastSyncedSalarioRef.current - valor) < 0.009) {
        return
      }
      syncingSalarioFixoRef.current = true
      lastSyncedSalarioRef.current = valor
      void onSyncSalarioFixoRef.current?.(valor)
        .catch(e => {
          showToast(
            e instanceof Error ? e.message : 'Não foi possível sincronizar o fixo com o salário.',
            'error',
          )
        })
        .finally(() => {
          syncingSalarioFixoRef.current = false
        })
    }, SAVE_DEBOUNCE_MS)
  }

  const setDado = (key: keyof FuncionarioAdmissaoDados, value: string | boolean) => {
    setDraft(prev => {
      const next = { ...prev, [key]: value }
      draftRef.current = next
      scheduleSave(false)
      if (key === 'salario') syncSalarioParaFixo(next)
      return next
    })
  }

  const patchDados = (patch: Partial<FuncionarioAdmissaoDados>, syncJornada = false) => {
    setDraft(prev => {
      const next = { ...prev, ...patch }
      draftRef.current = next
      scheduleSave(syncJornada)
      return next
    })
  }

  const marcarCompleto = async () => {
    flushSave()
    await onUpdate({ admissao_status: 'completo' })
  }

  const salvarHorariosAgora = async () => {
    if (readOnly) return
    if (!admissaoTemHorariosPreenchidos(draftRef.current)) {
      showToast('Preencha chegada e saída do serviço em pelo menos um dia marcado.', 'error')
      return
    }
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    const ok = await persistAdmissao(true)
    if (ok) {
      showToast('Horários salvos e sincronizados com o ponto.', 'success')
    }
  }

  const temDadosFuncionario =
    !!(draft.pis || draft.endereco || draft.usa_vale_transporte || draft.vt_quantidade_dia)

  const isSavingHorarios = saveStatus === 'pending' || saveStatus === 'saving'

  const saveStatusLabel =
    saveStatus === 'pending' ? 'Aguardando salvar…'
    : saveStatus === 'saving' ? 'Salvando e sincronizando com o ponto…'
    : saveStatus === 'saved' ? 'Salvo e sincronizado com o ponto'
    : saveStatus === 'error' ? 'Falha ao salvar — tente de novo'
    : null

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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-[#f2d892]">Preenchimento da empresa contratante</h3>
        </div>
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
            <p className="mt-1 text-xs text-[#b8957f]">
              Este salário fica sincronizado com o fixo mensal em Métricas de Obras.
            </p>
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
              patchDados({ horarios_semana, horarios_dias_ativos }, true)
            }
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {!readOnly && (
              <button
                type="button"
                className="btn btn-gold btn-md inline-flex items-center gap-2"
                disabled={isSavingHorarios || saving}
                onClick={() => void salvarHorariosAgora()}
              >
                <Save size={16} />
                {isSavingHorarios ? 'Salvando…' : 'Salvar horários e sincronizar com o ponto'}
              </button>
            )}
            {saveStatusLabel && (
              <p
                className={[
                  'text-xs',
                  saveStatus === 'error' ? 'text-red-300'
                  : saveStatus === 'saved' ? 'text-emerald-300'
                  : 'text-[#b8957f]',
                ].join(' ')}
                role="status"
              >
                {saveStatusLabel}
              </p>
            )}
          </div>
          <p className="mt-2 text-xs text-[#b8957f]">
            Clique no botão para gravar. Os mesmos horários passam a valer na aba Ponto
            (jornada usada na batida).
          </p>
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
