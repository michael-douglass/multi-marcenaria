/** Regras de senha do CRM: alinhadas ao Auth (mínimo 6); pode ser só números. */
export const PASSWORD_MIN_LENGTH = 6;

export function validateCrmPassword(password: string): string | null {
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    return `Senha deve ter no mínimo ${PASSWORD_MIN_LENGTH} caracteres`;
  }
  return null;
}

export const PASSWORD_RULES_HINT =
  'Mínimo 6 caracteres. Pode ser só números (ex.: o telefone).';

/** Traduz mensagens típicas do Supabase Auth para português claro. */
export function mapAuthPasswordError(raw: string): string {
  const msg = (raw || '').toLowerCase();
  if (msg.includes('pwned') || msg.includes('leaked') || msg.includes('known to be weak')) {
    return 'Esta senha é fraca ou já vazou na internet. Escolha outra mais segura.';
  }
  const minMatch = msg.match(/at least (\d+) character/);
  if (minMatch) {
    return `Senha deve ter no mínimo ${minMatch[1]} caracteres`;
  }
  if (msg.includes('weak_password') || msg.includes('weak password')) {
    return 'Senha rejeitada pelas regras de segurança do login. Tente outra combinação de números.';
  }
  if (msg.includes('same_password') || msg.includes('different from the old')) {
    return 'A nova senha precisa ser diferente da senha atual.';
  }
  if (msg.includes('uppercase') || msg.includes('maiúscula') || msg.includes('maiuscula')) {
    return 'Se o sistema ainda exigir maiúscula, desative essa regra em Auth → Password no Supabase.';
  }
  return raw || 'Não foi possível redefinir a senha';
}
