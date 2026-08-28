import type { SaquePedido } from '@/hooks/usePrestadorPerfil';

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

/** Arredonda valor monetário BRL a 2 casas (evita 0,099999… exibido como R$ 0,10). */
export function arredondarBrl(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/** Converte reais para centavos inteiros para comparações seguras. */
export function toCentavos(value: number): number {
  return Math.round(arredondarBrl(value) * 100);
}

/** Interpreta texto digitado em pt-BR (ex.: "0,10", "0.10", "1.234,56"). */
export function parseValorMonetarioBr(input: string): number | null {
  const trimmed = input.trim().replace(/[^\d,.-]/g, '');
  if (!trimmed) return null;

  const normalized = trimmed.includes(',')
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : trimmed;

  const v = parseFloat(normalized);
  if (!Number.isFinite(v) || v <= 0) return null;
  return arredondarBrl(v);
}

/** Bloqueia saque/retirada acima do saldo de vendas já confirmadas no CRM. */
export function validarValorSaquePontuaGarbo(
  saldoParaSacar: number,
  valor: number,
): { ok: true } | { ok: false; message: string } {
  const v = arredondarBrl(Number(valor));
  if (!Number.isFinite(v) || v <= 0) {
    return { ok: false, message: 'Informe um valor válido maior que zero.' };
  }

  const saldoCent = toCentavos(saldoParaSacar);
  const valorCent = toCentavos(v);

  if (valorCent > saldoCent) {
    return {
      ok: false,
      message: `Saldo insuficiente. Disponível para sacar: ${BRL(arredondarBrl(Math.max(0, saldoParaSacar)))}.`,
    };
  }
  return { ok: true };
}

/** Soma pedidos de saque aguardando liberação do administrador. */
export function sumSaquesPendentes(pedidos: Pick<SaquePedido, 'status' | 'valor_solicitado'>[]): number {
  return pedidos
    .filter((p) => p.status === 'pendente')
    .reduce((s, p) => s + Number(p.valor_solicitado), 0);
}

export interface SaldoExibidoPrestador {
  saldoDisponivel: number;
  carteiraExibida: number;
  aGanharExibido: number;
  valorReservado: number;
}

/**
 * Valores exibidos ao prestador.
 * - Saques pagos e pedidos pendentes debitam a carteira (já saiu ou está reservado).
 * - O saldo disponível para saque também debita "A ganhar": já está liberado e aparece em "Para sacar".
 */
export function calcSaldoExibidoPrestador(
  saldoParaSacar: number,
  totalComissaoCarteira: number,
  totalAGanar: number,
  totalRetirado: number,
  totalComissaoGanha: number,
  totalAjustes: number,
  pedidos: Pick<SaquePedido, 'status' | 'valor_solicitado'>[],
): SaldoExibidoPrestador {
  const valorReservado = arredondarBrl(sumSaquesPendentes(pedidos));
  const retirado = arredondarBrl(totalRetirado);
  const debitadoTotal = arredondarBrl(retirado + valorReservado);
  const comissaoJaRealizada = arredondarBrl(totalComissaoGanha + totalAjustes);
  const saldoBruto = arredondarBrl(saldoParaSacar);
  const saldoDisponivel = Math.max(0, arredondarBrl(saldoBruto - valorReservado));

  const carteiraExibida = Math.max(
    0,
    arredondarBrl(totalComissaoCarteira - debitadoTotal - saldoDisponivel),
  );
  const debitadoDoPendente = Math.max(0, arredondarBrl(debitadoTotal - comissaoJaRealizada));
  const aGanharExibido = Math.max(0, arredondarBrl(totalAGanar - debitadoDoPendente));

  return {
    valorReservado,
    saldoDisponivel,
    carteiraExibida,
    aGanharExibido,
  };
}
