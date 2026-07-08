import { useEffect, useState } from 'react'
import { CheckCircle2, Clock, FileKey2, Loader2, Save, ShieldCheck, Upload } from 'lucide-react'
import { Field } from '@/components/ui/Field'
import { LoadingState } from '@/components/ui/EmptyState'
import { formatarCnpj } from '@/lib/rep/rep-validation'
import { showToast } from '@/lib/toast'
import { useRepConfig } from '@/hooks/useRepConfig'
import type { RepConfigInput } from '@/types'

const DEFAULT_FORM: RepConfigInput = {
  razao_social: 'GARBO MOVELARIA',
  cnpj: '',
  inpi_registro: '',
  versao_software: '1.0.0',
  certificado_valido_ate: '',
  certificado_senha: '',
}

export function RepConfigPanel() {
  const { config, loading, saving, salvar } = useRepConfig()
  const [form, setForm] = useState<RepConfigInput>(DEFAULT_FORM)
  const [certificadoArquivo, setCertificadoArquivo] = useState<File | null>(null)
  const [atualizarSenha, setAtualizarSenha] = useState(false)

  useEffect(() => {
    if (!config) return
    setForm({
      razao_social: config.razao_social ?? DEFAULT_FORM.razao_social,
      cnpj: config.cnpj ?? '',
      inpi_registro: config.inpi_registro ?? '',
      versao_software: config.versao_software ?? '1.0.0',
      certificado_valido_ate: config.certificado_valido_ate?.slice(0, 10) ?? '',
      certificado_path: config.certificado_path ?? null,
      certificado_senha: '',
    })
    setAtualizarSenha(false)
    setCertificadoArquivo(null)
  }, [config])

  if (loading) return <LoadingState message="Carregando configuração do ponto eletrônico…" />

  const handleSave = async () => {
    if (!form.razao_social.trim()) {
      showToast('Informe a razão social da empresa.', 'error')
      return
    }
    if (form.cnpj.replace(/\D/g, '').length !== 14) {
      showToast('CNPJ inválido. Informe 14 dígitos.', 'error')
      return
    }
    if (certificadoArquivo && !form.certificado_senha?.trim() && !config?.certificado_senha_configurada) {
      showToast('Informe a senha do certificado digital.', 'error')
      return
    }
    if (atualizarSenha && !form.certificado_senha?.trim()) {
      showToast('Informe a nova senha do certificado.', 'error')
      return
    }

    try {
      await salvar(form, {
        certificadoArquivo,
        atualizarSenha: atualizarSenha || !!certificadoArquivo,
      })
      setCertificadoArquivo(null)
      setAtualizarSenha(false)
      showToast('Configuração do ponto eletrônico salva com sucesso.')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao salvar.', 'error')
    }
  }

  const certificadoOk = config?.certificado_configurado && config?.certificado_senha_configurada

  return (
    <div className="space-y-5">
      <div className="glass-card space-y-2 p-5">
        <h2 className="flex items-center gap-2 font-display text-xl text-[#f2d892]">
          <Clock size={20} />
          Ponto Eletrônico (REP-P)
        </h2>
        <p className="text-sm text-[#b8957f]">
          Cadastre aqui os dados da empresa e o certificado digital e-CNPJ usados na exportação fiscal (AFD/AEJ) e na assinatura dos arquivos.
        </p>
        {config && (
          <p className="text-xs text-[#b8957f]">
            NSR atual do sistema: <span className="text-[#edd9c4]">{config.nsr_atual}</span>
          </p>
        )}
      </div>

      <div className="glass-card space-y-4 p-5">
        <h3 className="section-label">Dados da empresa</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Razão social">
            <input
              className="glass-input"
              value={form.razao_social}
              onChange={e => setForm(p => ({ ...p, razao_social: e.target.value }))}
            />
          </Field>
          <Field label="CNPJ">
            <input
              className="glass-input"
              value={formatarCnpj(form.cnpj)}
              placeholder="00.000.000/0000-00"
              onChange={e => setForm(p => ({ ...p, cnpj: e.target.value.replace(/\D/g, '').slice(0, 14) }))}
            />
          </Field>
          <Field label="Registro INPI do software">
            <input
              className="glass-input"
              value={form.inpi_registro ?? ''}
              placeholder="Recomendado para conformidade REP-P"
              onChange={e => setForm(p => ({ ...p, inpi_registro: e.target.value }))}
            />
          </Field>
          <Field label="Versão do software">
            <input
              className="glass-input"
              value={form.versao_software}
              onChange={e => setForm(p => ({ ...p, versao_software: e.target.value }))}
            />
          </Field>
        </div>
      </div>

      <div className="glass-card space-y-4 p-5">
        <h3 className="flex items-center gap-2 section-label">
          <FileKey2 size={16} className="text-[#f2d892]" />
          Certificado digital e-CNPJ
        </h3>
        <p className="text-sm text-[#b8957f]">
          Envie o arquivo <strong className="text-[#edd9c4]">.pfx</strong> ou <strong className="text-[#edd9c4]">.p12</strong> do certificado ICP-Brasil da empresa. O arquivo fica armazenado de forma privada e só administradores têm acesso.
        </p>

        {config?.certificado_configurado && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            <CheckCircle2 size={16} />
            Certificado enviado: {config.certificado_nome ?? 'certificado-digital.pfx'}
          </div>
        )}

        <Field label="Arquivo do certificado (.pfx ou .p12)">
          <label className="flex cursor-pointer flex-wrap items-center gap-3">
            <span className="btn btn-outline btn-sm inline-flex items-center gap-2">
              <Upload size={14} />
              {certificadoArquivo ? 'Trocar arquivo' : 'Selecionar certificado'}
            </span>
            <input
              type="file"
              accept=".pfx,.p12,application/x-pkcs12"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0] ?? null
                setCertificadoArquivo(file)
                if (file) setAtualizarSenha(true)
              }}
            />
            {certificadoArquivo && (
              <span className="text-sm text-[#edd9c4]">{certificadoArquivo.name}</span>
            )}
          </label>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Senha do certificado">
            <input
              type="password"
              className="glass-input"
              value={form.certificado_senha ?? ''}
              placeholder={
                config?.certificado_senha_configurada && !atualizarSenha
                  ? '•••••••• (já configurada)'
                  : 'Senha do arquivo .pfx'
              }
              onChange={e => {
                setAtualizarSenha(true)
                setForm(p => ({ ...p, certificado_senha: e.target.value }))
              }}
            />
          </Field>
          <Field label="Validade do certificado">
            <input
              type="date"
              className="glass-input"
              value={form.certificado_valido_ate ?? ''}
              onChange={e => setForm(p => ({ ...p, certificado_valido_ate: e.target.value }))}
            />
          </Field>
        </div>

        <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
          certificadoOk
            ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300'
            : 'border-amber-500/30 bg-amber-500/5 text-amber-200'
        }`}>
          <ShieldCheck size={18} className="mt-0.5 shrink-0" />
          <p>
            {certificadoOk
              ? 'Certificado e senha configurados. Os arquivos fiscais serão assinados automaticamente na exportação.'
              : 'Sem certificado completo, a assinatura digital usará modo de desenvolvimento até você enviar o .pfx e a senha.'}
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="button" className="btn btn-gold" disabled={saving} onClick={() => void handleSave()}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Salvar configuração
        </button>
      </div>
    </div>
  )
}
