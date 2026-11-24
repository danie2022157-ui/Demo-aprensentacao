import React from 'react';
import { Download, RotateCcw } from 'lucide-react';
import { CrmState, LOSS_REASON_LABELS, PIPELINE_STAGES, TEAM_OWNERS } from '../../types/crm';
import {
  buildReportsCsv,
  computeDashboardMetrics,
  computeProposalMetrics,
  formatCurrencyBRL,
  isTaskOverdue,
} from '../../lib/crm-engine';
import { RevenueChart } from '../ui/RevenueChart';

interface ReportsViewProps {
  state: CrmState;
  onRequestReset: () => void;
  onNotify: (msg: string) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  state,
  onRequestReset,
  onNotify,
}) => {
  const metrics = computeDashboardMetrics(state);
  const proposalMetrics = computeProposalMetrics(state);
  const { followUpSummary } = metrics;

  const handleExportCsv = () => {
    const csv = buildReportsCsv(state);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'onethy-crm-relatorio-comercial.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onNotify('Relatório CSV exportado com os dados atuais da demonstração.');
  };

  const totalPipelineAndClosed =
    metrics.openPipelineValue + metrics.closedRevenue;

  const stageBreakdown = PIPELINE_STAGES.map((st) => {
    const deals = state.opportunities.filter((o) => o.stage === st.id);
    const value = deals.reduce((sum, o) => sum + o.value, 0);
    const share =
      totalPipelineAndClosed > 0
        ? Math.round((value / totalPipelineAndClosed) * 100)
        : 0;
    return { ...st, count: deals.length, value, share };
  });

  const ownerPerformance = TEAM_OWNERS.map((owner) => {
    const opps = state.opportunities.filter((o) => o.owner === owner);
    const closedValue = opps
      .filter((o) => o.stage === 'fechado')
      .reduce((s, o) => s + o.value, 0);
    const openValue = opps
      .filter((o) => o.stage !== 'fechado')
      .reduce((s, o) => s + o.value, 0);
    const ownerTasks = state.tasks.filter((t) => t.owner === owner);
    const completed = ownerTasks.filter((t) => t.status === 'concluido').length;
    const overdue = ownerTasks.filter((t) =>
      isTaskOverdue(t, state.referenceDate)
    ).length;
    const rate =
      ownerTasks.length > 0
        ? Math.round((completed / ownerTasks.length) * 100)
        : 0;
    return {
      owner,
      openCount: opps.filter((o) => o.stage !== 'fechado').length,
      openValue,
      closedValue,
      completed,
      overdue,
      rate,
    };
  });

  const priorityCounts = {
    alta: state.tasks.filter((t) => t.status === 'pendente' && t.priority === 'alta').length,
    media: state.tasks.filter((t) => t.status === 'pendente' && t.priority === 'media').length,
    baixa: state.tasks.filter((t) => t.status === 'pendente' && t.priority === 'baixa').length,
  };

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#12141A] border border-white/[0.07] rounded-xl p-4">
        <div>
          <h2 className="text-sm font-semibold text-white">
            Indicadores Comerciais em Tempo Real
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Todos os índices refletem automaticamente clientes, movimentações no funil e follow-ups concluídos.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onRequestReset}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-neutral-300 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] rounded-lg transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar dados
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#D4AF37] hover:bg-[#E8C96D] text-[#090A0D] rounded-lg transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="bg-[#12141A] border border-white/[0.07] rounded-xl p-4">
          <p className="text-xs text-neutral-400">Taxa de acompanhamento</p>
          <p className="text-2xl font-semibold text-[#E8C96D] font-mono tabular-nums mt-2">
            {metrics.followUpCompletionRate}%
          </p>
          <p className="text-[11px] text-neutral-500 mt-1">
            {followUpSummary.completed} de {state.tasks.length} tarefas
          </p>
        </div>

        <div className="bg-[#12141A] border border-white/[0.07] rounded-xl p-4">
          <p className="text-xs text-neutral-400">Tarefas concluídas</p>
          <p className="text-2xl font-semibold text-[#4ADE80] font-mono tabular-nums mt-2">
            {followUpSummary.completed}
          </p>
          <p className="text-[11px] text-neutral-500 mt-1">
            {followUpSummary.pending} ainda pendentes
          </p>
        </div>

        <div className="bg-[#12141A] border border-white/[0.07] rounded-xl p-4">
          <p className="text-xs text-neutral-400">Oportunidades recuperadas</p>
          <p className="text-2xl font-semibold text-white font-mono tabular-nums mt-2">
            {metrics.recoveredOpportunitiesCount}
          </p>
          <p className="text-[11px] text-neutral-500 mt-1">
            Retomadas via cadência
          </p>
        </div>

        <div className="bg-[#12141A] border border-white/[0.07] rounded-xl p-4">
          <p className="text-xs text-neutral-400">Taxa de conversão</p>
          <p className="text-2xl font-semibold text-white font-mono tabular-nums mt-2">
            {metrics.conversionRate}%
          </p>
          <p className="text-[11px] text-neutral-500 mt-1">
            {metrics.closedDealsCount} ganhos de {state.opportunities.length}
          </p>
        </div>

        <div className="bg-[#12141A] border border-white/[0.07] rounded-xl p-4">
          <p className="text-xs text-neutral-400">Ticket médio</p>
          <p className="text-2xl font-semibold text-white font-mono tabular-nums mt-2">
            {formatCurrencyBRL(metrics.averageTicket)}
          </p>
          <p className="text-[11px] text-neutral-500 mt-1">
            Receita total {formatCurrencyBRL(metrics.closedRevenue)}
          </p>
        </div>
      </div>

      {/* Main Chart */}
      <div className="bg-[#12141A] border border-white/[0.07] rounded-xl p-6">
        <RevenueChart
          data={state.monthlyHistory}
          currentClosedRevenue={metrics.closedRevenue}
          currentOpenPipeline={metrics.openPipelineValue}
          height={250}
        />
      </div>

      {/* Funnel & Follow-up Health Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-[#12141A] border border-white/[0.07] rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4">
            Funil de Conversão por Etapa
          </h3>
          <div className="space-y-4">
            {stageBreakdown.map((st) => (
              <div key={st.id}>
                <div className="flex items-baseline justify-between text-xs mb-1.5">
                  <span className="text-neutral-200 font-medium">
                    {st.label}{' '}
                    <span className="text-neutral-500 font-mono tabular-nums">
                      · {st.count} {st.count === 1 ? 'negócio' : 'negócios'}
                    </span>
                  </span>
                  <span className="font-mono tabular-nums text-neutral-200">
                    {formatCurrencyBRL(st.value)}{' '}
                    <span className="text-neutral-500">({st.share}%)</span>
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.max(st.value > 0 ? 5 : 0, st.share)}%`,
                      backgroundColor: st.accentHex,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 bg-[#12141A] border border-white/[0.07] rounded-xl p-6 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-white">
              Saúde do Follow-up
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Distribuição atual das atividades e fila pendente por prioridade
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-lg bg-[#171A22] border border-white/[0.06]">
              <p className="text-[11px] text-neutral-400">Em dia / Hoje</p>
              <p className="text-xl font-semibold font-mono tabular-nums text-[#E8C96D] mt-1">
                {followUpSummary.today}
              </p>
            </div>
            <div className="p-3.5 rounded-lg bg-[#171A22] border border-white/[0.06]">
              <p className="text-[11px] text-neutral-400">Atrasados</p>
              <p className="text-xl font-semibold font-mono tabular-nums text-[#F87171] mt-1">
                {followUpSummary.overdue}
              </p>
            </div>
            <div className="p-3.5 rounded-lg bg-[#171A22] border border-white/[0.06]">
              <p className="text-[11px] text-neutral-400">Sem acompanhamento</p>
              <p className="text-xl font-semibold font-mono tabular-nums text-[#FBBF24] mt-1">
                {metrics.unattendedOpportunities.length}
              </p>
            </div>
            <div className="p-3.5 rounded-lg bg-[#171A22] border border-white/[0.06]">
              <p className="text-[11px] text-neutral-400">Concluídos</p>
              <p className="text-xl font-semibold font-mono tabular-nums text-[#4ADE80] mt-1">
                {followUpSummary.completed}
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-white/[0.06] space-y-2 text-xs">
            <p className="text-neutral-300 font-medium">
              Pendentes por prioridade
            </p>
            <div className="flex items-center justify-between text-neutral-400">
              <span>Prioridade alta</span>
              <span className="font-mono tabular-nums text-[#F87171]">
                {priorityCounts.alta}
              </span>
            </div>
            <div className="flex items-center justify-between text-neutral-400">
              <span>Prioridade média</span>
              <span className="font-mono tabular-nums text-[#FBBF24]">
                {priorityCounts.media}
              </span>
            </div>
            <div className="flex items-center justify-between text-neutral-400">
              <span>Prioridade baixa</span>
              <span className="font-mono tabular-nums text-neutral-300">
                {priorityCounts.baixa}
              </span>
            </div>
          </div>

          {proposalMetrics.lossByReason.length > 0 && (
            <div className="pt-3 border-t border-white/[0.06] space-y-2 text-xs">
              <p className="text-neutral-300 font-medium">
                Motivos de perda (orçamentos)
              </p>
              {proposalMetrics.lossByReason.map((item) => (
                <div
                  key={item.reason}
                  className="flex items-center justify-between text-neutral-400"
                >
                  <span>
                    {LOSS_REASON_LABELS[
                      item.reason as keyof typeof LOSS_REASON_LABELS
                    ] ?? item.reason}
                  </span>
                  <span className="font-mono tabular-nums text-neutral-200">
                    {item.count} · {formatCurrencyBRL(item.value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Team Performance Table */}
      <div className="bg-[#12141A] border border-white/[0.07] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.07]">
          <h3 className="text-sm font-semibold text-white">
            Desempenho por Responsável
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.06] text-[11.5px] font-medium text-neutral-400 bg-[#151821]">
                <th className="py-3 px-6">Responsável</th>
                <th className="py-3 px-4 text-right">Negócios Abertos</th>
                <th className="py-3 px-4 text-right">Volume em Funil</th>
                <th className="py-3 px-4 text-right">Receita Fechada</th>
                <th className="py-3 px-4 text-right">Follow-ups Concluídos</th>
                <th className="py-3 px-4 text-right">Atrasados</th>
                <th className="py-3 px-6 text-right">Taxa Retorno</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05] text-xs">
              {ownerPerformance.map((row) => (
                <tr key={row.owner} className="hover:bg-white/[0.02]">
                  <td className="py-3.5 px-6 font-medium text-white">
                    {row.owner}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-neutral-300">
                    {row.openCount}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-neutral-200">
                    {formatCurrencyBRL(row.openValue)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#4ADE80]">
                    {formatCurrencyBRL(row.closedValue)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-neutral-200">
                    {row.completed}
                  </td>
                  <td
                    className={`py-3.5 px-4 text-right font-mono tabular-nums ${
                      row.overdue > 0 ? 'text-[#F87171]' : 'text-neutral-500'
                    }`}
                  >
                    {row.overdue}
                  </td>
                  <td className="py-3.5 px-6 text-right font-mono tabular-nums text-[#E8C96D] font-medium">
                    {row.rate}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
