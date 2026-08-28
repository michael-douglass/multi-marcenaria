import type {
  OrcamentoDados,
  OrcamentoDadosMeta,
  OrcamentoPrecificacao,
} from '@/lib/orcamento-slide-types';

export type OrcamentoEtapaRascunho = 1 | 2 | 3 | 4;

export interface OrcamentoFormSnapshotInput {
  clienteNome: string;
  identificador: string;
  vinculoLeadId: number | null;
  etapa: OrcamentoEtapaRascunho;
  respostas: Record<string, string | string[]>;
  precificacao: OrcamentoPrecificacao;
  prazoEntrega: string;
  inicioExecucao: string;
  garantiaMeses: string;
  textosBlocos?: Record<string, string>;
  ocultarAnaliseIa?: boolean;
  linkPublicoOculto?: boolean;
}

export function embedMetaDados(
  dados: Omit<OrcamentoDados, '_meta'>,
  etapa: OrcamentoEtapaRascunho,
  metaExtra?: Omit<Partial<OrcamentoDadosMeta>, 'etapa'>,
): OrcamentoDados {
  return { ...dados, _meta: { ...metaExtra, etapa } };
}

export function parseEtapaRascunho(dados: OrcamentoDados | null | undefined): OrcamentoEtapaRascunho {
  const raw = dados?._meta?.etapa;
  if (raw === 2 || raw === 3 || raw === 4) return raw;
  return 1;
}

export function snapshotOrcamentoForm(input: OrcamentoFormSnapshotInput): string {
  return JSON.stringify(input);
}

export function identificadorRascunhoOrcamento(clienteNome: string): string {
  const nome = clienteNome.trim();
  if (nome.length >= 2) {
    const slug = nome
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 24)
      .toUpperCase();
    if (slug) return `RASC-${slug}`;
  }
  return `RASC-${Date.now().toString(36).toUpperCase()}`;
}
