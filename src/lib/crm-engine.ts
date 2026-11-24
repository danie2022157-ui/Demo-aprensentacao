import {
  CrmState,
  FollowUpSummary,
  FollowUpTask,
  Opportunity,
  PIPELINE_STAGES,
  PipelineStage,
  Priority,
} from '../types/crm';

export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCompactBRL(value: number): string {
  if (value >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toFixed(2).replace('.', ',')}M`;
  }
  if (value >= 1_000) {
    return `R$ ${(value / 1_000).toFixed(1).replace('.', ',')}k`;
  }
  return formatCurrencyBRL(value);
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function formatRelativeDueDate(
  dueDate: string,
  referenceDate: string
): string {
  if (dueDate === referenceDate) return 'Hoje';
  if (dueDate === addDaysToDateString(referenceDate, 1)) return 'Amanhã';
  if (dueDate === addDaysToDateString(referenceDate, -1)) return 'Ontem';
  const [y, m, d] = dueDate.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

export function isTaskOverdue(
  task: FollowUpTask,
  referenceDate: string
): boolean {
  return task.status === 'pendente' && task.dueDate < referenceDate;
}

export function isTaskToday(
  task: FollowUpTask,
  referenceDate: string
): boolean {
  return task.status === 'pendente' && task.dueDate === referenceDate;
}

export function computeFollowUpSummary(
  tasks: FollowUpTask[],
  referenceDate: string
): FollowUpSummary {
  let pending = 0;
  let overdue = 0;
  let completed = 0;
  let today = 0;

  for (const task of tasks) {
    if (task.status === 'concluido') {
      completed += 1;
    } else {
      pending += 1;
      if (task.dueDate < referenceDate) {
        overdue += 1;
      } else if (task.dueDate === referenceDate) {
        today += 1;
      }
    }
  }

  return { pending, overdue, completed, today };
}

export function detectUnattendedOpportunities(
  opportunities: Opportunity[],
  tasks: FollowUpTask[]
): Opportunity[] {
  const attendedOppIds = new Set(
    tasks
      .filter((t) => t.status === 'pendente' && Boolean(t.opportunityId))
      .map((t) => t.opportunityId as string)
  );

  return opportunities.filter(
    (opp) => opp.stage !== 'fechado' && !attendedOppIds.has(opp.id)
  );
}

export interface DashboardMetrics {
  openPipelineValue: number;
  closedRevenue: number;
  weightedPipelineValue: number;
  openDealsCount: number;
  closedDealsCount: number;
  conversionRate: number;
  averageTicket: number;
  followUpCompletionRate: number;
  recoveredOpportunitiesCount: number;
  unattendedOpportunities: Opportunity[];
  followUpSummary: FollowUpSummary;
}

export function computeDashboardMetrics(state: CrmState): DashboardMetrics {
  const openOpps = state.opportunities.filter((o) => o.stage !== 'fechado');
  const closedOpps = state.opportunities.filter((o) => o.stage === 'fechado');

  const openPipelineValue = openOpps.reduce((sum, o) => sum + o.value, 0);
  const closedRevenue = closedOpps.reduce((sum, o) => sum + o.value, 0);
  const weightedPipelineValue = openOpps.reduce(
    (sum, o) => sum + (o.value * o.probability) / 100,
    0
  );

  const totalDeals = state.opportunities.length;
  const conversionRate =
    totalDeals > 0 ? Math.round((closedOpps.length / totalDeals) * 100) : 0;

  const averageTicket =
    totalDeals > 0
      ? Math.round(
          state.opportunities.reduce((s, o) => s + o.value, 0) / totalDeals
        )
      : 0;

  const followUpSummary = computeFollowUpSummary(
    state.tasks,
    state.referenceDate
  );

  const totalTasks = state.tasks.length;
  const followUpCompletionRate =
    totalTasks > 0
      ? Math.round((followUpSummary.completed / totalTasks) * 100)
      : 0;

  const recoveredOpportunitiesCount = state.opportunities.filter(
    (o) => o.recovered
  ).length;

  const unattendedOpportunities = detectUnattendedOpportunities(
    state.opportunities,
    state.tasks
  );

  return {
    openPipelineValue,
    closedRevenue,
    weightedPipelineValue,
    openDealsCount: openOpps.length,
    closedDealsCount: closedOpps.length,
    conversionRate,
    averageTicket,
    followUpCompletionRate,
    recoveredOpportunitiesCount,
    unattendedOpportunities,
    followUpSummary,
  };
}

export function getStageConfig(stage: PipelineStage) {
  return (
    PIPELINE_STAGES.find((s) => s.id === stage) ?? PIPELINE_STAGES[0]
  );
}

export interface StageMoveResult {
  nextState: CrmState;
  autoCreatedTask: FollowUpTask | null;
}

export function moveOpportunityStage(
  state: CrmState,
  opportunityId: string,
  targetStage: PipelineStage,
  nowIso: string = '2026-11-24T12:00:00Z'
): StageMoveResult {
  const existing = state.opportunities.find((o) => o.id === opportunityId);
  if (!existing || existing.stage === targetStage) {
    return { nextState: state, autoCreatedTask: null };
  }

  const stageCfg = getStageConfig(targetStage);
  const updatedOpps = state.opportunities.map((o) =>
    o.id === opportunityId
      ? {
          ...o,
          stage: targetStage,
          probability: stageCfg.defaultProbability,
          updatedAt: nowIso,
        }
      : o
  );

  const matchingRule = state.rules.find(
    (r) => r.enabled && r.triggerStage === targetStage
  );

  let autoCreatedTask: FollowUpTask | null = null;
  let nextTasks = state.tasks;

  if (matchingRule && targetStage !== 'fechado') {
    const dueDate = addDaysToDateString(
      state.referenceDate,
      matchingRule.delayDays
    );
    const dueHour = Math.min(18, 9 + matchingRule.delayHours);
    const dueTime = `${String(dueHour).padStart(2, '0')}:30`;

    autoCreatedTask = {
      id: `tsk-auto-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      clientId: existing.clientId,
      opportunityId: existing.id,
      title: matchingRule.defaultTaskTitle,
      contextLabel: matchingRule.defaultContextLabel,
      dueDate,
      dueTime,
      priority: matchingRule.defaultPriority,
      owner: existing.owner,
      status: 'pendente',
      channel: 'whatsapp',
      notes: `Criado automaticamente pela regra "${matchingRule.name}". Requer autorização manual antes de enviar mensagem.`,
      autoGenerated: true,
      requiresManualApproval: matchingRule.requiresManualApproval,
      recurrenceDays: matchingRule.recurrenceDays,
    };

    nextTasks = [autoCreatedTask, ...state.tasks];
  }

  const newConversation = {
    id: `conv-stage-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    clientId: existing.clientId,
    opportunityId: existing.id,
    channel: 'reuniao' as const,
    direction: 'interno' as const,
    summary: `Oportunidade "${existing.title}" movida para ${stageCfg.label}.${
      autoCreatedTask
        ? ` Follow-up agendado para ${formatRelativeDueDate(
            autoCreatedTask.dueDate,
            state.referenceDate
          )} às ${autoCreatedTask.dueTime}.`
        : ''
    }`,
    owner: existing.owner,
    timestamp: nowIso,
  };

  return {
    nextState: {
      ...state,
      opportunities: updatedOpps,
      tasks: nextTasks,
      conversations: [newConversation, ...state.conversations],
    },
    autoCreatedTask,
  };
}

export interface FollowUpOutcomeResult {
  nextState: CrmState;
  followUpReminderCreated: FollowUpTask | null;
  advancedOpportunityTitle: string | null;
}

/**
 * Executes the intelligent follow-up flow:
 * - Cliente respondeu? Sim -> avança oportunidade para Negociação (se aberta e anterior à negociação) e registra retorno.
 * - Cliente respondeu? Não -> cria novo lembrete respeitando o intervalo de recorrência configurado (sem envio automático).
 */
export function resolveFollowUpOutcome(
  state: CrmState,
  taskId: string,
  clientResponded: boolean,
  nowIso: string = '2026-11-24T12:00:00Z'
): FollowUpOutcomeResult {
  const targetTask = state.tasks.find((t) => t.id === taskId);
  if (!targetTask) {
    return {
      nextState: state,
      followUpReminderCreated: null,
      advancedOpportunityTitle: null,
    };
  }

  const wasOverdue = isTaskOverdue(targetTask, state.referenceDate);

  let nextTasks: FollowUpTask[] = state.tasks.map((t) =>
    t.id === taskId
      ? {
          ...t,
          status: 'concluido',
          completedAt: nowIso,
          outcome: clientResponded ? 'respondeu' : 'sem_resposta',
        }
      : t
  );

  let nextOpps = state.opportunities;
  let followUpReminderCreated: FollowUpTask | null = null;
  let advancedOpportunityTitle: string | null = null;

  const linkedOpp = targetTask.opportunityId
    ? state.opportunities.find((o) => o.id === targetTask.opportunityId)
    : undefined;

  if (clientResponded) {
    if (linkedOpp && linkedOpp.stage !== 'fechado') {
      const shouldAdvanceToNegotiation =
        linkedOpp.stage === 'novo_interessado' ||
        linkedOpp.stage === 'primeiro_contato' ||
        linkedOpp.stage === 'orcamento_enviado';

      nextOpps = state.opportunities.map((o) =>
        o.id === linkedOpp.id
          ? {
              ...o,
              stage: shouldAdvanceToNegotiation ? 'negociacao' : o.stage,
              probability: shouldAdvanceToNegotiation ? 85 : o.probability,
              recovered: o.recovered || wasOverdue,
              updatedAt: nowIso,
            }
          : o
      );

      if (shouldAdvanceToNegotiation) {
        advancedOpportunityTitle = linkedOpp.title;
      }
    }
  } else {
    const recurrenceDays = targetTask.recurrenceDays ?? 2;
    const nextDueDate = addDaysToDateString(
      state.referenceDate,
      recurrenceDays
    );

    followUpReminderCreated = {
      id: `tsk-rem-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      clientId: targetTask.clientId,
      opportunityId: targetTask.opportunityId,
      title: `Novo lembrete: ${targetTask.title.replace(/^Novo lembrete:\s*/i, '')}`,
      contextLabel: 'Aguardando resposta',
      dueDate: nextDueDate,
      dueTime: targetTask.dueTime,
      priority: targetTask.priority === 'baixa' ? 'media' : 'alta',
      owner: targetTask.owner,
      status: 'pendente',
      channel: targetTask.channel,
      notes: `Reagendado automaticamente (+${recurrenceDays} dias) por ausência de resposta. Envio manual obrigatório.`,
      autoGenerated: true,
      requiresManualApproval: true,
      recurrenceDays,
    };

    nextTasks = [followUpReminderCreated, ...nextTasks];
  }

  const logEntry = {
    id: `conv-fu-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    clientId: targetTask.clientId,
    opportunityId: targetTask.opportunityId,
    channel: targetTask.channel,
    direction: clientResponded ? ('recebido' as const) : ('enviado' as const),
    summary: clientResponded
      ? `Cliente respondeu ao follow-up "${targetTask.title}".${
          advancedOpportunityTitle
            ? ` Oportunidade avançada para Negociação.`
            : ''
        }`
      : `Sem resposta em "${targetTask.title}". Novo lembrete criado para ${formatRelativeDueDate(
          followUpReminderCreated!.dueDate,
          state.referenceDate
        )} às ${followUpReminderCreated!.dueTime}.`,
    owner: targetTask.owner,
    timestamp: nowIso,
  };

  return {
    nextState: {
      ...state,
      opportunities: nextOpps,
      tasks: nextTasks,
      conversations: [logEntry, ...state.conversations],
    },
    followUpReminderCreated,
    advancedOpportunityTitle,
  };
}

export interface TemplateVariables {
  cliente: string;
  empresa: string;
  valor: string;
  responsavel: string;
  etapa: string;
}

export function renderMessageTemplate(
  body: string,
  vars: TemplateVariables
): string {
  return body
    .replaceAll('{{cliente}}', vars.cliente)
    .replaceAll('{{empresa}}', vars.empresa)
    .replaceAll('{{valor}}', vars.valor)
    .replaceAll('{{responsavel}}', vars.responsavel)
    .replaceAll('{{etapa}}', vars.etapa);
}

export function getPriorityLabel(priority: Priority): string {
  switch (priority) {
    case 'alta':
      return 'Alta';
    case 'media':
      return 'Média';
    case 'baixa':
      return 'Baixa';
  }
}

export function buildReportsCsv(state: CrmState): string {
  const clientById = new Map(state.clients.map((c) => [c.id, c]));
  const headers = [
    'Oportunidade',
    'Empresa',
    'Responsavel',
    'Etapa',
    'Valor (BRL)',
    'Probabilidade (%)',
    'Recuperada',
  ];

  const rows = state.opportunities.map((opp) => {
    const client = clientById.get(opp.clientId);
    const stage = getStageConfig(opp.stage).label;
    return [
      `"${opp.title.replaceAll('"', '""')}"`,
      `"${(client?.company ?? 'N/A').replaceAll('"', '""')}"`,
      `"${opp.owner}"`,
      `"${stage}"`,
      String(opp.value),
      String(opp.probability),
      opp.recovered ? 'Sim' : 'Não',
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export function daysBetweenDates(fromDate: string, toDate: string): number {
  const [y1, m1, d1] = fromDate.slice(0, 10).split('-').map(Number);
  const [y2, m2, d2] = toDate.slice(0, 10).split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.max(0, Math.round((t2 - t1) / 86_400_000));
}

export interface StalledOpportunityItem {
  opportunity: Opportunity;
  companyName: string;
  contactName: string;
  daysStalled: number;
  hasPendingFollowUp: boolean;
  hasOverdueTask: boolean;
  urgencyScore: number;
  urgencyReason: string;
}

export function computeStalledOpportunities(
  state: CrmState
): StalledOpportunityItem[] {
  const clientById = new Map(state.clients.map((c) => [c.id, c]));

  return state.opportunities
    .filter((opp) => opp.stage !== 'fechado')
    .map((opp) => {
      const client = clientById.get(opp.clientId);
      const daysStalled = daysBetweenDates(
        opp.updatedAt.slice(0, 10),
        state.referenceDate
      );
      const pendingTasks = state.tasks.filter(
        (t) => t.status === 'pendente' && t.opportunityId === opp.id
      );
      const hasPendingFollowUp = pendingTasks.length > 0;
      const hasOverdueTask = pendingTasks.some((t) =>
        isTaskOverdue(t, state.referenceDate)
      );

      let urgencyScore = daysStalled * 10 + Math.round(opp.value / 5000);
      if (!hasPendingFollowUp) urgencyScore += 60;
      if (hasOverdueTask) urgencyScore += 40;

      let urgencyReason = `Parada há ${daysStalled} ${
        daysStalled === 1 ? 'dia' : 'dias'
      }`;
      if (!hasPendingFollowUp) {
        urgencyReason = `Sem acompanhamento · parada há ${daysStalled}d`;
      } else if (hasOverdueTask) {
        urgencyReason = `Follow-up atrasado · parada há ${daysStalled}d`;
      }

      return {
        opportunity: opp,
        companyName: client?.company ?? 'Cliente',
        contactName: client?.contactName ?? 'Contato',
        daysStalled,
        hasPendingFollowUp,
        hasOverdueTask,
        urgencyScore,
        urgencyReason,
      };
    })
    .sort((a, b) => b.urgencyScore - a.urgencyScore);
}

export interface ProposalMetrics {
  totalOpenCount: number;
  totalOpenValue: number;
  overdueCount: number;
  overdueValue: number;
  approvedValue: number;
  lostCount: number;
  lostValue: number;
  lossByReason: Array<{ reason: string; count: number; value: number }>;
}

export function computeProposalMetrics(state: CrmState): ProposalMetrics {
  const open = state.proposals.filter(
    (p) => p.status === 'aguardando_retorno' || p.status === 'em_revisao'
  );
  const overdue = open.filter(
    (p) => p.expectedReturnDate < state.referenceDate
  );
  const approved = state.proposals.filter((p) => p.status === 'aprovado');
  const lost = state.proposals.filter((p) => p.status === 'perdido');

  const reasonMap = new Map<string, { count: number; value: number }>();
  for (const p of lost) {
    const key = p.lossReason ?? 'sem_retorno';
    const curr = reasonMap.get(key) ?? { count: 0, value: 0 };
    reasonMap.set(key, { count: curr.count + 1, value: curr.value + p.value });
  }

  return {
    totalOpenCount: open.length,
    totalOpenValue: open.reduce((s, p) => s + p.value, 0),
    overdueCount: overdue.length,
    overdueValue: overdue.reduce((s, p) => s + p.value, 0),
    approvedValue: approved.reduce((s, p) => s + p.value, 0),
    lostCount: lost.length,
    lostValue: lost.reduce((s, p) => s + p.value, 0),
    lossByReason: Array.from(reasonMap.entries()).map(([reason, data]) => ({
      reason,
      ...data,
    })),
  };
}

export interface FinancialSummary {
  receivedTotal: number;
  pendingReceivables: number;
  paidExpenses: number;
  pendingExpenses: number;
  currentCashBalance: number;
  projectedCashBalance: number;
  overdueReceivablesCount: number;
  overdueExpensesCount: number;
  overdueTotalCount: number;
}

export function computeFinancialSummary(state: CrmState): FinancialSummary {
  let receivedTotal = 0;
  let pendingReceivables = 0;
  let paidExpenses = 0;
  let pendingExpenses = 0;
  let overdueReceivablesCount = 0;
  let overdueExpensesCount = 0;

  for (const entry of state.financialEntries) {
    const isOverdue =
      entry.status === 'pendente' && entry.dueDate < state.referenceDate;
    if (entry.type === 'receber') {
      if (entry.status === 'pago') {
        receivedTotal += entry.amount;
      } else {
        pendingReceivables += entry.amount;
        if (isOverdue) overdueReceivablesCount += 1;
      }
    } else {
      if (entry.status === 'pago') {
        paidExpenses += entry.amount;
      } else {
        pendingExpenses += entry.amount;
        if (isOverdue) overdueExpensesCount += 1;
      }
    }
  }

  const currentCashBalance = receivedTotal - paidExpenses;
  const projectedCashBalance =
    currentCashBalance + pendingReceivables - pendingExpenses;

  return {
    receivedTotal,
    pendingReceivables,
    paidExpenses,
    pendingExpenses,
    currentCashBalance,
    projectedCashBalance,
    overdueReceivablesCount,
    overdueExpensesCount,
    overdueTotalCount: overdueReceivablesCount + overdueExpensesCount,
  };
}

export interface LossSimulatorInput {
  contactsPerMonth: number;
  proposalsPerMonth: number;
  unfollowedPct: number;
  avgTicket: number;
  currentConversionPct: number;
  hypotheticalRecoveryPct: number;
}

export interface LossSimulatorOutput {
  unfollowedContacts: number;
  unfollowedProposals: number;
  potentialAssociatedValue: number;
  hypotheticalRecoveredSales: number;
  annualHypotheticalValue: number;
  estimatedCurrentMonthlyRevenue: number;
}

export function calculateLossSimulator(
  input: LossSimulatorInput
): LossSimulatorOutput {
  const contacts = Math.max(0, input.contactsPerMonth);
  const proposals = Math.max(0, input.proposalsPerMonth);
  const unfollowedPct = Math.min(100, Math.max(0, input.unfollowedPct));
  const avgTicket = Math.max(0, input.avgTicket);
  const conversionPct = Math.min(100, Math.max(0, input.currentConversionPct));
  const recoveryPct = Math.min(100, Math.max(0, input.hypotheticalRecoveryPct));

  const unfollowedContacts = Math.round(contacts * (unfollowedPct / 100));
  const unfollowedProposals = Math.round(proposals * (unfollowedPct / 100));
  const potentialAssociatedValue = Math.round(unfollowedContacts * avgTicket);
  const hypotheticalRecoveredSales = Math.round(
    potentialAssociatedValue * (recoveryPct / 100)
  );
  const annualHypotheticalValue = hypotheticalRecoveredSales * 12;

  const activeContacts = Math.max(0, contacts - unfollowedContacts);
  const estimatedCurrentMonthlyRevenue = Math.round(
    activeContacts * (conversionPct / 100) * avgTicket
  );

  return {
    unfollowedContacts,
    unfollowedProposals,
    potentialAssociatedValue,
    hypotheticalRecoveredSales,
    annualHypotheticalValue,
    estimatedCurrentMonthlyRevenue,
  };
}

export interface ContextualApproachSuggestion {
  headline: string;
  rationale: string;
  suggestedMessage: string;
  isSuggestion: true;
  requiresManualReview: true;
}

export function generateContextualSuggestion(params: {
  contactName: string;
  companyName: string;
  ownerName: string;
  stageLabel: string;
  value?: number;
  daysWithoutReturn: number;
  proposalCode?: string;
}): ContextualApproachSuggestion {
  const {
    contactName,
    companyName,
    ownerName,
    stageLabel,
    value,
    daysWithoutReturn,
    proposalCode,
  } = params;
  const firstName = contactName.split(' ')[0] || contactName;
  const formattedVal = value ? formatCurrencyBRL(value) : undefined;

  if (proposalCode || stageLabel.toLowerCase().includes('orçamento')) {
    const urgencyNote =
      daysWithoutReturn >= 4
        ? `Proposta parada há ${daysWithoutReturn} dias — abordagem curta de retomada sem pressão para descobrir se há dúvida técnica ou objeção de prazo/preço.`
        : `Retorno recente após envio de orçamento — foco em confirmar recebimento e facilitar o próximo passo.`;

    return {
      headline:
        daysWithoutReturn >= 4
          ? 'Sugestão de resgate de orçamento sem retorno'
          : 'Sugestão de confirmação de proposta enviada',
      rationale: urgencyNote,
      suggestedMessage: `Olá ${firstName}, tudo bem? Aqui é ${ownerName}. Passando para retomar ${
        proposalCode ? `o orçamento ${proposalCode}` : 'a proposta'
      } da ${companyName}${
        formattedVal ? ` (${formattedVal})` : ''
      }. Ficou alguma dúvida sobre escopo, prazo ou condição que eu possa esclarecer em uma conversa rápida de 10 minutos?`,
      isSuggestion: true,
      requiresManualReview: true,
    };
  }

  if (stageLabel.toLowerCase().includes('negocia')) {
    return {
      headline: 'Sugestão de destravamento em negociação',
      rationale:
        'Etapa avançada com alta probabilidade — objetivo é confirmar pendências decisórias e alinhar data de início.',
      suggestedMessage: `Oi ${firstName}, tudo certo? Como estamos alinhando os últimos detalhes do projeto da ${companyName}${
        formattedVal ? ` (${formattedVal})` : ''
      }, queria confirmar se falta algum documento ou ajuste comercial da nossa parte para avançarmos nesta semana.`,
      isSuggestion: true,
      requiresManualReview: true,
    };
  }

  return {
    headline: 'Sugestão de retomada de primeiro contato',
    rationale: `Contato parado há ${daysWithoutReturn} ${
      daysWithoutReturn === 1 ? 'dia' : 'dias'
    } — mensagem objetiva para retomar a conversa e qualificar a dor principal.`,
    suggestedMessage: `Olá ${firstName}, tudo bem? Aqui é ${ownerName}. Retomando seu contato pela ${companyName} para entendermos o cenário atual de atendimento e acompanhamento comercial. Prefere falarmos hoje à tarde ou amanhã de manhã?`,
    isSuggestion: true,
    requiresManualReview: true,
  };
}

export interface ClientHistoryApproachSuggestion
  extends ContextualApproachSuggestion {
  clientId: string;
  stageId: PipelineStage | null;
  stageLabel: string;
  opportunityId?: string;
  opportunityTitle?: string;
  opportunityValue?: number;
  matchedRuleName: string | null;
  matchedRuleActive: boolean;
  ruleCadenceLabel: string;
  recommendedChannel: 'whatsapp' | 'telefone' | 'email' | 'reuniao';
  recommendedAction: string;
  suggestedFollowUpDelayDays: number;
  suggestedPriority: Priority;
  daysSinceLastContact: number | null;
  lastInteractionChannel: 'whatsapp' | 'telefone' | 'email' | 'reuniao' | null;
  lastInteractionDirection: 'enviado' | 'recebido' | 'interno' | null;
  lastInteractionSummary: string | null;
  hasPendingFollowUp: boolean;
  hasOverdueProposal: boolean;
}

/**
 * Uses the existing CRM rules engine, funnel stage, proposals, tasks, and
 * conversation history to recommend the next approach for a specific client.
 * Always returns an editable suggestion requiring manual human review.
 */
export function generateClientHistoryApproachSuggestion(
  state: CrmState,
  clientId: string
): ClientHistoryApproachSuggestion | null {
  const client = state.clients.find((c) => c.id === clientId);
  if (!client) return null;

  const clientOpps = state.opportunities.filter((o) => o.clientId === clientId);
  const openOpps = clientOpps.filter((o) => o.stage !== 'fechado');
  const primaryOpp =
    openOpps.sort((a, b) => b.value - a.value)[0] ??
    clientOpps.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ??
    null;

  const stageId: PipelineStage | null = primaryOpp ? primaryOpp.stage : null;
  const stageLabel = primaryOpp
    ? getStageConfig(primaryOpp.stage).label
    : client.status === 'ativo'
    ? 'Cliente ativo'
    : 'Sem oportunidade no funil';

  const matchingRule = stageId
    ? state.rules.find((r) => r.triggerStage === stageId) ?? null
    : null;

  const clientConversations = state.conversations
    .filter((cv) => cv.clientId === clientId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const lastConv = clientConversations[0] ?? null;
  const daysSinceLastContact = lastConv
    ? daysBetweenDates(lastConv.timestamp.slice(0, 10), state.referenceDate)
    : null;

  const openProposals = state.proposals.filter(
    (p) =>
      p.clientId === clientId &&
      (p.status === 'aguardando_retorno' || p.status === 'em_revisao')
  );
  const primaryProposal =
    openProposals.sort((a, b) =>
      a.expectedReturnDate.localeCompare(b.expectedReturnDate)
    )[0] ?? null;

  const hasOverdueProposal = Boolean(
    primaryProposal && primaryProposal.expectedReturnDate < state.referenceDate
  );

  const pendingTasks = state.tasks.filter(
    (t) => t.clientId === clientId && t.status === 'pendente'
  );
  const hasPendingFollowUp = pendingTasks.length > 0;
  const hasOverdueTask = pendingTasks.some((t) =>
    isTaskOverdue(t, state.referenceDate)
  );

  const daysReference =
    daysSinceLastContact ??
    (primaryOpp
      ? daysBetweenDates(primaryOpp.updatedAt.slice(0, 10), state.referenceDate)
      : 0);

  const firstName = client.contactName.split(' ')[0] || client.contactName;
  const formattedVal = primaryOpp ? formatCurrencyBRL(primaryOpp.value) : undefined;

  const suggestedFollowUpDelayDays = matchingRule
    ? Math.max(1, matchingRule.delayDays || matchingRule.recurrenceDays || 2)
    : 2;
  const suggestedPriority: Priority =
    hasOverdueProposal || hasOverdueTask || (!hasPendingFollowUp && Boolean(primaryOpp && primaryOpp.stage !== 'fechado'))
      ? 'alta'
      : matchingRule?.defaultPriority ?? 'media';

  const ruleCadenceLabel = matchingRule
    ? `${matchingRule.name} (${
        matchingRule.enabled ? 'ativa' : 'pausada'
      } · retorno +${matchingRule.delayDays}d · recorrência ${
        matchingRule.recurrenceDays
      }d)`
    : stageId === 'fechado'
    ? 'Pós-venda e acompanhamento de cliente ativo'
    : 'Regra padrão de retomada comercial (+2d)';

  // Decide recommended channel based on history and funnel stage
  let recommendedChannel: 'whatsapp' | 'telefone' | 'email' | 'reuniao' =
    'whatsapp';
  if (stageId === 'negociacao') {
    recommendedChannel =
      lastConv?.channel === 'telefone' || daysReference >= 3
        ? 'telefone'
        : 'whatsapp';
  } else if (stageId === 'orcamento_enviado' && hasOverdueProposal) {
    recommendedChannel =
      lastConv?.channel === 'whatsapp' && lastConv.direction === 'enviado'
        ? 'telefone'
        : 'whatsapp';
  } else if (stageId === 'fechado') {
    recommendedChannel = 'reuniao';
  } else if (lastConv?.channel === 'email' && lastConv.direction === 'recebido') {
    recommendedChannel = 'email';
  }

  // Case 1: Closed won / active customer check-in
  if (stageId === 'fechado' || (!primaryOpp && client.status === 'ativo')) {
    const historyNote = lastConv
      ? `Último registro há ${daysReference}d (${lastConv.channel}).`
      : 'Sem registro recente de pós-venda no histórico.';

    return {
      clientId,
      stageId,
      stageLabel,
      opportunityId: primaryOpp?.id,
      opportunityTitle: primaryOpp?.title,
      opportunityValue: primaryOpp?.value,
      matchedRuleName: matchingRule?.name ?? null,
      matchedRuleActive: Boolean(matchingRule?.enabled),
      ruleCadenceLabel,
      recommendedChannel,
      recommendedAction:
        'Agendar check-in de acompanhamento e mapear expansão de escopo',
      suggestedFollowUpDelayDays: 7,
      suggestedPriority: 'baixa',
      daysSinceLastContact,
      lastInteractionChannel: lastConv?.channel ?? null,
      lastInteractionDirection: lastConv?.direction ?? null,
      lastInteractionSummary: lastConv?.summary ?? null,
      hasPendingFollowUp,
      hasOverdueProposal,
      headline: 'Sugestão de check-in de cliente ativo / expansão',
      rationale: `Cliente em etapa "${stageLabel}". ${historyNote} Manter contato periódico fortalece retenção e abre espaço para novas oportunidades.`,
      suggestedMessage: `Olá ${firstName}, tudo bem? Aqui é ${client.owner}. Passando para acompanhar como está o andamento na ${client.company} e saber se há algum ponto em que possamos apoiar a equipe nesta semana.`,
      isSuggestion: true,
      requiresManualReview: true,
    };
  }

  // Base contextual draft from existing engine
  const base = generateContextualSuggestion({
    contactName: client.contactName,
    companyName: client.company,
    ownerName: primaryOpp?.owner ?? client.owner,
    stageLabel,
    value: primaryProposal?.value ?? primaryOpp?.value,
    daysWithoutReturn: daysReference,
    proposalCode: primaryProposal?.code,
  });

  // Enrich rationale & message using actual conversation history + rules engine state
  const contextParts: string[] = [];
  if (primaryOpp) {
    contextParts.push(
      `Etapa "${stageLabel}"${formattedVal ? ` (${formattedVal})` : ''}`
    );
  }
  if (hasOverdueProposal && primaryProposal) {
    contextParts.push(
      `orçamento ${primaryProposal.code} com retorno vencido`
    );
  } else if (primaryProposal) {
    contextParts.push(`orçamento ${primaryProposal.code} em aberto`);
  }
  if (!hasPendingFollowUp && primaryOpp) {
    contextParts.push('sem follow-up pendente na agenda');
  } else if (hasOverdueTask) {
    contextParts.push('possui follow-up atrasado');
  }

  let historyContextText = 'sem histórico de conversas registrado até agora';
  let historyTail = '';
  if (lastConv) {
    const dirLabel =
      lastConv.direction === 'recebido'
        ? 'retorno recebido do cliente'
        : lastConv.direction === 'enviado'
        ? 'contato enviado sem registro de resposta posterior'
        : 'movimentação/nota interna';
    historyContextText = `última interação há ${daysReference} ${
      daysReference === 1 ? 'dia' : 'dias'
    } (${dirLabel})`;

    if (lastConv.direction === 'recebido') {
      historyTail = ` Como você comentou no nosso último contato, já deixei tudo pronto para avançarmos no próximo passo.`;
    } else if (lastConv.direction === 'enviado' && daysReference >= 3) {
      historyTail = ` Caso prefira, posso resumir os pontos principais em uma ligação rápida de 5 minutos.`;
    }
  }

  const ruleNote = matchingRule
    ? ` Motor de regras: "${matchingRule.name}" (${
        matchingRule.enabled ? 'ativa' : 'pausada'
      }, retorno em +${matchingRule.delayDays}d).`
    : '';

  let recommendedAction = 'Enviar abordagem revisada e registrar no histórico';
  if (hasOverdueProposal && primaryProposal) {
    recommendedAction = `Resgatar orçamento ${primaryProposal.code} vencido via ${
      recommendedChannel === 'telefone' ? 'ligação breve' : 'WhatsApp'
    }`;
  } else if (!hasPendingFollowUp && primaryOpp) {
    recommendedAction = `Retomar contato imediatamente e criar follow-up (+${suggestedFollowUpDelayDays}d)`;
  } else if (stageId === 'negociacao') {
    recommendedAction =
      'Destravar pendência final de aprovação e confirmar cronograma';
  } else if (lastConv?.direction === 'recebido') {
    recommendedAction =
      'Responder ao retorno recebido enquanto o interesse está aquecido';
  }

  const headline =
    !hasPendingFollowUp && primaryOpp
      ? 'Sugestão prioritária: retomar oportunidade sem follow-up'
      : lastConv?.direction === 'recebido' && stageId !== 'orcamento_enviado'
      ? `Sugestão de resposta rápida (${stageLabel})`
      : base.headline;

  const rationale = `${contextParts.join(' · ')} — ${historyContextText}.${ruleNote}`;

  const suggestedMessage = historyTail
    ? `${base.suggestedMessage}${historyTail}`
    : base.suggestedMessage;

  return {
    clientId,
    stageId,
    stageLabel,
    opportunityId: primaryOpp?.id,
    opportunityTitle: primaryOpp?.title,
    opportunityValue: primaryOpp?.value,
    matchedRuleName: matchingRule?.name ?? null,
    matchedRuleActive: Boolean(matchingRule?.enabled),
    ruleCadenceLabel,
    recommendedChannel,
    recommendedAction,
    suggestedFollowUpDelayDays,
    suggestedPriority,
    daysSinceLastContact,
    lastInteractionChannel: lastConv?.channel ?? null,
    lastInteractionDirection: lastConv?.direction ?? null,
    lastInteractionSummary: lastConv?.summary ?? null,
    hasPendingFollowUp,
    hasOverdueProposal,
    headline,
    rationale,
    suggestedMessage,
    isSuggestion: true,
    requiresManualReview: true,
  };
}

export interface AnalyticsSegment {
  id: string;
  label: string;
  count: number;
  value?: number;
  pct: number;
  color: string;
  filterHint?: string;
}

export interface OwnerAnalyticsRow {
  owner: string;
  closedRevenue: number;
  openPipeline: number;
  dealsCount: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  completionRatePct: number;
}

export interface ExecutiveInsight {
  id: string;
  tone: 'warning' | 'positive' | 'gold';
  title: string;
  detail: string;
  actionLabel: string;
  targetSection: 'funil' | 'orcamentos' | 'tarefas' | 'financeiro' | 'simulador';
  filterHint?: string;
}

export interface DashboardAnalytics {
  followUpHealth: {
    totalTasks: number;
    onTimePct: number;
    segments: AnalyticsSegment[];
  };
  proposalBreakdown: {
    totalCount: number;
    totalValue: number;
    approvalRatePct: number;
    overdueValue: number;
    segments: AnalyticsSegment[];
  };
  cashflowComparison: {
    received: number;
    pendingReceivables: number;
    paidExpenses: number;
    pendingExpenses: number;
    projectedBalance: number;
    overdueCount: number;
  };
  ownerPerformance: OwnerAnalyticsRow[];
  channelActivity: {
    totalTouchpoints: number;
    channels: AnalyticsSegment[];
  };
  executiveInsights: ExecutiveInsight[];
}

export function computeDashboardAnalytics(state: CrmState): DashboardAnalytics {
  const summary = computeFollowUpSummary(state.tasks, state.referenceDate);
  const totalTasks = state.tasks.length;
  const upcomingOnTime = Math.max(
    0,
    summary.pending - summary.overdue - summary.today
  );
  const onTimeCount = Math.max(0, totalTasks - summary.overdue);
  const onTimePct =
    totalTasks > 0 ? Math.round((onTimeCount / totalTasks) * 100) : 100;

  const pctOf = (part: number, whole: number) =>
    whole > 0 ? Math.round((part / whole) * 100) : 0;

  const followUpSegments: AnalyticsSegment[] = [
    {
      id: 'concluido',
      label: 'Concluídos',
      count: summary.completed,
      pct: pctOf(summary.completed, totalTasks),
      color: '#4ADE80',
      filterHint: 'concluido',
    },
    {
      id: 'hoje',
      label: 'Para hoje',
      count: summary.today,
      pct: pctOf(summary.today, totalTasks),
      color: '#D4AF37',
      filterHint: 'hoje',
    },
    {
      id: 'no_prazo',
      label: 'No prazo',
      count: upcomingOnTime,
      pct: pctOf(upcomingOnTime, totalTasks),
      color: '#60A5FA',
      filterHint: 'pendente',
    },
    {
      id: 'atrasado',
      label: 'Atrasados',
      count: summary.overdue,
      pct: pctOf(summary.overdue, totalTasks),
      color: '#F87171',
      filterHint: 'atrasado',
    },
  ];

  // Proposals breakdown
  const propMetrics = computeProposalMetrics(state);
  const approvedProps = state.proposals.filter((p) => p.status === 'aprovado');
  const openProps = state.proposals.filter(
    (p) => p.status === 'aguardando_retorno' || p.status === 'em_revisao'
  );
  const overdueProps = openProps.filter(
    (p) => p.expectedReturnDate < state.referenceDate
  );
  const onTrackOpenProps = openProps.filter(
    (p) => p.expectedReturnDate >= state.referenceDate
  );
  const lostProps = state.proposals.filter((p) => p.status === 'perdido');

  const totalProposalValue = state.proposals.reduce((s, p) => s + p.value, 0);
  const decidedCount = approvedProps.length + lostProps.length;
  const approvalRatePct =
    decidedCount > 0
      ? Math.round((approvedProps.length / decidedCount) * 100)
      : 0;

  const proposalSegments: AnalyticsSegment[] = [
    {
      id: 'aprovado',
      label: 'Aprovados',
      count: approvedProps.length,
      value: propMetrics.approvedValue,
      pct: pctOf(propMetrics.approvedValue, totalProposalValue),
      color: '#4ADE80',
    },
    {
      id: 'aberto_prazo',
      label: 'Em aberto (no prazo)',
      count: onTrackOpenProps.length,
      value: onTrackOpenProps.reduce((s, p) => s + p.value, 0),
      pct: pctOf(
        onTrackOpenProps.reduce((s, p) => s + p.value, 0),
        totalProposalValue
      ),
      color: '#D4AF37',
    },
    {
      id: 'vencido',
      label: 'Retorno vencido',
      count: overdueProps.length,
      value: propMetrics.overdueValue,
      pct: pctOf(propMetrics.overdueValue, totalProposalValue),
      color: '#F59E0B',
    },
    {
      id: 'perdido',
      label: 'Perdidos',
      count: lostProps.length,
      value: propMetrics.lostValue,
      pct: pctOf(propMetrics.lostValue, totalProposalValue),
      color: '#F87171',
    },
  ];

  // Cashflow comparison
  const fin = computeFinancialSummary(state);

  // Owner performance
  const ownerSet = new Set<string>();
  state.opportunities.forEach((o) => ownerSet.add(o.owner));
  state.tasks.forEach((t) => ownerSet.add(t.owner));
  const ownerPerformance: OwnerAnalyticsRow[] = Array.from(ownerSet)
    .map((owner) => {
      const opps = state.opportunities.filter((o) => o.owner === owner);
      const closedRevenue = opps
        .filter((o) => o.stage === 'fechado')
        .reduce((s, o) => s + o.value, 0);
      const openPipeline = opps
        .filter((o) => o.stage !== 'fechado')
        .reduce((s, o) => s + o.value, 0);
      const tasks = state.tasks.filter((t) => t.owner === owner);
      const completedTasks = tasks.filter((t) => t.status === 'concluido').length;
      const overdueTasks = tasks.filter((t) =>
        isTaskOverdue(t, state.referenceDate)
      ).length;
      return {
        owner,
        closedRevenue,
        openPipeline,
        dealsCount: opps.length,
        totalTasks: tasks.length,
        completedTasks,
        overdueTasks,
        completionRatePct: pctOf(completedTasks, tasks.length),
      };
    })
    .sort(
      (a, b) =>
        b.closedRevenue + b.openPipeline - (a.closedRevenue + a.openPipeline)
    );

  // Channel activity (conversations + follow-up tasks)
  const channelDefs: Array<{
    id: 'whatsapp' | 'email' | 'telefone' | 'reuniao';
    label: string;
    color: string;
  }> = [
    { id: 'whatsapp', label: 'WhatsApp', color: '#D4AF37' },
    { id: 'email', label: 'E-mail', color: '#60A5FA' },
    { id: 'telefone', label: 'Telefone', color: '#4ADE80' },
    { id: 'reuniao', label: 'Reunião', color: '#A78BFA' },
  ];

  const totalTouchpoints = state.conversations.length + state.tasks.length;
  const channels: AnalyticsSegment[] = channelDefs
    .map((ch) => {
      const count =
        state.conversations.filter((c) => c.channel === ch.id).length +
        state.tasks.filter((t) => t.channel === ch.id).length;
      return {
        id: ch.id,
        label: ch.label,
        count,
        pct: pctOf(count, totalTouchpoints),
        color: ch.color,
      };
    })
    .sort((a, b) => b.count - a.count);

  // Live Executive Insights
  const unattended = detectUnattendedOpportunities(
    state.opportunities,
    state.tasks
  );
  const unattendedValue = unattended.reduce((s, o) => s + o.value, 0);
  const exposedRiskValue = unattendedValue + propMetrics.overdueValue;

  const executiveInsights: ExecutiveInsight[] = [
    {
      id: 'insight-risk',
      tone: exposedRiskValue > 0 ? 'warning' : 'positive',
      title:
        exposedRiskValue > 0
          ? `${formatCurrencyBRL(exposedRiskValue)} em risco por falta de retorno`
          : 'Operação comercial sem exposição crítica',
      detail:
        exposedRiskValue > 0
          ? `${unattended.length} oportunidade(s) sem follow-up (${formatCurrencyBRL(
              unattendedValue
            )}) e ${propMetrics.overdueCount} orçamento(s) vencido(s) (${formatCurrencyBRL(
              propMetrics.overdueValue
            )}).`
          : 'Todas as oportunidades abertas e orçamentos estão dentro do prazo de acompanhamento.',
      actionLabel:
        propMetrics.overdueCount > 0 ? 'Tratar orçamentos' : 'Abrir funil',
      targetSection: propMetrics.overdueCount > 0 ? 'orcamentos' : 'funil',
    },
    {
      id: 'insight-cashflow',
      tone: fin.projectedCashBalance >= 0 ? 'positive' : 'warning',
      title: `Saldo projetado de ${formatCurrencyBRL(fin.projectedCashBalance)}`,
      detail: `${formatCurrencyBRL(
        fin.pendingReceivables
      )} previstos a receber frente a ${formatCurrencyBRL(
        fin.pendingExpenses
      )} em despesas pendentes${
        fin.overdueTotalCount > 0
          ? ` (${fin.overdueTotalCount} vencido(s) em aberto).`
          : '.'
      }`,
      actionLabel: 'Abrir financeiro',
      targetSection: 'financeiro',
    },
    {
      id: 'insight-cadence',
      tone: summary.overdue > 0 ? 'gold' : 'positive',
      title: `Disciplina de follow-up em ${onTimePct}%`,
      detail:
        summary.overdue > 0
          ? `${summary.overdue} retorno(s) atrasado(s) concentrando a maior chance de perda. Canal principal: ${
              channels[0]?.label ?? 'WhatsApp'
            } (${channels[0]?.pct ?? 0}%).`
          : `Zero tarefas atrasadas. Canal dominante da operação: ${
              channels[0]?.label ?? 'WhatsApp'
            } (${channels[0]?.pct ?? 0}%).`,
      actionLabel: summary.overdue > 0 ? 'Resolver atrasados' : 'Ver agenda',
      targetSection: 'tarefas',
      filterHint: summary.overdue > 0 ? 'atrasado' : 'pendente',
    },
  ];

  return {
    followUpHealth: {
      totalTasks,
      onTimePct,
      segments: followUpSegments,
    },
    proposalBreakdown: {
      totalCount: state.proposals.length,
      totalValue: totalProposalValue,
      approvalRatePct,
      overdueValue: propMetrics.overdueValue,
      segments: proposalSegments,
    },
    cashflowComparison: {
      received: fin.receivedTotal,
      pendingReceivables: fin.pendingReceivables,
      paidExpenses: fin.paidExpenses,
      pendingExpenses: fin.pendingExpenses,
      projectedBalance: fin.projectedCashBalance,
      overdueCount: fin.overdueTotalCount,
    },
    ownerPerformance,
    channelActivity: {
      totalTouchpoints,
      channels,
    },
    executiveInsights,
  };
}



