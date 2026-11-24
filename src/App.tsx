/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Menu, Presentation, Search } from 'lucide-react';
import {
  Client,
  ConversationChannel,
  CrmState,
  DiagnosticSubmission,
  FinancialEntry,
  FollowUpRule,
  FollowUpTask,
  LOSS_REASON_LABELS,
  LossReason,
  MessageTemplate,
  NavSection,
  Opportunity,
  PipelineStage,
  Proposal,
} from './types/crm';
import { loadCrmState, resetCrmState, saveCrmState } from './lib/storage';
import {
  addDaysToDateString,
  calculateLossSimulator,
  ClientHistoryApproachSuggestion,
  computeFinancialSummary,
  computeFollowUpSummary,
  computeProposalMetrics,
  detectUnattendedOpportunities,
  formatRelativeDueDate,
  getStageConfig,
  LossSimulatorInput,
  moveOpportunityStage,
  resolveFollowUpOutcome,
} from './lib/crm-engine';
import { Sidebar } from './components/sidebar/Sidebar';
import { DashboardView } from './components/dashboard/DashboardView';
import { ClientsView } from './components/crm/ClientsView';
import { PipelineView } from './components/crm/PipelineView';
import { ProposalsView } from './components/crm/ProposalsView';
import { TasksFollowUpView } from './components/crm/TasksFollowUpView';
import { FinancialView } from './components/crm/FinancialView';
import { SimulatorDiagnosticView } from './components/crm/SimulatorDiagnosticView';
import { ReportsView } from './components/crm/ReportsView';
import { ConfirmDialog } from './components/ui/Modal';
import { ToastBanner, ToastMessage } from './components/ui/ToastBanner';
import {
  PRESENTATION_STEPS,
  PresentationGuideBar,
} from './components/ui/PresentationGuideBar';
import { DiagnosticRequestModal } from './components/ui/DiagnosticRequestModal';

const SECTION_META: Record<NavSection, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Visão Geral da Operação',
    subtitle: 'Inteligência operacional: oportunidades paradas, orçamentos e Central de Follow-up',
  },
  clientes: {
    title: 'Clientes & Histórico Centralizado',
    subtitle: 'Cadastro de contatos e conversas fora de planilhas e chats soltos',
  },
  funil: {
    title: 'Funil Comercial',
    subtitle: 'Arraste oportunidades entre etapas e dispare follow-ups automáticos',
  },
  orcamentos: {
    title: 'Gestão de Orçamentos',
    subtitle: 'Propostas enviadas, prazos de retorno, alertas e motivos de perda',
  },
  tarefas: {
    title: 'Central de Follow-up & Tarefas',
    subtitle: 'Agenda de retornos, calendário, regras inteligentes e sugestões revisáveis',
  },
  financeiro: {
    title: 'Visibilidade Financeira',
    subtitle: 'Contas a receber, despesas, fluxo de caixa previsto e alertas de vencimento',
  },
  simulador: {
    title: 'Diagnóstico & Simulador de Perdas',
    subtitle: 'Estime oportunidades não acompanhadas e mapeie gargalos da operação',
  },
  relatorios: {
    title: 'Relatórios Comerciais',
    subtitle: 'Indicadores de acompanhamento, conversão, motivos de perda e equipe',
  },
};

const DEFAULT_SIMULATOR_INPUT: LossSimulatorInput = {
  contactsPerMonth: 100,
  proposalsPerMonth: 45,
  unfollowedPct: 20,
  avgTicket: 500,
  currentConversionPct: 25,
  hypotheticalRecoveryPct: 25,
};

export default function App() {
  const [state, setState] = useState<CrmState>(() => loadCrmState());
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [taskFilterHint, setTaskFilterHint] = useState<
    'todos' | 'pendente' | 'atrasado' | 'hoje' | 'concluido'
  >('pendente');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Simulator state shared with Diagnostic Modal
  const [simInput, setSimInput] = useState<LossSimulatorInput>(
    DEFAULT_SIMULATOR_INPUT
  );
  const [diagnosticModalOpen, setDiagnosticModalOpen] = useState(false);

  // Commercial Presentation Mode (7-minute guided pitch)
  const [presentationMode, setPresentationMode] = useState(false);
  const [presentationStepIndex, setPresentationStepIndex] = useState(0);

  useEffect(() => {
    saveCrmState(state);
  }, [state]);

  const showToast = useCallback(
    (text: string, tone: 'gold' | 'success' = 'gold') => {
      const id = String(Date.now());
      setToast({ id, text, tone });
      window.setTimeout(() => {
        setToast((curr) => (curr?.id === id ? null : curr));
      }, 4200);
    },
    []
  );

  const followUpSummary = computeFollowUpSummary(
    state.tasks,
    state.referenceDate
  );
  const unattendedCount = detectUnattendedOpportunities(
    state.opportunities,
    state.tasks
  ).length;
  const proposalMetrics = computeProposalMetrics(state);
  const financialSummary = computeFinancialSummary(state);
  const simOutput = calculateLossSimulator(simInput);

  const handleNavigate = (section: NavSection, filterHint?: string) => {
    setActiveSection(section);
    if (
      section === 'tarefas' &&
      (filterHint === 'pendente' ||
        filterHint === 'atrasado' ||
        filterHint === 'hoje' ||
        filterHint === 'concluido' ||
        filterHint === 'todos')
    ) {
      setTaskFilterHint(filterHint);
    }
  };

  const handleOpenClientDetail = (clientId: string) => {
    setSelectedClientId(clientId);
    setActiveSection('clientes');
  };

  const handleSelectPresentationStep = (idx: number) => {
    const bounded = Math.max(0, Math.min(PRESENTATION_STEPS.length - 1, idx));
    setPresentationStepIndex(bounded);
    const step = PRESENTATION_STEPS[bounded];
    setActiveSection(step.targetSection);
  };

  const handleTogglePresentationMode = () => {
    if (!presentationMode) {
      setPresentationMode(true);
      setPresentationStepIndex(0);
      setActiveSection(PRESENTATION_STEPS[0].targetSection);
      showToast(
        'Modo de Apresentação (7 min) ativado. Use o guia no rodapé para conduzir a reunião.',
        'gold'
      );
    } else {
      setPresentationMode(false);
    }
  };

  // --- Clients CRUD ---
  const handleAddClient = (clientData: Omit<Client, 'id' | 'createdAt'>) => {
    const newClient: Client = {
      ...clientData,
      id: `cli-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      clients: [newClient, ...prev.clients],
    }));
    showToast(`Cliente "${newClient.company}" cadastrado na demonstração.`, 'success');
  };

  const handleUpdateClient = (updated: Client) => {
    setState((prev) => ({
      ...prev,
      clients: prev.clients.map((c) => (c.id === updated.id ? updated : c)),
    }));
    showToast(`Dados de "${updated.company}" atualizados.`, 'success');
  };

  const handleDeleteClient = (clientId: string) => {
    const target = state.clients.find((c) => c.id === clientId);
    setState((prev) => ({
      ...prev,
      clients: prev.clients.filter((c) => c.id !== clientId),
      opportunities: prev.opportunities.filter((o) => o.clientId !== clientId),
      proposals: prev.proposals.filter((p) => p.clientId !== clientId),
      tasks: prev.tasks.filter((t) => t.clientId !== clientId),
      conversations: prev.conversations.filter((cv) => cv.clientId !== clientId),
    }));
    if (target) {
      showToast(`Cliente "${target.company}" removido.`);
    }
  };

  const handleAddConversation = (entry: {
    clientId: string;
    channel: ConversationChannel;
    direction: 'enviado' | 'recebido' | 'interno';
    summary: string;
    owner: string;
  }) => {
    setState((prev) => ({
      ...prev,
      conversations: [
        {
          id: `conv-${Date.now()}`,
          clientId: entry.clientId,
          channel: entry.channel,
          direction: entry.direction,
          summary: entry.summary,
          owner: entry.owner,
          timestamp: new Date().toISOString(),
        },
        ...prev.conversations,
      ],
    }));
    showToast('Interação registrada no histórico do cliente.', 'success');
  };

  // --- Pipeline CRUD & Stage Moves ---
  const handleMoveStage = (opportunityId: string, targetStage: PipelineStage) => {
    const { nextState, autoCreatedTask } = moveOpportunityStage(
      state,
      opportunityId,
      targetStage,
      new Date().toISOString()
    );
    setState(nextState);

    const stageLabel = getStageConfig(targetStage).label;
    if (autoCreatedTask) {
      showToast(
        `Etapa alterada para "${stageLabel}". Follow-up automático agendado para ${formatRelativeDueDate(
          autoCreatedTask.dueDate,
          nextState.referenceDate
        )} às ${autoCreatedTask.dueTime} (revisão manual).`,
        'gold'
      );
    } else {
      showToast(`Oportunidade movida para "${stageLabel}".`, 'success');
    }
  };

  const handleAddOpportunity = (
    oppData: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    const nowIso = new Date().toISOString();
    const newOpp: Opportunity = {
      ...oppData,
      id: `opp-${Date.now()}`,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const matchingRule = state.rules.find(
      (r) => r.enabled && r.triggerStage === newOpp.stage && newOpp.stage !== 'fechado'
    );

    let autoTask: FollowUpTask | null = null;
    if (matchingRule) {
      autoTask = {
        id: `tsk-auto-${Date.now()}`,
        clientId: newOpp.clientId,
        opportunityId: newOpp.id,
        title: matchingRule.defaultTaskTitle,
        contextLabel: matchingRule.defaultContextLabel,
        dueDate: addDaysToDateString(state.referenceDate, matchingRule.delayDays),
        dueTime: '10:30',
        priority: matchingRule.defaultPriority,
        owner: newOpp.owner,
        status: 'pendente',
        channel: 'whatsapp',
        notes: `Criado automaticamente pela regra "${matchingRule.name}". Revisão manual obrigatória.`,
        autoGenerated: true,
        requiresManualApproval: true,
        recurrenceDays: matchingRule.recurrenceDays,
      };
    }

    setState((prev) => ({
      ...prev,
      opportunities: [newOpp, ...prev.opportunities],
      tasks: autoTask ? [autoTask, ...prev.tasks] : prev.tasks,
    }));

    showToast(
      autoTask
        ? `Oportunidade "${newOpp.title}" criada com follow-up automático agendado.`
        : `Oportunidade "${newOpp.title}" criada no funil.`,
      'success'
    );
  };

  const handleUpdateOpportunity = (updated: Opportunity) => {
    setState((prev) => ({
      ...prev,
      opportunities: prev.opportunities.map((o) =>
        o.id === updated.id ? updated : o
      ),
    }));
    showToast(`Oportunidade "${updated.title}" atualizada.`, 'success');
  };

  const handleDeleteOpportunity = (oppId: string) => {
    setState((prev) => ({
      ...prev,
      opportunities: prev.opportunities.filter((o) => o.id !== oppId),
    }));
    showToast('Oportunidade removida do funil.');
  };

  // --- Proposals CRUD & Actions ---
  const handleAddProposal = (proposalData: Omit<Proposal, 'id' | 'code'>) => {
    const codeNum = 409 + state.proposals.length;
    const newProposal: Proposal = {
      ...proposalData,
      id: `prop-${Date.now()}`,
      code: `ORC-${codeNum}`,
    };

    // Automatically schedule a follow-up on the expected return date
    const autoFollowUp: FollowUpTask = {
      id: `tsk-prop-${Date.now()}`,
      clientId: newProposal.clientId,
      opportunityId: newProposal.opportunityId,
      title: `Acompanhar retorno do orçamento ${newProposal.code}`,
      contextLabel: 'Orçamento enviado',
      dueDate: newProposal.expectedReturnDate,
      dueTime: '10:00',
      priority: 'alta',
      owner: newProposal.owner,
      status: 'pendente',
      channel: 'whatsapp',
      notes: `Follow-up vinculado ao orçamento ${newProposal.code}.`,
      autoGenerated: true,
      requiresManualApproval: true,
      recurrenceDays: 3,
    };

    setState((prev) => ({
      ...prev,
      proposals: [newProposal, ...prev.proposals],
      tasks: [autoFollowUp, ...prev.tasks],
    }));
    showToast(
      `Orçamento ${newProposal.code} registrado e follow-up agendado para o prazo de retorno.`,
      'success'
    );
  };

  const handleApproveProposal = (proposalId: string) => {
    const target = state.proposals.find((p) => p.id === proposalId);
    if (!target) return;
    const nowIso = new Date().toISOString();
    const dueDate = addDaysToDateString(state.referenceDate, 7);

    setState((prev) => ({
      ...prev,
      proposals: prev.proposals.map((p) =>
        p.id === proposalId ? { ...p, status: 'aprovado' } : p
      ),
      opportunities: target.opportunityId
        ? prev.opportunities.map((o) =>
            o.id === target.opportunityId
              ? { ...o, stage: 'fechado', probability: 100, updatedAt: nowIso }
              : o
          )
        : prev.opportunities,
      financialEntries: [
        {
          id: `fin-prop-${Date.now()}`,
          description: `Aprovação ${target.code} — ${target.title}`,
          clientId: target.clientId,
          category: 'Venda Aprovada',
          type: 'receber',
          amount: target.value,
          dueDate,
          status: 'pendente',
        },
        ...prev.financialEntries,
      ],
    }));

    showToast(
      `Orçamento ${target.code} aprovado! Funil atualizado e previsão lançada no Financeiro.`,
      'success'
    );
  };

  const handleMarkProposalLost = (proposalId: string, reason: LossReason) => {
    const target = state.proposals.find((p) => p.id === proposalId);
    if (!target) return;

    setState((prev) => ({
      ...prev,
      proposals: prev.proposals.map((p) =>
        p.id === proposalId ? { ...p, status: 'perdido', lossReason: reason } : p
      ),
      conversations: [
        {
          id: `conv-loss-${Date.now()}`,
          clientId: target.clientId,
          opportunityId: target.opportunityId,
          channel: 'reuniao',
          direction: 'interno',
          summary: `Orçamento ${target.code} marcado como perdido. Motivo: ${LOSS_REASON_LABELS[reason]}.`,
          owner: target.owner,
          timestamp: new Date().toISOString(),
        },
        ...prev.conversations,
      ],
    }));

    showToast(
      `Perda registrada em ${target.code} (${LOSS_REASON_LABELS[reason]}). Relatórios atualizados.`,
      'gold'
    );
  };

  const handleScheduleProposalFollowUp = (proposal: Proposal) => {
    const nextDate = addDaysToDateString(state.referenceDate, 1);
    const task: FollowUpTask = {
      id: `tsk-propfu-${Date.now()}`,
      clientId: proposal.clientId,
      opportunityId: proposal.opportunityId,
      title: `Retomar orçamento ${proposal.code} — ${proposal.title}`,
      contextLabel: 'Orçamento enviado',
      dueDate: nextDate,
      dueTime: '10:30',
      priority: 'alta',
      owner: proposal.owner,
      status: 'pendente',
      channel: 'whatsapp',
      notes: 'Agendado diretamente pelo módulo de Orçamentos.',
      requiresManualApproval: true,
      recurrenceDays: 2,
    };
    setState((prev) => ({
      ...prev,
      tasks: [task, ...prev.tasks],
    }));
    showToast(`Follow-up agendado para ${proposal.code} (Amanhã · 10:30).`, 'success');
  };

  // --- Financial CRUD ---
  const handleAddFinancialEntry = (entryData: Omit<FinancialEntry, 'id'>) => {
    const entry: FinancialEntry = {
      ...entryData,
      id: `fin-${Date.now()}`,
    };
    setState((prev) => ({
      ...prev,
      financialEntries: [entry, ...prev.financialEntries],
    }));
    showToast('Lançamento adicionado ao fluxo financeiro.', 'success');
  };

  const handleToggleFinancialPaid = (entryId: string) => {
    setState((prev) => ({
      ...prev,
      financialEntries: prev.financialEntries.map((e) =>
        e.id === entryId
          ? {
              ...e,
              status: e.status === 'pendente' ? 'pago' : 'pendente',
              paidAt:
                e.status === 'pendente' ? new Date().toISOString() : undefined,
            }
          : e
      ),
    }));
    showToast('Status financeiro atualizado no fluxo de caixa.', 'success');
  };

  const handleDeleteFinancialEntry = (entryId: string) => {
    setState((prev) => ({
      ...prev,
      financialEntries: prev.financialEntries.filter((e) => e.id !== entryId),
    }));
    showToast('Lançamento financeiro removido.');
  };

  // --- Tasks & Follow-up ---
  const handleToggleTaskComplete = (taskId: string) => {
    const existing = state.tasks.find((t) => t.id === taskId);
    if (!existing) return;
    const nextStatus = existing.status === 'pendente' ? 'concluido' : 'pendente';

    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: nextStatus,
              completedAt:
                nextStatus === 'concluido' ? new Date().toISOString() : undefined,
              outcome:
                nextStatus === 'concluido' ? 'concluido_padrao' : undefined,
            }
          : t
      ),
    }));

    showToast(
      nextStatus === 'concluido'
        ? 'Acompanhamento marcado como concluído. Indicadores atualizados.'
        : 'Tarefa reaberta na agenda de follow-ups.',
      nextStatus === 'concluido' ? 'success' : 'gold'
    );
  };

  const handleResolveOutcome = (taskId: string, clientResponded: boolean) => {
    const result = resolveFollowUpOutcome(
      state,
      taskId,
      clientResponded,
      new Date().toISOString()
    );
    setState(result.nextState);

    if (clientResponded) {
      showToast(
        result.advancedOpportunityTitle
          ? `Resposta registrada! "${result.advancedOpportunityTitle}" avançou para Negociação.`
          : 'Resposta do cliente registrada e follow-up concluído.',
        'success'
      );
    } else if (result.followUpReminderCreated) {
      showToast(
        `Sem resposta registrada. Novo lembrete criado para ${formatRelativeDueDate(
          result.followUpReminderCreated.dueDate,
          result.nextState.referenceDate
        )} às ${result.followUpReminderCreated.dueTime}.`,
        'gold'
      );
    }
  };

  const handleAddTask = (taskData: Omit<FollowUpTask, 'id'>) => {
    const newTask: FollowUpTask = {
      ...taskData,
      id: `tsk-${Date.now()}`,
    };
    setState((prev) => ({
      ...prev,
      tasks: [newTask, ...prev.tasks],
    }));
    showToast('Novo follow-up adicionado à agenda.', 'success');
  };

  const handleDeleteTask = (taskId: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== taskId),
    }));
    showToast('Tarefa removida da agenda.');
  };

  const handleQuickScheduleForOpportunity = (opportunityId: string) => {
    const opp = state.opportunities.find((o) => o.id === opportunityId);
    if (!opp) return;
    const client = state.clients.find((c) => c.id === opp.clientId);
    const nextDate = addDaysToDateString(state.referenceDate, 1);

    const newTask: FollowUpTask = {
      id: `tsk-quick-${Date.now()}`,
      clientId: opp.clientId,
      opportunityId: opp.id,
      title: `Retorno comercial — ${opp.title}`,
      contextLabel: getStageConfig(opp.stage).label,
      dueDate: nextDate,
      dueTime: '10:30',
      priority: 'alta',
      owner: opp.owner,
      status: 'pendente',
      channel: 'whatsapp',
      notes: 'Agendado a partir do painel de oportunidades paradas.',
      requiresManualApproval: true,
      recurrenceDays: 2,
    };

    setState((prev) => ({
      ...prev,
      tasks: [newTask, ...prev.tasks],
    }));

    showToast(
      `Follow-up agendado para ${client?.company ?? 'cliente'} (Amanhã · 10:30).`,
      'success'
    );
  };

  const handleUpdateRule = (rule: FollowUpRule) => {
    setState((prev) => ({
      ...prev,
      rules: prev.rules.map((r) => (r.id === rule.id ? rule : r)),
    }));
  };

  const handleSaveTemplate = (
    tplData: Omit<MessageTemplate, 'id' | 'updatedAt'> & { id?: string }
  ) => {
    const nowIso = new Date().toISOString();
    if (tplData.id) {
      setState((prev) => ({
        ...prev,
        templates: prev.templates.map((t) =>
          t.id === tplData.id
            ? { ...t, ...tplData, id: t.id, updatedAt: nowIso }
            : t
        ),
      }));
      showToast('Modelo de mensagem atualizado.', 'success');
    } else {
      const created: MessageTemplate = {
        ...tplData,
        id: `tpl-${Date.now()}`,
        updatedAt: nowIso,
      };
      setState((prev) => ({
        ...prev,
        templates: [created, ...prev.templates],
      }));
      showToast('Novo modelo de mensagem criado.', 'success');
    }
  };

  const handleDeleteTemplate = (tplId: string) => {
    setState((prev) => ({
      ...prev,
      templates: prev.templates.filter((t) => t.id !== tplId),
    }));
    showToast('Modelo removido.');
  };

  const handleToggleWhatsAppApproval = (requireManualApproval: boolean) => {
    setState((prev) => ({
      ...prev,
      whatsappConfig: {
        ...prev.whatsappConfig,
        requireManualApproval,
      },
    }));
  };

  const handleLogPreparedMessage = (
    clientId: string,
    channel: ConversationChannel,
    messageText: string
  ) => {
    const client = state.clients.find((c) => c.id === clientId);
    setState((prev) => ({
      ...prev,
      conversations: [
        {
          id: `conv-msg-${Date.now()}`,
          clientId,
          channel,
          direction: 'enviado',
          summary: `Abordagem revisada e registrada manualmente: "${messageText.slice(0, 140)}${
            messageText.length > 140 ? '...' : ''
          }"`,
          owner: client?.owner ?? 'Camila Duarte',
          timestamp: new Date().toISOString(),
        },
        ...prev.conversations,
      ],
    }));
    showToast(
      `Envio manual registrado no histórico de ${client?.company ?? 'cliente'}.`,
      'success'
    );
  };

  const handleScheduleFollowUpFromSuggestion = (
    suggestion: ClientHistoryApproachSuggestion
  ) => {
    const client = state.clients.find((c) => c.id === suggestion.clientId);
    const dueDate = addDaysToDateString(
      state.referenceDate,
      suggestion.suggestedFollowUpDelayDays
    );
    const newTask: FollowUpTask = {
      id: `tsk-ai-${Date.now()}`,
      clientId: suggestion.clientId,
      opportunityId: suggestion.opportunityId,
      title: suggestion.recommendedAction,
      contextLabel: suggestion.stageLabel,
      dueDate,
      dueTime: '10:30',
      priority: suggestion.suggestedPriority,
      owner: client?.owner ?? 'Camila Duarte',
      status: 'pendente',
      channel: suggestion.recommendedChannel,
      notes: `Agendado via Sugestão de IA (${suggestion.ruleCadenceLabel}). Revisão manual obrigatória antes do envio.`,
      autoGenerated: true,
      requiresManualApproval: true,
      recurrenceDays: suggestion.suggestedFollowUpDelayDays,
    };

    setState((prev) => ({
      ...prev,
      tasks: [newTask, ...prev.tasks],
    }));

    showToast(
      `Follow-up agendado para ${client?.company ?? 'cliente'} (${formatRelativeDueDate(
        dueDate,
        state.referenceDate
      )} · 10:30) conforme o motor de regras.`,
      'success'
    );
  };

  const handleDiagnosticSubmit = (
    sub: Omit<DiagnosticSubmission, 'id' | 'createdAt'>
  ) => {
    const entry: DiagnosticSubmission = {
      ...sub,
      id: `diag-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      diagnosticRequests: [entry, ...prev.diagnosticRequests],
    }));
    showToast(
      `Diagnóstico operacional registrado para "${entry.companyName}".`,
      'success'
    );
  };

  const handleConfirmReset = () => {
    const restored = resetCrmState();
    setState(restored);
    setSimInput(DEFAULT_SIMULATOR_INPUT);
    setSelectedClientId(null);
    setGlobalSearch('');
    setResetDialogOpen(false);
    showToast('Dados de demonstração restaurados para o estado original.', 'gold');
  };

  const meta = SECTION_META[activeSection];

  return (
    <div className="min-h-screen bg-[#090A0D] text-[#F3F4F6] flex">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={(sec) => handleNavigate(sec)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        pendingFollowUps={followUpSummary.pending}
        overdueFollowUps={followUpSummary.overdue}
        unattendedCount={unattendedCount}
        overdueProposalsCount={proposalMetrics.overdueCount}
        overdueFinancialCount={financialSummary.overdueTotalCount}
        onRequestReset={() => setResetDialogOpen(true)}
        onOpenDiagnostic={() => setDiagnosticModalOpen(true)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Clean 3-Zone Top Header Bar */}
        <header className="sticky top-0 z-30 h-16 bg-[#090A0D]/95 backdrop-blur-md border-b border-white/[0.07] px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* Zone 1: Menu toggle (mobile) + Page title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menu de navegação"
              className="lg:hidden p-2 -ml-1 rounded-lg text-neutral-300 hover:text-white hover:bg-white/[0.06]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-[15px] sm:text-base font-semibold text-white truncate">
                {meta.title}
              </h1>
              <p className="hidden md:block text-[11.5px] text-neutral-400 truncate">
                {meta.subtitle}
              </p>
            </div>
          </div>

          {/* Zone 2: Global live search */}
          <div className="hidden md:block flex-1 max-w-xs lg:max-w-sm">
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Buscar clientes, propostas ou tarefas..."
                aria-label="Busca global no CRM"
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#12141A] border border-white/[0.08] rounded-lg text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-[#D4AF37]/60"
              />
            </div>
          </div>

          {/* Zone 3: Presentation Mode CTA */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleTogglePresentationMode}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                presentationMode
                  ? 'bg-[#D4AF37] text-[#090A0D] border-[#D4AF37] font-semibold'
                  : 'bg-[#12141A] hover:bg-[#191C25] text-[#E8C96D] border-[#D4AF37]/30'
              }`}
            >
              <Presentation className="w-3.5 h-3.5" />
              <span>{presentationMode ? 'Apresentação ativa' : 'Apresentar (7 min)'}</span>
            </button>
          </div>
        </header>

        {/* Main Workspace Content */}
        <main
          className={`flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto ${
            presentationMode ? 'pb-32' : ''
          }`}
        >
          {activeSection === 'dashboard' && (
            <DashboardView
              state={state}
              onNavigate={handleNavigate}
              onCompleteTask={handleToggleTaskComplete}
              onQuickScheduleForOpportunity={handleQuickScheduleForOpportunity}
              onOpenClientDetail={handleOpenClientDetail}
            />
          )}

          {activeSection === 'clientes' && (
            <ClientsView
              state={state}
              globalSearch={globalSearch}
              selectedClientId={selectedClientId}
              onSelectClient={setSelectedClientId}
              onAddClient={handleAddClient}
              onUpdateClient={handleUpdateClient}
              onDeleteClient={handleDeleteClient}
              onAddConversation={handleAddConversation}
              onLogSuggestedMessage={handleLogPreparedMessage}
              onScheduleFollowUpFromSuggestion={handleScheduleFollowUpFromSuggestion}
            />
          )}

          {activeSection === 'funil' && (
            <PipelineView
              state={state}
              globalSearch={globalSearch}
              onMoveStage={handleMoveStage}
              onAddOpportunity={handleAddOpportunity}
              onUpdateOpportunity={handleUpdateOpportunity}
              onDeleteOpportunity={handleDeleteOpportunity}
              onQuickScheduleForOpportunity={handleQuickScheduleForOpportunity}
              onOpenClientDetail={handleOpenClientDetail}
            />
          )}

          {activeSection === 'orcamentos' && (
            <ProposalsView
              state={state}
              globalSearch={globalSearch}
              onAddProposal={handleAddProposal}
              onApproveProposal={handleApproveProposal}
              onMarkProposalLost={handleMarkProposalLost}
              onScheduleProposalFollowUp={handleScheduleProposalFollowUp}
              onLogSuggestedMessage={(clientId, msg) =>
                handleLogPreparedMessage(clientId, 'whatsapp', msg)
              }
              onOpenClientDetail={handleOpenClientDetail}
            />
          )}

          {activeSection === 'tarefas' && (
            <TasksFollowUpView
              key={taskFilterHint}
              state={state}
              initialStatusFilter={taskFilterHint}
              globalSearch={globalSearch}
              onToggleTaskComplete={handleToggleTaskComplete}
              onResolveOutcome={handleResolveOutcome}
              onAddTask={handleAddTask}
              onDeleteTask={handleDeleteTask}
              onUpdateRule={handleUpdateRule}
              onSaveTemplate={handleSaveTemplate}
              onDeleteTemplate={handleDeleteTemplate}
              onToggleWhatsAppApproval={handleToggleWhatsAppApproval}
              onLogPreparedMessage={handleLogPreparedMessage}
              onOpenClientDetail={handleOpenClientDetail}
            />
          )}

          {activeSection === 'financeiro' && (
            <FinancialView
              state={state}
              globalSearch={globalSearch}
              onAddEntry={handleAddFinancialEntry}
              onToggleEntryPaid={handleToggleFinancialPaid}
              onDeleteEntry={handleDeleteFinancialEntry}
            />
          )}

          {activeSection === 'simulador' && (
            <SimulatorDiagnosticView
              state={state}
              simInput={simInput}
              onChangeSimInput={setSimInput}
              onRequestDiagnostic={() => setDiagnosticModalOpen(true)}
              onNavigate={handleNavigate}
            />
          )}

          {activeSection === 'relatorios' && (
            <ReportsView
              state={state}
              onRequestReset={() => setResetDialogOpen(true)}
              onNotify={(msg) => showToast(msg, 'success')}
            />
          )}
        </main>
      </div>

      <PresentationGuideBar
        open={presentationMode}
        stepIndex={presentationStepIndex}
        onSelectStep={handleSelectPresentationStep}
        onClose={() => setPresentationMode(false)}
        onOpenDiagnosticModal={() => setDiagnosticModalOpen(true)}
      />

      <DiagnosticRequestModal
        open={diagnosticModalOpen}
        onClose={() => setDiagnosticModalOpen(false)}
        simulatedPotential={simOutput.potentialAssociatedValue}
        simulatedRecovery={simOutput.hypotheticalRecoveredSales}
        onSubmit={handleDiagnosticSubmit}
      />

      <ConfirmDialog
        open={resetDialogOpen}
        title="Restaurar dados de demonstração"
        description="Todas as alterações locais (clientes, movimentações, orçamentos, lançamentos financeiros e tarefas) voltarão ao cenário inicial da Onethy."
        confirmLabel="Restaurar agora"
        onCancel={() => setResetDialogOpen(false)}
        onConfirm={handleConfirmReset}
      />

      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
