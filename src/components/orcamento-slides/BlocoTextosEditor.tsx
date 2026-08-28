import { useEffect, useRef, useState } from 'react';
import { FileText, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  itensFerragensDoConfig,
  itensFracionadosDoConfig,
  TEXTOS_PADRAO_BLOCO,
  textoDoConfig,
} from '@/lib/orcamento-slide-bloco-textos';
import type { BlocoFerragemItem, BlocoTipo, OrcamentoSlideBloco, PrecoFracionadoItem } from '@/lib/orcamento-slide-types';
import { ItensPrecosFracionadosEditor } from '@/components/orcamento-slides/ItensPrecosFracionadosEditor';

interface BlocoTextosEditorProps {
  bloco: OrcamentoSlideBloco;
  onConfigChange: (patch: Record<string, unknown>) => void;
}

function CampoTexto({
  label,
  hint,
  value,
  onChange,
  multiline = false,
  placeholder,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">{label}</Label>
      {hint && <p className="text-[11px] text-muted-foreground -mt-0.5">{hint}</p>}
      {multiline ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="text-sm resize-y min-h-[72px]"
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-8 text-sm"
        />
      )}
    </div>
  );
}

function useDebouncedConfigPatch(
  blocoId: string,
  onConfigChange: (patch: Record<string, unknown>) => void,
  delay = 600,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Record<string, unknown>>({});

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, [blocoId]);

  const schedule = (patch: Record<string, unknown>) => {
    pendingRef.current = { ...pendingRef.current, ...patch };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onConfigChange(pendingRef.current);
      pendingRef.current = {};
    }, delay);
  };

  const flush = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (Object.keys(pendingRef.current).length > 0) {
      onConfigChange(pendingRef.current);
      pendingRef.current = {};
    }
  };

  return { schedule, flush };
}

export function BlocoTextosEditor({ bloco, onConfigChange }: BlocoTextosEditorProps) {
  const { tipo, config, id } = bloco;
  const padroes = TEXTOS_PADRAO_BLOCO[tipo] ?? {};
  const { schedule, flush } = useDebouncedConfigPatch(id, onConfigChange);

  const [titulo, setTitulo] = useState(() => textoDoConfig(config, 'titulo', tipo));
  const [subtitulo, setSubtitulo] = useState(() => textoDoConfig(config, 'subtitulo', tipo));
  const [etiqueta, setEtiqueta] = useState(() => textoDoConfig(config, 'etiqueta', tipo));
  const [percentual, setPercentual] = useState(() => textoDoConfig(config, 'percentual', tipo));
  const [texto, setTexto] = useState(() => textoDoConfig(config, 'texto', tipo));
  const [meses, setMeses] = useState(() => textoDoConfig(config, 'meses', tipo));
  const [itens, setItens] = useState<BlocoFerragemItem[]>(() => itensFerragensDoConfig(config));
  const [itensFracionados, setItensFracionados] = useState<PrecoFracionadoItem[]>(() => itensFracionadosDoConfig(config));

  useEffect(() => {
    setTitulo(textoDoConfig(config, 'titulo', tipo));
    setSubtitulo(textoDoConfig(config, 'subtitulo', tipo));
    setEtiqueta(textoDoConfig(config, 'etiqueta', tipo));
    setPercentual(textoDoConfig(config, 'percentual', tipo));
    setTexto(textoDoConfig(config, 'texto', tipo));
    setMeses(textoDoConfig(config, 'meses', tipo));
    setItens(itensFerragensDoConfig(config));
    setItensFracionados(itensFracionadosDoConfig(config));
  }, [id, tipo]); // só reseta ao trocar de bloco

  const patchCampo = (key: string, value: string) => schedule({ [key]: value });

  const salvarItens = (novos: BlocoFerragemItem[]) => {
    setItens(novos);
    onConfigChange({ itens: novos });
  };

  const salvarItensFracionados = (novos: PrecoFracionadoItem[]) => {
    setItensFracionados(novos);
    onConfigChange({ itens: novos });
  };

  const blocosSemTexto: BlocoTipo[] = ['solicitar_fotos', 'imagem_interativa'];

  if (blocosSemTexto.includes(tipo)) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 pb-3 border-b border-border/40">
      <h4 className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wide">
        <FileText className="h-3.5 w-3.5 text-amber-400" />
        Textos do bloco
      </h4>

      {tipo === 'capa' && (
        <div className="grid grid-cols-1 gap-3">
          <CampoTexto
            label="Título"
            value={titulo}
            onChange={(v) => { setTitulo(v); patchCampo('titulo', v); }}
            placeholder={padroes.titulo}
          />
          <CampoTexto
            label="Subtítulo"
            hint="Deixe vazio para usar o nome do cliente no orçamento."
            value={subtitulo}
            onChange={(v) => { setSubtitulo(v); patchCampo('subtitulo', v); }}
            placeholder="Ex.: Luana – Vista do Lago"
          />
        </div>
      )}

      {tipo === 'valorizacao' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <CampoTexto
            label="Destaque (%)"
            value={percentual}
            onChange={(v) => { setPercentual(v); patchCampo('percentual', v); }}
            placeholder={padroes.percentual}
          />
          <CampoTexto
            label="Título"
            value={titulo}
            onChange={(v) => { setTitulo(v); patchCampo('titulo', v); }}
            placeholder={padroes.titulo}
          />
          <div className="sm:col-span-2">
            <CampoTexto
              label="Texto"
              value={texto}
              onChange={(v) => { setTexto(v); patchCampo('texto', v); }}
              multiline
              placeholder={padroes.texto}
            />
          </div>
        </div>
      )}

      {(tipo === 'galeria_projetos' || tipo === 'dados_projeto' || tipo === 'imagens_orcamento' || tipo === 'analise_ia') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <CampoTexto
            label="Etiqueta superior"
            value={etiqueta}
            onChange={(v) => { setEtiqueta(v); patchCampo('etiqueta', v); }}
            placeholder={padroes.etiqueta}
          />
          <CampoTexto
            label="Título"
            value={titulo}
            onChange={(v) => { setTitulo(v); patchCampo('titulo', v); }}
            placeholder={padroes.titulo}
          />
          {tipo === 'dados_projeto' && (
            <p className="sm:col-span-2 text-[11px] text-muted-foreground">
              Exibe as perguntas respondidas na etapa &quot;Dados do projeto&quot; de cada orçamento (ambientes, MDF, garantia, etc.).
            </p>
          )}
          {tipo === 'imagens_orcamento' && (
            <p className="sm:col-span-2 text-[11px] text-muted-foreground">
              As fotos e vídeos vêm do orçamento (etapa Visual). Aqui você só define título e posição do bloco na apresentação. Vídeos aparecem no site e são omitidos no PDF.
            </p>
          )}
          {tipo === 'analise_ia' && (
            <p className="sm:col-span-2 text-[11px] text-muted-foreground">
              No orçamento, o relatório da aba Análise IA do lead preenche este slide. Você pode editar todo o texto antes de apresentar ao cliente.
            </p>
          )}
        </div>
      )}

      {tipo === 'analise_ia' && (
        <CampoTexto
          label="Texto modelo (pré-visualização no template)"
          hint="Exemplo exibido na configuração. O conteúdo real vem da análise de IA de cada orçamento."
          value={texto}
          onChange={(v) => { setTexto(v); patchCampo('texto', v); }}
          multiline
          placeholder="Conteúdo de exemplo para o slide…"
        />
      )}

      {tipo === 'comparativo_ferragens' && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CampoTexto
              label="Etiqueta superior"
              value={etiqueta}
              onChange={(v) => { setEtiqueta(v); patchCampo('etiqueta', v); }}
              placeholder={padroes.etiqueta}
            />
            <CampoTexto
              label="Título"
              value={titulo}
              onChange={(v) => { setTitulo(v); patchCampo('titulo', v); }}
              placeholder={padroes.titulo}
            />
          </div>
          <CampoTexto
            label="Texto introdutório"
            value={texto}
            onChange={(v) => { setTexto(v); patchCampo('texto', v); }}
            multiline
            placeholder={padroes.texto}
          />
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Itens do comparativo</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => salvarItens([...itens, { titulo: '', descricao: '' }])}
              >
                <Plus className="h-3 w-3" />
                Item
              </Button>
            </div>
            {itens.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum item. Adicione ferragens para listar no bloco.</p>
            )}
            {itens.map((item, i) => (
              <div key={i} className="rounded-lg border border-border/50 p-3 flex flex-col gap-2 bg-muted/20">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground font-medium">Item {i + 1}</span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => salvarItens(itens.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <Input
                  value={item.titulo}
                  onChange={(e) => {
                    const novos = [...itens];
                    novos[i] = { ...item, titulo: e.target.value };
                    setItens(novos);
                    schedule({ itens: novos });
                  }}
                  onBlur={flush}
                  placeholder="Nome da ferragem"
                  className="h-8 text-sm"
                />
                <Textarea
                  value={item.descricao}
                  onChange={(e) => {
                    const novos = [...itens];
                    novos[i] = { ...item, descricao: e.target.value };
                    setItens(novos);
                    schedule({ itens: novos });
                  }}
                  onBlur={flush}
                  placeholder="Descrição breve"
                  rows={2}
                  className="text-sm resize-y"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {tipo === 'precos_fracionados' && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CampoTexto
              label="Etiqueta superior"
              value={etiqueta}
              onChange={(v) => { setEtiqueta(v); patchCampo('etiqueta', v); }}
              placeholder={padroes.etiqueta}
            />
            <CampoTexto
              label="Título"
              value={titulo}
              onChange={(v) => { setTitulo(v); patchCampo('titulo', v); }}
              placeholder={padroes.titulo}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Os valores reais são preenchidos na etapa Precificação do orçamento (chave &quot;Fracionar preços&quot;).
            Aqui você define título e itens de exemplo para a prévia.
          </p>
          <ItensPrecosFracionadosEditor
            compact
            itens={itensFracionados}
            onChange={salvarItensFracionados}
          />
        </div>
      )}

      {(tipo === 'precificacao' || tipo === 'prazos' || tipo === 'garantia' || tipo === 'texto_livre' || tipo === 'script' || tipo === 'antes_depois' || tipo === 'comparativo_mdf') && (
        <div className="grid grid-cols-1 gap-3">
          <CampoTexto
            label="Título"
            value={titulo}
            onChange={(v) => { setTitulo(v); patchCampo('titulo', v); }}
            placeholder={padroes.titulo ?? 'Título do bloco'}
          />
          {(tipo === 'prazos' || tipo === 'garantia' || tipo === 'texto_livre' || tipo === 'script') && (
            <CampoTexto
              label={tipo === 'garantia' ? 'Texto da garantia' : 'Texto'}
              value={texto}
              onChange={(v) => { setTexto(v); patchCampo('texto', v); }}
              multiline
              placeholder={padroes.texto}
            />
          )}
          {tipo === 'prazos' && (
            <p className="text-[11px] text-muted-foreground rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-pretty">
              No orçamento, o vendedor informa o <strong>início da execução</strong> e o{' '}
              <strong>prazo em dias</strong>. A <strong>data prevista de entrega</strong> é
              calculada automaticamente (início + dias) e aparece neste slide.
            </p>
          )}
          {tipo === 'garantia' && (
            <CampoTexto
              label="Meses de garantia (padrão)"
              hint="No orçamento, o valor preenchido pelo vendedor tem prioridade."
              value={meses}
              onChange={(v) => { setMeses(v); patchCampo('meses', v); }}
              placeholder={padroes.meses}
            />
          )}
        </div>
      )}
    </div>
  );
}
