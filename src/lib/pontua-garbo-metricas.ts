import type { PrestadorFinanceiro } from '@/hooks/usePontuaGarboFinanceiro';
import type { SaquePedido } from '@/hooks/usePrestadorPerfil';

/**
 * Métricas do painel Financeiro · Pontua Garbo.
 *
 * Tudo aqui é função pura sobre o que `usePontuaGarboFinanceiro` e
 * `useSaquePedidosAdmin` já devolvem — nenhuma query nova.
 *
 * Definições (as mesmas que aparecem nos rótulos da tela, para o número
 * não ficar ambíguo):
 * - cadastrado no mês .... `usuarios.criado_em` dentro do mês.
 * - pontuando ............ arquiteto com comissão acumulada > 0.
 * - pontuou no mês ....... teve venda ganha (`venda_realizada_em`) no mês.
 * - comissão paga ........ lançamentos tipo `saque` (dinheiro que saiu).
 */

const MES_CURTO = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

const MES_LONGO = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export interface PontuaMesBucket {
  /** `2026-09` — ordenável e estável como chave de série. */
  chave: string;
  /** `set` — eixo X. */
  label: string;
  /** `setembro 2026` — tooltip. */
  labelLongo: string;
  cadastrados: number;
  pontuaram: number;
  comissaoPaga: number;
}

export interface SaqueSolicitante {
  prestadorId: string;
  nome: string;
  titulo: string | null;
  avatarUrl: string | null;
  pedidos: SaquePedido[];
  totalPendente: number;
  totalAprovado: number;
  ultimaSolicitacao: string | null;
  temPendente: boolean;
}

export interface PontuaMetricas {
  serie: PontuaMesBucket[];
  totalCadastrados: number;
  cadastradosMes: number;
  cadastradosMesAnterior: number;
  /** Variação percentual mês a mês. `null` quando o mês anterior foi zero. */
  deltaCadastrados: number | null;
  pontuando: number;
  pontuaramNoMes: number;
  /** Fatia dos cadastrados que já pontuou, 0–100. */
  percentualPontuando: number;
  solicitantes: SaqueSolicitante[];
  solicitantesPendentes: SaqueSolicitante[];
  totalSolicitadoPendente: number;
  /** Média entre quem realmente recebeu — não dilui com quem nunca sacou. */
  mediaComissaoPaga: number;
  /** Média sobre todos os cadastrados, para contraste. */
  mediaComissaoPorCadastrado: number;
  arquitetosComComissaoPaga: number;
  totalComissaoPaga: number;
}

function chaveMes(date: Date): string {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
}

function parseData(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Últimos `meses` buckets terminando no mês de `referencia` (inclusive). */
function montarBuckets(meses: number, referencia: Date): PontuaMesBucket[] {
  const out: PontuaMesBucket[] = [];
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(referencia.getFullYear(), referencia.getMonth() - i, 1);
    out.push({
      chave: chaveMes(d),
      label: MES_CURTO[d.getMonth()],
      labelLongo: MES_LONGO[d.getMonth()] + ' ' + d.getFullYear(),
      cadastrados: 0,
      pontuaram: 0,
      comissaoPaga: 0,
    });
  }
  return out;
}

export function calcularPontuaMetricas(
  prestadores: PrestadorFinanceiro[],
  pedidos: SaquePedido[],
  opcoes?: { meses?: number; referencia?: Date },
): PontuaMetricas {
  const meses = opcoes?.meses ?? 12;
  const referencia = opcoes?.referencia ?? new Date();
  const serie = montarBuckets(meses, referencia);
  const porChave = new Map(serie.map((b) => [b.chave, b]));

  const chaveAtual = chaveMes(referencia);
  const chaveAnterior = chaveMes(
    new Date(referencia.getFullYear(), referencia.getMonth() - 1, 1),
  );

  let cadastradosMes = 0;
  let cadastradosMesAnterior = 0;
  let pontuando = 0;
  let totalComissaoPaga = 0;
  let arquitetosComComissaoPaga = 0;

  // Um arquiteto conta uma vez por mês, mesmo com várias vendas ganhas nele.
  const pontuaramPorMes = new Map<string, Set<string>>();

  for (const p of prestadores) {
    const criado = parseData(p.criadoEm);
    if (criado) {
      const chave = chaveMes(criado);
      if (chave === chaveAtual) cadastradosMes++;
      if (chave === chaveAnterior) cadastradosMesAnterior++;
      const bucket = porChave.get(chave);
      if (bucket) bucket.cadastrados++;
    }

    if (p.totalComissao > 0) pontuando++;

    if (p.totalRetirado > 0) {
      arquitetosComComissaoPaga++;
      totalComissaoPaga += p.totalRetirado;
    }

    for (const lead of p.leads) {
      if (!lead.vendaGanha || lead.comissao <= 0) continue;
      const venda = parseData(lead.vendaRealizadaEm);
      if (!venda) continue;
      const chave = chaveMes(venda);
      if (!porChave.has(chave)) continue;
      const set = pontuaramPorMes.get(chave) ?? new Set<string>();
      set.add(p.id);
      pontuaramPorMes.set(chave, set);
    }

    for (const lanc of p.lancamentos) {
      if (lanc.tipo !== 'saque') continue;
      const quando = parseData(lanc.criado_em);
      if (!quando) continue;
      const bucket = porChave.get(chaveMes(quando));
      if (bucket) bucket.comissaoPaga += Number(lanc.valor) || 0;
    }
  }

  for (const bucket of serie) {
    bucket.pontuaram = pontuaramPorMes.get(bucket.chave)?.size ?? 0;
  }

  const dadosPorId = new Map(prestadores.map((p) => [p.id, p]));
  const agrupado = new Map<string, SaqueSolicitante>();

  for (const pedido of pedidos) {
    const dono = dadosPorId.get(pedido.prestador_id);
    const atual: SaqueSolicitante = agrupado.get(pedido.prestador_id) ?? {
      prestadorId: pedido.prestador_id,
      nome: dono?.nome ?? 'Arquiteto',
      titulo: dono?.titulo ?? null,
      avatarUrl: dono?.avatarUrl ?? null,
      pedidos: [],
      totalPendente: 0,
      totalAprovado: 0,
      ultimaSolicitacao: null,
      temPendente: false,
    };

    atual.pedidos.push(pedido);
    const valor = Number(pedido.valor_solicitado) || 0;
    if (pedido.status === 'pendente') {
      atual.totalPendente += valor;
      atual.temPendente = true;
    }
    if (pedido.status === 'aprovado') atual.totalAprovado += valor;

    if (
      !atual.ultimaSolicitacao ||
      new Date(pedido.criado_em) > new Date(atual.ultimaSolicitacao)
    ) {
      atual.ultimaSolicitacao = pedido.criado_em;
    }

    agrupado.set(pedido.prestador_id, atual);
  }

  const solicitantes = Array.from(agrupado.values()).sort((a, b) => {
    if (a.temPendente !== b.temPendente) return a.temPendente ? -1 : 1;
    if (b.totalPendente !== a.totalPendente) return b.totalPendente - a.totalPendente;
    return (b.ultimaSolicitacao ?? '').localeCompare(a.ultimaSolicitacao ?? '');
  });

  const solicitantesPendentes = solicitantes.filter((s) => s.temPendente);
  const pontuaramNoMes = pontuaramPorMes.get(chaveAtual)?.size ?? 0;

  return {
    serie,
    totalCadastrados: prestadores.length,
    cadastradosMes,
    cadastradosMesAnterior,
    deltaCadastrados:
      cadastradosMesAnterior > 0
        ? ((cadastradosMes - cadastradosMesAnterior) / cadastradosMesAnterior) * 100
        : null,
    pontuando,
    pontuaramNoMes,
    percentualPontuando:
      prestadores.length > 0 ? (pontuando / prestadores.length) * 100 : 0,
    solicitantes,
    solicitantesPendentes,
    totalSolicitadoPendente: solicitantesPendentes.reduce((s, i) => s + i.totalPendente, 0),
    mediaComissaoPaga:
      arquitetosComComissaoPaga > 0 ? totalComissaoPaga / arquitetosComComissaoPaga : 0,
    mediaComissaoPorCadastrado:
      prestadores.length > 0 ? totalComissaoPaga / prestadores.length : 0,
    arquitetosComComissaoPaga,
    totalComissaoPaga,
  };
}
