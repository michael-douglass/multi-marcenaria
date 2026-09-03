import { ExternalLink, Link2, Unlink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { FUNCIONARIO_TIPO_LABEL, FUNCIONARIO_TIPO_PERFIL } from '@/lib/funcionario-constants'
import { USUARIO_ORIGEM_LABEL, usuarioOrigem } from '@/lib/funcionario-usuario-busca'
import { fmtCur, fmtDate } from '@/lib/utils'
import type { ContaPagar, Funcionario, FuncionarioInput } from '@/types'
import type { UsuarioAdmin } from '@/hooks/useUsuarios'
import { FuncionarioUsuarioSelect } from './FuncionarioUsuarioSelect'

interface Props {
  funcionario: Funcionario
  usuarios: UsuarioAdmin[]
  contasPagar: ContaPagar[]
  readOnly?: boolean
  onUpdate: (input: Partial<FuncionarioInput>) => Promise<void>
  saving?: boolean
}

export function FuncionarioVinculosPanel({
  funcionario,
  usuarios,
  contasPagar,
  readOnly,
  onUpdate,
  saving,
}: Props) {
  const perfilEsperado = FUNCIONARIO_TIPO_PERFIL[funcionario.tipo]
  const tipoLabel = FUNCIONARIO_TIPO_LABEL[funcionario.tipo] ?? funcionario.tipo

  const usuarioVinculado = usuarios.find(u => u.id === funcionario.usuario_id)

  const handleVincular = async (usuarioId: string) => {
    await onUpdate({ usuario_id: usuarioId || null })
  }

  return (
    <div className="space-y-6">
      <div className="glass-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Link2 size={18} className="text-[#f2d892]" />
          <h3 className="font-semibold text-[#f2d892]">Usuário do sistema</h3>
        </div>
        <p className="mb-4 text-sm text-[#b8957f]">
          Vincule esta pasta a qualquer login do sistema — Movelaria ou CRM. Assim a pessoa
          consegue bater ponto (quando tiver acesso) e as contas a pagar do prestador
          aparecem aqui.
        </p>

        {!perfilEsperado && (
          <p className="mb-3 rounded-lg border border-sky-800/20 bg-sky-50 px-3 py-2 text-xs text-[#1a100c]">
            Pasta do tipo <strong>{tipoLabel}</strong> não exige um perfil específico de login.
            Você pode vincular qualquer usuário do sistema (Movelaria ou CRM).
          </p>
        )}

        {!readOnly && (
          <div className="flex flex-wrap items-start gap-3">
            <FuncionarioUsuarioSelect
              usuarios={usuarios}
              value={funcionario.usuario_id}
              perfilEsperado={perfilEsperado}
              disabled={saving}
              onChange={id => void handleVincular(id)}
            />
            {funcionario.usuario_id && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={saving}
                onClick={() => void handleVincular('')}
              >
                <Unlink size={14} />
                Desvincular
              </button>
            )}
          </div>
        )}

        {!readOnly && usuarios.length === 0 && (
          <p className="mt-3 text-sm text-amber-800">
            Nenhum usuário encontrado. Cadastre o login em Configurações → Usuários
            e volte aqui para vincular.
          </p>
        )}

        {usuarioVinculado && (
          <div className="mt-4 rounded-lg border border-[rgba(212,168,83,0.2)] bg-[rgba(212,168,83,0.06)] p-3 text-sm">
            <p className="text-[#f2d892]">{usuarioVinculado.nome ?? usuarioVinculado.email}</p>
            <p className="text-[#b8957f]">{usuarioVinculado.email}</p>
            <p className="mt-1 text-xs text-[#b8957f]">
              Acesso {USUARIO_ORIGEM_LABEL[usuarioOrigem(usuarioVinculado)]}
              {usuarioVinculado.ativo ? '' : ' · login inativo'}
            </p>
          </div>
        )}
      </div>

      <div className="glass-card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="font-semibold text-[#f2d892]">Contas a pagar vinculadas</h3>
          {funcionario.usuario_id && (
            <Link to="/contas-pagar" className="btn btn-outline btn-sm">
              <ExternalLink size={14} />
              Abrir Contas a Pagar
            </Link>
          )}
        </div>

        {!funcionario.usuario_id ? (
          <p className="text-sm text-[#b8957f]">
            Vincule um usuário do sistema para ver as contas a pagar deste prestador.
          </p>
        ) : contasPagar.length === 0 ? (
          <p className="text-sm text-[#b8957f]">Nenhuma conta a pagar encontrada para este prestador.</p>
        ) : (
          <div className="max-h-80 overflow-auto rounded-lg border border-[rgba(212,168,83,0.12)]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-[#f8efe3] backdrop-blur-sm">
                <tr className="border-b border-[rgba(212,168,83,0.15)] text-left text-[0.65rem] uppercase tracking-wider text-[#b8957f]">
                  <th className="px-3 py-2.5 pr-3">Descrição</th>
                  <th className="px-3 py-2.5 pr-3">Vencimento</th>
                  <th className="px-3 py-2.5 pr-3">Valor</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {contasPagar.map(cp => (
                  <tr key={cp.id} className="border-b border-[rgba(212,168,83,0.08)]">
                    <td className="px-3 py-2.5 pr-3 text-[#f0e0d2]">
                      {cp.descricao ?? cp.fornecedor_nome ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 pr-3 text-[#b8957f]">{fmtDate(cp.data_vencimento)}</td>
                    <td className="px-3 py-2.5 pr-3 text-[#f2d892]">{fmtCur(cp.valor_parcela)}</td>
                    <td className="px-3 py-2.5 capitalize text-[#edd9c4]">{cp.status.replace('_', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
