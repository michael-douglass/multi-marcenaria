/**
 * Formulário público — cliente preenche dados e inicia contrato (sem login).
 * URL: /iniciar-orcamento/:schema/:token
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, FileText, Loader2 } from 'lucide-react';
import { GarboBrandLoader } from '@/components/ui/garbo-brand-loader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataBrInput } from '@/components/contratos/DataBrInput';
import {
  lerFormInicioOrcamento,
  submeterFormInicioOrcamento,
  type FormInicioOrcamentoCampo,
  type FormInicioOrcamentoPayload,
} from '@/lib/orcamento-form-public-api';

function formatCPF(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2-$3');
}

function CampoPublico({
  campo,
  valor,
  onChange,
}: {
  campo: FormInicioOrcamentoCampo;
  valor: string;
  onChange: (v: string) => void;
}) {
  if (campo.tipo === 'cpf') {
    return (
      <Input
        value={valor}
        onChange={(e) => onChange(formatCPF(e.target.value))}
        placeholder="000.000.000-00"
        maxLength={14}
        required={campo.obrigatorio}
      />
    );
  }
  if (campo.tipo === 'data') {
    return <DataBrInput value={valor} onChange={onChange} />;
  }
  if (campo.tipo === 'valor') {
    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
          R$
        </span>
        <Input
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          className="pl-9"
          placeholder="0,00"
          required={campo.obrigatorio}
        />
      </div>
    );
  }
  return (
    <Input
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      placeholder={`Digite ${campo.label.toLowerCase()}`}
      required={campo.obrigatorio}
    />
  );
}

export default function IniciarOrcamentoPublicoPage() {
  const { schema, token } = useParams<{ schema: string; token: string }>();
  const [payload, setPayload] = useState<FormInicioOrcamentoPayload | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sucesso, setSucesso] = useState<{ identificador: string; cliente_nome: string } | null>(
    null,
  );

  useEffect(() => {
    if (!schema || !token) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    lerFormInicioOrcamento(schema, token)
      .then((data) => {
        if (cancelled) return;
        setPayload(data);
        const inicial: Record<string, string> = {};
        for (const c of data.campos) {
          inicial[c.nome] = c.valor_prefill ?? '';
        }
        setValores(inicial);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || 'Não foi possível abrir o formulário.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [schema, token]);

  const camposOrdenados = useMemo(
    () => [...(payload?.campos ?? [])].sort((a, b) => a.ordem - b.ordem),
    [payload?.campos],
  );

  const podeEnviar = camposOrdenados
    .filter((c) => c.obrigatorio)
    .every((c) => !!valores[c.nome]?.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schema || !token || !podeEnviar || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await submeterFormInicioOrcamento(schema, token, valores);
      setSucesso({
        identificador: result.identificador,
        cliente_nome: result.cliente_nome,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <GarboBrandLoader variant="fullscreen" message="Carregando formulário…" />;
  }

  if (error && !payload) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Link indisponível</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (sucesso) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-amber-950/30 to-background p-6">
        <Card className="max-w-md w-full border-amber-500/30">
          <CardHeader className="text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
              <CheckCircle2 className="h-7 w-7 text-emerald-400" />
            </div>
            <CardTitle>Dados recebidos!</CardTitle>
            <CardDescription>
              Obrigado{sucesso.cliente_nome ? `, ${sucesso.cliente_nome}` : ''}. Seus dados foram
              registrados e um contrato foi iniciado ({sucesso.identificador}). A equipe entrará em
              contato.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-950/20 via-background to-background py-10 px-4">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-amber-500/15 mb-1">
            <FileText className="h-5 w-5 text-amber-400" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {payload?.empresa_nome || 'Dados para contrato'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Preencha os dados abaixo para iniciarmos o seu contrato.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Seus dados</CardTitle>
            <CardDescription>
              Campos marcados com * são obrigatórios.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {camposOrdenados.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum campo foi liberado ainda. Peça à empresa para configurar o formulário.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {camposOrdenados.map((campo) => (
                  <div key={campo.nome} className="space-y-1.5">
                    <Label htmlFor={`campo-${campo.nome}`}>
                      {campo.label}
                      {campo.obrigatorio ? ' *' : ''}
                    </Label>
                    <CampoPublico
                      campo={campo}
                      valor={valores[campo.nome] ?? ''}
                      onChange={(v) => setValores((prev) => ({ ...prev, [campo.nome]: v }))}
                    />
                  </div>
                ))}

                {error && (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                  disabled={!podeEnviar || isSubmitting}
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Enviar e iniciar contrato
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
