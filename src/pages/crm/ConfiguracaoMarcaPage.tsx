import { useState } from 'react'
import { Palette } from 'lucide-react'
import { CrmPageFrame, CrmPageHeader } from '@/components/crm/CrmPageFrame'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/Field'
import { garboBrandLogo } from '@/lib/garbo-brand'
import { showToast } from '@/lib/toast'

const STORAGE_KEY = 'garbo-crm-marca-preview'

interface MarcaPreview {
  nomeMenu: string
  cor: string
}

function lerPreview(): MarcaPreview {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { nomeMenu: 'Garbo movelaria', cor: '#c4a574' }
    const parsed = JSON.parse(raw) as MarcaPreview
    return {
      nomeMenu: parsed.nomeMenu || 'Garbo movelaria',
      cor: parsed.cor || '#c4a574',
    }
  } catch {
    return { nomeMenu: 'Garbo movelaria', cor: '#c4a574' }
  }
}

export function ConfiguracaoMarcaPage() {
  const [form, setForm] = useState(lerPreview)

  return (
    <CrmPageFrame padded>
      <CrmPageHeader
        title="Identidade visual"
        subtitle="Uma casa só — sem seletor de empresa. A logo oficial continua no arquivo da marca."
        icon={(
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-400/15">
            <Palette className="h-4 w-4 text-amber-300" />
          </div>
        )}
      />
      <div className="mx-auto max-w-3xl space-y-4">
        <article className="rounded-xl border border-border/80 bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Identidade visual</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <Field label="Nome no menu">
                <input className="glass-input w-full" value={form.nomeMenu} onChange={e => setForm(f => ({ ...f, nomeMenu: e.target.value }))} />
              </Field>
              <Field label="Cor de acento">
                <input className="glass-input w-full" type="color" value={form.cor} onChange={e => setForm(f => ({ ...f, cor: e.target.value }))} />
              </Field>
              <Button size="sm" type="button" onClick={() => {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(form))
                showToast('Prévia salva neste navegador. Não grava no banco — ainda não há RPC de marca.')
              }}>
                Salvar prévia
              </Button>
            </div>
            <div className="flex flex-col items-start gap-2 rounded-lg border p-3" style={{ borderColor: form.cor }}>
              <img src={garboBrandLogo} alt="" className="h-14 w-14 object-contain" width={56} height={56} />
              <p className="font-display text-xs uppercase tracking-[0.2em]" style={{ color: form.cor }}>{form.nomeMenu}</p>
            </div>
          </div>
        </article>
        <article className="rounded-xl border border-border/80 bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">Página do prestador</h2>
          <p className="text-sm text-muted-foreground">Os banners do portal usam a marca Garbo já no código. Upload de banner novo precisa de pasta no Storage — não inventamos tabela.</p>
        </article>
        <article className="rounded-xl border border-border/80 bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">Timbrado de contratos</h2>
          <p className="text-sm text-muted-foreground">CNPJ e dados da contratada ficam nos modelos de contrato já existentes em `/contratos/configuracoes`.</p>
        </article>
      </div>
    </CrmPageFrame>
  )
}
