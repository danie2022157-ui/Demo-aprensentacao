import React, { useState } from 'react';
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  PieChart,
  Wallet,
  Users,
  Radio,
} from 'lucide-react';
import { NavSection } from '../../types/crm';
import {
  DashboardAnalytics,
  formatCompactBRL,
  formatCurrencyBRL,
} from '../../lib/crm-engine';

interface DashboardAnalyticsSectionProps {
  analytics: DashboardAnalytics;
  onNavigate: (section: NavSection, filterHint?: string) => void;
}

export const DashboardAnalyticsSection: React.FC<
  DashboardAnalyticsSectionProps
> = ({ analytics, onNavigate }) => {
  const [hoveredFollowUpId, setHoveredFollowUpId] = useState<string | null>(
    null
  );
  const [ownerMetricMode, setOwnerMetricMode] = useState<'revenue' | 'cadence'>(
    'revenue'
  );
  const [hoveredOwner, setHoveredOwner] = useState<string | null>(null);
  const [hoveredCashBar, setHoveredCashBar] = useState<string | null>(null);

  // --- Follow-up Donut Geometry ---
  const donutSize = 132;
  const donutRadius = 48;
  const donutStroke = 14;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const totalTasks = Math.max(1, analytics.followUpHealth.totalTasks);

  let cumulativeOffset = 0;
  const donutSlices = analytics.followUpHealth.segments.map((seg) => {
    const ratio = seg.count / totalTasks;
    const dashLen = ratio * donutCircumference;
    const offset = cumulativeOffset;
    cumulativeOffset += dashLen;
    return { ...seg, dashLen, offset };
  });

  const activeFollowUpSeg = hoveredFollowUpId
    ? analytics.followUpHealth.segments.find((s) => s.id === hoveredFollowUpId)
    : null;

  // --- Cashflow Grouped Bar Chart Geometry ---
  const cashBars = [
    {
      id: 'received',
      label: 'Recebido',
      shortLabel: 'Receb.',
      value: analytics.cashflowComparison.received,
      color: '#4ADE80',
    },
    {
      id: 'pending_rec',
      label: 'A receber',
      shortLabel: 'A receb.',
      value: analytics.cashflowComparison.pendingReceivables,
      color: '#D4AF37',
    },
    {
      id: 'paid_exp',
      label: 'Desp. pagas',
      shortLabel: 'Pagas',
      value: analytics.cashflowComparison.paidExpenses,
      color: '#94A3B8',
    },
    {
      id: 'pending_exp',
      label: 'Desp. prev.',
      shortLabel: 'A pagar',
      value: analytics.cashflowComparison.pendingExpenses,
      color: '#F87171',
    },
  ];
  const maxCashVal = Math.max(10000, ...cashBars.map((b) => b.value));
  const niceCashMax = Math.ceil(maxCashVal / 20000) * 20000;
  const activeCashItem = hoveredCashBar
    ? cashBars.find((b) => b.id === hoveredCashBar)
    : null;

  // --- Owner Performance Chart Geometry ---
  const maxOwnerVolume = Math.max(
    1,
    ...analytics.ownerPerformance.map((o) => o.closedRevenue + o.openPipeline)
  );
  const activeOwnerRow = hoveredOwner
    ? analytics.ownerPerformance.find((o) => o.owner === hoveredOwner)
    : analytics.ownerPerformance[0];

  // --- Proposals Max Value ---
  const totalProposalVal = Math.max(1, analytics.proposalBreakdown.totalValue);

  return (
    <div
      data-testid="dashboard-analytics-section"
      className="space-y-6"
    >
      {/* Section Heading Divider */}
      <div className="flex flex-wrap items-baseline justify-between gap-2 pt-1">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#D4AF37]" />
            Análise Operacional e Indicadores Visuais
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Leitura em tempo real da cadência de follow-up, risco em orçamentos, caixa projetado e produtividade da equipe
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('relatorios')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#E8C96D] hover:text-[#F6E2A1] whitespace-nowrap"
        >
          Ver relatórios completos
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Row A: 3 Visual Analytics Cards (Follow-up Donut, Proposals Exposure, Cashflow Bars) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* 1. Follow-up Cadence Donut */}
        <div
          data-testid="chart-followup-donut"
          className="lg:col-span-4 bg-[#12141A] border border-white/[0.07] rounded-xl p-5 flex flex-col"
        >
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <PieChart className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                Saúde dos Follow-ups
              </h3>
              <p className="text-[11.5px] text-neutral-400 mt-0.5">
                Distribuição das{' '}
                <span className="font-mono tabular-nums text-neutral-200">
                  {analytics.followUpHealth.totalTasks}
                </span>{' '}
                atividades
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('tarefas')}
              className="text-xs text-[#E8C96D] hover:underline whitespace-nowrap"
            >
              Agenda
            </button>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-4 my-auto">
            {/* Donut SVG */}
            <div className="relative shrink-0">
              <svg
                width={donutSize}
                height={donutSize}
                viewBox={`0 0 ${donutSize} ${donutSize}`}
                role="img"
                aria-label={`Gráfico de saúde dos follow-ups: ${analytics.followUpHealth.onTimePct}% em dia`}
                className="-rotate-90"
              >
                <circle
                  cx={donutSize / 2}
                  cy={donutSize / 2}
                  r={donutRadius}
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={donutStroke}
                />
                {donutSlices.map((slice) => {
                  if (slice.count === 0) return null;
                  const isDimmed =
                    hoveredFollowUpId !== null &&
                    hoveredFollowUpId !== slice.id;
                  return (
                    <circle
                      key={slice.id}
                      cx={donutSize / 2}
                      cy={donutSize / 2}
                      r={donutRadius}
                      fill="none"
                      stroke={slice.color}
                      strokeWidth={
                        hoveredFollowUpId === slice.id
                          ? donutStroke + 2
                          : donutStroke
                      }
                      strokeDasharray={`${Math.max(0, slice.dashLen - 2)} ${
                        donutCircumference
                      }`}
                      strokeDashoffset={-slice.offset}
                      opacity={isDimmed ? 0.32 : 1}
                      className="transition-all duration-200 cursor-pointer"
                      onMouseEnter={() => setHoveredFollowUpId(slice.id)}
                      onMouseLeave={() => setHoveredFollowUpId(null)}
                      onClick={() =>
                        onNavigate('tarefas', slice.filterHint ?? 'todos')
                      }
                    />
                  );
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-3">
                <span className="text-xl font-semibold text-white font-mono tabular-nums leading-none">
                  {activeFollowUpSeg
                    ? activeFollowUpSeg.count
                    : `${analytics.followUpHealth.onTimePct}%`}
                </span>
                <span className="text-[10.5px] text-neutral-400 mt-1 leading-tight">
                  {activeFollowUpSeg ? activeFollowUpSeg.label : 'Em dia'}
                </span>
              </div>
            </div>

            {/* Interactive Legend */}
            <ul className="w-full space-y-2 text-xs">
              {analytics.followUpHealth.segments.map((seg) => (
                <li key={seg.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setHoveredFollowUpId(seg.id)}
                    onMouseLeave={() => setHoveredFollowUpId(null)}
                    onClick={() =>
                      onNavigate('tarefas', seg.filterHint ?? 'todos')
                    }
                    className={`w-full flex items-center justify-between gap-2 px-2 py-1 rounded-md transition-colors text-left ${
                      hoveredFollowUpId === seg.id
                        ? 'bg-white/[0.06]'
                        : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: seg.color }}
                      />
                      <span className="text-neutral-300 truncate">
                        {seg.label}
                      </span>
                    </span>
                    <span className="font-mono tabular-nums text-neutral-200 shrink-0">
                      {seg.count}{' '}
                      <span className="text-neutral-500">({seg.pct}%)</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 2. Proposals Conversion & Risk Composition */}
        <div
          data-testid="chart-proposals-breakdown"
          className="lg:col-span-4 bg-[#12141A] border border-white/[0.07] rounded-xl p-5 flex flex-col"
        >
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                Composição de Orçamentos
              </h3>
              <p className="text-[11.5px] text-neutral-400 mt-0.5">
                Aprovação sobre encerrados:{' '}
                <span className="font-mono tabular-nums text-[#4ADE80] font-medium">
                  {analytics.proposalBreakdown.approvalRatePct}%
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('orcamentos')}
              className="text-xs text-[#E8C96D] hover:underline whitespace-nowrap"
            >
              Orçamentos
            </button>
          </div>

          {/* Stacked Proportion Bar */}
          <div className="mb-4">
            <div className="flex items-baseline justify-between text-xs mb-1.5">
              <span className="text-neutral-400">Volume total emitido</span>
              <span className="font-mono tabular-nums font-semibold text-white">
                {formatCurrencyBRL(analytics.proposalBreakdown.totalValue)}
              </span>
            </div>
            <div
              className="h-3 rounded-full bg-white/[0.06] overflow-hidden flex gap-0.5"
              role="img"
              aria-label="Barra proporcional dos orçamentos por status"
            >
              {analytics.proposalBreakdown.segments.map((seg) => {
                const val = seg.value ?? 0;
                if (val <= 0) return null;
                const widthPct = (val / totalProposalVal) * 100;
                return (
                  <div
                    key={seg.id}
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: seg.color,
                    }}
                    title={`${seg.label}: ${formatCurrencyBRL(val)} (${seg.count})`}
                    className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-300"
                  />
                );
              })}
            </div>
          </div>

          {/* Breakdown Rows */}
          <ul className="space-y-2.5 flex-1">
            {analytics.proposalBreakdown.segments.map((seg) => (
              <li
                key={seg.id}
                className="flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="text-neutral-300 truncate">{seg.label}</span>
                  <span className="text-[11px] font-mono tabular-nums text-neutral-500">
                    ({seg.count})
                  </span>
                </div>
                <span className="font-mono tabular-nums text-neutral-100 shrink-0">
                  {formatCurrencyBRL(seg.value ?? 0)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs">
            <span className="text-neutral-400">Exposto sem retorno</span>
            <span className="font-mono tabular-nums font-semibold text-[#F59E0B]">
              {formatCurrencyBRL(analytics.proposalBreakdown.overdueValue)}
            </span>
          </div>
        </div>

        {/* 3. Financial Projected Cashflow SVG Bar Chart */}
        <div
          data-testid="chart-cashflow-bars"
          className="lg:col-span-4 bg-[#12141A] border border-white/[0.07] rounded-xl p-5 flex flex-col"
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                Fluxo de Caixa Previsto
              </h3>
              <p className="text-[11.5px] text-neutral-400 mt-0.5 truncate">
                {activeCashItem ? (
                  <>
                    {activeCashItem.label}:{' '}
                    <span className="font-mono tabular-nums text-white font-medium">
                      {formatCurrencyBRL(activeCashItem.value)}
                    </span>
                  </>
                ) : (
                  <>
                    Saldo projetado:{' '}
                    <span
                      className={`font-mono tabular-nums font-medium ${
                        analytics.cashflowComparison.projectedBalance >= 0
                          ? 'text-[#4ADE80]'
                          : 'text-[#F87171]'
                      }`}
                    >
                      {formatCurrencyBRL(
                        analytics.cashflowComparison.projectedBalance
                      )}
                    </span>
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('financeiro')}
              className="text-xs text-[#E8C96D] hover:underline whitespace-nowrap"
            >
              Financeiro
            </button>
          </div>

          {/* Grouped Vertical Bar SVG */}
          <div className="my-auto pt-1">
            <svg
              viewBox="0 0 340 164"
              className="w-full h-auto"
              role="img"
              aria-label="Gráfico de barras comparando valores recebidos, a receber, despesas pagas e despesas previstas"
            >
              {[0, 0.5, 1].map((t) => {
                const y = 132 - t * 106;
                const tickVal = Math.round(niceCashMax * t);
                return (
                  <g key={t}>
                    <line
                      x1="60"
                      y1={y}
                      x2="332"
                      y2={y}
                      stroke="rgba(255,255,255,0.06)"
                      strokeWidth="1"
                    />
                    <text
                      x="54"
                      y={y + 3.5}
                      textAnchor="end"
                      fill="#737A8C"
                      fontSize="9.5"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {formatCompactBRL(tickVal)}
                    </text>
                  </g>
                );
              })}

              {cashBars.map((bar, i) => {
                const slotWidth = 66;
                const barWidth = 34;
                const x = 74 + i * slotWidth;
                const barH = Math.max(
                  bar.value > 0 ? 4 : 0,
                  (bar.value / niceCashMax) * 106
                );
                const y = 132 - barH;
                const isHovered = hoveredCashBar === bar.id;
                const isDimmed =
                  hoveredCashBar !== null && hoveredCashBar !== bar.id;

                return (
                  <g
                    key={bar.id}
                    onMouseEnter={() => setHoveredCashBar(bar.id)}
                    onMouseLeave={() => setHoveredCashBar(null)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={x - 10}
                      y="16"
                      width={barWidth + 20}
                      height="136"
                      fill="transparent"
                    />
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barH}
                      rx="5"
                      fill={bar.color}
                      opacity={isDimmed ? 0.35 : isHovered ? 1 : 0.88}
                      className="transition-opacity duration-150"
                    />
                    <text
                      x={x + barWidth / 2}
                      y={Math.max(14, y - 5)}
                      textAnchor="middle"
                      fill={isHovered ? '#FFFFFF' : '#CBD5E1'}
                      fontSize="9.5"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {formatCompactBRL(bar.value)}
                    </text>
                    <text
                      x={x + barWidth / 2}
                      y="150"
                      textAnchor="middle"
                      fill={isHovered ? '#E8C96D' : '#8B92A5'}
                      fontSize="10"
                    >
                      {bar.shortLabel}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs">
            <span className="text-neutral-400">Lançamentos vencidos</span>
            <span
              className={`font-mono tabular-nums font-semibold ${
                analytics.cashflowComparison.overdueCount > 0
                  ? 'text-[#F87171]'
                  : 'text-[#4ADE80]'
              }`}
            >
              {analytics.cashflowComparison.overdueCount}
            </span>
          </div>
        </div>
      </section>

      {/* Row B: Owner Performance Interactive Chart + Channels & Executive Diagnosis */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* 4. Owner Commercial & Follow-up Performance */}
        <div
          data-testid="chart-owner-performance"
          className="lg:col-span-7 bg-[#12141A] border border-white/[0.07] rounded-xl p-6 flex flex-col"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-[#D4AF37] shrink-0" />
                Desempenho por Responsável
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                {activeOwnerRow ? (
                  <>
                    <span className="text-neutral-200 font-medium">
                      {activeOwnerRow.owner}
                    </span>{' '}
                    · Fechado{' '}
                    <span className="font-mono tabular-nums text-[#E8C96D]">
                      {formatCurrencyBRL(activeOwnerRow.closedRevenue)}
                    </span>{' '}
                    · Funil{' '}
                    <span className="font-mono tabular-nums text-neutral-200">
                      {formatCurrencyBRL(activeOwnerRow.openPipeline)}
                    </span>{' '}
                    · Follow-up{' '}
                    <span className="font-mono tabular-nums text-[#4ADE80]">
                      {activeOwnerRow.completionRatePct}%
                    </span>
                  </>
                ) : (
                  'Comparativo de carteira e execução de retornos'
                )}
              </p>
            </div>

            <div
              role="group"
              aria-label="Alternar métrica de desempenho por responsável"
              className="flex items-center gap-1 p-1 bg-[#171A22] rounded-lg border border-white/[0.06] shrink-0"
            >
              <button
                type="button"
                onClick={() => setOwnerMetricMode('revenue')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  ownerMetricMode === 'revenue'
                    ? 'bg-[#D4AF37] text-[#090A0D] font-semibold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Volume R$
              </button>
              <button
                type="button"
                onClick={() => setOwnerMetricMode('cadence')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  ownerMetricMode === 'cadence'
                    ? 'bg-[#D4AF37] text-[#090A0D] font-semibold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Acompanhamento (%)
              </button>
            </div>
          </div>

          <div className="space-y-4 my-auto">
            {analytics.ownerPerformance.map((row) => {
              const closedPct = (row.closedRevenue / maxOwnerVolume) * 100;
              const openPct = (row.openPipeline / maxOwnerVolume) * 100;
              const isSelected = hoveredOwner === row.owner;

              return (
                <div
                  key={row.owner}
                  onMouseEnter={() => setHoveredOwner(row.owner)}
                  onMouseLeave={() => setHoveredOwner(null)}
                  className={`p-3 rounded-lg border transition-colors ${
                    isSelected
                      ? 'bg-[#171A22] border-[#D4AF37]/30'
                      : 'bg-[#151821]/70 border-white/[0.05]'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-3 text-xs mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-white truncate">
                        {row.owner}
                      </span>
                      <span className="text-[11px] text-neutral-500 font-mono tabular-nums">
                        {row.dealsCount} oport.
                      </span>
                      {row.overdueTasks > 0 && (
                        <span className="text-[11px] text-[#F87171] font-mono tabular-nums">
                          · {row.overdueTasks} atras.
                        </span>
                      )}
                    </div>

                    {ownerMetricMode === 'revenue' ? (
                      <span className="font-mono tabular-nums text-neutral-200 shrink-0">
                        {formatCurrencyBRL(
                          row.closedRevenue + row.openPipeline
                        )}
                      </span>
                    ) : (
                      <span className="font-mono tabular-nums text-neutral-200 shrink-0">
                        {row.completedTasks}/{row.totalTasks} (
                        <span className="text-[#4ADE80]">
                          {row.completionRatePct}%
                        </span>
                        )
                      </span>
                    )}
                  </div>

                  {ownerMetricMode === 'revenue' ? (
                    <div className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden flex">
                      {row.closedRevenue > 0 && (
                        <div
                          style={{ width: `${Math.max(3, closedPct)}%` }}
                          className="h-full bg-[#D4AF37] transition-all duration-300"
                          title={`Receita fechada: ${formatCurrencyBRL(row.closedRevenue)}`}
                        />
                      )}
                      {row.openPipeline > 0 && (
                        <div
                          style={{ width: `${Math.max(3, openPct)}%` }}
                          className="h-full bg-[#64748B]/75 transition-all duration-300"
                          title={`Funil ativo: ${formatCurrencyBRL(row.openPipeline)}`}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        style={{
                          width: `${
                            row.completionRatePct > 0
                              ? Math.max(4, row.completionRatePct)
                              : 0
                          }%`,
                        }}
                        className={`h-full rounded-full transition-all duration-300 ${
                          row.completionRatePct >= 50
                            ? 'bg-[#4ADE80]'
                            : row.completionRatePct >= 25
                            ? 'bg-[#D4AF37]'
                            : 'bg-[#F59E0B]'
                        }`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-neutral-400">
            {ownerMetricMode === 'revenue' ? (
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#D4AF37] inline-block" />
                  Receita fechada
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#64748B]/75 inline-block" />
                  Funil ativo
                </span>
              </div>
            ) : (
              <span>
                Percentual de atividades concluídas sobre o total atribuído ao responsável
              </span>
            )}
            <span className="font-mono tabular-nums text-neutral-500">
              {analytics.ownerPerformance.length} responsáveis ativos
            </span>
          </div>
        </div>

        {/* 5. Channel Mix + Live Executive Insights */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Channel Distribution */}
          <div
            data-testid="chart-channel-mix"
            className="bg-[#12141A] border border-white/[0.07] rounded-xl p-5"
          >
            <div className="flex items-center justify-between gap-2 mb-3.5">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                Canais de Relacionamento
              </h3>
              <span className="text-[11px] font-mono tabular-nums text-neutral-400">
                {analytics.channelActivity.totalTouchpoints} pontos de contato
              </span>
            </div>

            <div className="space-y-3">
              {analytics.channelActivity.channels.map((ch) => (
                <div key={ch.id}>
                  <div className="flex items-baseline justify-between text-xs mb-1">
                    <span className="text-neutral-300 font-medium">
                      {ch.label}
                    </span>
                    <span className="font-mono tabular-nums text-neutral-200">
                      {ch.count}{' '}
                      <span className="text-neutral-500">({ch.pct}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${ch.count > 0 ? Math.max(5, ch.pct) : 0}%`,
                        backgroundColor: ch.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Live Executive Insights */}
          <div
            data-testid="dashboard-executive-insights"
            className="bg-[#12141A] border border-[#D4AF37]/20 rounded-xl p-5 flex-1 flex flex-col"
          >
            <h3 className="text-sm font-semibold text-white mb-3">
              Diagnóstico Executivo ao Vivo
            </h3>
            <ul className="space-y-3 flex-1">
              {analytics.executiveInsights.map((insight) => (
                <li
                  key={insight.id}
                  className="p-3 rounded-lg bg-[#161922] border border-white/[0.06] flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    {insight.tone === 'warning' ? (
                      <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
                    ) : insight.tone === 'positive' ? (
                      <CheckCircle2 className="w-4 h-4 text-[#4ADE80] shrink-0 mt-0.5" />
                    ) : (
                      <TrendingUp className="w-4 h-4 text-[#E8C96D] shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white leading-snug">
                        {insight.title}
                      </p>
                      <p className="text-[11.5px] text-neutral-400 mt-0.5 leading-relaxed">
                        {insight.detail}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate(insight.targetSection, insight.filterHint)
                    }
                    className="text-[11.5px] font-medium text-[#E8C96D] hover:underline whitespace-nowrap shrink-0 mt-0.5"
                  >
                    {insight.actionLabel}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
};
