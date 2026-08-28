/** Dados de demonstração do Pontua Garbo — só para a apresentação (não são reais). */

export const GARBO_PONTUA_DEMO = {
  eyebrow: 'PROGRAMA DE PONTUAÇÃO',
  title: 'Programa de Pontuação Garbo para Parceiros',
  subtitle:
    'Veja, na prática, como o arquiteto acompanha comissões, saldos e saques — com números de exemplo para facilitar o entendimento.',
  badge: 'Demonstração com dados fictícios',
  parceiro: {
    nome: 'Ana Paula Mendes',
    escritorio: 'Mendes Arquitetura',
    cidade: 'Pouso Alegre · MG',
    percentual: 10,
  },
  metricas: {
    aGanar: 8450,
    paraSacar: 12380,
    retirado: 24500,
    aguardandoLiberacao: 2100,
    totalComissaoGanha: 36880,
    ganhoMesAtual: 4200,
    mediaMensalGanhos: 6146.67,
  },
  ganhosPorMes: [
    { key: '2025-10', label: 'Out/25', valor: 3800 },
    { key: '2025-11', label: 'Nov/25', valor: 5200 },
    { key: '2025-12', label: 'Dez/25', valor: 6100 },
    { key: '2026-01', label: 'Jan/26', valor: 4900 },
    { key: '2026-02', label: 'Fev/26', valor: 8680 },
    { key: '2026-03', label: 'Mar/26', valor: 4200 },
  ],
  passos: [
    {
      step: '01',
      title: 'Indique e acompanhe',
      text: 'Cada projeto indicado pelo parceiro entra no CRM da Garbo. A comissão fica vinculada à venda.',
    },
    {
      step: '02',
      title: 'Venda realizada',
      text: 'Quando a obra é fechada, a comissão (ex.: 10%) é calculada automaticamente sobre o valor da venda.',
    },
    {
      step: '03',
      title: 'Saldo e saque',
      text: 'O arquiteto vê o que está a ganhar, o que já pode sacar e solicita o PIX direto pelo painel.',
    },
  ],
  comissoes: [
    {
      id: 'c1',
      projeto: 'Residência Serra Verde',
      cliente: 'Família Oliveira',
      valorVenda: 86000,
      comissao: 8600,
      status: 'pago' as const,
      data: '12/02/2026',
    },
    {
      id: 'c2',
      projeto: 'Apartamento Centro',
      cliente: 'Carla Nogueira',
      valorVenda: 42000,
      comissao: 4200,
      status: 'liberado' as const,
      data: '03/03/2026',
    },
    {
      id: 'c3',
      projeto: 'Closet + suíte master',
      cliente: 'Roberto Lima',
      valorVenda: 28500,
      comissao: 2850,
      status: 'em_andamento' as const,
      data: 'Em andamento',
    },
    {
      id: 'c4',
      projeto: 'Cozinha integrada',
      cliente: 'Studio Horizonte',
      valorVenda: 21000,
      comissao: 2100,
      status: 'aguardando' as const,
      data: 'Aguardando liberação',
    },
  ],
  saques: [
    { id: 's1', valor: 8500, status: 'aprovado' as const, data: '28/01/2026' },
    { id: 's2', valor: 6200, status: 'aprovado' as const, data: '18/02/2026' },
    { id: 's3', valor: 4800, status: 'pendente' as const, data: '08/03/2026' },
  ],
} as const;

export type GarboPontuaComissaoStatus = (typeof GARBO_PONTUA_DEMO.comissoes)[number]['status'];
export type GarboPontuaSaqueStatus = (typeof GARBO_PONTUA_DEMO.saques)[number]['status'];

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function labelComissaoStatus(status: GarboPontuaComissaoStatus): { label: string; color: string } {
  switch (status) {
    case 'pago':
      return { label: 'Pago', color: '#4ade80' };
    case 'liberado':
      return { label: 'Para sacar', color: '#f2d892' };
    case 'em_andamento':
      return { label: 'Em andamento', color: 'rgba(168,212,255,0.95)' };
    case 'aguardando':
      return { label: 'Aguardando liberação', color: 'rgba(251,191,36,0.95)' };
    default:
      return { label: status, color: 'rgba(255,250,244,0.6)' };
  }
}
