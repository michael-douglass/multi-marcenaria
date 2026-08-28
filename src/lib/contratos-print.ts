import { CONTRATO_DOCUMENT_CSS } from '@/lib/contrato-document-styles';
import type { ContratoAnexo } from '@/hooks/useContratoAnexos';
import { isImageAttachment } from '@/lib/attachment-files';

/** Nome técnico da variável fixa de CPF do contratante (sempre na assinatura). */
export const VARIAVEL_CPF_FIXO = 'cpf';

export const VARIAVEL_CPF_FIXO_LABEL = 'CPF do Contratante';

export interface Assinaturas {
  nomeCliente?: string;
  cpfCliente?: string;
  nomeEmpresa?: string;
  razaoSocialEmpresa?: string;
  cnpjEmpresa?: string;
}

export interface PrintContratoOptions {
  conteudo: string;
  logoUrl?: string | null;
  nomeEmpresa?: string | null;
  razaoSocial?: string | null;
  cnpj?: string | null;
  assinaturas?: Assinaturas;
  anexos?: ContratoAnexo[];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildAssinaturasHTML(a: Assinaturas): string {
  const nomeContratada = a.razaoSocialEmpresa || a.nomeEmpresa;

  return `
  <div class="assinaturas">
    <p class="local-data">Local e Data: ____________________________________________, _____ de _____________________ de ________.</p>
    <div class="linha-assinatura">
      <div class="assinante">
        <div class="linha-sign"></div>
        ${a.nomeCliente ? `<p class="sign-nome">${escapeHtml(a.nomeCliente)}</p>` : ''}
        <p class="sign-doc">CPF: ${escapeHtml(a.cpfCliente || '_____________________')}</p>
        <p class="sign-papel">Contratante</p>
      </div>
      <div class="assinante">
        <div class="linha-sign"></div>
        ${nomeContratada ? `<p class="sign-nome">${escapeHtml(nomeContratada)}</p>` : ''}
        <p class="sign-doc">CNPJ: ${escapeHtml(a.cnpjEmpresa || '_____________________')}</p>
        <p class="sign-papel">Contratada</p>
      </div>
    </div>
  </div>`;
}

function buildAnexosHTML(anexos: ContratoAnexo[]): string {
  if (!anexos.length) return '';

  const itens = anexos
    .map((anexo, index) => {
      const titulo = escapeHtml(anexo.titulo || anexo.file_name);
      if (isImageAttachment(anexo)) {
        return `
        <div class="anexo-item anexo-imagem">
          <p class="anexo-titulo">${index + 1}. ${titulo}</p>
          <img src="${escapeHtml(anexo.file_url)}" alt="${titulo}" class="anexo-img" />
        </div>`;
      }
      return `
        <div class="anexo-item">
          <p class="anexo-titulo">${index + 1}. ${titulo}</p>
          <p class="anexo-link"><a href="${escapeHtml(anexo.file_url)}" target="_blank" rel="noopener">${escapeHtml(anexo.file_name)}</a></p>
        </div>`;
    })
    .join('');

  return `
  <div class="anexos-secao page-break-before">
    <h3 class="anexos-titulo">Anexos do contrato</h3>
    ${itens}
  </div>`;
}

export function imprimirContrato(opts: PrintContratoOptions) {
  const { conteudo, logoUrl, nomeEmpresa, razaoSocial, cnpj, assinaturas, anexos = [] } = opts;

  const assinaturasBloco = buildAssinaturasHTML({
    nomeCliente: assinaturas?.nomeCliente,
    cpfCliente: assinaturas?.cpfCliente,
    nomeEmpresa: nomeEmpresa ?? undefined,
    razaoSocialEmpresa: razaoSocial ?? assinaturas?.razaoSocialEmpresa,
    cnpjEmpresa: cnpj ?? assinaturas?.cnpjEmpresa,
  });

  const conteudoHtml = escapeHtml(conteudo);

  const cabecalho = `
    <div class="cabecalho">
      ${logoUrl ? `<img src="${logoUrl}" alt="Logo" class="logo" />` : ''}
      <div class="empresa-info">
        ${nomeEmpresa ? `<h2 class="empresa-nome">${escapeHtml(nomeEmpresa)}</h2>` : ''}
        ${cnpj ? `<p class="empresa-cnpj">CNPJ: ${escapeHtml(cnpj)}</p>` : ''}
      </div>
    </div>
    ${nomeEmpresa || cnpj ? '<hr class="divisor" />' : ''}
  `;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Contrato</title>
  <style>${CONTRATO_DOCUMENT_CSS}</style>
</head>
<body>
  <div class="pagina">
    ${cabecalho}
    <div class="conteudo">${conteudoHtml}</div>
    ${assinaturasBloco}
    ${buildAnexosHTML(anexos)}
  </div>
  <script>
    window.onload = function() {
      window.focus();
      window.print();
      setTimeout(() => window.close(), 500);
    };
  </script>
</body>
</html>`;

  const janela = window.open('', '_blank', 'width=900,height=700');
  if (!janela) {
    alert('Permita pop-ups para imprimir o contrato.');
    return;
  }
  janela.document.open();
  janela.document.write(html);
  janela.document.close();
}

export function substituirVariaveis(
  template: string,
  valores: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, nome) => valores[nome] ?? `{{${nome}}}`);
}

export function extrairVariaveis(template: string): string[] {
  const matches = template.matchAll(/\{\{(\w+)\}\}/g);
  const nomes = new Set<string>();
  for (const m of matches) nomes.add(m[1]);
  return Array.from(nomes);
}

export function gerarIdentificador(clienteNome: string): string {
  const hoje = new Date();
  const dia = hoje.getDate().toString().padStart(2, '0');
  const mes = (hoje.getMonth() + 1).toString().padStart(2, '0');
  const ano = hoje.getFullYear();
  return `${dia}/${mes}/${ano} - ${clienteNome}`;
}

/** Resolve nome e CPF do contratante — prioriza variável fixa {{cpf}}. */
export function resolverAssinaturas(
  valores: Record<string, string>,
  variaveis: Array<{ nome: string; tipo: string }>,
): { nomeCliente?: string; cpfCliente?: string } {
  const cpfFixo = valores[VARIAVEL_CPF_FIXO]?.trim();
  const varCpf = variaveis.find((v) => v.tipo === 'cpf' && v.nome !== VARIAVEL_CPF_FIXO);
  const varNome = variaveis.find(
    (v) =>
      v.tipo === 'texto' &&
      /nome|cliente|contratante/.test(v.nome.toLowerCase()),
  );
  return {
    nomeCliente: varNome ? valores[varNome.nome]?.trim() : undefined,
    cpfCliente: cpfFixo || (varCpf ? valores[varCpf.nome]?.trim() : undefined),
  };
}

export function buildAssinaturasCompletas(
  valores: Record<string, string>,
  variaveis: Array<{ nome: string; tipo: string }>,
  empresa: {
    nomeFantasia?: string;
    razaoSocial?: string;
    cnpj?: string;
  },
): Assinaturas {
  const base = resolverAssinaturas(valores, variaveis);
  return {
    ...base,
    nomeEmpresa: empresa.nomeFantasia,
    razaoSocialEmpresa: empresa.razaoSocial || empresa.nomeFantasia,
    cnpjEmpresa: empresa.cnpj,
  };
}
