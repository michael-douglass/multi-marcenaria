import type { TipoChavePix } from '@/hooks/usePrestadorPerfil';

const TIPO_PIX_LABELS: Record<TipoChavePix, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  telefone: 'Telefone',
  aleatoria: 'Chave Aleatória',
};

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function formatarData(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface ReciboSaqueOpts {
  prestadorNome: string;
  valorSolicitado: number;
  chavePix: string;
  tipoChavePix: string;
  processadoEm: string | null;
  logoUrl?: string | null;
  nomeEmpresa?: string | null;
  razaoSocial?: string | null;
  cnpj?: string | null;
}

const RECIBO_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11pt;
    color: #111;
    background: #f4f4f4;
  }

  .pagina {
    width: 148mm;
    margin: 16mm auto;
    background: #fff;
    border: 1px solid #d0d0d0;
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  }

  /* ── Cabeçalho ─────────────────────────────────── */
  .cabecalho {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 18px 12px;
    background: #1a1a1a;
    color: #fff;
  }

  .logo {
    max-height: 48px;
    max-width: 100px;
    object-fit: contain;
    flex-shrink: 0;
  }

  .empresa-info {
    flex: 1;
    min-width: 0;
  }

  .empresa-nome {
    font-size: 12pt;
    font-weight: 700;
    color: #fff;
    line-height: 1.2;
    word-break: break-word;
  }

  .empresa-cnpj {
    font-size: 8.5pt;
    color: #aaa;
    margin-top: 2px;
  }

  /* ── Título do documento ─────────────────────── */
  .titulo-bloco {
    background: #f7c948;
    padding: 8px 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .titulo {
    font-size: 10pt;
    font-weight: 700;
    color: #1a1a1a;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .data-emissao {
    font-size: 8pt;
    color: #5a4000;
  }

  /* ── Corpo ────────────────────────────────────── */
  .corpo {
    padding: 20px 18px 16px;
  }

  .mensagem-principal {
    font-size: 13.5pt;
    font-weight: 700;
    color: #111;
    line-height: 1.45;
    margin-bottom: 4px;
  }

  .valor-destaque {
    color: #1a7a1a;
    white-space: nowrap;
  }

  .programa-label {
    font-size: 9pt;
    color: #555;
    margin-top: 4px;
    font-style: italic;
  }

  /* ── Divisor ──────────────────────────────────── */
  .divisor {
    border: none;
    border-top: 1px dashed #ccc;
    margin: 14px 18px;
  }

  /* ── Detalhes de pagamento ────────────────────── */
  .detalhes {
    padding: 0 18px 16px;
  }

  .detalhes-titulo {
    font-size: 8pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #888;
    margin-bottom: 8px;
  }

  .detalhe-linha {
    display: flex;
    justify-content: space-between;
    font-size: 9.5pt;
    color: #333;
    padding: 3px 0;
    border-bottom: 1px solid #f0f0f0;
  }

  .detalhe-label {
    color: #777;
    flex-shrink: 0;
    padding-right: 8px;
  }

  .detalhe-valor {
    font-weight: 600;
    text-align: right;
    word-break: break-all;
  }

  /* ── Rodapé / assinatura ──────────────────────── */
  .rodape {
    padding: 12px 18px;
    background: #f7f7f7;
    border-top: 1px solid #e0e0e0;
    text-align: center;
  }

  .rodape-razao {
    font-size: 8.5pt;
    font-weight: 600;
    color: #333;
  }

  .rodape-cnpj {
    font-size: 8pt;
    color: #666;
    margin-top: 2px;
  }

  /* ── Impressão ────────────────────────────────── */
  /* ── Barra de ações ──────────────────────────── */
  .acoes {
    display: flex;
    justify-content: center;
    gap: 10px;
    padding: 14px 18px;
    background: #f0f0f0;
    border-top: 1px solid #ddd;
  }

  .btn-acao {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 18px;
    border: none;
    border-radius: 5px;
    font-size: 10pt;
    font-weight: 700;
    cursor: pointer;
    letter-spacing: 0.03em;
  }

  .btn-imprimir {
    background: #1a1a1a;
    color: #fff;
  }

  .btn-jpg {
    background: #f7c948;
    color: #1a1a1a;
  }

  .btn-acao:hover { opacity: 0.85; }

  @media print {
    body { background: #fff; }
    .pagina { border: 1px solid #ccc; box-shadow: none; margin: 0 auto; }
    .acoes { display: none; }
  }
`;

export function abrirReciboSaque(opts: ReciboSaqueOpts): void {
  const {
    prestadorNome,
    valorSolicitado,
    chavePix,
    tipoChavePix,
    processadoEm,
    logoUrl,
    nomeEmpresa,
    razaoSocial,
    cnpj,
  } = opts;

  const tipoLabel = TIPO_PIX_LABELS[tipoChavePix as TipoChavePix] ?? tipoChavePix;
  const nomeDisplay = nomeEmpresa?.trim() || '';
  const razaoDisplay = razaoSocial?.trim() || nomeDisplay;
  const dataFormatada = formatarData(processadoEm);
  const valorFormatado = BRL(valorSolicitado);

  const cabecalhoHTML = `
    <div class="cabecalho">
      ${logoUrl ? `<img src="${esc(logoUrl)}" alt="Logo" class="logo" />` : ''}
      <div class="empresa-info">
        ${nomeDisplay ? `<div class="empresa-nome">${esc(nomeDisplay)}</div>` : ''}
        ${cnpj ? `<div class="empresa-cnpj">CNPJ: ${esc(cnpj)}</div>` : ''}
      </div>
    </div>
  `;

  const rodapeHTML =
    razaoDisplay || cnpj
      ? `
    <div class="rodape">
      ${razaoDisplay ? `<div class="rodape-razao">${esc(razaoDisplay)}</div>` : ''}
      ${cnpj ? `<div class="rodape-cnpj">CNPJ: ${esc(cnpj)}</div>` : ''}
    </div>
  `
      : '';

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Recibo de Saque — ${esc(prestadorNome)}</title>
  <style>${RECIBO_CSS}</style>
</head>
<body>
  <div class="pagina">

    ${cabecalhoHTML}

    <div class="titulo-bloco">
      <span class="titulo">Recibo de Saque</span>
      <span class="data-emissao">${dataFormatada}</span>
    </div>

    <div class="corpo">
      <p class="mensagem-principal">
        Parab&eacute;ns, <strong>${esc(prestadorNome)}</strong>! Voc&ecirc; sacou
        <span class="valor-destaque">${esc(valorFormatado)}</span>
        no programa Pontua Garbo.
      </p>
    </div>

    <hr class="divisor" />

    <div class="detalhes">
      <p class="detalhes-titulo">Detalhes do pagamento</p>

      <div class="detalhe-linha">
        <span class="detalhe-label">Forma de pagamento</span>
        <span class="detalhe-valor">Pix</span>
      </div>

      <div class="detalhe-linha">
        <span class="detalhe-label">Tipo de chave</span>
        <span class="detalhe-valor">${esc(tipoLabel)}</span>
      </div>

      <div class="detalhe-linha">
        <span class="detalhe-label">Chave Pix</span>
        <span class="detalhe-valor">${esc(chavePix)}</span>
      </div>

      <div class="detalhe-linha">
        <span class="detalhe-label">Pago em</span>
        <span class="detalhe-valor">${dataFormatada}</span>
      </div>
    </div>

    ${rodapeHTML}

    <div class="acoes">
      <button class="btn-acao btn-imprimir" onclick="window.print()">
        🖨️&nbsp; Imprimir / PDF
      </button>
      <button class="btn-acao btn-jpg" onclick="salvarJpg()">
        📷&nbsp; Salvar JPG
      </button>
    </div>

  </div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
  <script>
    function salvarJpg() {
      var pagina = document.querySelector('.pagina');
      var btn = document.querySelector('.btn-jpg');
      btn.textContent = 'Aguarde...';
      btn.disabled = true;

      html2canvas(pagina, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff'
      }).then(function(canvas) {
        var link = document.createElement('a');
        link.download = 'recibo-saque.jpg';
        link.href = canvas.toDataURL('image/jpeg', 0.95);
        link.click();
        btn.innerHTML = '📷&nbsp; Salvar JPG';
        btn.disabled = false;
      }).catch(function() {
        alert('Erro ao gerar JPG. Tente usar Imprimir > Salvar como PDF.');
        btn.innerHTML = '📷&nbsp; Salvar JPG';
        btn.disabled = false;
      });
    }
  </script>
</body>
</html>`;

  const janela = window.open('', '_blank', 'width=700,height=600');
  if (!janela) {
    alert('Permita pop-ups para gerar o recibo.');
    return;
  }
  janela.document.open();
  janela.document.write(html);
  janela.document.close();
}
