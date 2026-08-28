import { useState } from 'react'
import { Ban, FileText, Image, Megaphone, MessageSquare, Music } from 'lucide-react'
import { CrmPageFrame, CrmPageHeader } from '@/components/crm/CrmPageFrame'
import { Button } from '@/components/ui/button'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/EmptyState'
import { Field } from '@/components/ui/Field'
import { useCrmAutomacoes } from '@/hooks/useCrmMarketing'
import { showToast } from '@/lib/toast'

export function AutomacoesPage() {
  const { negativados, loading, error, salvarNegativado } = useCrmAutomacoes()
  const [fone, setFone] = useState('')
  return (
    <CrmPageFrame padded>
      <CrmPageHeader
        title="Negativação"
        subtitle="Números que não devem receber disparo automático."
        icon={(
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-orange-400/30 bg-orange-400/15">
            <Ban className="h-4 w-4 text-orange-300" />
          </div>
        )}
      />
      {loading && <LoadingState variant="page" message="Abrindo a lista..." />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && (
        <div className="rounded-xl border border-border/80 bg-card p-4">
          <div className="mb-4 flex flex-wrap gap-2">
            <input className="glass-input max-w-xs" placeholder="Telefone só números" value={fone} onChange={e => setFone(e.target.value)} />
            <Button size="sm" type="button" onClick={() => {
              const n = Number(fone.replace(/\D/g, ''))
              if (!n) { showToast('Informe o telefone.', 'error'); return }
              void salvarNegativado(n).then(() => { setFone(''); showToast('Número adicionado.') })
                .catch(err => showToast(err instanceof Error ? err.message : 'Erro', 'error'))
            }}>Negativar</Button>
          </div>
          {negativados.length === 0 ? <EmptyState message="Nenhum número negativado." /> : (
            <ul className="max-h-[350px] overflow-y-auto divide-y divide-border/50 rounded-xl border border-border/80">
              {negativados.map(n => (
                <li key={n.id} className="px-3 py-2 text-sm">{n.telefone}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </CrmPageFrame>
  )
}

type AtalhoTab = 'mensagens' | 'disparos' | 'audios' | 'imagens' | 'pdfs'

export function AutomacoesMarketingPage() {
  const { atalhos, loading, error, salvarAtalho } = useCrmAutomacoes()
  const [tab, setTab] = useState<AtalhoTab>('mensagens')
  const [titulo, setTitulo] = useState('')
  const [mensagem, setMensagem] = useState('')
  const tabs: { id: AtalhoTab; label: string; icon: typeof MessageSquare }[] = [
    { id: 'mensagens', label: 'Mensagens', icon: MessageSquare },
    { id: 'disparos', label: 'Disparos', icon: Megaphone },
    { id: 'audios', label: 'Áudios', icon: Music },
    { id: 'imagens', label: 'Imagens', icon: Image },
    { id: 'pdfs', label: 'PDFs', icon: FileText },
  ]

  return (
    <CrmPageFrame padded>
      <CrmPageHeader
        title="Automações de marketing"
        subtitle="Modelos de mensagem para disparo. Áudio, imagem e PDF ainda não têm arquivo no banco da Movelaria."
        icon={(
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-400/30 bg-rose-400/15">
            <Megaphone className="h-4 w-4 text-rose-300" />
          </div>
        )}
        below={(
          <div className="flex flex-wrap gap-2">
            {tabs.map(item => (
              <button
                key={item.id}
                type="button"
                className={tab === item.id ? 'btn btn-gold btn-sm' : 'btn btn-outline btn-sm'}
                onClick={() => setTab(item.id)}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            ))}
          </div>
        )}
      />
      {loading && <LoadingState variant="page" message="Abrindo os modelos..." />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && (tab === 'mensagens' || tab === 'disparos') && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-border/80 bg-card p-4">
            <h2 className="text-sm font-semibold">Novo template</h2>
            <Field label="Título"><input className="glass-input w-full" value={titulo} onChange={e => setTitulo(e.target.value)} /></Field>
            <Field label="Mensagem"><textarea className="glass-input min-h-24 w-full" value={mensagem} onChange={e => setMensagem(e.target.value)} /></Field>
            <Button size="sm" type="button" onClick={() => {
              if (!titulo.trim()) { showToast('Informe o título.', 'error'); return }
              void salvarAtalho(null, titulo, mensagem).then(() => { setTitulo(''); setMensagem(''); showToast('Modelo salvo.') })
                .catch(err => showToast(err instanceof Error ? err.message : 'Erro', 'error'))
            }}>Salvar modelo</Button>
          </div>
          <div className="max-h-[420px] overflow-y-auto rounded-xl border border-border/80">
            {atalhos.length === 0 ? <EmptyState message="Nenhum modelo ainda." /> : (
              <ul className="space-y-2 p-3">
                {atalhos.map(a => (
                  <li key={a.id} className="rounded-lg border border-border/70 p-3">
                    <p className="font-medium">{a.titulo}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{a.mensagem}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      {!loading && !error && tab !== 'mensagens' && tab !== 'disparos' && (
        <EmptyState message="Este banco guarda só texto de template. Upload de áudio, imagem e PDF não foi portado — não inventamos arquivo." />
      )}
    </CrmPageFrame>
  )
}
