import React from 'react';
import {
  ArrowRight,
  Check,
  AlertTriangle,
  CalendarPlus,
  Clock,
} from 'lucide-react';
import {
  CrmState,
  NavSection,
  PIPELINE_STAGES,
} from '../../types/crm';
import {
  computeDashboardAnalytics,
  computeDashboardMetrics,
  computeProposalMetrics,
  computeStalledOpportunities,
  formatCurrencyBRL,
  formatRelativeDueDate,
  isTaskOverdue,
} from '../../lib/crm-engine';
import { RevenueChart } from '../ui/RevenueChart';
import { DashboardAnalyticsSection } from './DashboardAnalyticsSection';

interface DashboardViewProps {
  state: CrmState;
  onNavigate: (section: NavSection, filterHint?: string) => void;
  onCompleteTask: (taskId: string) => void;
  onQuickScheduleForOpportunity: (opportunityId: string) => void;
  onOpenClientDetail: (clientId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  state,
  onNavigate,
  onCompleteTask,
  onQuickScheduleForOpportunity,
  onOpenClientDetail,
}) => {
  const metrics = computeDashboardMetrics(state);
  const analytics = computeDashboardAnalytics(state);
  const proposalMetrics = computeProposalMetrics(state);
  const stalledItems = computeStalledOpportunities(state).slice(0, 3);
  const { followUpSummary } = metrics;
  const clientById = new Map(state.clients.map((c) => [c.id, c]));

  // Show earliest Today tasks (Alfa, Beta, etc.) alongside earliest Tomorrow/upcoming (Gama)
  // so the executive preview covers both today's priorities and tomorrow's first contact
  const todayPending = [...state.tasks]
    .filter((t) => t.status === 'pendente' && t.dueDate === state.referenceDate)
    .sort((a, b) => a.dueTime.localeCompare(b.dueTime));
  const futurePending = [...state.tasks]
    .filter((t) => t.status === 'pendente' && t.dueDate > state.referenceDate)
    .sort((a, b) =>
      `${a.dueDate}T${a.dueTime}`.localeCompare(`${b.dueDate}T${b.dueTime}`)
    );
  const upcomingTasks = [
    ...todayPending.slice(0, 2),
    ...futurePending.slice(0, 1),
    ...todayPending.slice(2),
    ...futurePending.slice(1),
  ].slice(0, 5);

  const overdueTasks = state.tasks.filter((t) =>
    isTaskOverdue(t, state.referenceDate)
  );

  const stageTotals = PIPELINE_STAGES.map((st) => {
    const opps = state.opportunities.filter((o) => o.stage === st.id);
    const total = opps.reduce((s, o) => s + o.value, 0);
    return { ...st, count: opps.length, total };
  });
  const maxStageTotal = Math.max(1, ...stageTotals.map((s) => s.total));

  const recentConversations = [...state.conversations]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Top 4-Column Commercial KPI Strip */}
      <section aria-label="Indicadores comerciais principais">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-[#12141A] border border-white/[0.07] rounded-xl p-5">
            <p className="text-xs font-medium text-neutral-400">
              Receita fechada
            </p>
            <p
              data-testid="kpi-closed-revenue"
              className="mt-2 text-2xl font-semibold text-white font-mono tabular-nums tracking-tight"
            >
              {formatCurrencyBRL(metrics.closedRevenue)}
            </p>
            <p className="mt-2 text-xs text-neutral-400">
              <span className="text-[#4ADE80] font-mono tabular-nums">
                {metrics.closedDealsCount}
              </span>{' '}
              negócios ganhos · Conversão{' '}
              <span className="font-mono tabular-nums text-neutral-200">
                {metrics.conversionRate}%
              </span>
            </p>
          </div>

          <div className="bg-[#12141A] border border-white/[0.07] rounded-xl p-5">
            <p className="text-xs font-medium text-neutral-400">
              Funil comercial ativo
            </p>
            <p
              data-testid="kpi-open-pipeline"
              className="mt-2 text-2xl font-semibold text-[#E8C96D] font-mono tabular-nums tracking-tight"
            >
              {formatCurrencyBRL(metrics.openPipelineValue)}
            </p>
            <p className="mt-2 text-xs text-neutral-400">
              <span className="font-mono tabular-nums text-neutral-200">
                {metrics.openDealsCount}
              </span>{' '}
              oportunidades · Ponderado{' '}
              <span className="font-mono tabular-nums text-neutral-200">
                {formatCurrencyBRL(Math.round(metrics.weightedPipelineValue))}
              </span>
            </p>
          </div>

          <div className="bg-[#12141A] border border-white/[0.07] rounded-xl p-5">
            <p className="text-xs font-medium text-neutral-400">
              Taxa de acompanhamento
            </p>
            <p
              data-testid="kpi-followup-rate"
              className="mt-2 text-2xl font-semibold text-white font-mono tabular-nums tracking-tight"
            >
              {metrics.followUpCompletionRate}%
            </p>
            <p className="mt-2 text-xs text-neutral-400">
              <span className="font-mono tabular-nums text-neutral-200">
                {followUpSummary.completed}
              </span>{' '}
              concluídos de{' '}
              <span className="font-mono tabular-nums text-neutral-200">
                {state.tasks.length}
              </span>{' '}
              atividades
            </p>
          </div>

          <div className="bg-[#12141A] border border-white/[0.07] rounded-xl p-5">
            <p className="text-xs font-medium text-neutral-400">
              Oportunidades recuperadas
            </p>
            <p
              data-testid="kpi-recovered-deals"
              className="mt-2 text-2xl font-semibold text-white font-mono tabular-nums tracking-tight"
            >
              {metrics.recoveredOpportunitiesCount}
            </p>
            <p className="mt-2 text-xs text-neutral-400">
              Ticket médio{' '}
              <span className="font-mono tabular-nums text-neutral-200">
                {formatCurrencyBRL(metrics.averageTicket)}
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* Main Focal Row: Central de Follow-up + Funnel & Unattended Alerts */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Central de Follow-up (Primary Focal Anchor) */}
        <div
          data-testid="central-followup-panel"
          className="lg:col-span-7 bg-[#12141A] border border-[#D4AF37]/25 rounded-xl p-6 flex flex-col"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.07]">
            <div>
              <h2 className="text-base font-semibold text-white">
                Central de Follow-up
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Agenda ativa de retornos, lembretes e etapas pendentes
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('tarefas')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#E8C96D] hover:text-[#F6E2A1] transition-colors whitespace-nowrap"
            >
              Abrir central completa
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 4-Counter Follow-up Strip (12 Pendentes / 4 Atrasados / 8 Concluídos / 6 Para hoje) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-5 border-b border-white/[0.07]">
            <button
              type="button"
              onClick={() => onNavigate('tarefas', 'pendente')}
              className="text-left p-3.5 rounded-lg bg-[#171A22] hover:bg-[#1D212B] border border-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
            >
              <span
                data-testid="followup-count-pending"
                className="block text-2xl font-semibold text-white font-mono tabular-nums"
              >
                {followUpSummary.pending}
              </span>
              <span className="block text-xs text-neutral-400 mt-1">
                Pendentes
              </span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('tarefas', 'atrasado')}
              className="text-left p-3.5 rounded-lg bg-[#171A22] hover:bg-[#1D212B] border border-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
            >
              <span
                data-testid="followup-count-overdue"
                className={`block text-2xl font-semibold font-mono tabular-nums ${
                  followUpSummary.overdue > 0 ? 'text-[#F87171]' : 'text-white'
                }`}
              >
                {followUpSummary.overdue}
              </span>
              <span className="block text-xs text-neutral-400 mt-1">
                Atrasados
              </span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('tarefas', 'concluido')}
              className="text-left p-3.5 rounded-lg bg-[#171A22] hover:bg-[#1D212B] border border-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
            >
              <span
                data-testid="followup-count-completed"
                className="block text-2xl font-semibold text-[#4ADE80] font-mono tabular-nums"
              >
                {followUpSummary.completed}
              </span>
              <span className="block text-xs text-neutral-400 mt-1">
                Concluídos
              </span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('tarefas', 'hoje')}
              className="text-left p-3.5 rounded-lg bg-[#171A22] hover:bg-[#1D212B] border border-[#D4AF37]/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
            >
              <span
                data-testid="followup-count-today"
                className="block text-2xl font-semibold text-[#E8C96D] font-mono tabular-nums"
              >
                {followUpSummary.today}
              </span>
              <span className="block text-xs text-neutral-400 mt-1">
                Para hoje
              </span>
            </button>
          </div>

          {/* Próximos acompanhamentos */}
          <div className="pt-5 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-neutral-100">
                Próximos acompanhamentos
              </h3>
              {overdueTasks.length > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigate('tarefas', 'atrasado')}
                  className="text-xs text-[#F87171] hover:underline whitespace-nowrap"
                >
                  {overdueTasks.length} atrasados precisam de retorno
                </button>
              )}
            </div>

            {upcomingTasks.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-white/[0.08] rounded-lg">
                <p className="text-sm text-neutral-300">
                  Todos os acompanhamentos agendados foram concluídos.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('tarefas')}
                  className="mt-3 px-3.5 py-2 text-xs font-medium bg-[#D4AF37] text-[#090A0D] rounded-lg hover:bg-[#E8C96D] transition-colors"
                >
                  Agendar novo follow-up
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {upcomingTasks.map((task) => {
                  const client = clientById.get(task.clientId);
                  const relDate = formatRelativeDueDate(
                    task.dueDate,
                    state.referenceDate
                  );
                  return (
                    <li
                      key={task.id}
                      className="py-3.5 flex items-center justify-between gap-4 group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenClientDetail(task.clientId)}
                            className="text-sm font-medium text-white hover:text-[#E8C96D] transition-colors truncate text-left"
                          >
                            {client?.company ?? 'Cliente'}
                          </button>
                        </div>
                        <p className="text-xs text-neutral-400 mt-0.5 truncate">
                          <span className="font-mono tabular-nums text-neutral-300">
                            {relDate} · {task.dueTime}
                          </span>{' '}
                          · {task.contextLabel} · {task.owner}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`hidden sm:inline text-xs font-medium ${
                            task.priority === 'alta'
                              ? 'text-[#FBBF24]'
                              : 'text-neutral-400'
                          }`}
                        >
                          {task.contextLabel}
                        </span>
                        <button
                          type="button"
                          onClick={() => onCompleteTask(task.id)}
                          aria-label={`Concluir acompanhamento de ${client?.company ?? task.title}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-200 bg-[#1A1E28] hover:bg-[#D4AF37] hover:text-[#090A0D] border border-white/[0.08] transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Concluir
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <p className="mt-auto pt-4 text-[11.5px] text-neutral-500 border-t border-white/[0.05]">
              Demonstração interativa com dados fictícios locais — todas as alterações atualizam indicadores em tempo real.
            </p>
          </div>
        </div>

        {/* Right Column: Funnel Summary + Unattended Opportunity Detector */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Funnel Summary by Stage */}
          <div className="bg-[#12141A] border border-white/[0.07] rounded-xl p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-base font-semibold text-white">
                Distribuição do Funil
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('funil')}
                className="text-xs font-medium text-[#E8C96D] hover:text-[#F6E2A1] whitespace-nowrap"
              >
                Abrir funil
              </button>
            </div>

            <div className="space-y-3.5">
              {stageTotals.map((st) => {
                const widthPct = Math.max(
                  6,
                  Math.round((st.total / maxStageTotal) * 100)
                );
                return (
                  <div key={st.id}>
                    <div className="flex items-baseline justify-between text-xs mb-1.5">
                      <span className="text-neutral-300 font-medium">
                        {st.label}{' '}
                        <span className="text-neutral-500 font-mono tabular-nums">
                          ({st.count})
                        </span>
                      </span>
                      <span className="font-mono tabular-nums text-neutral-200">
                        {formatCurrencyBRL(st.total)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${st.total === 0 ? 0 : widthPct}%`,
                          backgroundColor: st.accentHex,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Immediate Attention: Stalled & Unattended Opportunities */}
          <div className="bg-[#12141A] border border-white/[0.07] rounded-xl p-6 flex-1 flex flex-col">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0" />
                  Atenção imediata · Oportunidades paradas
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Priorizadas por tempo parado, falta de retorno e valor exposto
                </p>
              </div>
              <span
                data-testid="unattended-count"
                className="text-sm font-mono tabular-nums font-semibold text-[#F59E0B]"
              >
                {metrics.unattendedOpportunities.length}
              </span>
            </div>

            {stalledItems.length === 0 ? (
              <div className="my-auto py-4 text-xs text-[#4ADE80]">
                Excelente: nenhuma oportunidade parada precisando de ação urgente.
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.06] mt-1">
                {stalledItems.map((item) => (
                  <li
                    key={item.opportunity.id}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenClientDetail(item.opportunity.clientId)}
                          className="text-sm font-medium text-neutral-100 hover:text-[#E8C96D] truncate text-left"
                        >
                          {item.companyName}
                        </button>
                        <span className="text-xs font-mono tabular-nums text-[#E8C96D] shrink-0">
                          {formatCurrencyBRL(item.opportunity.value)}
                        </span>
                      </div>
                      <p
                        className={`text-xs truncate mt-0.5 ${
                          !item.hasPendingFollowUp
                            ? 'text-[#FBBF24]'
                            : item.hasOverdueTask
                            ? 'text-[#F87171]'
                            : 'text-neutral-400'
                        }`}
                      >
                        {item.urgencyReason}
                      </p>
                    </div>
                    {!item.hasPendingFollowUp ? (
                      <button
                        type="button"
                        onClick={() =>
                          onQuickScheduleForOpportunity(item.opportunity.id)
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#090A0D] bg-[#D4AF37] hover:bg-[#E8C96D] transition-colors whitespace-nowrap shrink-0"
                      >
                        <CalendarPlus className="w-3.5 h-3.5" />
                        Agendar retorno
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onNavigate('tarefas', 'atrasado')}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-200 bg-white/[0.06] hover:bg-white/[0.1] whitespace-nowrap shrink-0"
                      >
                        Ver tarefa
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-auto pt-3 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2 text-xs">
              <button
                type="button"
                onClick={() => onNavigate('orcamentos')}
                className="text-neutral-300 hover:text-[#E8C96D] transition-colors"
              >
                Orçamentos vencidos:{' '}
                <span className="font-mono tabular-nums text-[#F87171] font-medium">
                  {proposalMetrics.overdueCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('simulador')}
                className="text-[#E8C96D] hover:underline font-medium"
              >
                Simular perdas →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Row: Revenue Growth Chart + Recent Interactions */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 bg-[#12141A] border border-white/[0.07] rounded-xl p-6">
          <RevenueChart
            data={state.monthlyHistory}
            currentClosedRevenue={metrics.closedRevenue}
            currentOpenPipeline={metrics.openPipelineValue}
          />
        </div>

        <div className="lg:col-span-4 bg-[#12141A] border border-white/[0.07] rounded-xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">
              Últimas interações
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('clientes')}
              className="text-xs text-[#E8C96D] hover:underline whitespace-nowrap"
            >
              Ver histórico
            </button>
          </div>
          <ul className="space-y-4 flex-1">
            {recentConversations.map((conv) => {
              const client = clientById.get(conv.clientId);
              const dateLabel = conv.timestamp.slice(0, 10).split('-').reverse().join('/');
              return (
                <li
                  key={conv.id}
                  className="pb-3.5 border-b border-white/[0.06] last:border-b-0 last:pb-0"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => onOpenClientDetail(conv.clientId)}
                      className="font-medium text-neutral-100 hover:text-[#E8C96D] truncate"
                    >
                      {client?.company ?? 'Cliente'}
                    </button>
                    <span className="text-neutral-500 font-mono tabular-nums shrink-0 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {dateLabel}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                    {conv.summary}
                  </p>
                  <p className="text-[11px] text-neutral-500 mt-1">
                    {conv.channel.toUpperCase()} · {conv.owner}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Expanded Operational Charts & Executive Analytics */}
      <DashboardAnalyticsSection
        analytics={analytics}
        onNavigate={onNavigate}
      />
    </div>
  );
};
