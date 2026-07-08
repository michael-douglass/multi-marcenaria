import { Field } from '@/components/ui/Field'

import {

  ADMISSAO_STATUS_LABEL,

} from '@/lib/funcionario-constants'

import type { Funcionario, FuncionarioAdmissaoDados, FuncionarioInput } from '@/types'



interface Props {

  funcionario: Funcionario

  readOnly?: boolean

  onUpdate: (input: Partial<FuncionarioInput>) => Promise<void>

  saving?: boolean

}



export function FuncionarioAdmissaoForm({ funcionario, readOnly, onUpdate, saving }: Props) {

  const dados = funcionario.admissao_dados ?? {}



  const setDado = (key: keyof FuncionarioAdmissaoDados, value: string | boolean) => {

    void onUpdate({

      admissao_dados: { ...dados, [key]: value },

    })

  }



  const marcarCompleto = async () => {

    await onUpdate({ admissao_status: 'completo' })

  }



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

            <input

              type="date"

              className="glass-input"

              disabled={readOnly || saving}

              value={dados.data_admissao ?? ''}

              onChange={e => setDado('data_admissao', e.target.value)}

            />

          </Field>

          <Field label="Salário">

            <input

              className="glass-input"

              disabled={readOnly || saving}

              value={dados.salario ?? ''}

              onChange={e => setDado('salario', e.target.value)}

              placeholder="R$ 0,00"

            />

          </Field>

          <Field label="Função">

            <input

              className="glass-input"

              disabled={readOnly || saving}

              value={dados.funcao ?? ''}

              onChange={e => setDado('funcao', e.target.value)}

            />

          </Field>

          <Field label="Telefone">

            <input

              className="glass-input"

              disabled={readOnly || saving}

              value={dados.telefone_empresa ?? ''}

              onChange={e => setDado('telefone_empresa', e.target.value)}

            />

          </Field>

          <Field label="Horário Seg–Sex">

            <input

              className="glass-input"

              disabled={readOnly || saving}

              value={dados.horario_seg_sex ?? ''}

              onChange={e => setDado('horario_seg_sex', e.target.value)}

            />

          </Field>

          <Field label="Horário Seg–Sáb">

            <input

              className="glass-input"

              disabled={readOnly || saving}

              value={dados.horario_seg_sab ?? ''}

              onChange={e => setDado('horario_seg_sab', e.target.value)}

            />

          </Field>

          <Field label="E-mail">

            <input

              type="email"

              className="glass-input"

              disabled={readOnly || saving}

              value={dados.email_pessoal ?? funcionario.email ?? ''}

              onChange={e => setDado('email_pessoal', e.target.value)}

            />

          </Field>

          <Field label="Escolaridade">

            <select

              className="glass-input"

              disabled={readOnly || saving}

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



        <div className="mt-4 grid gap-3 sm:grid-cols-2">

          <label className="flex items-center gap-2 text-sm text-[#edd9c4]">

            <input

              type="checkbox"

              checked={!!dados.usa_vale_transporte}

              disabled={readOnly || saving}

              onChange={e => setDado('usa_vale_transporte', e.target.checked)}

            />

            Usa vale-transporte

          </label>

        </div>



        {dados.usa_vale_transporte && (

          <div className="mt-3 grid gap-3 sm:grid-cols-2">

            <Field label="Ônibus 1">

              <input className="glass-input" disabled={readOnly || saving} value={dados.onibus_1 ?? ''} onChange={e => setDado('onibus_1', e.target.value)} />

            </Field>

            <Field label="Valor 1">

              <input className="glass-input" disabled={readOnly || saving} value={dados.valor_onibus_1 ?? ''} onChange={e => setDado('valor_onibus_1', e.target.value)} />

            </Field>

            <Field label="Ônibus 2">

              <input className="glass-input" disabled={readOnly || saving} value={dados.onibus_2 ?? ''} onChange={e => setDado('onibus_2', e.target.value)} />

            </Field>

            <Field label="Valor 2">

              <input className="glass-input" disabled={readOnly || saving} value={dados.valor_onibus_2 ?? ''} onChange={e => setDado('valor_onibus_2', e.target.value)} />

            </Field>

          </div>

        )}



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



      {(dados.pis || dados.endereco) && (

        <div className="glass-card p-5">

          <h3 className="mb-3 font-semibold text-[#f2d892]">Dados preenchidos pelo funcionário</h3>

          <dl className="grid gap-2 text-sm sm:grid-cols-2">

            {dados.pis && <div><dt className="text-[#b8957f]">PIS</dt><dd className="text-[#f0e0d2]">{dados.pis}</dd></div>}

            {dados.endereco && <div><dt className="text-[#b8957f]">Endereço</dt><dd className="text-[#f0e0d2]">{dados.endereco}</dd></div>}

            {funcionario.cpf && <div><dt className="text-[#b8957f]">CPF</dt><dd className="text-[#f0e0d2]">{funcionario.cpf}</dd></div>}

            {funcionario.telefone && <div><dt className="text-[#b8957f]">Telefone</dt><dd className="text-[#f0e0d2]">{funcionario.telefone}</dd></div>}

          </dl>

        </div>

      )}

    </div>

  )

}

