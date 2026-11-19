/**
 * Formulário curto, abaixo de um Select, para cadastrar uma opção que ainda não existe
 * (origem, região, fonte de mensagem) sem sair do modal do lead.
 */
import { useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** Valor reservado do SelectItem que abre o formulário. */
export const OPCAO_NOVA = '__nova__';

export interface CampoOpcaoNova {
  id: string;
  placeholder: string;
  tipo?: 'text' | 'url';
}

interface Props {
  campos: CampoOpcaoNova[];
  onSalvar: (valores: Record<string, string>) => Promise<void>;
  onCancelar: () => void;
  /** Mensagem de erro de validação (antes de chamar onSalvar); null = válido. */
  validar?: (valores: Record<string, string>) => string | null;
}

export function OpcaoNovaInline({ campos, onSalvar, onCancelar, validar }: Props) {
  const [valores, setValores] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    const limpos = Object.fromEntries(campos.map((c) => [c.id, (valores[c.id] ?? '').trim()]));
    const vazio = campos.find((c) => !limpos[c.id]);
    const msg = vazio ? `Preencha: ${vazio.placeholder}` : validar?.(limpos) ?? null;
    if (msg) {
      setErro(msg);
      return;
    }
    setErro(null);
    setSalvando(true);
    try {
      await onSalvar(limpos);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="mt-2 space-y-2 rounded-md border border-dashed p-2">
      {campos.map((c, i) => (
        <Input
          key={c.id}
          type={c.tipo ?? 'text'}
          autoFocus={i === 0}
          placeholder={c.placeholder}
          aria-label={c.placeholder}
          value={valores[c.id] ?? ''}
          disabled={salvando}
          onChange={(e) => setValores((v) => ({ ...v, [c.id]: e.target.value }))}
          onKeyDown={(e) => {
            // Enter não pode enviar o formulário do lead.
            if (e.key === 'Enter') {
              e.preventDefault();
              void salvar();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              onCancelar();
            }
          }}
        />
      ))}
      {erro ? <p className="text-xs text-destructive">{erro}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancelar} disabled={salvando}>
          <X className="mr-1 h-4 w-4" aria-hidden /> Cancelar
        </Button>
        <Button type="button" size="sm" onClick={() => void salvar()} disabled={salvando}>
          {salvando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden /> : <Plus className="mr-1 h-4 w-4" aria-hidden />}
          Adicionar
        </Button>
      </div>
    </div>
  );
}
