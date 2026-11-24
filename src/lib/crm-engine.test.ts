import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoState } from './demo-data';
import {
  calculateLossSimulator,
  computeDashboardAnalytics,
  computeDashboardMetrics,
  computeFinancialSummary,
  computeFollowUpSummary,
  computeProposalMetrics,
  computeStalledOpportunities,
  detectUnattendedOpportunities,
  generateClientHistoryApproachSuggestion,
  generateContextualSuggestion,
  moveOpportunityStage,
  renderMessageTemplate,
  resolveFollowUpOutcome,
} from './crm-engine';

test('initial demo data matches Central de Follow-up counts (12/4/8/6) and featured companies', () => {
  const state = createDemoState();
  const summary = computeFollowUpSummary(state.tasks, state.referenceDate);

  assert.equal(summary.pending, 12);
  assert.equal(summary.overdue, 4);
  assert.equal(summary.completed, 8);
  assert.equal(summary.today, 6);

  const companyNames = state.clients.map((c) => c.company);
  assert.ok(companyNames.includes('Empresa Alfa'));
  assert.ok(companyNames.includes('Comercial Beta'));
  assert.ok(companyNames.includes('Empresa Gama'));
});

test('detectUnattendedOpportunities identifies open deals without pending follow-up', () => {
  const state = createDemoState();
  const unattended = detectUnattendedOpportunities(
    state.opportunities,
    state.tasks
  );

  // opp-6 (NorteSul) and opp-7 (Aurora) have no pending follow-up initially
  assert.equal(unattended.length, 2);
  const ids = unattended.map((o) => o.id).sort();
  assert.deepEqual(ids, ['opp-6', 'opp-7']);
});

test('moveOpportunityStage updates stage and auto-creates follow-up when rule is active', () => {
  const state = createDemoState();
  const { nextState, autoCreatedTask } = moveOpportunityStage(
    state,
    'opp-6',
    'orcamento_enviado'
  );

  const moved = nextState.opportunities.find((o) => o.id === 'opp-6');
  assert.equal(moved?.stage, 'orcamento_enviado');
  assert.equal(moved?.probability, 65);
  assert.ok(autoCreatedTask, 'Expected an auto-created follow-up task');
  assert.equal(autoCreatedTask.requiresManualApproval, true);
  assert.equal(autoCreatedTask.dueDate, '2026-11-26'); // +2 days rule
  assert.equal(nextState.tasks.length, state.tasks.length + 1);

  // opp-6 is now attended
  const remainingUnattended = detectUnattendedOpportunities(
    nextState.opportunities,
    nextState.tasks
  );
  assert.equal(remainingUnattended.length, 1);
});

test('moveOpportunityStage skips auto-creation when matching rule is disabled', () => {
  const state = createDemoState();
  const disabledState = {
    ...state,
    rules: state.rules.map((r) =>
      r.triggerStage === 'orcamento_enviado' ? { ...r, enabled: false } : r
    ),
  };

  const { nextState, autoCreatedTask } = moveOpportunityStage(
    disabledState,
    'opp-6',
    'orcamento_enviado'
  );

  assert.equal(autoCreatedTask, null);
  assert.equal(nextState.tasks.length, state.tasks.length);
});

test('resolveFollowUpOutcome handles client responded (advances to Negociação) vs no response (creates reminder)', () => {
  const state = createDemoState();

  // Case 1: Client responded on Empresa Alfa (currently in orcamento_enviado)
  const respondedRes = resolveFollowUpOutcome(state, 'tsk-1', true);
  const alfaOpp = respondedRes.nextState.opportunities.find(
    (o) => o.id === 'opp-1'
  );
  const alfaTask = respondedRes.nextState.tasks.find((t) => t.id === 'tsk-1');
  assert.equal(alfaTask?.status, 'concluido');
  assert.equal(alfaTask?.outcome, 'respondeu');
  assert.equal(alfaOpp?.stage, 'negociacao');
  assert.equal(respondedRes.followUpReminderCreated, null);

  // Case 2: No response on Empresa Alfa -> creates new reminder +3 days
  const noResponseRes = resolveFollowUpOutcome(state, 'tsk-1', false);
  assert.ok(noResponseRes.followUpReminderCreated);
  assert.equal(noResponseRes.followUpReminderCreated.dueDate, '2026-11-27');
  assert.equal(
    noResponseRes.followUpReminderCreated.requiresManualApproval,
    true
  );
  const summaryAfter = computeFollowUpSummary(
    noResponseRes.nextState.tasks,
    noResponseRes.nextState.referenceDate
  );
  // 1 completed, 1 new pending created -> pending stays 12, completed becomes 9
  assert.equal(summaryAfter.pending, 12);
  assert.equal(summaryAfter.completed, 9);
});

test('renderMessageTemplate replaces all placeholders accurately', () => {
  const rendered = renderMessageTemplate(
    'Olá {{cliente}} da {{empresa}}, proposta de {{valor}} com {{responsavel}} ({{etapa}}).',
    {
      cliente: 'Henrique',
      empresa: 'Empresa Alfa',
      valor: 'R$ 48.600',
      responsavel: 'Camila Duarte',
      etapa: 'Orçamento enviado',
    }
  );
  assert.equal(
    rendered,
    'Olá Henrique da Empresa Alfa, proposta de R$ 48.600 com Camila Duarte (Orçamento enviado).'
  );
});

test('computeDashboardMetrics calculates conversion, revenue, and follow-up rate', () => {
  const state = createDemoState();
  const metrics = computeDashboardMetrics(state);

  assert.equal(metrics.closedDealsCount, 3);
  assert.equal(metrics.openDealsCount, 7);
  assert.equal(metrics.conversionRate, 30);
  assert.equal(metrics.followUpCompletionRate, 40); // 8 / 20
  assert.equal(metrics.recoveredOpportunitiesCount, 4);
  assert.ok(metrics.openPipelineValue > 0);
  assert.ok(metrics.closedRevenue > 0);
});

test('calculateLossSimulator reproduces exact user brief example (100 contacts, 20%, R$ 500, 25%)', () => {
  const res = calculateLossSimulator({
    contactsPerMonth: 100,
    proposalsPerMonth: 40,
    unfollowedPct: 20,
    avgTicket: 500,
    currentConversionPct: 25,
    hypotheticalRecoveryPct: 25,
  });

  assert.equal(res.unfollowedContacts, 20);
  assert.equal(res.potentialAssociatedValue, 10000);
  assert.equal(res.hypotheticalRecoveredSales, 2500);
  assert.equal(res.annualHypotheticalValue, 30000);
});

test('computeStalledOpportunities ranks unattended and longest-stalled deals first', () => {
  const state = createDemoState();
  const stalled = computeStalledOpportunities(state);

  assert.equal(stalled.length, 7);
  // Top two must be the unattended deals (Aurora stalled 7d, NorteSul stalled 6d)
  const topTwoIds = stalled.slice(0, 2).map((s) => s.opportunity.id).sort();
  assert.deepEqual(topTwoIds, ['opp-6', 'opp-7']);
  assert.equal(stalled[0].hasPendingFollowUp, false);
  assert.ok(stalled[0].daysStalled >= 6);
});

test('computeProposalMetrics calculates overdue proposals and loss reasons accurately', () => {
  const state = createDemoState();
  const pm = computeProposalMetrics(state);

  assert.equal(pm.totalOpenCount, 4);
  assert.equal(pm.overdueCount, 2); // ORC-402 (21/11) and ORC-405 (23/11)
  assert.equal(pm.lostCount, 2);
  assert.ok(pm.lossByReason.some((r) => r.reason === 'sem_retorno'));
});

test('computeFinancialSummary calculates receivables, expenses, projected balance, and overdue alerts', () => {
  const state = createDemoState();
  const fin = computeFinancialSummary(state);

  assert.equal(fin.receivedTotal, 62000);
  assert.equal(fin.paidExpenses, 9200);
  assert.equal(fin.currentCashBalance, 52800);
  assert.equal(fin.pendingReceivables, 51450); // 22000 + 13250 + 16200
  assert.equal(fin.pendingExpenses, 41200); // 34800 + 6400
  assert.equal(fin.projectedCashBalance, 63050);
  assert.equal(fin.overdueTotalCount, 2); // fin-3 (21/11) + fin-6 (22/11)
});

test('generateContextualSuggestion returns manual-review suggestion with client context', () => {
  const s = generateContextualSuggestion({
    contactName: 'Thiago Bastos',
    companyName: 'Solaris Energia Limpa',
    ownerName: 'Rafael Mendes',
    stageLabel: 'Orçamento enviado',
    value: 28500,
    daysWithoutReturn: 7,
    proposalCode: 'ORC-402',
  });

  assert.equal(s.isSuggestion, true);
  assert.equal(s.requiresManualReview, true);
  assert.ok(s.suggestedMessage.includes('Thiago'));
  assert.ok(s.suggestedMessage.includes('ORC-402'));
  assert.ok(s.suggestedMessage.includes('Solaris Energia Limpa'));
});

test('generateClientHistoryApproachSuggestion combines funnel stage, active rule, proposal, and conversation history', () => {
  const state = createDemoState();

  // Empresa Alfa (cli-alfa): orcamento_enviado, ORC-408 open, last interaction received on WhatsApp 1d ago
  const alfa = generateClientHistoryApproachSuggestion(state, 'cli-alfa');
  assert.ok(alfa);
  assert.equal(alfa.stageId, 'orcamento_enviado');
  assert.ok(alfa.matchedRuleName);
  assert.equal(alfa.matchedRuleActive, true);
  assert.equal(alfa.daysSinceLastContact, 1);
  assert.equal(alfa.lastInteractionDirection, 'recebido');
  assert.ok(alfa.suggestedMessage.includes('Henrique'));
  assert.ok(alfa.suggestedMessage.includes('ORC-408'));
  assert.equal(alfa.requiresManualReview, true);

  // Aurora Alimentos Finos (cli-aurora): primeiro_contato, unattended (no pending follow-up)
  const aurora = generateClientHistoryApproachSuggestion(state, 'cli-aurora');
  assert.ok(aurora);
  assert.equal(aurora.stageId, 'primeiro_contato');
  assert.equal(aurora.hasPendingFollowUp, false);
  assert.equal(aurora.suggestedPriority, 'alta');
  assert.ok(aurora.headline.toLowerCase().includes('sem follow-up'));

  // Solaris Energia Limpa (cli-solaris): overdue proposal ORC-402
  const solaris = generateClientHistoryApproachSuggestion(state, 'cli-solaris');
  assert.ok(solaris);
  assert.equal(solaris.hasOverdueProposal, true);
  assert.equal(solaris.suggestedPriority, 'alta');
  assert.ok(solaris.recommendedAction.includes('ORC-402'));

  // Grupo Delta Engenharia (cli-delta): fechado -> active client check-in suggestion
  const delta = generateClientHistoryApproachSuggestion(state, 'cli-delta');
  assert.ok(delta);
  assert.equal(delta.stageId, 'fechado');
  assert.equal(delta.recommendedChannel, 'reuniao');
  assert.ok(delta.headline.toLowerCase().includes('cliente ativo'));
});

test('computeDashboardAnalytics aggregates follow-up health, proposals, cashflow, owners, channels, and insights', () => {
  const state = createDemoState();
  const analytics = computeDashboardAnalytics(state);

  // Follow-up segments must sum to total tasks (20) with 80% on-time (16/20)
  const taskSum = analytics.followUpHealth.segments.reduce(
    (s, seg) => s + seg.count,
    0
  );
  assert.equal(taskSum, 20);
  assert.equal(analytics.followUpHealth.onTimePct, 80);

  // Proposals breakdown matches overdue exposure (R$ 82.500) and total count (7)
  assert.equal(analytics.proposalBreakdown.totalCount, 7);
  assert.equal(analytics.proposalBreakdown.overdueValue, 82500);

  // Cashflow matches projected balance (R$ 63.050) and overdue count (2)
  assert.equal(analytics.cashflowComparison.projectedBalance, 63050);
  assert.equal(analytics.cashflowComparison.overdueCount, 2);

  // Owners cover all 4 reps and sum to total closed + open pipeline
  assert.equal(analytics.ownerPerformance.length, 4);
  const totalOwnerClosed = analytics.ownerPerformance.reduce(
    (s, o) => s + o.closedRevenue,
    0
  );
  assert.equal(totalOwnerClosed, 132500);

  // Channel touchpoints equal conversations (7) + tasks (20) = 27 and are sorted descending
  assert.equal(analytics.channelActivity.totalTouchpoints, 27);
  const channelSum = analytics.channelActivity.channels.reduce(
    (s, c) => s + c.count,
    0
  );
  assert.equal(channelSum, 27);
  assert.ok(
    analytics.channelActivity.channels[0].count >=
      analytics.channelActivity.channels[1].count
  );

  // 3 live executive insights generated
  assert.equal(analytics.executiveInsights.length, 3);
});


