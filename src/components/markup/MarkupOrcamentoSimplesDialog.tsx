import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FileDown, ImagePlus, Plus, Printer, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MarkupOrcamentoSimplesAura } from '@/components/markup/MarkupOrcamentoSimplesAura';
import { MarkupOrcamentoSimplesFolha } from '@/components/markup/MarkupOrcamentoSimplesFolha';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useLeadMidiasParaOrcamento } from '@/hooks/useLeadMidiasParaOrcamento';
import { useMarkupConfig } from '@/hooks/useMarkupConfig';
import type { SalvarMarkupOrcamentoInput } from '@/hooks/useMarkupOrcamentos';
import { runWithFilePickerGuard } from '@/lib/dialog-outside-guard';
import { formatarMoedaMarkup } from '@/lib/markup-calculo';
import {
  MARKUP_ORCAMENTO_SIMPLES_ALTURA_MIN_PX,
  MARKUP_ORCAMENTO_SIMPLES_LARGURA_PX,
  MARKUP_ORCAMENTO_SIMPLES_MAX_FOTOS,
  MARKUP_ORCAMENTO_SIMPLES_MAX_UPLOAD_BYTES,
  MARKUP_ORCAMENTO_SIMPLES_TIPOS_UPLOAD,
  calcularTotaisOrcamentoSimples,
  centavosParaReais,
  criarItemOrcamentoSimples,
  criarOrcamentoSimplesPadrao,
  documentoPersistivelOrcamentoSimples,
  normalizarOrcamentoSimples,
  parseMoedaBrParaCentavos,
} from '@/lib/markup-orcamento-simples';
import {
  exportarOrcamentoSimplesJpg,
  exportarOrcamentoSimplesPdf,
  incorporarImagemOrcamento,
} from '@/lib/markup-orcamento-simples-export';
import { setMarkupOrcamentoSimplesOpenFlag } from '@/lib/markup-ui';
import type { MarkupOrcamento, MarkupOrcamentoSimples } from '@/lib/markup-types';
import { cn } from '@/lib/utils';

interface MarkupOrcamentoSimplesTriggerProps {
  disabled?: boolean;
  onClick: () => void;
}

export function MarkupOrcamentoSimplesTrigger({
  disabled = false,
  onClick,
}: MarkupOrcamentoSimplesTriggerProps) {
  return (
    <Button
      size="sm"
      variant="outline"
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? 'Calcule um markup primeiro' : 'Imprimir folha comercial para o cliente'}
    >
      <Printer className="h-4 w-4 mr-1" />
      Imprimir
    </Button>
  );
}

interface MarkupOrcamentoSimplesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: number;
  leadNome?: string;
  orcamentos: MarkupOrcamento[];
  salvarOrcamento: (input: SalvarMarkupOrcamentoInput) => Promise<MarkupOrcamento>;
}

export function MarkupOrcamentoSimplesDialog({
  open,
  onOpenChange,
  leadId,
  leadNome,
  orcamentos,
  salvarOrcamento,
}: MarkupOrcamentoSimplesDialogProps) {
  const { empresa } = useEmpresa();
  const { data: config } = useMarkupConfig();
  const midias = useLeadMidiasParaOrcamento(leadId);
  const [origemId, setOrigemId] = useState<string | null>(null);
  const [doc, setDoc] = useState<MarkupOrcamentoSimples>(() =>
    criarOrcamentoSimplesPadrao({ titulo: leadNome || 'Orçamento', preco_final: 0 }),
  );
  const [fotosEmbutidas, setFotosEmbutidas] = useState<string[]>([]);
  const [logoEmbutida, setLogoEmbutida] = useState<string>('');
  const [exportando, setExportando] = useState<'pdf' | 'jpg' | null>(null);
  const [filePickerActive, setFilePickerActive] = useState(false);
  const folhaRef = useRef<HTMLDivElement>(null);
  const origemCarregadaRef = useRef<string | null>(null);
  const docRef = useRef(doc);
  const origemIdRef = useRef(origemId);
  docRef.current = doc;
  origemIdRef.current = origemId;

  const origem = useMemo(
    () => orcamentos.find((item) => item.id === origemId) ?? orcamentos[0] ?? null,
    [orcamentos, origemId],
  );

  const fotosLead = useMemo(
    () => (midias.data ?? []).filter((item) => item.tipo_arquivo !== 'pdf'),
    [midias.data],
  );

  const totais = useMemo(() => calcularTotaisOrcamentoSimples(doc), [doc]);

  const branding = useMemo(
    () => ({
      empresaNome: empresa?.razao_social?.trim() || empresa?.nome || 'Garbo Movelaria',
      empresaCnpj: empresa?.cnpj ?? null,
      logoUrl: logoEmbutida || config?.timbrado_url || empresa?.logo_url || null,
    }),
    [empresa, config?.timbrado_url, logoEmbutida],
  );

  useEffect(() => {
    setMarkupOrcamentoSimplesOpenFlag(open);
    return () => setMarkupOrcamentoSimplesOpenFlag(false);
  }, [open]);

  useEffect(() => {
    if (!open) {
      origemCarregadaRef.current = null;
      setOrigemId(null);
      return;
    }
    setOrigemId((atual) => atual ?? orcamentos[0]?.id ?? null);
  }, [open, orcamentos]);

  useEffect(() => {
    if (!open || !origem) return;
    if (origemCarregadaRef.current === origem.id) return;
    origemCarregadaRef.current = origem.id;
    setDoc(
      origem.modulos.meta?.orcamento_simples
        ? normalizarOrcamentoSimples(origem.modulos.meta.orcamento_simples, origem)
        : criarOrcamentoSimplesPadrao(origem),
    );
  }, [open, origem]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const logoSrc = config?.timbrado_url || empresa?.logo_url || '';
    void Promise.all([
      logoSrc ? incorporarImagemOrcamento(logoSrc) : Promise.resolve(''),
      ...doc.fotos.map((foto) => incorporarImagemOrcamento(foto.url)),
    ]).then(([logo, ...fotos]) => {
      if (cancelled) return;
      setLogoEmbutida(logo || logoSrc);
      setFotosEmbutidas(fotos.filter(Boolean));
    });
    return () => {
      cancelled = true;
    };
  }, [open, doc.fotos, config?.timbrado_url, empresa?.logo_url]);

  const persistir = useCallback(async () => {
    const atual = orcamentos.find((item) => item.id === origemIdRef.current) ?? orcamentos[0];
    if (!atual) return;
    await salvarOrcamento({
      id: atual.id,
      lead_id: atual.lead_id,
      titulo: atual.titulo,
      status: atual.status,
      preco_final: atual.preco_final,
      observacoes_rodape: atual.observacoes_rodape,
      silent: true,
      modulos: {
        ...atual.modulos,
        meta: {
          ...atual.modulos.meta,
          orcamento_simples: documentoPersistivelOrcamentoSimples(docRef.current),
        },
      },
    });
  }, [orcamentos, salvarOrcamento]);

  const fechar = (next: boolean) => {
    if (!next) {
      void persistir();
    }
    onOpenChange(next);
  };

  const trocarOrigem = async (nextId: string) => {
    await persistir();
    origemCarregadaRef.current = null;
    setOrigemId(nextId);
  };

  const atualizarItem = (id: string, patch: Partial<MarkupOrcamentoSimples['itens'][number]>) => {
    setDoc((atual) => ({
      ...atual,
      itens: atual.itens.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const adicionarItem = () => {
    setDoc((atual) => ({
      ...atual,
      itens: [...atual.itens, criarItemOrcamentoSimples('Novo item', 0, 1)],
    }));
  };

  const removerItem = (id: string) => {
    setDoc((atual) => {
      if (atual.itens.length <= 1) return atual;
      return { ...atual, itens: atual.itens.filter((item) => item.id !== id) };
    });
  };

  const toggleFotoLead = (url: string, id: string) => {
    setDoc((atual) => {
      const jaTem = atual.fotos.some((foto) => foto.url === url);
      if (jaTem) {
        return { ...atual, fotos: atual.fotos.filter((foto) => foto.url !== url) };
      }
      if (atual.fotos.length >= MARKUP_ORCAMENTO_SIMPLES_MAX_FOTOS) {
        toast.error(`No máximo ${MARKUP_ORCAMENTO_SIMPLES_MAX_FOTOS} fotos na folha.`);
        return atual;
      }
      return {
        ...atual,
        fotos: [...atual.fotos, { id, url, origem: 'lead' as const }],
      };
    });
  };

  const adicionarFotoLocal = (file: File) => {
    if (!MARKUP_ORCAMENTO_SIMPLES_TIPOS_UPLOAD.includes(file.type as (typeof MARKUP_ORCAMENTO_SIMPLES_TIPOS_UPLOAD)[number])) {
      toast.error('Use JPEG, PNG, WebP ou GIF.');
      return;
    }
    if (file.size > MARKUP_ORCAMENTO_SIMPLES_MAX_UPLOAD_BYTES) {
      toast.error('Cada foto do computador pode ter no máximo 4 MB.');
      return;
    }
    if (doc.fotos.length >= MARKUP_ORCAMENTO_SIMPLES_MAX_FOTOS) {
      toast.error(`No máximo ${MARKUP_ORCAMENTO_SIMPLES_MAX_FOTOS} fotos na folha.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || '');
      if (!url) return;
      setDoc((atual) => {
        if (atual.fotos.length >= MARKUP_ORCAMENTO_SIMPLES_MAX_FOTOS) return atual;
        return {
          ...atual,
          fotos: [
            ...atual.fotos,
            { id: `local-${Date.now()}-${file.name}`, url, origem: 'local' as const },
          ],
        };
      });
    };
    reader.readAsDataURL(file);
  };

  const exportar = async (formato: 'pdf' | 'jpg') => {
    const folha = folhaRef.current?.querySelector<HTMLElement>('[data-markup-orcamento-folha]');
    if (!folha) {
      toast.error('A prévia ainda não está pronta.');
      return;
    }
    setExportando(formato);
    try {
      await persistir();
      if (formato === 'pdf') {
        await exportarOrcamentoSimplesPdf(folha, doc.titulo);
      } else {
        await exportarOrcamentoSimplesJpg(folha, doc.titulo);
      }
      toast.success(formato === 'pdf' ? 'PDF baixado.' : 'JPG baixado.');
    } catch (erro) {
      toast.error('Não foi possível gerar o arquivo', {
        description: erro instanceof Error ? erro.message : undefined,
      });
    } finally {
      setExportando(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent
        nested
        data-markup-orcamento-simples=""
        overlayClassName="!z-[70]"
        className="flex max-h-[96vh] w-[calc(100%-1rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:h-[92vh] !z-[71]"
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        aria-describedby={undefined}
      >
        <DialogHeader className="relative overflow-hidden border-b border-[#c4a35a]/25 px-5 py-4 sm:px-6">
          <MarkupOrcamentoSimplesAura />
          <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p
                className="text-[11px] uppercase tracking-[0.28em] text-[#c4a35a]"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
              >
                Folha comercial
              </p>
              <DialogTitle
                className="mt-1 text-2xl font-normal text-[#f3e6cf]"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
              >
                Orçamento simples
              </DialogTitle>
              <DialogDescription className="sr-only">
                Monte a lista de itens, fotos e validade da proposta que o cliente recebe em PDF.
              </DialogDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() => void exportar('pdf')}
                disabled={!!exportando}
              >
                <FileDown className="h-4 w-4" />
                {exportando === 'pdf' ? 'Gerando…' : 'PDF'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() => void exportar('jpg')}
                disabled={!!exportando}
              >
                <FileDown className="h-4 w-4" />
                {exportando === 'jpg' ? 'Gerando…' : 'JPG'}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.92fr)]">
          <div className="min-h-0 overflow-y-auto border-b border-border/40 p-4 sm:p-5 lg:border-b-0 lg:border-r">
            {orcamentos.length > 1 ? (
              <div className="mb-4 space-y-1.5">
                <Label>Markup de origem</Label>
                <Select value={origem?.id} onValueChange={(value) => void trocarOrigem(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha o caderno" />
                  </SelectTrigger>
                  <SelectContent>
                    {orcamentos.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.titulo} · {formatarMoedaMarkup(item.preco_final)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="orcamento-simples-titulo">Título da proposta</Label>
              <Input
                id="orcamento-simples-titulo"
                value={doc.titulo}
                onChange={(event) => setDoc((atual) => ({ ...atual, titulo: event.target.value }))}
              />
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Itens</Label>
                <Button size="sm" variant="ghost" type="button" onClick={adicionarItem}>
                  <Plus className="h-3.5 w-3.5" />
                  Linha
                </Button>
              </div>
              <ul className="space-y-2">
                {doc.itens.map((item) => (
                  <li
                    key={item.id}
                    className="grid grid-cols-[minmax(0,1fr)_4.5rem_7.5rem_auto] gap-2 rounded-md border border-border/50 p-2"
                  >
                    <Input
                      aria-label="Descrição"
                      placeholder="Descrição comercial"
                      value={item.descricao}
                      onChange={(event) => atualizarItem(item.id, { descricao: event.target.value })}
                    />
                    <Input
                      aria-label="Quantidade"
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.quantidade}
                      onChange={(event) =>
                        atualizarItem(item.id, { quantidade: Number(event.target.value) || 0 })
                      }
                    />
                    <MoedaCentavosInput
                      valueCentavos={item.unitario_centavos}
                      onChange={(centavos) => atualizarItem(item.id, { unitario_centavos: centavos })}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-10 w-10 text-muted-foreground hover:text-destructive"
                      disabled={doc.itens.length <= 1}
                      aria-label="Remover item"
                      onClick={() => removerItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Desconto</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={doc.desconto_tipo === 'percent' ? 'default' : 'outline'}
                    onClick={() => setDoc((atual) => ({ ...atual, desconto_tipo: 'percent', desconto_valor: 0 }))}
                  >
                    %
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={doc.desconto_tipo === 'reais' ? 'default' : 'outline'}
                    onClick={() => setDoc((atual) => ({ ...atual, desconto_tipo: 'reais', desconto_valor: 0 }))}
                  >
                    R$
                  </Button>
                </div>
                {doc.desconto_tipo === 'percent' ? (
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={doc.desconto_valor}
                    onChange={(event) =>
                      setDoc((atual) => ({
                        ...atual,
                        desconto_valor: Math.min(100, Math.max(0, Number(event.target.value) || 0)),
                      }))
                    }
                  />
                ) : (
                  <MoedaCentavosInput
                    valueCentavos={doc.desconto_valor}
                    onChange={(centavos) =>
                      setDoc((atual) => ({
                        ...atual,
                        desconto_valor: Math.min(totais.subtotal_centavos, centavos),
                      }))
                    }
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="orcamento-simples-validade">Validade (dias)</Label>
                <Input
                  id="orcamento-simples-validade"
                  type="number"
                  min={1}
                  value={doc.validade_dias}
                  onChange={(event) =>
                    setDoc((atual) => ({
                      ...atual,
                      validade_dias: Math.max(1, Math.round(Number(event.target.value) || 1)),
                    }))
                  }
                />
              </div>
            </div>

            <div className="relative mt-4 overflow-hidden rounded-lg border border-[#c4a35a]/25 p-3">
              <MarkupOrcamentoSimplesAura intensity={0.45} />
              <div className="relative z-10 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Fotos ({doc.fotos.length}/{MARKUP_ORCAMENTO_SIMPLES_MAX_FOTOS})</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/jpeg,image/png,image/webp,image/gif';
                      input.multiple = true;
                      input.onchange = () => {
                        Array.from(input.files ?? []).forEach(adicionarFotoLocal);
                      };
                      runWithFilePickerGuard(setFilePickerActive, () => input.click());
                    }}
                  >
                    <ImagePlus className="h-3.5 w-3.5" />
                    Do computador
                  </Button>
                </div>
                {filePickerActive ? (
                  <p className="text-[11px] text-muted-foreground">Escolhendo arquivo…</p>
                ) : null}
                {fotosLead.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Este lead ainda não tem fotos nos anexos. Você pode enviar do computador — elas
                    entram só nesta impressão.
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                    {fotosLead.map((foto) => {
                      const ativa = doc.fotos.some((item) => item.url === foto.file_url);
                      return (
                        <button
                          key={foto.id}
                          type="button"
                          onClick={() => toggleFotoLead(foto.file_url, foto.id)}
                          className={cn(
                            'relative aspect-square overflow-hidden rounded-md bg-black/20',
                            ativa ? 'ring-2 ring-[#c4a35a] ring-offset-2 ring-offset-background' : 'ring-1 ring-border/60',
                          )}
                          aria-pressed={ativa}
                          title={ativa ? 'Tirar da folha' : 'Incluir na folha'}
                        >
                          <img src={foto.file_url} alt="" className="h-full w-full object-cover" />
                        </button>
                      );
                    })}
                  </div>
                )}
                {doc.fotos.some((foto) => foto.origem === 'local') ? (
                  <p className="text-[11px] text-muted-foreground">
                    Fotos do computador ficam só nesta tela — não são gravadas no caderno.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-4 space-y-1.5">
              <Label htmlFor="orcamento-simples-obs">Observações</Label>
              <Textarea
                id="orcamento-simples-obs"
                rows={4}
                value={doc.observacoes}
                onChange={(event) => setDoc((atual) => ({ ...atual, observacoes: event.target.value }))}
              />
            </div>

            <p
              className="mt-4 text-2xl text-[#c4a35a]"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
            >
              Total {formatarMoedaMarkup(centavosParaReais(totais.total_centavos))}
            </p>
          </div>

          <FolhaPreviewPane>
            <MarkupOrcamentoSimplesFolha
              doc={doc}
              branding={branding}
              clienteNome={leadNome?.trim() || 'Cliente'}
              fotosEmbutidas={fotosEmbutidas}
            />
          </FolhaPreviewPane>
        </div>

        <div
          ref={folhaRef}
          aria-hidden
          className="pointer-events-none fixed left-[-10000px] top-0"
          style={{ width: MARKUP_ORCAMENTO_SIMPLES_LARGURA_PX }}
        >
          <MarkupOrcamentoSimplesFolha
            doc={doc}
            branding={branding}
            clienteNome={leadNome?.trim() || 'Cliente'}
            fotosEmbutidas={fotosEmbutidas}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FolhaPreviewPane({ children }: { children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [altura, setAltura] = useState(MARKUP_ORCAMENTO_SIMPLES_ALTURA_MIN_PX);

  useEffect(() => {
    const host = hostRef.current;
    const inner = innerRef.current;
    if (!host || !inner) return;
    const atualizar = () => {
      const largura = Math.max(host.clientWidth - 32, 160);
      setScale(largura / MARKUP_ORCAMENTO_SIMPLES_LARGURA_PX);
      setAltura(Math.max(inner.scrollHeight, MARKUP_ORCAMENTO_SIMPLES_ALTURA_MIN_PX));
    };
    const ro = new ResizeObserver(atualizar);
    ro.observe(host);
    ro.observe(inner);
    atualizar();
    return () => ro.disconnect();
  }, [children]);

  return (
    <div ref={hostRef} className="min-h-[420px] overflow-auto p-4" style={{ background: '#140e0b' }}>
      <div
        style={{
          width: MARKUP_ORCAMENTO_SIMPLES_LARGURA_PX * scale,
          height: altura * scale,
          margin: '0 auto',
        }}
      >
        <div
          ref={innerRef}
          style={{
            width: MARKUP_ORCAMENTO_SIMPLES_LARGURA_PX,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            boxShadow: '0 28px 80px rgba(0,0,0,0.55)',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function MoedaCentavosInput({
  valueCentavos,
  onChange,
}: {
  valueCentavos: number;
  onChange: (centavos: number) => void;
}) {
  const [focado, setFocado] = useState(false);
  const [texto, setTexto] = useState('');
  const formatado = formatarMoedaMarkup(centavosParaReais(valueCentavos)).replace(/^\s*R\$\s?/, '');

  return (
    <Input
      aria-label="Valor unitário"
      inputMode="decimal"
      value={focado ? texto : formatado}
      onFocus={() => {
        setFocado(true);
        setTexto(formatado);
      }}
      onChange={(event) => setTexto(event.target.value)}
      onBlur={() => {
        onChange(parseMoedaBrParaCentavos(texto));
        setFocado(false);
      }}
    />
  );
}
