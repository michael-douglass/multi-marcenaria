import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Send, Trash2, Clock, Copy, Bell } from 'lucide-react';
import { useAtalhosPorTipo, useCreateAtalho, useDeleteAtalho } from '@/hooks/useAtalhos';
import { VARIAVEIS_REUNIAO } from '@/hooks/useTemplatesDisparo';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function TemplatesDisparoTab() {
  const [titulo, setTitulo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [allCanSee, setAllCanSee] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const { data: atalhos, isLoading } = useAtalhosPorTipo('texto');
  const createAtalho = useCreateAtalho();
  const deleteAtalho = useDeleteAtalho();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !mensagem.trim()) {
      toast.error('Preencha o título e a mensagem');
      return;
    }

    createAtalho.mutate({
      titulo: titulo.trim(),
      tipo: 'texto',
      mensagem: mensagem.trim(),
      all_can_see: allCanSee,
    }, {
      onSuccess: () => {
        setTitulo('');
        setMensagem('');
      }
    });
  };

  const insertVariable = (variavel: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setMensagem(prev => prev + variavel);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = mensagem;
    const before = text.substring(0, start);
    const after = text.substring(end);
    
    setMensagem(before + variavel + after);
    
    // Focus and set cursor position after the inserted variable
    setTimeout(() => {
      textarea.focus();
      const newPos = start + variavel.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const copyVariable = (variavel: string) => {
    navigator.clipboard.writeText(variavel);
    toast.success('Variável copiada!');
  };

  // Filtrar apenas templates que parecem ser para disparos (contêm variáveis)
  const templatesDisparo = atalhos?.filter(a => 
    a.mensagem && (
      a.mensagem.includes('{{nome}}') ||
      a.mensagem.includes('{{telefone}}') ||
      a.mensagem.includes('{{titulo}}') ||
      a.mensagem.includes('{{data}}') ||
      a.mensagem.includes('{{horario}}')
    )
  ) || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Novo Template de Disparo
          </CardTitle>
          <CardDescription>
            Crie templates com variáveis para lembretes e confirmações de reunião
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="titulo-disparo">Título do Template</Label>
              <Input
                id="titulo-disparo"
                placeholder="Ex: Lembrete 1h antes, Confirmação de agendamento..."
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
              />
            </div>

            {/* Variáveis Disponíveis */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-3 w-3" />
                Variáveis Disponíveis
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                Clique para inserir ou copie a variável
              </p>
              <TooltipProvider>
                <div className="flex flex-wrap gap-2">
                  {VARIAVEIS_REUNIAO.map((v) => (
                    <Tooltip key={v.key}>
                      <TooltipTrigger asChild>
                        <Badge 
                          variant="secondary" 
                          className="cursor-pointer hover:bg-primary/20 transition-colors group flex items-center gap-1"
                          onClick={() => insertVariable(v.key)}
                        >
                          {v.label}
                          <button
                            type="button"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyVariable(v.key);
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">{v.description}</p>
                        <p className="text-xs text-muted-foreground font-mono">{v.key}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </TooltipProvider>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mensagem-disparo">Mensagem</Label>
              <Textarea
                ref={textareaRef}
                id="mensagem-disparo"
                placeholder={`Olá {{nome}}! 👋\n\nSua reunião "{{titulo}}" está marcada para {{data}} às {{horario}}.\n\nNos vemos lá! 🎯`}
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={8}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Use as variáveis acima para personalizar a mensagem automaticamente
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="allCanSee-disparo"
                checked={allCanSee}
                onCheckedChange={setAllCanSee}
              />
              <Label htmlFor="allCanSee-disparo">Visível para todos os usuários</Label>
            </div>
            
            <Button type="submit" className="w-full" disabled={createAtalho.isPending}>
              {createAtalho.isPending ? 'Salvando...' : 'Salvar Template'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Templates de Disparo</CardTitle>
          <CardDescription>
            {templatesDisparo.length} templates com variáveis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            {isLoading ? (
              <p className="text-muted-foreground text-center py-4">Carregando...</p>
            ) : templatesDisparo.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <Bell className="h-10 w-10 mx-auto text-muted-foreground/30" />
                <p className="text-muted-foreground text-sm">
                  Nenhum template de disparo criado
                </p>
                <p className="text-xs text-muted-foreground">
                  Crie templates usando as variáveis para lembretes e confirmações
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {templatesDisparo.map((atalho) => (
                  <div key={atalho.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{atalho.titulo}</h4>
                        <Badge variant="outline" className="text-xs">
                          <Bell className="h-3 w-3 mr-1" />
                          Disparo
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteAtalho.mutate(atalho.id)}
                        disabled={deleteAtalho.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <pre className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/30 p-2 rounded font-mono">
                      {atalho.mensagem}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
