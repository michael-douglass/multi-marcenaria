import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import type {
  BlocoLayoutConfig,
  BlocoLayoutViewport,
  BlocoTipo,
  OrcamentoSlideBloco,
} from '@/lib/orcamento-slide-types';
import { resolveImagemAlinhamento, textoSobreImagem, type ViewportMode } from '@/lib/orcamento-slide-layout';

interface BlocoLayoutEditorProps {
  bloco: OrcamentoSlideBloco;
  onChange: (layout: BlocoLayoutConfig) => void;
}

const BLOCOS_COM_FOTO: BlocoTipo[] = ['capa', 'valorizacao', 'comparativo_ferragens', 'galeria_projetos', 'antes_depois', 'imagem_interativa'];
/** Blocos com texto + imagem no desktop — permitem antes/depois/sobre a imagem. */
const BLOCOS_TEXTO_IMAGEM_DESKTOP: BlocoTipo[] = ['capa', 'valorizacao', 'comparativo_ferragens', 'antes_depois'];
const BLOCOS_COM_COLUNAS: BlocoTipo[] = ['galeria_projetos'];
/** Ferragens e Investimento — altura do slide e escala do conteúdo. */
const BLOCOS_COM_TAMANHO_VISUAL: BlocoTipo[] = ['comparativo_ferragens', 'precificacao', 'precos_fracionados'];
/** Blocos sem campos de texto editáveis — não exibem posição do texto. */
const BLOCOS_SEM_TEXTO: BlocoTipo[] = ['imagem_interativa', 'solicitar_fotos'];

function ViewportLayoutFields({
  viewport,
  tipo,
  values,
  onPatch,
}: {
  viewport: ViewportMode;
  tipo: BlocoTipo;
  values: BlocoLayoutViewport;
  onPatch: (patch: BlocoLayoutViewport) => void;
}) {
  const label = viewport === 'desktop' ? 'Computador' : 'Celular';

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/50 p-3 bg-muted/20">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>

      {BLOCOS_COM_FOTO.includes(tipo) && !textoSobreImagem(values.texto_posicao_imagem ?? 'antes') && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Posição da imagem</Label>
          <Select
            value={resolveImagemAlinhamento(values)}
            onValueChange={(v) => onPatch({
              imagem_alinhamento: v as BlocoLayoutViewport['imagem_alinhamento'],
            })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="esquerda">Esquerda</SelectItem>
              <SelectItem value="centro">Centro</SelectItem>
              <SelectItem value="direita">Direita</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {((BLOCOS_TEXTO_IMAGEM_DESKTOP.includes(tipo) && viewport === 'desktop') || (tipo === 'capa' && viewport === 'mobile')) && !BLOCOS_SEM_TEXTO.includes(tipo) && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">
            {viewport === 'mobile' && tipo === 'capa' ? 'Título em relação à imagem' : 'Texto em relação à imagem'}
          </Label>
          <Select
            value={values.texto_posicao_imagem ?? 'antes'}
            onValueChange={(v) => onPatch({
              texto_posicao_imagem: v as BlocoLayoutViewport['texto_posicao_imagem'],
            })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="antes">
                {viewport === 'mobile' && tipo === 'capa' ? 'Abaixo da imagem' : 'Antes da imagem'}
              </SelectItem>
              <SelectItem value="depois">
                {viewport === 'mobile' && tipo === 'capa' ? 'Acima da imagem' : 'Depois da imagem'}
              </SelectItem>
              <SelectItem value="sobre_imagem">No centro da imagem</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {BLOCOS_COM_FOTO.includes(tipo) && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Largura da imagem: {values.foto_largura_pct ?? (viewport === 'mobile' ? 100 : 50)}%</Label>
          <Slider
            min={20}
            max={100}
            step={1}
            value={[values.foto_largura_pct ?? (viewport === 'mobile' ? 100 : 50)]}
            onValueChange={([v]) => onPatch({ foto_largura_pct: v })}
          />
        </div>
      )}

      {BLOCOS_COM_FOTO.includes(tipo) && viewport === 'desktop' && tipo !== 'capa' && !textoSobreImagem(values.texto_posicao_imagem ?? 'antes') && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Largura do painel de texto: {values.painel_largura_pct ?? 50}%</Label>
          <Slider
            min={40}
            max={75}
            step={1}
            value={[values.painel_largura_pct ?? 50]}
            onValueChange={([v]) => onPatch({ painel_largura_pct: v })}
          />
        </div>
      )}

      {BLOCOS_COM_FOTO.includes(tipo) && viewport === 'mobile' && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Ordem no celular</Label>
          <Select
            value={values.ordem_mobile ?? 'texto_primeiro'}
            onValueChange={(v) => onPatch({ ordem_mobile: v as BlocoLayoutViewport['ordem_mobile'] })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="texto_primeiro">Texto antes da imagem</SelectItem>
              <SelectItem value="imagem_primeiro">Imagem antes do texto</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {BLOCOS_COM_COLUNAS.includes(tipo) && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Colunas da galeria</Label>
          <Select
            value={String(values.colunas ?? (viewport === 'mobile' ? 1 : 3))}
            onValueChange={(v) => onPatch({ colunas: Number(v) as 1 | 2 | 3 })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 coluna</SelectItem>
              <SelectItem value="2">2 colunas</SelectItem>
              <SelectItem value="3">3 colunas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {BLOCOS_COM_TAMANHO_VISUAL.includes(tipo) && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Altura do bloco</Label>
            <Select
              value={values.altura_visual ?? 'padrao'}
              onValueChange={(v) => onPatch({ altura_visual: v as BlocoLayoutViewport['altura_visual'] })}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="padrao">Padrão (tela inteira)</SelectItem>
                <SelectItem value="grande">Grande (+12%)</SelectItem>
                <SelectItem value="maxima">Máxima (+25%)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Tamanho do conteúdo</Label>
            <Select
              value={values.escala_visual ?? 'normal'}
              onValueChange={(v) => onPatch({ escala_visual: v as BlocoLayoutViewport['escala_visual'] })}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="grande">Grande</SelectItem>
                <SelectItem value="maxima">Máximo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {!BLOCOS_SEM_TEXTO.includes(tipo) && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Posição do texto</Label>
          <Select
            value={values.alinhamento ?? 'esquerda'}
            onValueChange={(v) => onPatch({ alinhamento: v as BlocoLayoutViewport['alinhamento'] })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="esquerda">Esquerda</SelectItem>
              <SelectItem value="centro">Centro</SelectItem>
              <SelectItem value="direita">Direita</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {viewport === 'mobile' && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Margem lateral: {values.padding_x ?? 24}px</Label>
          <Slider
            min={12}
            max={40}
            step={2}
            value={[values.padding_x ?? 24]}
            onValueChange={([v]) => onPatch({ padding_x: v })}
          />
        </div>
      )}
    </div>
  );
}

export function BlocoLayoutEditor({ bloco, onChange }: BlocoLayoutEditorProps) {
  const layout = (bloco.config.layout as BlocoLayoutConfig | undefined) ?? {};

  const patchViewport = (viewport: ViewportMode, patch: BlocoLayoutViewport) => {
    onChange({
      ...layout,
      [viewport]: { ...layout[viewport], ...patch },
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-3 border-t border-border/40">
      <ViewportLayoutFields
        viewport="desktop"
        tipo={bloco.tipo}
        values={layout.desktop ?? {}}
        onPatch={(patch) => patchViewport('desktop', patch)}
      />
      <ViewportLayoutFields
        viewport="mobile"
        tipo={bloco.tipo}
        values={layout.mobile ?? {}}
        onPatch={(patch) => patchViewport('mobile', patch)}
      />
    </div>
  );
}
