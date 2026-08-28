import { useEffect, useState } from 'react';
import { Image as ImageIcon, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { FormatoImagemSelector } from '@/components/orcamento-slides/FormatoImagemSelector';
import { ImagemUploadZona } from '@/components/orcamento-slides/ImagemUploadZona';
import {
  imagensGaleriaDoConfig,
  orientacaoDoConfig,
  orientacaoImagemFundoDoConfig,
  urlDoConfig,
  urlImagemFundoDoConfig,
} from '@/lib/orcamento-slide-bloco-imagens';
import {
  aspectRatioSlide,
  FORMATO_IMAGEM_SLIDE_HINT,
  labelOrientacaoSlide,
  processarImagemSlide,
  type ImagemOrientacaoSlide,
} from '@/lib/orcamento-slide-imagem-spec';
import type { BlocoTipo, OrcamentoSlideBloco } from '@/lib/orcamento-slide-types';

interface BlocoImagensEditorProps {
  bloco: OrcamentoSlideBloco;
  onConfigChange: (patch: Record<string, unknown>) => void;
  onUpload: (file: File) => Promise<string>;
}

interface EditorGaleriaFotosProps {
  config: Record<string, unknown>;
  orientacaoGaleria: ImagemOrientacaoSlide;
  onOrientacaoChange: (o: ImagemOrientacaoSlide) => void;
  uploading: boolean;
  onUpload: (file: File) => void;
  onRemover: (index: number) => void;
  titulo?: string;
  descricao?: string;
}

function EditorGaleriaFotos({
  config,
  orientacaoGaleria,
  onOrientacaoChange,
  uploading,
  onUpload,
  onRemover,
  titulo = 'Fotos do bloco',
  descricao,
}: EditorGaleriaFotosProps) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-xs font-medium text-foreground">{titulo}</p>
        {descricao && <p className="text-[11px] text-muted-foreground mt-0.5">{descricao}</p>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {imagensGaleriaDoConfig(config).map((img, i) => (
          <div
            key={`${img.url}-${i}`}
            className="relative group rounded-lg overflow-hidden border border-border/60"
            style={{ aspectRatio: aspectRatioSlide(img.orientacao) }}
          >
            <img src={img.url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
            <div className="absolute bottom-1 left-1 rounded bg-black/60 px-1 py-0.5 text-[9px] text-white">
              {labelOrientacaoSlide(img.orientacao)}
            </div>
            <button
              type="button"
              className="absolute top-1 right-1 h-6 w-6 rounded-md bg-destructive/90 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              onClick={() => onRemover(i)}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      <FormatoImagemSelector value={orientacaoGaleria} onChange={onOrientacaoChange} />
      <label
        className="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border/60 hover:border-amber-500/50 cursor-pointer w-full py-6"
        style={{ aspectRatio: aspectRatioSlide(orientacaoGaleria), maxHeight: orientacaoGaleria === 'retrato' ? 200 : 120 }}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <Plus className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="text-[10px] text-muted-foreground text-center px-1">
          Adicionar {labelOrientacaoSlide(orientacaoGaleria)}
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = '';
          }}
        />
      </label>
    </div>
  );
}

const HINT_IMAGENS_ORCAMENTO =
  'No orçamento real, as fotos enviadas na etapa Visual aparecem automaticamente. Use este espaço para fotos de referência no template.';

export function BlocoImagensEditor({ bloco, onConfigChange, onUpload }: BlocoImagensEditorProps) {
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const { tipo, config, id: blocoId } = bloco;

  const [orientacaoCapa, setOrientacaoCapa] = useState<ImagemOrientacaoSlide>(() => orientacaoDoConfig(config));
  const [orientacaoAntes, setOrientacaoAntes] = useState<ImagemOrientacaoSlide>(
    () => (config.imagem_antes_orientacao as ImagemOrientacaoSlide) ?? 'paisagem',
  );
  const [orientacaoDepois, setOrientacaoDepois] = useState<ImagemOrientacaoSlide>(
    () => (config.imagem_depois_orientacao as ImagemOrientacaoSlide) ?? 'paisagem',
  );
  const [orientacaoGaleria, setOrientacaoGaleria] = useState<ImagemOrientacaoSlide>('paisagem');
  const [orientacaoFundo, setOrientacaoFundo] = useState<ImagemOrientacaoSlide>(() =>
    orientacaoImagemFundoDoConfig(config),
  );

  useEffect(() => {
    setOrientacaoCapa(orientacaoDoConfig(config));
    setOrientacaoAntes((config.imagem_antes_orientacao as ImagemOrientacaoSlide) ?? 'paisagem');
    setOrientacaoDepois((config.imagem_depois_orientacao as ImagemOrientacaoSlide) ?? 'paisagem');
    setOrientacaoFundo(orientacaoImagemFundoDoConfig(config));
  }, [blocoId]);

  const handleUpload = async (
    key: string,
    orientacaoKey: string,
    orientacao: ImagemOrientacaoSlide,
    file: File,
  ) => {
    setUploadingKey(key);
    try {
      const { file: processado } = await processarImagemSlide(file, orientacao);
      const url = await onUpload(processado);
      onConfigChange({ [key]: url, [orientacaoKey]: orientacao });
      toast.success(`Imagem ajustada para ${labelOrientacaoSlide(orientacao)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao processar imagem');
    } finally {
      setUploadingKey(null);
    }
  };

  const handleGaleriaUpload = async (file: File) => {
    setUploadingKey('galeria');
    try {
      const { file: processado } = await processarImagemSlide(file, orientacaoGaleria);
      const url = await onUpload(processado);
      const atuais = imagensGaleriaDoConfig(config);
      onConfigChange({
        imagens: [...atuais, { url, orientacao: orientacaoGaleria }],
      });
      toast.success(`Imagem ajustada para ${labelOrientacaoSlide(orientacaoGaleria)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao processar imagem');
    } finally {
      setUploadingKey(null);
    }
  };

  const removerGaleria = (index: number) => {
    const atuais = imagensGaleriaDoConfig(config);
    onConfigChange({ imagens: atuais.filter((_, i) => i !== index) });
  };

  const patchOrientacao = (orientacaoKey: string, orientacao: ImagemOrientacaoSlide) => {
    onConfigChange({ [orientacaoKey]: orientacao });
  };

  const galeriaTitulo = (t: BlocoTipo): string => {
    if (t === 'galeria_projetos') return 'Fotos da galeria';
    if (t === 'imagens_orcamento') return 'Fotos de referência';
    const temImagemPrincipal = ['capa', 'valorizacao', 'comparativo_ferragens', 'imagem_interativa'].includes(t);
    return temImagemPrincipal ? 'Fotos adicionais' : 'Fotos do bloco';
  };

  return (
    <div className="flex flex-col gap-3 mt-3 pt-3 border-t border-border/40">
      <h4 className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wide">
        <ImageIcon className="h-3.5 w-3.5 text-amber-400" />
        Imagens do bloco
      </h4>
      <p className="text-[11px] text-muted-foreground">{FORMATO_IMAGEM_SLIDE_HINT}</p>

      <ImagemUploadZona
        formatoSlide
        label="Imagem de fundo do bloco"
        descricao="Cobre o slide inteiro. Textos e cards ganham sombra para continuar legíveis."
        valor={urlImagemFundoDoConfig(config) ?? ''}
        orientacao={orientacaoFundo}
        onOrientacaoChange={(o) => {
          setOrientacaoFundo(o);
          if (urlImagemFundoDoConfig(config)) onConfigChange({ imagem_fundo_orientacao: o });
        }}
        onUpload={(f) => handleUpload('imagem_fundo_url', 'imagem_fundo_orientacao', orientacaoFundo, f)}
        onRemover={() => onConfigChange({ imagem_fundo_url: '', imagem_fundo_orientacao: 'paisagem' })}
        isUploading={uploadingKey === 'imagem_fundo_url'}
      />

      {tipo === 'antes_depois' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ImagemUploadZona
            formatoSlide
            label="Foto — Antes"
            valor={urlDoConfig(config, 'imagem_antes_url') ?? ''}
            orientacao={orientacaoAntes}
            onOrientacaoChange={(o) => {
              setOrientacaoAntes(o);
              if (urlDoConfig(config, 'imagem_antes_url')) patchOrientacao('imagem_antes_orientacao', o);
            }}
            onUpload={(f) => handleUpload('imagem_antes_url', 'imagem_antes_orientacao', orientacaoAntes, f)}
            onRemover={() => onConfigChange({ imagem_antes_url: '', imagem_antes_orientacao: 'paisagem' })}
            isUploading={uploadingKey === 'imagem_antes_url'}
          />
          <ImagemUploadZona
            formatoSlide
            label="Foto — Depois"
            valor={urlDoConfig(config, 'imagem_depois_url') ?? ''}
            orientacao={orientacaoDepois}
            onOrientacaoChange={(o) => {
              setOrientacaoDepois(o);
              if (urlDoConfig(config, 'imagem_depois_url')) patchOrientacao('imagem_depois_orientacao', o);
            }}
            onUpload={(f) => handleUpload('imagem_depois_url', 'imagem_depois_orientacao', orientacaoDepois, f)}
            onRemover={() => onConfigChange({ imagem_depois_url: '', imagem_depois_orientacao: 'paisagem' })}
            isUploading={uploadingKey === 'imagem_depois_url'}
          />
        </div>
      )}

      {tipo === 'capa' && (
        <ImagemUploadZona
          formatoSlide
          label="Foto da capa"
          descricao="Aparece na capa do slide."
          valor={urlDoConfig(config, 'imagem_url') ?? ''}
          orientacao={orientacaoCapa}
          onOrientacaoChange={(o) => {
            setOrientacaoCapa(o);
            if (urlDoConfig(config, 'imagem_url')) patchOrientacao('imagem_orientacao', o);
          }}
          onUpload={(f) => handleUpload('imagem_url', 'imagem_orientacao', orientacaoCapa, f)}
          onRemover={() => onConfigChange({ imagem_url: '', imagem_orientacao: 'paisagem' })}
          isUploading={uploadingKey === 'imagem_url'}
        />
      )}

      {(tipo === 'valorizacao' || tipo === 'comparativo_ferragens' || tipo === 'imagem_interativa') && (
        <ImagemUploadZona
          formatoSlide
          label={
            tipo === 'valorizacao'
              ? 'Foto do ambiente'
              : tipo === 'comparativo_ferragens'
                ? 'Imagem comparativa'
                : 'Imagem interativa'
          }
          valor={urlDoConfig(config, 'imagem_url') ?? ''}
          orientacao={orientacaoCapa}
          onOrientacaoChange={(o) => {
            setOrientacaoCapa(o);
            if (urlDoConfig(config, 'imagem_url')) patchOrientacao('imagem_orientacao', o);
          }}
          onUpload={(f) => handleUpload('imagem_url', 'imagem_orientacao', orientacaoCapa, f)}
          onRemover={() => onConfigChange({ imagem_url: '', imagem_orientacao: 'paisagem' })}
          isUploading={uploadingKey === 'imagem_url'}
        />
      )}

      <EditorGaleriaFotos
        config={config}
        orientacaoGaleria={orientacaoGaleria}
        onOrientacaoChange={setOrientacaoGaleria}
        uploading={uploadingKey === 'galeria'}
        onUpload={handleGaleriaUpload}
        onRemover={removerGaleria}
        titulo={galeriaTitulo(tipo)}
        descricao={tipo === 'imagens_orcamento' ? HINT_IMAGENS_ORCAMENTO : undefined}
      />
    </div>
  );
}
