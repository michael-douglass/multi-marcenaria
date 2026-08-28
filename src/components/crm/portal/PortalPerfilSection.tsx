import { useEffect, useState } from 'react'
import { TIPO_PIX_LABELS, type PortalPerfil, type TipoChavePix } from '@/lib/crm-portal'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/button'
import { showToast } from '@/lib/toast'

const fieldStyle = 'w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white/85 outline-none'

interface PortalPerfilSectionProps {
  perfil: PortalPerfil
  saving?: boolean
  onSave: (input: { telefone: string; chavePix: string; tipoChavePix: TipoChavePix }) => Promise<void>
}

export function PortalPerfilSection({ perfil, saving, onSave }: PortalPerfilSectionProps) {
  const [telefone, setTelefone] = useState(perfil.telefone ?? '')
  const [chavePix, setChavePix] = useState(perfil.chavePix ?? '')
  const [tipo, setTipo] = useState<TipoChavePix>(perfil.tipoChavePix)
  const initials = perfil.nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() || '?'

  useEffect(() => {
    setTelefone(perfil.telefone ?? '')
    setChavePix(perfil.chavePix ?? '')
    setTipo(perfil.tipoChavePix)
  }, [perfil.id, perfil.telefone, perfil.chavePix, perfil.tipoChavePix])

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-6 pb-28 pt-10 md:px-14">
      <div>
        <div className="mb-5 h-px w-10 bg-amber-400/30" />
        <h2 className="font-display text-3xl tracking-wide text-white md:text-4xl">Perfil</h2>
      </div>
      <div className="flex items-center gap-4">
        {perfil.avatarUrl
          ? <img src={perfil.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
          : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full text-lg font-semibold" style={{ background: 'rgba(240,210,140,0.15)', color: '#f2d892' }}>
              {initials}
            </div>
          )}
        <div>
          <p className="text-lg font-medium text-white">{perfil.nome}</p>
          <p className="text-xs uppercase tracking-[0.16em] text-[#f2d892]">{perfil.titulo}</p>
          <p className="text-xs text-white/40">{perfil.email}</p>
        </div>
      </div>
      <Field label="Telefone">
        <input className={fieldStyle} value={telefone} onChange={e => setTelefone(e.target.value)} />
      </Field>
      <Field label="Tipo da chave PIX">
        <select className={fieldStyle} value={tipo} onChange={e => setTipo(e.target.value as TipoChavePix)}>
          {(Object.keys(TIPO_PIX_LABELS) as TipoChavePix[]).map(item => (
            <option key={item} value={item} className="text-black">{TIPO_PIX_LABELS[item]}</option>
          ))}
        </select>
      </Field>
      <Field label="Chave PIX">
        <input className={fieldStyle} value={chavePix} onChange={e => setChavePix(e.target.value)} />
      </Field>
      <Button
        type="button"
        onClick={() => {
          void onSave({ telefone, chavePix, tipoChavePix: tipo })
            .then(() => showToast('Perfil atualizado.'))
            .catch(err => showToast(err instanceof Error ? err.message : 'Não foi possível salvar.', 'error'))
        }}
        disabled={saving}
      >
        Salvar perfil
      </Button>
    </div>
  )
}
