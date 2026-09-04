import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, Coins } from 'lucide-react';
import { formatBRLPontua } from '@/lib/pontua-garbo-arquiteto';
import type { PontuaMesBucket } from '@/lib/pontua-garbo-metricas';
import {
  finCard,
  finCardMuted,
  finChartAxis,
  finChartGrid,
  finChartTooltip,
  finSerieCadastro,
  finSeriePontuando,
} from '@/components/financeiro/financeiro-styles';

const EIXO_TICK = { fill: finChartAxis, fontSize: 11 } as const;

/** O eixo X mostra `label` (`set`); o tooltip quer `labelLongo` (`setembro 2026`). */
function tituloTooltip(label: unknown, payload: readonly { payload?: PontuaMesBucket }[] = []) {
  return payload[0]?.payload?.labelLongo ?? String(label ?? '');
}

function abreviarBRL(v: number) {
  if (v >= 1000) return `R$${Math.round(v / 1000)}k`;
  return `R$${Math.round(v)}`;
}

function MolduraGrafico({
  icone,
  titulo,
  descricao,
  acessorio,
  children,
}: {
  icone: React.ReactNode;
  titulo: string;
  descricao: string;
  acessorio?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-2xl border p-5 sm:p-6 ${finCard}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl text-[#1a100c]">
            {icone}
            {titulo}
          </h2>
          <p className={`${finCardMuted} mt-1 max-w-md`}>{descricao}</p>
        </div>
        {acessorio}
      </div>
      {children}
    </section>
  );
}

interface CadastrosChartProps {
  serie: PontuaMesBucket[];
  acessorio?: React.ReactNode;
}

/**
 * Cadastros por mês contra quantos arquitetos pontuaram no mesmo mês.
 * Duas séries no máximo — a paleta marrom só separa dois tons com segurança.
 */
export function PontuaCadastrosChart({ serie, acessorio }: CadastrosChartProps) {
  const vazio = serie.every((b) => b.cadastrados === 0 && b.pontuaram === 0);

  return (
    <MolduraGrafico
      icone={<BarChart3 className="h-4 w-4 text-[#b45309]" aria-hidden />}
      titulo="Entrada de arquitetos por mês"
      descricao="Quem foi cadastrado no Pontua e quantos desses fecharam venda ganha no mesmo mês."
      acessorio={acessorio}
    >
      {vazio ? (
        <p className="py-10 text-center text-sm text-[#6b5244]">
          Nenhum cadastro registrado no período escolhido.
        </p>
      ) : (
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={serie} barGap={2} barCategoryGap="26%">
              <CartesianGrid strokeDasharray="4 4" stroke={finChartGrid} vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={EIXO_TICK} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={EIXO_TICK}
                allowDecimals={false}
                width={32}
              />
              <Tooltip
                cursor={{ fill: 'rgba(26,16,12,0.05)' }}
                contentStyle={finChartTooltip}
                labelStyle={{ color: '#1a100c', fontSize: 12, fontWeight: 600, marginBottom: 4 }}
                labelFormatter={tituloTooltip}
                formatter={(valor, nome) => [String(valor ?? 0), String(nome ?? '')]}
              />
              <Legend
                verticalAlign="top"
                align="left"
                height={30}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, color: finChartAxis, paddingBottom: 8 }}
              />
              <Bar
                dataKey="cadastrados"
                name="Cadastrados"
                fill={finSerieCadastro}
                radius={[4, 4, 0, 0]}
                maxBarSize={34}
              />
              <Bar
                dataKey="pontuaram"
                name="Pontuaram"
                fill={finSeriePontuando}
                radius={[4, 4, 0, 0]}
                maxBarSize={34}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </MolduraGrafico>
  );
}

interface ComissoesChartProps {
  serie: PontuaMesBucket[];
  mediaMensal: number;
}

/** Comissão que efetivamente saiu por mês, com a média do período como referência. */
export function PontuaComissoesChart({ serie, mediaMensal }: ComissoesChartProps) {
  const vazio = serie.every((b) => b.comissaoPaga === 0);

  return (
    <MolduraGrafico
      icone={<Coins className="h-4 w-4 text-[#b45309]" aria-hidden />}
      titulo="Comissão paga por mês"
      descricao="Saques aprovados e lançados no período. A linha marca a média mensal."
    >
      {vazio ? (
        <p className="py-10 text-center text-sm text-[#6b5244]">
          Nenhuma comissão paga no período escolhido.
        </p>
      ) : (
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={serie} barCategoryGap="26%">
              <CartesianGrid strokeDasharray="4 4" stroke={finChartGrid} vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={EIXO_TICK} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={EIXO_TICK}
                tickFormatter={abreviarBRL}
                width={52}
              />
              <Tooltip
                cursor={{ fill: 'rgba(26,16,12,0.05)' }}
                contentStyle={finChartTooltip}
                labelStyle={{ color: '#1a100c', fontSize: 12, fontWeight: 600, marginBottom: 4 }}
                labelFormatter={tituloTooltip}
                formatter={(valor) => [formatBRLPontua(Number(valor) || 0), 'Comissão paga']}
              />
              {mediaMensal > 0 && (
                <ReferenceLine
                  y={mediaMensal}
                  stroke="#6b3f12"
                  strokeDasharray="5 4"
                  strokeWidth={1.5}
                  label={{
                    value: `média ${formatBRLPontua(mediaMensal)}`,
                    position: 'insideTopRight',
                    fill: '#6b3f12',
                    fontSize: 10,
                  }}
                />
              )}
              <Bar
                dataKey="comissaoPaga"
                name="Comissão paga"
                fill={finSerieCadastro}
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </MolduraGrafico>
  );
}
