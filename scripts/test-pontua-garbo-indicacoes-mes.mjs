/**
 * Totais Pontua Garbo por mês (aberto/fechado) + navegação no card.
 * Rode: node --test scripts/test-pontua-garbo-indicacoes-mes.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function isLeadVendaGanha(status, statusesGanho) {
  const s = (status ?? '').trim();
  if (statusesGanho?.length) {
    return statusesGanho.some((st) => s === st || (st.length > 0 && s.includes(st)));
  }
  return s === 'Venda Realizada (Matriculado)' || s.includes('Venda Realizada');
}

function isOrcamentoIndicadoAberto(status, ganhoStatuses) {
  const s = (status ?? '').trim();
  if (!s) return true;
  if (isLeadVendaGanha(s, ganhoStatuses)) return false;
  if (/perdid/i.test(s)) return false;
  return true;
}

function isOrcamentoIndicadoFechado(status, ganhoStatuses) {
  return isLeadVendaGanha(status, ganhoStatuses);
}

function monthKeyFromLeadDate(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 7);
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return trimmed.slice(0, 7);
}

function monthKeyDaIndicacao(lead, ganhoStatuses) {
  if (isOrcamentoIndicadoFechado(lead.status, ganhoStatuses)) {
    return monthKeyFromLeadDate(lead.venda_realizada_em ?? lead.data_chegada ?? lead.criado_em);
  }
  if (isOrcamentoIndicadoAberto(lead.status, ganhoStatuses)) {
    return monthKeyFromLeadDate(lead.data_chegada ?? lead.criado_em);
  }
  return null;
}

function accumulateIndicacoesPorMes(leads, ganhoStatuses) {
  const porMes = {};
  let aberto = 0;
  let fechado = 0;
  let primeiroMes = null;

  for (const lead of leads) {
    const isFechado = isOrcamentoIndicadoFechado(lead.status, ganhoStatuses);
    const isAberto = isOrcamentoIndicadoAberto(lead.status, ganhoStatuses);
    if (!isFechado && !isAberto) continue;

    const key = monthKeyDaIndicacao(lead, ganhoStatuses);
    if (!key) continue;

    const bucket = porMes[key] ?? { aberto: 0, fechado: 0 };
    if (isFechado) {
      bucket.fechado += 1;
      fechado += 1;
    } else {
      bucket.aberto += 1;
      aberto += 1;
    }
    porMes[key] = bucket;
    if (!primeiroMes || key < primeiroMes) primeiroMes = key;
  }

  return { porMes, aberto, fechado, primeiroMes };
}

function shiftMonthKey(key, delta) {
  const [yearRaw, monthRaw] = key.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return key;
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

function clampMonthKey(key, minKey, maxKey) {
  if (key < minKey) return minKey;
  if (key > maxKey) return maxKey;
  return key;
}

function rangeMesDoBadge(primeiroMes, mesAtual) {
  const maxMes = mesAtual;
  const minMes = primeiroMes && primeiroMes < mesAtual ? primeiroMes : mesAtual;
  return { minMes, maxMes };
}

function getTotaisDoMes(porMes, monthKey) {
  return porMes?.[monthKey] ?? { aberto: 0, fechado: 0 };
}

describe('navegação de mês no card Pontua Garbo', () => {
  it('avança e volta o mês sem pular', () => {
    assert.equal(shiftMonthKey('2026-08', -1), '2026-07');
    assert.equal(shiftMonthKey('2026-01', -1), '2025-12');
    assert.equal(shiftMonthKey('2026-12', 1), '2027-01');
  });

  it('não deixa ir além do mês atual nem antes da primeira indicação', () => {
    const { minMes, maxMes } = rangeMesDoBadge('2026-05', '2026-08');
    assert.equal(minMes, '2026-05');
    assert.equal(maxMes, '2026-08');
    assert.equal(clampMonthKey('2026-08', minMes, maxMes), '2026-08');
    assert.equal(clampMonthKey('2026-04', minMes, maxMes), '2026-05');
    assert.equal(clampMonthKey('2026-09', minMes, maxMes), '2026-08');
  });

  it('sem indicações, o card fica só no mês atual', () => {
    const { minMes, maxMes } = rangeMesDoBadge(null, '2026-08');
    assert.equal(minMes, '2026-08');
    assert.equal(maxMes, '2026-08');
  });
});

describe('totais Aberto/Fechado por mês', () => {
  const ganho = ['Venda Realizada (Matriculado)'];

  it('mostra o mês atual separado dos outros meses', () => {
    const totais = accumulateIndicacoesPorMes(
      [
        { id: 1, status: 'Novo Lead', data_chegada: '2026-08-03' },
        { id: 2, status: 'Novo Lead', data_chegada: '2026-08-20' },
        { id: 3, status: 'Venda Realizada (Matriculado)', data_chegada: '2026-07-10', venda_realizada_em: '2026-08-12' },
        { id: 4, status: 'Venda Realizada (Matriculado)', data_chegada: '2026-07-01', venda_realizada_em: '2026-07-18' },
        { id: 5, status: 'Lead Perdido', data_chegada: '2026-08-01' },
      ],
      ganho,
    );

    assert.equal(totais.aberto, 2);
    assert.equal(totais.fechado, 2);
    assert.equal(totais.primeiroMes, '2026-07');
    assert.deepEqual(getTotaisDoMes(totais.porMes, '2026-08'), { aberto: 2, fechado: 1 });
    assert.deepEqual(getTotaisDoMes(totais.porMes, '2026-07'), { aberto: 0, fechado: 1 });
    assert.deepEqual(getTotaisDoMes(totais.porMes, '2026-06'), { aberto: 0, fechado: 0 });
  });

  it('indicação aberta conta no mês da chegada', () => {
    const totais = accumulateIndicacoesPorMes(
      [{ id: 10, status: 'Em negociação', data_chegada: '2026-06-15' }],
      ganho,
    );
    assert.deepEqual(getTotaisDoMes(totais.porMes, '2026-06'), { aberto: 1, fechado: 0 });
    assert.deepEqual(getTotaisDoMes(totais.porMes, '2026-08'), { aberto: 0, fechado: 0 });
  });
});

describe('código do card e do hook', () => {
  it('o selo troca o mês no card fechado e começa em todos os meses', () => {
    const badge = readFileSync(
      join(root, 'src/components/leads/LeadPontuaGarboPartnerBadge.tsx'),
      'utf8',
    );
    assert.match(badge, /MonthSwitcher/);
    assert.match(badge, /stopPropagation/);
    assert.match(badge, /MES_TODOS/);
    assert.match(badge, /Todos os meses/);
    assert.match(badge, /orçamento/);
    assert.match(badge, /variant === 'card'/);
  });

  it('o mapa do parceiro agrupa indicações por mês', () => {
    const hook = readFileSync(join(root, 'src/hooks/usePontuaGarboPartnerLeads.ts'), 'utf8');
    assert.match(hook, /accumulateIndicacoesPorMes/);
    assert.match(hook, /venda_realizada_em/);
    assert.match(hook, /porMes/);
    assert.match(hook, /pickBestPartnerLead/);
    assert.match(hook, /unidoExistente/);
  });
});

const STOPWORDS = new Set([
  'de', 'da', 'do', 'dos', 'das', 'e', 'arquiteto', 'arquiteta',
  'arquitetura', 'arquitetos', 'estudio', 'studio', 'consultor', 'prestador',
]);

function normalizePartnerName(value) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function partnerNameTokens(value) {
  return normalizePartnerName(value)
    .split(' ')
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function tokenInList(token, list) {
  return list.some((item) => item === token || item.startsWith(token) || token.startsWith(item));
}

function scorePartnerLeadMatch(user, lead) {
  const userTokens = partnerNameTokens(user.nome);
  const leadTokens = partnerNameTokens(lead.nome);
  if (userTokens.length === 0 || leadTokens.length === 0) return 0;
  const userNorm = normalizePartnerName(user.nome);
  const leadNorm = normalizePartnerName(lead.nome);
  const startsWithUser =
    leadNorm.startsWith(userNorm) ||
    (userTokens.length >= 2 && leadTokens[0] === userTokens[0] && leadTokens[1] === userTokens[1]);
  const firstMatches = leadTokens[0] === userTokens[0];
  const remainingUser = userTokens.slice(1);
  const remainingMatched = remainingUser.filter((token) => tokenInList(token, leadTokens));
  let score = 0;
  if (startsWithUser) score = 90;
  else if (firstMatches && remainingUser.length === 0) score = leadTokens.length <= 2 ? 75 : 20;
  else if (firstMatches && remainingMatched.length >= 1 && leadTokens.length <= userTokens.length + 2) score = 80;
  else if (firstMatches && remainingMatched.length >= 1) score = 40;
  if (userTokens.length === 1 && leadTokens.length > 2) score = Math.min(score, 20);
  const userEmail = (user.email ?? '').trim().toLowerCase();
  const leadEmail = (lead.email ?? '').trim().toLowerCase();
  if (userEmail && leadEmail && userEmail === leadEmail) score = Math.max(score, 85);
  const status = (lead.status ?? '').toLowerCase();
  const nomeBruto = (lead.nome ?? '').toLowerCase();
  if (status.includes('arquitet') || nomeBruto.includes('arquitet')) score += 6;
  return Math.min(100, score);
}

function pickBestPartnerLead(user, candidates) {
  let best = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    if (candidate.pontua_garbo_usuario_id && candidate.pontua_garbo_usuario_id !== user.usuarioId) continue;
    const score = scorePartnerLeadMatch(user, candidate);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return bestScore >= 70 ? best : null;
}

describe('unir arquiteto Pontua ao card da pessoa, não do cliente', () => {
  const joao = { usuarioId: 'jp', nome: 'João Paulo', telefone: '553592775071' };

  it('escolhe o card João Paulo Vilela e ignora cliente com o mesmo telefone', () => {
    const best = pickBestPartnerLead(joao, [
      { id: 7071, nome: 'Monique e Matheus ', telefone: '553592775071' },
      { id: 7175, nome: 'João Paulo Vilela (arquiteto)', telefone: '55359277507', status: 'Cliente' },
      { id: 9216, nome: ' IRENE E FERNANDO  - João Paulo', telefone: '553592775071', status: 'Enviou orçamento' },
    ]);
    assert.equal(best?.id, 7175);
    assert.ok(scorePartnerLeadMatch(joao, best) >= 70);
    assert.ok(scorePartnerLeadMatch(joao, { id: 7071, nome: 'Monique e Matheus ' }) < 70);
    assert.ok(scorePartnerLeadMatch(joao, { id: 9216, nome: ' IRENE E FERNANDO  - João Paulo' }) < 70);
  });

  it('une Julia Honório ao escritório dela, não a outro card', () => {
    const best = pickBestPartnerLead(
      { usuarioId: 'jh', nome: 'Julia Honório' },
      [
        { id: 1, nome: 'Cliente da Julia', status: 'Enviou orçamento' },
        { id: 9141, nome: 'Julia Honório Arquitetura', status: 'Arquiteto' },
      ],
    );
    assert.equal(best?.id, 9141);
  });
});
