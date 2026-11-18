import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ImagePlus, Loader2, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApp } from '@/context/AppContext';
import { useEmpresaBranding, type EmpresaDadosInput } from '@/hooks/useEmpresaBranding';
import { resolveBrandLogo } from '@/lib/app-branding';
import { CnpjReceitaIndisponivel, consultarCnpjReceita } from '@/lib/cnpj-receita';
import { cnpjValido, formatCep, formatCnpj, formatTelefone, somenteDigitos } from '@/lib/empresa-identidade';
import { cn } from '@/lib/utils';

/**
 * Edição única da identidade da empresa ativa: logo/cor, CNPJ (com busca na Receita) e dados
 * cadastrais. Usado no /profile (admin) e em /admin/marca. Grava pela RPC `empresa_atualizar_dados`.
 */

type Campos = {
  nome: string;
  razao_social: string;
  cnpj: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  telefone: string;
  email: string;
  cor_primaria: string;
};

interface EmpresaDadosFormProps {
  /** `perfil`: tons dourados sobre fundo escuro do /profile. `padrao`: tema do app. */
  tom?: 'padrao' | 'perfil';
  className?: string;
}

const DEBOUNCE_MS = 600;
const COR_PADRAO = '#f97316';

export function EmpresaDadosForm({ tom = 'padrao', className }: EmpresaDadosFormProps) {
  const { empresa } = useApp();
  const { salvarDadosEmpresa, removerLogo } = useEmpresaBranding();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ultimoConsultado = useRef<string>('');

  const [campos, setCampos] = useState<Campos>(() => camposDe(empresa));
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(empresa?.logoUrl ?? null);
  const [buscando, setBuscando] = useState(false);
  const [situacao, setSituacao] = useState<string | null>(null);
  const [cnpjEditado, setCnpjEditado] = useState(false);

  // Recarrega o formulário quando a empresa chega/muda (corrige o CNPJ vazio da tela antiga).
  useEffect(() => {
    setCampos(camposDe(empresa));
    setLogoPreview(empresa?.logoUrl ?? null);
    setLogoFile(null);
    setCnpjEditado(false);
    ultimoConsultado.current = somenteDigitos(empresa?.cnpj);
  }, [empresa]);

  const cnpjDigitos = somenteDigitos(campos.cnpj);
  const cnpjCompleto = cnpjDigitos.length === 14;
  const cnpjOk = cnpjValido(cnpjDigitos);

  const buscarNaReceita = async (forcar = false) => {
    if (!cnpjValido(cnpjDigitos)) {
      toast.error('CNPJ inválido. Confira os 14 números.');
      return;
    }
    if (!forcar && ultimoConsultado.current === cnpjDigitos) return;
    ultimoConsultado.current = cnpjDigitos;
    setBuscando(true);
    try {
      const d = await consultarCnpjReceita(cnpjDigitos);
      if (!d) {
        toast.error('CNPJ não encontrado na Receita. Preencha os dados manualmente.');
        setSituacao(null);
        return;
      }
      setSituacao(d.situacao || null);
      setCampos((c) => ({
        ...c,
        razao_social: d.razaoSocial || c.razao_social,
        nome: d.nomeFantasia || c.nome || d.razaoSocial,
        cep: d.cep ? formatCep(d.cep) : c.cep,
        logradouro: d.logradouro || c.logradouro,
        numero: d.numero || c.numero,
        complemento: d.complemento || c.complemento,
        bairro: d.bairro || c.bairro,
        cidade: d.cidade || c.cidade,
        uf: d.uf || c.uf,
        telefone: d.telefone ? formatTelefone(d.telefone) : c.telefone,
        email: d.email || c.email,
      }));
      toast.success('Dados da Receita preenchidos. Revise e salve.');
    } catch (e) {
      const msg = e instanceof CnpjReceitaIndisponivel ? e.message : 'Erro ao consultar a Receita.';
      toast.error(msg);
    } finally {
      setBuscando(false);
    }
  };

  // Consulta automática (debounce) quando o admin digita um CNPJ completo e válido.
  useEffect(() => {
    if (!cnpjEditado || !cnpjOk || ultimoConsultado.current === cnpjDigitos) return;
    const t = setTimeout(() => void buscarNaReceita(), DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispara só pela mudança do CNPJ
  }, [cnpjDigitos, cnpjOk, cnpjEditado]);

  const set = (k: keyof Campos) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setCampos((c) => ({ ...c, [k]: e.target.value }));

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return void toast.error('Selecione um arquivo de imagem válido');
    if (file.size > 2 * 1024 * 1024) return void toast.error('Imagem muito grande. Máximo: 2 MB');
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleRemoverLogo = async () => {
    if (logoFile && !empresa?.logoUrl) {
      setLogoFile(null);
      setLogoPreview(null);
      return;
    }
    await removerLogo.mutateAsync();
    setLogoFile(null);
    setLogoPreview(null);
  };

  const handleSalvar = async () => {
    if (!campos.nome.trim()) return void toast.error('Informe o nome fantasia.');
    if (cnpjDigitos && !cnpjOk) return void toast.error('CNPJ inválido. Confira os 14 números.');
    if (campos.uf.trim() && !/^[a-zA-Z]{2}$/.test(campos.uf.trim())) return void toast.error('UF deve ter 2 letras.');
    const dados: EmpresaDadosInput = {
      nome: campos.nome.trim(),
      razao_social: campos.razao_social.trim() || null,
      cnpj: cnpjDigitos || null,
      cep: somenteDigitos(campos.cep) || null,
      logradouro: campos.logradouro.trim() || null,
      numero: campos.numero.trim() || null,
      complemento: campos.complemento.trim() || null,
      bairro: campos.bairro.trim() || null,
      cidade: campos.cidade.trim() || null,
      uf: campos.uf.trim().toUpperCase() || null,
      telefone: campos.telefone.trim() || null,
      email: campos.email.trim() || null,
      cor_primaria: campos.cor_primaria || null,
    };
    await salvarDadosEmpresa.mutateAsync({ dados, logoFile });
    setLogoFile(null);
  };

  if (!empresa) {
    return <p className="text-sm text-muted-foreground">Nenhuma empresa ativa para configurar.</p>;
  }

  const perfil = tom === 'perfil';
  const cls = {
    bloco: perfil
      ? 'rounded-xl border border-[rgba(240,210,140,0.12)] bg-[rgba(255,248,235,0.03)] p-4'
      : 'rounded-lg border bg-card p-4',
    titulo: perfil
      ? 'text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#c4a88a]'
      : 'text-sm font-semibold text-foreground',
    label: perfil ? 'text-xs text-[#edd9c4]' : 'text-xs',
    input: perfil
      ? 'h-11 border-[rgba(240,210,140,0.22)] bg-[rgba(18,10,6,0.6)] text-[#f5ebe0] placeholder:text-[#c4a88a]/50 focus-visible:ring-[#f2d892]/40'
      : 'h-11',
    ajuda: perfil ? 'text-xs text-[#c4a88a]' : 'text-xs text-muted-foreground',
    botaoSec: perfil
      ? 'h-11 gap-2 border-[rgba(240,210,140,0.35)] bg-transparent text-[#f2d892] hover:bg-[#f2d892]/10 hover:text-[#f2d892]'
      : 'h-11 gap-2',
    botaoPri: perfil ? 'h-11 bg-[#f2d892] font-semibold text-[#1a0f0a] hover:bg-[#f2d892]/90' : 'h-11',
  };

  const campo = (k: keyof Campos, label: string, props: React.ComponentProps<typeof Input> = {}, span = '') => (
    <div className={cn('space-y-1.5', span)}>
      <Label htmlFor={`empresa-${k}`} className={cls.label}>
        {label}
      </Label>
      <Input id={`empresa-${k}`} value={campos[k]} onChange={set(k)} className={cls.input} {...props} />
    </div>
  );

  const salvando = salvarDadosEmpresa.isPending;
  const situacaoAlerta = situacao && situacao !== 'ATIVA';

  return (
    <div className={cn('space-y-4', className)}>
      {/* 1. Logo */}
      <div className={cls.bloco}>
        <p className={cls.titulo}>Logo</p>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div
            className={cn(
              'flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border p-2',
              perfil ? 'border-[rgba(240,210,140,0.22)] bg-[rgba(255,248,235,0.06)]' : 'bg-muted/40',
            )}
          >
            <img
              src={resolveBrandLogo(logoPreview)}
              alt={campos.nome || 'Logo da empresa'}
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <div className="flex-1 space-y-2">
            <p className={cls.ajuda}>Aparece no menu, nos slides e nos PDFs. PNG, JPG ou WebP — máximo 2 MB.</p>
            <div className="flex flex-wrap items-center gap-2">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogo} />
              <Button type="button" variant="outline" className={cls.botaoSec} onClick={() => fileInputRef.current?.click()}>
                <ImagePlus className="h-4 w-4" />
                Enviar logo
              </Button>
              {(logoPreview || empresa.logoUrl) && (
                <Button
                  type="button"
                  variant="outline"
                  className={cls.botaoSec}
                  onClick={() => void handleRemoverLogo()}
                  disabled={removerLogo.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                  Remover
                </Button>
              )}
              <div className="flex items-center gap-2">
                <Label htmlFor="empresa-cor" className={cls.label}>
                  Cor
                </Label>
                <input
                  type="color"
                  id="empresa-cor"
                  value={campos.cor_primaria}
                  onChange={(e) => setCampos((c) => ({ ...c, cor_primaria: e.target.value }))}
                  className="h-11 w-11 cursor-pointer rounded border bg-transparent"
                  aria-label="Cor de destaque"
                />
              </div>
            </div>
            {logoFile && <p className={cls.ajuda}>Nova logo selecionada — será enviada ao salvar.</p>}
          </div>
        </div>
      </div>

      {/* 2. CNPJ */}
      <div className={cls.bloco}>
        <p className={cls.titulo}>CNPJ</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="empresa-cnpj" className={cls.label}>
              CNPJ da empresa
            </Label>
            <div className="relative">
              <Input
                id="empresa-cnpj"
                inputMode="numeric"
                value={campos.cnpj}
                onChange={(e) => {
                  setCnpjEditado(true);
                  setSituacao(null);
                  setCampos((c) => ({ ...c, cnpj: formatCnpj(e.target.value) }));
                }}
                placeholder="00.000.000/0000-00"
                maxLength={18}
                aria-invalid={cnpjCompleto && !cnpjOk}
                className={cn(cls.input, cnpjCompleto && !cnpjOk && 'border-destructive')}
              />
              {buscando && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin opacity-70" />
              )}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className={cls.botaoSec}
            onClick={() => void buscarNaReceita(true)}
            disabled={!cnpjOk || buscando}
          >
            <Search className="h-4 w-4" />
            Buscar na Receita
          </Button>
        </div>
        {cnpjCompleto && !cnpjOk && <p className="mt-2 text-xs text-destructive">CNPJ inválido.</p>}
        {!cnpjCompleto && <p className={cn('mt-2', cls.ajuda)}>Ao completar o CNPJ, buscamos os dados na Receita.</p>}
        {situacaoAlerta && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-500">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Situação na Receita: {situacao}. Confira antes de usar nos documentos.
          </p>
        )}
      </div>

      {/* 3. Dados cadastrais */}
      <div className={cls.bloco}>
        <p className={cls.titulo}>Dados cadastrais</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-6">
          {campo('razao_social', 'Razão social', { placeholder: 'Razão social' }, 'sm:col-span-6')}
          {campo('nome', 'Nome fantasia (aparece no sistema)', { placeholder: 'Nome da sua empresa' }, 'sm:col-span-6')}
          {campo('cep', 'CEP', { inputMode: 'numeric', placeholder: '00000-000', maxLength: 9, onChange: (e) => setCampos((c) => ({ ...c, cep: formatCep(e.target.value) })) }, 'sm:col-span-2')}
          {campo('logradouro', 'Logradouro', {}, 'sm:col-span-4')}
          {campo('numero', 'Número', {}, 'sm:col-span-2')}
          {campo('complemento', 'Complemento', {}, 'sm:col-span-4')}
          {campo('bairro', 'Bairro', {}, 'sm:col-span-3')}
          {campo('cidade', 'Cidade', {}, 'sm:col-span-2')}
          {campo('uf', 'UF', { maxLength: 2, onChange: (e) => setCampos((c) => ({ ...c, uf: e.target.value.toUpperCase() })) }, 'sm:col-span-1')}
          {campo('telefone', 'Telefone', { inputMode: 'tel', placeholder: '(00) 0000-0000' }, 'sm:col-span-3')}
          {campo('email', 'E-mail', { type: 'email', placeholder: 'contato@empresa.com.br' }, 'sm:col-span-3')}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" className={cls.botaoPri} onClick={() => void handleSalvar()} disabled={salvando || !campos.nome.trim()}>
          {salvando ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando…
            </>
          ) : (
            'Salvar dados da empresa'
          )}
        </Button>
      </div>
    </div>
  );
}

function camposDe(e: ReturnType<typeof useApp>['empresa']): Campos {
  return {
    nome: e?.nome ?? '',
    razao_social: e?.razaoSocial ?? '',
    cnpj: formatCnpj(e?.cnpj),
    cep: formatCep(e?.cep),
    logradouro: e?.logradouro ?? '',
    numero: e?.numero ?? '',
    complemento: e?.complemento ?? '',
    bairro: e?.bairro ?? '',
    cidade: e?.cidade ?? '',
    uf: e?.uf ?? '',
    telefone: formatTelefone(e?.telefone),
    email: e?.email ?? '',
    cor_primaria: e?.corPrimaria || COR_PADRAO,
  };
}
