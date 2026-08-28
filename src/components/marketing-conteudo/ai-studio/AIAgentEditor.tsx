import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save } from 'lucide-react';
import {
  MarketingAIAgent,
  useMarketingAIStudio,
} from '@/hooks/useMarketingAIStudio';

interface AIAgentEditorProps {
  agent: MarketingAIAgent;
}

export function AIAgentEditor({ agent }: AIAgentEditorProps) {
  const { saveAgent } = useMarketingAIStudio();
  const [systemPrompt, setSystemPrompt] = useState(agent.system_prompt);
  const [userTemplate, setUserTemplate] = useState(agent.user_prompt_template);
  const [model, setModel] = useState(agent.model || '');

  useEffect(() => {
    setSystemPrompt(agent.system_prompt);
    setUserTemplate(agent.user_prompt_template);
    setModel(agent.model || '');
  }, [agent]);

  const handleSave = () => {
    saveAgent.mutate({
      id: agent.id,
      system_prompt: systemPrompt,
      user_prompt_template: userTemplate,
      model: model.trim() || null,
    });
  };

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-amber-900/20 bg-background/60 p-3 dark:border-amber-100/15">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-medium">{agent.nome}</p>
          {agent.descricao ? (
            <p className="text-xs text-muted-foreground">{agent.descricao}</p>
          ) : null}
        </div>
        <span className="rounded-full bg-amber-900/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-900 dark:bg-amber-100/10 dark:text-amber-200">
          {agent.slug}
        </span>
      </div>

      <div className="space-y-2">
        <Label>System prompt</Label>
        <Textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={4}
          className="font-mono text-xs"
        />
      </div>

      <div className="space-y-2">
        <Label>User prompt (use {'{{variáveis}}'})</Label>
        <Textarea
          value={userTemplate}
          onChange={(e) => setUserTemplate(e.target.value)}
          rows={5}
          className="font-mono text-xs"
        />
      </div>

      <div className="space-y-2">
        <Label>Modelo (opcional — override)</Label>
        <Input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="ex: gpt-4o-mini"
        />
      </div>

      <Button
        size="sm"
        className="studio-cta gap-2"
        onClick={handleSave}
        disabled={saveAgent.isPending}
      >
        {saveAgent.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Save className="h-3.5 w-3.5" />
        )}
        Salvar agente
      </Button>
    </div>
  );
}
