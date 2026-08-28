export interface AcessoUsuarioTextoInput {
  site: string;
  login: string;
  senha: string;
  nome?: string | null;
}

/** Texto pronto para o admin enviar ao usuário (site + login + senha). */
export function buildAcessoUsuarioTexto({
  site,
  login,
  senha,
  nome,
}: AcessoUsuarioTextoInput): string {
  const saudacao = nome?.trim()
    ? `Olá, ${nome.trim()}!`
    : 'Olá!';

  return [
    saudacao,
    '',
    'Segue seu acesso à plataforma:',
    '',
    `Site: ${site.replace(/\/$/, '')}`,
    `Login: ${login}`,
    `Senha: ${senha}`,
    '',
    'Entre no site com o login e a senha acima. Se precisar, peça uma nova senha ao administrador.',
  ].join('\n');
}

/** Gera senha temporária só com números (6 dígitos). */
export function gerarSenhaTemporariaAcesso(): string {
  const n = Math.floor(100000 + Math.random() * 900000);
  return String(n);
}
