import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CalendarDays } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { horariosDoDia, parseAgendaPublica, proximosDiasAgenda, type CrmAgendaPublica } from '@/lib/crm-comunicacao'
import { showToast } from '@/lib/toast'
import { Button } from '@/components/ui/button'

type Step = 'form' | 'date' | 'time' | 'success'

export function AgendamentoPublicoGarbo() {
  const { empresaSlug, slug } = useParams()
  const agendaSlug = slug || empresaSlug || 'agendamento'
  const [agenda, setAgenda] = useState<CrmAgendaPublica | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<Step>('form')
  const [nome, setNome] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [data, setData] = useState('')
  const [hora, setHora] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void supabase.rpc('movelaria_crm_agenda_publica', { p_slug: agendaSlug }).then(({ data: raw, error: err }) => {
      if (cancelled) return
      if (err) setError(err.message)
      else setAgenda(parseAgendaPublica(raw))
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [agendaSlug])

  const dias = useMemo(() => (agenda ? proximosDiasAgenda(agenda) : []), [agenda])
  const horas = useMemo(() => (agenda && data ? horariosDoDia(agenda, data) : []), [agenda, data])

  const enviar = async () => {
    if (!nome.trim() || !whatsapp.trim() || !data || !hora) {
      showToast('Preencha nome, WhatsApp, data e horário.', 'error')
      return
    }
    setSaving(true)
    try {
      const inicio = new Date(`${data}T${hora}:00`)
      const { error: err } = await supabase.rpc('movelaria_crm_agenda_publica_criar', {
        p_slug: agendaSlug,
        p_nome: nome.trim(),
        p_whatsapp: whatsapp,
        p_inicio: inicio.toISOString(),
      })
      if (err) throw err
      setStep('success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Não foi possível agendar.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const fmtDia = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
  }

  return (
    <div className="min-h-screen bg-[#2a1812] px-4 py-10 font-raleway text-[#f2d892]">
      <div className="mx-auto max-w-lg rounded-2xl border border-[rgba(240,210,140,0.28)] bg-[rgba(42,24,18,0.92)] p-6">
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          <h1 className="text-2xl font-bold">{agenda?.nome || 'Agendar conversa'}</h1>
        </div>
        {loading && <p className="text-sm opacity-70">Abrindo a agenda...</p>}
        {!loading && error && <p className="text-sm text-red-300">{error}</p>}
        {!loading && !error && !agenda && <p className="text-sm opacity-70">Agenda não encontrada.</p>}
        {step === 'success' && (
          <div className="space-y-2">
            <p className="text-lg font-semibold text-emerald-300">Agendamento confirmado!</p>
            <p className="text-sm opacity-80">A equipe confirma pelo WhatsApp.</p>
          </div>
        )}
        {!loading && agenda && step !== 'success' && (
          <div className="space-y-4">
            {agenda.texto && <p className="text-sm opacity-80">{agenda.texto}</p>}
            <p className="text-xs uppercase tracking-widest opacity-60">
              {step === 'form' ? '1 · Seus dados' : step === 'date' ? '2 · Escolha o dia' : '3 · Escolha o horário'}
            </p>
            {step === 'form' && (
              <>
                <label className="block text-sm">
                  Nome
                  <input className="mt-1 w-full rounded-lg border border-[rgba(240,210,140,0.3)] bg-transparent px-3 py-2" value={nome} onChange={e => setNome(e.target.value)} />
                </label>
                <label className="block text-sm">
                  WhatsApp
                  <input className="mt-1 w-full rounded-lg border border-[rgba(240,210,140,0.3)] bg-transparent px-3 py-2" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
                </label>
                <Button type="button" onClick={() => {
                  if (!nome.trim() || !whatsapp.trim()) { showToast('Informe nome e WhatsApp.', 'error'); return }
                  setStep('date')
                }}>
                  Continuar
                </Button>
              </>
            )}
            {step === 'date' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {dias.map(iso => (
                    <button
                      key={iso}
                      type="button"
                      className={data === iso ? 'rounded-lg bg-[#f2d892] px-3 py-2 text-sm text-[#2a1812]' : 'rounded-lg border border-[rgba(240,210,140,0.4)] px-3 py-2 text-sm'}
                      onClick={() => { setData(iso); setHora('') }}
                    >
                      {fmtDia(iso)}
                    </button>
                  ))}
                </div>
                {dias.length === 0 && <p className="text-xs opacity-60">Nenhum dia disponível no período.</p>}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setStep('form')}>Voltar</Button>
                  <Button type="button" disabled={!data} onClick={() => setStep('time')}>Continuar</Button>
                </div>
              </>
            )}
            {step === 'time' && (
              <>
                {horas.length === 0 ? <p className="text-xs opacity-60">Nenhum horário neste dia.</p> : (
                  <div className="flex flex-wrap gap-2">
                    {horas.map(h => (
                      <button
                        key={h}
                        type="button"
                        className={hora === h ? 'rounded-full bg-[#f2d892] px-3 py-1 text-sm text-[#2a1812]' : 'rounded-full border border-[rgba(240,210,140,0.4)] px-3 py-1 text-sm'}
                        onClick={() => setHora(h)}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setStep('date')}>Voltar</Button>
                  <Button type="button" disabled={saving || !hora} onClick={() => void enviar()}>
                    {saving ? 'Reservando...' : 'Confirmar'}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
