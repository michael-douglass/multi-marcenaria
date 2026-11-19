import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { AiApiKeyField } from '@/components/configuracoes-ia/AiApiKeyCard'
import { dataBR, erroMsg } from '@/components/master/master-utils'
import {
  useLimparChaveMotorIa,
  useMotorIa,
  useSalvarChaveMotorIa,
  useSalvarMotorIa,
  type MotorIaEdicao,
} from '@/hooks/useMaster'
import { IA_CARD_LEAD_IMAGE_MODELS, IA_CARD_LEAD_VISION_MODELS } from '@/lib/ia-card-lead-modelos'
import {
  DEFAULT_AMBIENTE_ANALYSIS_PROMPT,
  DEFAULT_AMBIENTE_IMAGE_PROMPT,
  DEFAULT_RENDER_ANALYSIS_PROMPT,
  DEFAULT_RENDER_IMAGE_PROMPT,
} from '@/lib/pipeline-lead-ai-render-prompts'
import { Painel, Vazio } from '@/master/components/MasterUi'

const PROMPT_MAX = 8000

type PromptCampo =
  | 'render_analysis_prompt'
  | 'render_prompt'
  | 'render_ambiente_analysis_prompt'
  | 'render_ambiente_prompt'

const PADROES: Record<PromptCampo, string> = {
  render_analysis_prompt: DEFAULT_RENDER_ANALYSIS_PROMPT,
  render_prompt: DEFAULT_RENDER_IMAGE_PROMPT,
  render_ambiente_analysis_prompt: DEFAULT_AMBIENTE_ANALYSIS_PROMPT,
  render_ambiente_prompt: DEFAULT_AMBIENTE_IMAGE_PROMPT,
}

function CampoPrompt({ id, rotulo, ajuda, valor, campo, onChange }: {
  id: string
  rotulo: string
  ajuda: string
  valor: string
  campo: PromptCampo
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id}>{rotulo}</Label>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(PADROES[campo])}>
            Carregar texto padrão
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={!valor} onClick={() => onChange('')}>
            Usar o padrão do sistema
          </Button>
        </div>
      </div>
      <Textarea
        id={id}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        maxLength={PROMPT_MAX}
        placeholder="Vazio = padrão do sistema. Use {{nome_lead}}, {{origem}} e {{analise}} quando fizer sentido."
        className="font-mono text-[0.82rem]"
      />
      <p className="text-[0.78rem] text-[var(--m-ink-2)]">{ajuda}</p>
    </div>
  )
}

/** Chave, modelos, prompts e chaves liga/desliga do motor de IA do card do lead (ADR 0007). */
export function MotorIaPainel() {
  const { data: motor, isLoading, error } = useMotorIa()
  const salvarMotor = useSalvarMotorIa()
  const salvarChave = useSalvarChaveMotorIa()
  const limparChave = useLimparChaveMotorIa()

  const base = useMemo<MotorIaEdicao | null>(
    () =>
      motor
        ? {
            ativo: motor.ativo,
            render_ativo: motor.render_ativo,
            render_ambiente_ativo: motor.render_ambiente_ativo,
            vision_model: motor.vision_model,
            image_model: motor.image_model,
            render_analysis_prompt: motor.render_analysis_prompt ?? '',
            render_prompt: motor.render_prompt ?? '',
            render_ambiente_analysis_prompt: motor.render_ambiente_analysis_prompt ?? '',
            render_ambiente_prompt: motor.render_ambiente_prompt ?? '',
            tokens_por_imagem_fixa: motor.tokens_por_imagem_fixa,
          }
        : null,
    [motor],
  )
  const [form, setForm] = useState<MotorIaEdicao | null>(null)
  useEffect(() => setForm(base), [base])

  if (isLoading) return <Vazio>Carregando…</Vazio>
  if (error || !motor || !form || !base) return <Vazio>{erroMsg(error, 'Não foi possível carregar o motor de IA')}</Vazio>

  const sujo = JSON.stringify(form) !== JSON.stringify(base)
  const set = <K extends keyof MotorIaEdicao>(k: K, v: MotorIaEdicao[K]) => setForm((f) => (f ? { ...f, [k]: v } : f))
  const imagemSemTokens = form.image_model === 'dall-e-2'

  const salvar = async () => {
    try {
      await salvarMotor.mutateAsync(form)
      toast.success('Motor de IA salvo.')
    } catch (err) {
      toast.error(erroMsg(err, 'Não foi possível salvar o motor de IA'))
    }
  }

  return (
    <div className="space-y-8">
      <Painel
        titulo="Chave da OpenAI"
        descricao="Uma única chave para todas as marcenarias com a função “IA no card lead” ligada. Nenhuma marcenaria vê esta chave, e ela nunca volta para o navegador."
      >
        <div className="max-w-[34rem] space-y-2">
          <AiApiKeyField
            id="motor-ia-chave"
            label="Chave da plataforma"
            configured={motor.chave_configurada}
            saving={salvarChave.isPending}
            clearing={limparChave.isPending}
            onSave={async (v) => {
              try {
                await salvarChave.mutateAsync(v.trim())
                toast.success('Chave salva.')
              } catch (err) {
                toast.error(erroMsg(err, 'Não foi possível salvar a chave'))
              }
            }}
            onClear={async () => {
              try {
                await limparChave.mutateAsync()
                toast.success('Chave removida. A renderização fica indisponível até cadastrar outra.')
              } catch (err) {
                toast.error(erroMsg(err, 'Não foi possível remover a chave'))
              }
            }}
          />
          {motor.chave_configurada ? (
            <p className="text-[0.82rem] text-[var(--m-ink-2)]">
              Termina em <span className="m-num font-medium">••••{motor.chave_final4}</span>
              {motor.chave_atualizada_em ? ` · atualizada em ${dataBR(motor.chave_atualizada_em)}` : ''}
            </p>
          ) : (
            <p className="text-[0.82rem] text-[var(--m-ink-2)]">
              Sem chave, a renderização por IA fica indisponível para todas as marcenarias.
            </p>
          )}
        </div>
      </Painel>

      <Painel
        titulo="Modelos e liberação"
        descricao="Valem para todas as marcenarias. A escolha de quem usa fica em Planos e em cada Marcenaria."
        acao={
          <Button onClick={() => void salvar()} disabled={!sujo || salvarMotor.isPending}>
            {salvarMotor.isPending ? 'Salvando…' : 'Salvar motor'}
          </Button>
        }
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-3">
            <label className="flex items-center justify-between gap-3 rounded-md border border-[var(--m-line)] px-3 py-2.5">
              <span>
                <span className="block text-sm font-medium text-[var(--m-ink)]">Motor ligado</span>
                <span className="block text-[0.78rem] text-[var(--m-ink-2)]">Desligado, nenhuma marcenaria renderiza.</span>
              </span>
              <Switch checked={form.ativo} onCheckedChange={(v) => set('ativo', v)} aria-label="Motor ligado" />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-md border border-[var(--m-line)] px-3 py-2.5">
              <span className="text-sm font-medium text-[var(--m-ink)]">Renderização de projetos</span>
              <Switch checked={form.render_ativo} onCheckedChange={(v) => set('render_ativo', v)} aria-label="Renderização de projetos" />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-md border border-[var(--m-line)] px-3 py-2.5">
              <span className="text-sm font-medium text-[var(--m-ink)]">Renderização com ambiente</span>
              <Switch
                checked={form.render_ambiente_ativo}
                onCheckedChange={(v) => set('render_ambiente_ativo', v)}
                aria-label="Renderização com ambiente"
              />
            </label>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="motor-ia-visao">Modelo de visão (lê o esboço)</Label>
              <Select value={form.vision_model} onValueChange={(v) => set('vision_model', v)}>
                <SelectTrigger id="motor-ia-visao">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IA_CARD_LEAD_VISION_MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label} — {m.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="motor-ia-imagem">Modelo de imagem (gera o render)</Label>
              <Select value={form.image_model} onValueChange={(v) => set('image_model', v)}>
                <SelectTrigger id="motor-ia-imagem">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IA_CARD_LEAD_IMAGE_MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label} — {m.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="motor-ia-tokens-img">Tokens contados por imagem (modelos sem medição)</Label>
              <Input
                id="motor-ia-tokens-img"
                type="number"
                min={0}
                value={form.tokens_por_imagem_fixa}
                onChange={(e) => set('tokens_por_imagem_fixa', Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                className="max-w-[12rem]"
              />
              <p className="text-[0.78rem] text-[var(--m-ink-2)]">
                {imagemSemTokens
                  ? 'O modelo escolhido não informa tokens: cada imagem gerada conta este valor no limite da marcenaria.'
                  : 'Só vale se a resposta da OpenAI vier sem a contagem de tokens.'}
              </p>
            </div>
          </div>
        </div>
      </Painel>

      <Painel
        titulo="Prompts da renderização"
        descricao="Vazio usa o texto padrão do sistema. Alterar aqui muda o resultado para todas as marcenarias."
        acao={
          <Button onClick={() => void salvar()} disabled={!sujo || salvarMotor.isPending}>
            {salvarMotor.isPending ? 'Salvando…' : 'Salvar motor'}
          </Button>
        }
      >
        <div className="space-y-6">
          <CampoPrompt
            id="motor-ia-p1"
            campo="render_analysis_prompt"
            rotulo="Renderização de projetos — análise do esboço"
            ajuda="Instrução enviada ao modelo de visão para classificar o esboço."
            valor={form.render_analysis_prompt ?? ''}
            onChange={(v) => set('render_analysis_prompt', v)}
          />
          <CampoPrompt
            id="motor-ia-p2"
            campo="render_prompt"
            rotulo="Renderização de projetos — geração da imagem"
            ajuda="Instrução enviada ao modelo de imagem. {{analise}} recebe o resultado da etapa anterior."
            valor={form.render_prompt ?? ''}
            onChange={(v) => set('render_prompt', v)}
          />
          <CampoPrompt
            id="motor-ia-p3"
            campo="render_ambiente_analysis_prompt"
            rotulo="Renderização com ambiente — análise"
            ajuda="Instrução para ler a lousa, a descrição e os móveis do ambiente."
            valor={form.render_ambiente_analysis_prompt ?? ''}
            onChange={(v) => set('render_ambiente_analysis_prompt', v)}
          />
          <CampoPrompt
            id="motor-ia-p4"
            campo="render_ambiente_prompt"
            rotulo="Renderização com ambiente — geração da imagem"
            ajuda="Instrução enviada ao modelo de imagem para compor o ambiente."
            valor={form.render_ambiente_prompt ?? ''}
            onChange={(v) => set('render_ambiente_prompt', v)}
          />
        </div>
      </Painel>
    </div>
  )
}
