import React, { useState, useMemo } from 'react';
import {
  Plus,
  Check,
  RotateCcw,
  Calendar,
  ListTodo,
  GitBranch,
  FileText,
  Copy,
  ShieldCheck,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
  Trash2,
  ArrowDown,
  Send,
} from 'lucide-react';
import {
  ConversationChannel,
  CrmState,
  FollowUpRule,
  FollowUpTask,
  MessageTemplate,
  PIPELINE_STAGES,
  PipelineStage,
  Priority,
  TEAM_OWNERS,
} from '../../types/crm';
import {
  computeFollowUpSummary,
  daysBetweenDates,
  formatCurrencyBRL,
  formatRelativeDueDate,
  generateContextualSuggestion,
  getPriorityLabel,
  getStageConfig,
  isTaskOverdue,
  isTaskToday,
  renderMessageTemplate,
} from '../../lib/crm-engine';
import { Modal } from '../ui/Modal';

type SubTab = 'agenda' | 'calendario' | 'regras' | 'modelos';
type StatusFilter = 'todos' | 'pendente' | 'atrasado' | 'hoje' | 'concluido';

interface TasksFollowUpViewProps {
  state: CrmState;
  initialStatusFilter?: StatusFilter;
  globalSearch: string;
  onToggleTaskComplete: (taskId: string) => void;
  onResolveOutcome: (taskId: string, clientResponded: boolean) => void;
  onAddTask: (task: Omit<FollowUpTask, 'id'>) => void;
  onDeleteTask: (taskId: string) => void;
  onUpdateRule: (rule: FollowUpRule) => void;
  onSaveTemplate: (tpl: Omit<MessageTemplate, 'id' | 'updatedAt'> & { id?: string }) => void;
  onDeleteTemplate: (tplId: string) => void;
  onToggleWhatsAppApproval: (requireManualApproval: boolean) => void;
  onLogPreparedMessage: (clientId: string, channel: ConversationChannel, messageText: string) => void;
  onOpenClientDetail: (clientId: string) => void;
}

const PRIORITY_STYLE: Record<Priority, string> = {
  alta: 'text-[#F87171]',
  media: 'text-[#FBBF24]',
  baixa: 'text-neutral-400',
};

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export const TasksFollowUpView: React.FC<TasksFollowUpViewProps> = ({
  state,
  initialStatusFilter = 'pendente',
  globalSearch,
  onToggleTaskComplete,
  onResolveOutcome,
  onAddTask,
  onDeleteTask,
  onUpdateRule,
  onSaveTemplate,
  onDeleteTemplate,
  onToggleWhatsAppApproval,
  onLogPreparedMessage,
  onOpenClientDetail,
}) => {
  const [activeTab, setActiveTab] = useState<SubTab>('agenda');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatusFilter);
  const [priorityFilter, setPriorityFilter] = useState<'todas' | Priority>('todas');
  const [ownerFilter, setOwnerFilter] = useState<string>('todos');

  // Create Task Modal
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskFormError, setTaskFormError] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState({
    clientId: state.clients[0]?.id ?? '',
    opportunityId: state.opportunities[0]?.id ?? '',
    title: '',
    contextLabel: 'Orçamento enviado',
    dueDate: state.referenceDate,
    dueTime: '11:00',
    priority: 'alta' as Priority,
    owner: TEAM_OWNERS[0] as string,
    channel: 'whatsapp' as ConversationChannel,
    recurrenceDays: '2',
    notes: '',
  });

  // Calendar state anchored to Nov 2026
  const [calYear, setCalYear] = useState(2026);
  const [calMonth, setCalMonth] = useState(10); // 0-indexed -> 10 = November
  const [selectedDay, setSelectedDay] = useState<string>(state.referenceDate);

  // Message Prepare Modal
  const [messageModalTask, setMessageModalTask] = useState<FollowUpTask | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    state.templates[0]?.id ?? ''
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Template Editor Modal
  const [tplModalOpen, setTplModalOpen] = useState(false);
  const [editingTpl, setEditingTpl] = useState<MessageTemplate | null>(null);
  const [tplForm, setTplForm] = useState({
    name: '',
    stage: 'orcamento_enviado' as PipelineStage | 'geral',
    channel: 'whatsapp' as 'whatsapp' | 'email',
    subject: '',
    body: '',
  });
  const [tplPreviewClientId, setTplPreviewClientId] = useState<string>(
    state.clients[0]?.id ?? ''
  );

  const clientById = useMemo(
    () => new Map(state.clients.map((c) => [c.id, c])),
    [state.clients]
  );
  const oppById = useMemo(
    () => new Map(state.opportunities.map((o) => [o.id, o])),
    [state.opportunities]
  );

  const summary = useMemo(
    () => computeFollowUpSummary(state.tasks, state.referenceDate),
    [state.tasks, state.referenceDate]
  );

  const query = globalSearch.trim().toLowerCase();

  const filteredTasks = useMemo(() => {
    return [...state.tasks]
      .filter((t) => {
        if (statusFilter === 'pendente' && t.status !== 'pendente') return false;
        if (statusFilter === 'concluido' && t.status !== 'concluido') return false;
        if (statusFilter === 'atrasado' && !isTaskOverdue(t, state.referenceDate))
          return false;
        if (statusFilter === 'hoje' && !isTaskToday(t, state.referenceDate))
          return false;
        if (priorityFilter !== 'todas' && t.priority !== priorityFilter)
          return false;
        if (ownerFilter !== 'todos' && t.owner !== ownerFilter) return false;
        if (!query) return true;
        const client = clientById.get(t.clientId);
        return (
          t.title.toLowerCase().includes(query) ||
          t.contextLabel.toLowerCase().includes(query) ||
          (client?.company.toLowerCase().includes(query) ?? false) ||
          t.owner.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'pendente' ? -1 : 1;
        return `${a.dueDate}T${a.dueTime}`.localeCompare(
          `${b.dueDate}T${b.dueTime}`
        );
      });
  }, [
    state.tasks,
    state.referenceDate,
    statusFilter,
    priorityFilter,
    ownerFilter,
    query,
    clientById,
  ]);

  const handleOpenCreateTask = (prefillDate?: string) => {
    const firstClientId = state.clients[0]?.id ?? '';
    const firstOpp = state.opportunities.find((o) => o.clientId === firstClientId);
    setTaskForm({
      clientId: firstClientId,
      opportunityId: firstOpp?.id ?? '',
      title: '',
      contextLabel: 'Aguardando resposta',
      dueDate: prefillDate ?? state.referenceDate,
      dueTime: '11:00',
      priority: 'alta',
      owner: TEAM_OWNERS[0],
      channel: 'whatsapp',
      recurrenceDays: '2',
      notes: '',
    });
    setTaskFormError(null);
    setTaskModalOpen(true);
  };

  const handleSubmitTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.clientId || !taskForm.title.trim()) {
      setTaskFormError('Selecione um cliente e informe o objetivo do follow-up.');
      return;
    }
    onAddTask({
      clientId: taskForm.clientId,
      opportunityId: taskForm.opportunityId || undefined,
      title: taskForm.title.trim(),
      contextLabel: taskForm.contextLabel.trim() || 'Follow-up comercial',
      dueDate: taskForm.dueDate,
      dueTime: taskForm.dueTime,
      priority: taskForm.priority,
      owner: taskForm.owner,
      status: 'pendente',
      channel: taskForm.channel,
      notes: taskForm.notes.trim(),
      requiresManualApproval: true,
      recurrenceDays: Number(taskForm.recurrenceDays) || 2,
    });
    setTaskModalOpen(false);
  };

  // Calendar grid calculations
  const firstDayOfMonth = new Date(Date.UTC(calYear, calMonth, 1));
  const startWeekday = firstDayOfMonth.getUTCDay(); // 0=Sun
  const daysInMonth = new Date(Date.UTC(calYear, calMonth + 1, 0)).getUTCDate();

  const tasksByDate = useMemo(() => {
    const map = new Map<string, FollowUpTask[]>();
    for (const t of state.tasks) {
      const list = map.get(t.dueDate) ?? [];
      list.push(t);
      map.set(t.dueDate, list);
    }
    return map;
  }, [state.tasks]);

  const selectedDayTasks = useMemo(
    () =>
      (tasksByDate.get(selectedDay) ?? []).sort((a, b) =>
        a.dueTime.localeCompare(b.dueTime)
      ),
    [tasksByDate, selectedDay]
  );

  const handleCopyText = (text: string, id: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 1800);
  };

  const getRenderedMessage = (tpl: MessageTemplate, clientId: string, oppId?: string) => {
    const client = clientById.get(clientId);
    const opp =
      (oppId ? oppById.get(oppId) : undefined) ??
      state.opportunities.find((o) => o.clientId === clientId);
    return renderMessageTemplate(tpl.body, {
      cliente: client?.contactName ?? 'Cliente',
      empresa: client?.company ?? 'Empresa',
      valor: opp ? formatCurrencyBRL(opp.value) : 'R$ 0',
      responsavel: client?.owner ?? TEAM_OWNERS[0],
      etapa: opp ? getStageConfig(opp.stage).label : 'Primeiro contato',
    });
  };

  const openTemplateModal = (tpl?: MessageTemplate) => {
    if (tpl) {
      setEditingTpl(tpl);
      setTplForm({
        name: tpl.name,
        stage: tpl.stage,
        channel: tpl.channel,
        subject: tpl.subject ?? '',
        body: tpl.body,
      });
    } else {
      setEditingTpl(null);
      setTplForm({
        name: '',
        stage: 'orcamento_enviado',
        channel: 'whatsapp',
        subject: '',
        body: 'Olá {{cliente}}, passando para retomar a proposta da {{empresa}} ({{valor}}). Podemos conversar hoje?',
      });
    }
    setTplModalOpen(true);
  };

  const handleSaveTplSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tplForm.name.trim() || !tplForm.body.trim()) return;
    onSaveTemplate({
      id: editingTpl?.id,
      name: tplForm.name.trim(),
      stage: tplForm.stage,
      channel: tplForm.channel,
      subject: tplForm.channel === 'email' ? tplForm.subject.trim() : undefined,
      body: tplForm.body.trim(),
    });
    setTplModalOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Sub-navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.07] pb-4">
        <div
          role="tablist"
          aria-label="Módulos da Central de Follow-up"
          className="flex flex-wrap items-center gap-1.5 p-1 bg-[#12141A] border border-white/[0.07] rounded-xl"
        >
          {(
            [
              ['agenda', 'Agenda & Tarefas', ListTodo],
              ['calendario', 'Calendário', Calendar],
              ['regras', 'Regras Inteligentes', GitBranch],
              ['modelos', 'Modelos de Mensagens', FileText],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg whitespace-nowrap ${
                activeTab === id
                  ? 'bg-[#D4AF37] text-[#090A0D] font-semibold'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => handleOpenCreateTask()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold bg-[#D4AF37] hover:bg-[#E8C96D] text-[#090A0D] rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Novo Follow-up
        </button>
      </div>

      {/* TAB 1: AGENDA & TAREFAS */}
      {activeTab === 'agenda' && (
        <div className="space-y-5">
          {/* Interactive 4-Counter Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {(
              [
                ['pendente', 'Pendentes', summary.pending, 'text-white'],
                [
                  'atrasado',
                  'Atrasados',
                  summary.overdue,
                  summary.overdue > 0 ? 'text-[#F87171]' : 'text-white',
                ],
                ['concluido', 'Concluídos', summary.completed, 'text-[#4ADE80]'],
                ['hoje', 'Para hoje', summary.today, 'text-[#E8C96D]'],
              ] as const
            ).map(([filterKey, label, count, valueColor]) => {
              const active = statusFilter === filterKey;
              return (
                <button
                  key={filterKey}
                  type="button"
                  onClick={() =>
                    setStatusFilter(active ? 'todos' : filterKey)
                  }
                  className={`text-left p-4 rounded-xl border transition-colors ${
                    active
                      ? 'bg-[#171A24] border-[#D4AF37]/50'
                      : 'bg-[#12141A] border-white/[0.07] hover:border-white/[0.14]'
                  }`}
                >
                  <span
                    className={`block text-2xl font-semibold font-mono tabular-nums ${valueColor}`}
                  >
                    {count}
                  </span>
                  <span className="block text-xs text-neutral-400 mt-1">
                    {label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Filters bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#12141A] border border-white/[0.07] rounded-xl p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <div
                role="group"
                aria-label="Filtrar por prioridade"
                className="flex items-center gap-1 p-1 bg-[#171A22] rounded-lg border border-white/[0.06]"
              >
                {(
                  [
                    ['todas', 'Todas prioridades'],
                    ['alta', 'Alta'],
                    ['media', 'Média'],
                    ['baixa', 'Baixa'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPriorityFilter(key)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      priorityFilter === key
                        ? 'bg-white/[0.12] text-white'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <select
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
                aria-label="Filtrar tarefas por responsável"
                className="px-3 py-1.5 text-xs bg-[#171A22] border border-white/[0.08] rounded-lg text-neutral-200"
              >
                <option value="todos">Todos os responsáveis</option>
                {TEAM_OWNERS.map((owner) => (
                  <option key={owner} value={owner}>
                    {owner}
                  </option>
                ))}
              </select>

              {statusFilter !== 'todos' && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('todos')}
                  className="text-xs text-[#E8C96D] hover:underline px-2"
                >
                  Mostrar todos ({state.tasks.length})
                </button>
              )}
            </div>

            <p className="text-xs text-neutral-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
              Nenhuma mensagem é enviada sem sua autorização manual
            </p>
          </div>

          {/* Task List */}
          <div className="bg-[#12141A] border border-white/[0.07] rounded-xl overflow-hidden">
            {filteredTasks.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm text-neutral-300">
                  Nenhuma tarefa de follow-up neste filtro.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('todos');
                    setPriorityFilter('todas');
                    setOwnerFilter('todos');
                  }}
                  className="mt-3 text-xs text-[#E8C96D] hover:underline"
                >
                  Ver todas as atividades
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {filteredTasks.map((task) => {
                  const client = clientById.get(task.clientId);
                  const overdue = isTaskOverdue(task, state.referenceDate);
                  const relDate = formatRelativeDueDate(
                    task.dueDate,
                    state.referenceDate
                  );

                  return (
                    <li
                      key={task.id}
                      data-testid={`task-item-${task.id}`}
                      className="p-4 sm:px-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                          <button
                            type="button"
                            onClick={() => onOpenClientDetail(task.clientId)}
                            className="text-sm font-semibold text-white hover:text-[#E8C96D] transition-colors text-left"
                          >
                            {client?.company ?? 'Cliente'}
                          </button>
                          <span className="text-neutral-600" aria-hidden="true">
                            ·
                          </span>
                          <span
                            className={`text-xs font-mono tabular-nums ${
                              overdue
                                ? 'text-[#F87171] font-medium'
                                : task.status === 'concluido'
                                ? 'text-neutral-500'
                                : 'text-[#E8C96D]'
                            }`}
                          >
                            {relDate} · {task.dueTime}
                            {overdue ? ' (Atrasado)' : ''}
                          </span>
                          <span className="text-neutral-600" aria-hidden="true">
                            ·
                          </span>
                          <span className={`text-xs font-medium ${PRIORITY_STYLE[task.priority]}`}>
                            Prioridade {getPriorityLabel(task.priority)}
                          </span>
                          {task.autoGenerated && (
                            <>
                              <span className="text-neutral-600" aria-hidden="true">
                                ·
                              </span>
                              <span className="text-[11px] text-neutral-400">
                                Regra automática
                              </span>
                            </>
                          )}
                        </div>

                        <p
                          className={`text-sm ${
                            task.status === 'concluido'
                              ? 'line-through text-neutral-500'
                              : 'text-neutral-200'
                          }`}
                        >
                          {task.title}
                        </p>

                        <p className="text-xs text-neutral-400">
                          {task.contextLabel} · Canal: {task.channel.toUpperCase()} · Responsável:{' '}
                          <span className="text-neutral-300">{task.owner}</span>
                          {task.notes ? ` · ${task.notes}` : ''}
                        </p>
                      </div>

                      {/* Workflow Actions */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {task.status === 'pendente' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setMessageModalTask(task);
                                setSelectedTemplateId('__ai_suggestion__');
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-200 bg-[#171A22] hover:bg-[#1F2430] border border-white/[0.08] rounded-lg transition-colors whitespace-nowrap"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-[#D4AF37]" />
                              Mensagem
                            </button>
                            <button
                              type="button"
                              onClick={() => onResolveOutcome(task.id, true)}
                              title="Registra resposta positiva e avança oportunidade para Negociação"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#4ADE80] bg-[#22C55E]/[0.08] hover:bg-[#22C55E]/[0.16] border border-[#22C55E]/25 rounded-lg transition-colors whitespace-nowrap"
                            >
                              Respondeu
                            </button>
                            <button
                              type="button"
                              onClick={() => onResolveOutcome(task.id, false)}
                              title="Registra ausência de retorno e cria novo lembrete conforme recorrência"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#FBBF24] bg-[#F59E0B]/[0.08] hover:bg-[#F59E0B]/[0.16] border border-[#F59E0B]/25 rounded-lg transition-colors whitespace-nowrap"
                            >
                              Sem resposta
                            </button>
                            <button
                              type="button"
                              onClick={() => onToggleTaskComplete(task.id)}
                              aria-label={`Marcar tarefa "${task.title}" como concluída`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#090A0D] bg-[#D4AF37] hover:bg-[#E8C96D] rounded-lg transition-colors whitespace-nowrap"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Concluir
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onToggleTaskComplete(task.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 bg-white/[0.05] hover:bg-white/[0.1] rounded-lg transition-colors whitespace-nowrap"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Reabrir
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onDeleteTask(task.id)}
                          aria-label={`Remover tarefa ${task.title}`}
                          className="p-1.5 text-neutral-500 hover:text-[#F87171] rounded-lg hover:bg-white/[0.05]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CALENDÁRIO DE ATIVIDADES */}
      {activeTab === 'calendario' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 bg-[#12141A] border border-white/[0.07] rounded-xl p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-white">
                {MONTH_NAMES[calMonth]} {calYear}
              </h2>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (calMonth === 0) {
                      setCalMonth(11);
                      setCalYear((y) => y - 1);
                    } else {
                      setCalMonth((m) => m - 1);
                    }
                  }}
                  aria-label="Mês anterior"
                  className="p-2 rounded-lg bg-[#171A22] hover:bg-[#1E222D] text-neutral-300"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCalYear(2026);
                    setCalMonth(10);
                    setSelectedDay(state.referenceDate);
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#171A22] hover:bg-[#1E222D] text-[#E8C96D]"
                >
                  Hoje (24/11)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (calMonth === 11) {
                      setCalMonth(0);
                      setCalYear((y) => y + 1);
                    } else {
                      setCalMonth((m) => m + 1);
                    }
                  }}
                  aria-label="Próximo mês"
                  className="p-2 rounded-lg bg-[#171A22] hover:bg-[#1E222D] text-neutral-300"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium text-neutral-500 mb-2">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: startWeekday }).map((_, i) => (
                <div key={`empty-${i}`} className="h-20 rounded-lg bg-[#0D0F14]/50" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const dayNum = idx + 1;
                const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(
                  dayNum
                ).padStart(2, '0')}`;
                const dayTasks = tasksByDate.get(dateStr) ?? [];
                const pendingCount = dayTasks.filter(
                  (t) => t.status === 'pendente'
                ).length;
                const hasOverdue = dayTasks.some((t) =>
                  isTaskOverdue(t, state.referenceDate)
                );
                const isSelected = selectedDay === dateStr;
                const isToday = dateStr === state.referenceDate;

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => setSelectedDay(dateStr)}
                    className={`h-20 p-2 rounded-lg border text-left flex flex-col justify-between transition-colors ${
                      isSelected
                        ? 'bg-[#D4AF37]/15 border-[#D4AF37]'
                        : isToday
                        ? 'bg-[#171A24] border-[#D4AF37]/40'
                        : 'bg-[#151821] border-white/[0.06] hover:border-white/[0.16]'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={`text-xs font-mono tabular-nums ${
                          isToday
                            ? 'text-[#E8C96D] font-semibold'
                            : 'text-neutral-300'
                        }`}
                      >
                        {dayNum}
                      </span>
                      {dayTasks.length > 0 && (
                        <span
                          className={`text-[10px] font-mono tabular-nums ${
                            hasOverdue
                              ? 'text-[#F87171]'
                              : pendingCount > 0
                              ? 'text-[#E8C96D]'
                              : 'text-[#4ADE80]'
                          }`}
                        >
                          {dayTasks.length}
                        </span>
                      )}
                    </div>
                    {dayTasks.length > 0 && (
                      <p className="text-[10.5px] text-neutral-400 truncate w-full">
                        {pendingCount > 0
                          ? `${pendingCount} pendente${pendingCount > 1 ? 's' : ''}`
                          : 'Concluído'}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Day Agenda */}
          <div className="lg:col-span-4 bg-[#12141A] border border-white/[0.07] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/[0.07]">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Atividades de {formatRelativeDueDate(selectedDay, state.referenceDate)}
                </h3>
                <p className="text-xs font-mono text-neutral-400 mt-0.5">
                  {selectedDay.split('-').reverse().join('/')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenCreateTask(selectedDay)}
                className="px-3 py-1.5 text-xs font-semibold bg-[#D4AF37] text-[#090A0D] rounded-lg hover:bg-[#E8C96D]"
              >
                + Agendar
              </button>
            </div>

            {selectedDayTasks.length === 0 ? (
              <p className="text-xs text-neutral-400 py-6 text-center">
                Nenhum acompanhamento agendado para esta data.
              </p>
            ) : (
              <ul className="space-y-3">
                {selectedDayTasks.map((t) => {
                  const client = clientById.get(t.clientId);
                  return (
                    <li
                      key={t.id}
                      className="p-3.5 rounded-lg bg-[#171A22] border border-white/[0.06] space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono tabular-nums text-[#E8C96D] flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {t.dueTime}
                        </span>
                        <span className="text-[11px] text-neutral-400">
                          {t.status === 'concluido' ? 'Concluído' : t.contextLabel}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-white">
                        {client?.company ?? 'Cliente'}
                      </p>
                      <p className="text-xs text-neutral-300">{t.title}</p>
                      <div className="pt-2 flex items-center justify-between">
                        <span className="text-[11px] text-neutral-500">{t.owner}</span>
                        <button
                          type="button"
                          onClick={() => onToggleTaskComplete(t.id)}
                          className="text-xs text-[#E8C96D] hover:underline"
                        >
                          {t.status === 'pendente' ? 'Concluir' : 'Reabrir'}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: REGRAS INTELIGENTES & FLUXO */}
      {activeTab === 'regras' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Flowchart Column */}
          <div className="lg:col-span-5 bg-[#12141A] border border-[#D4AF37]/25 rounded-xl p-6">
            <h2 className="text-base font-semibold text-white">
              Fluxo Inteligente de Acompanhamento
            </h2>
            <p className="text-xs text-neutral-400 mt-1 mb-5">
              Ciclo comercial automatizado para criar tarefas e lembretes sem perder oportunidades.
            </p>

            <div className="flex flex-col items-center space-y-2 text-xs">
              {[
                'Novo interessado',
                'Primeiro contato',
                'Enviar orçamento',
                'Criar follow-up automático',
                'Aguardar retorno',
              ].map((step) => (
                <React.Fragment key={step}>
                  <div className="w-full max-w-xs py-2.5 px-4 text-center rounded-lg bg-[#171A22] border border-white/[0.09] text-neutral-100 font-medium">
                    {step}
                  </div>
                  <ArrowDown className="w-4 h-4 text-[#D4AF37]" aria-hidden="true" />
                </React.Fragment>
              ))}

              <div className="w-full max-w-xs py-3 px-4 text-center rounded-lg bg-[#D4AF37]/15 border border-[#D4AF37]/45 text-[#F3DC8B] font-semibold">
                Cliente respondeu?
              </div>

              <div className="grid grid-cols-2 gap-4 w-full max-w-xs pt-2">
                <div className="flex flex-col items-center space-y-2">
                  <span className="text-[11px] font-semibold text-[#4ADE80]">Sim</span>
                  <ArrowDown className="w-3.5 h-3.5 text-[#4ADE80]" aria-hidden="true" />
                  <div className="w-full py-2.5 px-3 text-center rounded-lg bg-[#22C55E]/10 border border-[#22C55E]/35 text-[#4ADE80] font-medium">
                    Negociação
                  </div>
                </div>
                <div className="flex flex-col items-center space-y-2">
                  <span className="text-[11px] font-semibold text-[#FBBF24]">Não</span>
                  <ArrowDown className="w-3.5 h-3.5 text-[#FBBF24]" aria-hidden="true" />
                  <div className="w-full py-2.5 px-3 text-center rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/35 text-[#FBBF24] font-medium">
                    Novo lembrete
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/[0.07] text-xs text-neutral-400 leading-relaxed">
              <strong className="text-neutral-200 font-medium">
                Governança de envio:
              </strong>{' '}
              as regras criam lembretes e sugerem mensagens prontas, mas exigem aprovação explícita do consultor antes de qualquer disparo ao cliente.
            </div>
          </div>

          {/* Rules Configuration + WhatsApp Business API Future Integration */}
          <div className="lg:col-span-7 space-y-5">
            <div className="bg-[#12141A] border border-white/[0.07] rounded-xl p-6 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-white">
                  Regras de Criação e Recorrência
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Configure os intervalos de follow-up por etapa do funil comercial.
                </p>
              </div>

              <div className="space-y-3">
                {state.rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="p-4 rounded-xl bg-[#171A22] border border-white/[0.07] space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">
                          {rule.name}
                        </p>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          Gatilho: etapa{' '}
                          <span className="text-[#E8C96D]">
                            {getStageConfig(rule.triggerStage).label}
                          </span>{' '}
                          · Tarefa: {rule.defaultTaskTitle}
                        </p>
                      </div>
                      <label className="inline-flex items-center gap-2 text-xs text-neutral-300 cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={(e) =>
                            onUpdateRule({ ...rule, enabled: e.target.checked })
                          }
                          className="accent-[#D4AF37] w-4 h-4 rounded"
                        />
                        {rule.enabled ? 'Ativa' : 'Pausada'}
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-white/[0.06]">
                      <div>
                        <label
                          htmlFor={`delay-${rule.id}`}
                          className="block text-[11px] text-neutral-400 mb-1"
                        >
                          Intervalo inicial (dias)
                        </label>
                        <input
                          id={`delay-${rule.id}`}
                          type="number"
                          min="0"
                          max="30"
                          value={rule.delayDays}
                          onChange={(e) =>
                            onUpdateRule({
                              ...rule,
                              delayDays: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#111319] border border-white/[0.08] rounded-lg text-white"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`rec-${rule.id}`}
                          className="block text-[11px] text-neutral-400 mb-1"
                        >
                          Recorrência sem resposta (dias)
                        </label>
                        <input
                          id={`rec-${rule.id}`}
                          type="number"
                          min="1"
                          max="30"
                          value={rule.recurrenceDays}
                          onChange={(e) =>
                            onUpdateRule({
                              ...rule,
                              recurrenceDays: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                          className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#111319] border border-white/[0.08] rounded-lg text-white"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`prio-${rule.id}`}
                          className="block text-[11px] text-neutral-400 mb-1"
                        >
                          Prioridade padrão
                        </label>
                        <select
                          id={`prio-${rule.id}`}
                          value={rule.defaultPriority}
                          onChange={(e) =>
                            onUpdateRule({
                              ...rule,
                              defaultPriority: e.target.value as Priority,
                            })
                          }
                          className="w-full px-2.5 py-1.5 text-xs bg-[#111319] border border-white/[0.08] rounded-lg text-white"
                        >
                          <option value="alta">Alta</option>
                          <option value="media">Média</option>
                          <option value="baixa">Baixa</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Future WhatsApp Business API Integration Card */}
            <div className="bg-[#12141A] border border-white/[0.07] rounded-xl p-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-white">
                  Integração futura — WhatsApp Business API
                </h3>
                <span className="text-xs font-medium text-[#E8C96D]">
                  Pronto para arquitetura Cloud API
                </span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                {state.whatsappConfig.webhookStatus}. Linha reservada:{' '}
                <span className="font-mono text-neutral-200">
                  {state.whatsappConfig.businessPhoneDisplay}
                </span>
                .
              </p>
              <label className="flex items-start gap-3 pt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.whatsappConfig.requireManualApproval}
                  onChange={(e) => onToggleWhatsAppApproval(e.target.checked)}
                  className="accent-[#D4AF37] w-4 h-4 mt-0.5"
                />
                <span className="text-xs text-neutral-200 leading-relaxed">
                  Exigir autorização manual antes de enviar qualquer mensagem ao cliente (recomendado para preservar o atendimento consultivo).
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: MODELOS DE MENSAGENS PERSONALIZÁVEIS */}
      {activeTab === 'modelos' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#12141A] border border-white/[0.07] rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="preview-client" className="text-xs text-neutral-400">
                Pré-visualizar variáveis com:
              </label>
              <select
                id="preview-client"
                value={tplPreviewClientId}
                onChange={(e) => setTplPreviewClientId(e.target.value)}
                className="px-3 py-1.5 text-xs bg-[#171A22] border border-white/[0.08] rounded-lg text-white"
              >
                {state.clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company} — {c.contactName}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => openTemplateModal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#D4AF37] hover:bg-[#E8C96D] text-[#090A0D] rounded-lg whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Novo Modelo
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {state.templates.map((tpl) => {
              const previewText = getRenderedMessage(tpl, tplPreviewClientId);
              return (
                <article
                  key={tpl.id}
                  className="bg-[#12141A] border border-white/[0.07] rounded-xl p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-white">
                          {tpl.name}
                        </h3>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          Canal: {tpl.channel === 'whatsapp' ? 'WhatsApp' : 'E-mail'} · Etapa:{' '}
                          {tpl.stage === 'geral'
                            ? 'Geral'
                            : getStageConfig(tpl.stage).label}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openTemplateModal(tpl)}
                          aria-label={`Editar modelo ${tpl.name}`}
                          className="p-1.5 text-neutral-400 hover:text-white rounded hover:bg-white/[0.06]"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteTemplate(tpl.id)}
                          aria-label={`Excluir modelo ${tpl.name}`}
                          className="p-1.5 text-neutral-400 hover:text-[#F87171] rounded hover:bg-white/[0.06]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg bg-[#171A22] border border-white/[0.06]">
                      <p className="text-[11px] text-[#E8C96D] mb-1.5">
                        Prévia preenchida
                      </p>
                      <p className="text-xs text-neutral-200 whitespace-pre-line leading-relaxed">
                        {previewText}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                    <span className="text-[11px] font-mono text-neutral-500">
                      Variáveis: {'{{cliente}} {{empresa}} {{valor}}'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(previewText, tpl.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-200 bg-white/[0.06] hover:bg-white/[0.1] rounded-lg transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copiedId === tpl.id ? 'Copiado' : 'Copiar texto'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal: Create Follow-up Task */}
      <Modal
        open={taskModalOpen}
        title="Agendar Novo Follow-up"
        subtitle="Organize retornos com prioridade, responsável e intervalo de recorrência."
        onClose={() => setTaskModalOpen(false)}
      >
        <form onSubmit={handleSubmitTask} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="tsk-client" className="block text-xs text-neutral-300 mb-1">
                Cliente *
              </label>
              <select
                id="tsk-client"
                value={taskForm.clientId}
                onChange={(e) => {
                  const cid = e.target.value;
                  const firstOpp = state.opportunities.find((o) => o.clientId === cid);
                  setTaskForm({
                    ...taskForm,
                    clientId: cid,
                    opportunityId: firstOpp?.id ?? '',
                  });
                }}
                className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white"
              >
                {state.clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="tsk-opp" className="block text-xs text-neutral-300 mb-1">
                Oportunidade vinculada
              </label>
              <select
                id="tsk-opp"
                value={taskForm.opportunityId}
                onChange={(e) =>
                  setTaskForm({ ...taskForm, opportunityId: e.target.value })
                }
                className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white"
              >
                <option value="">Sem oportunidade específica</option>
                {state.opportunities
                  .filter((o) => o.clientId === taskForm.clientId)
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="tsk-title" className="block text-xs text-neutral-300 mb-1">
              Ação / Descrição do retorno *
            </label>
            <input
              id="tsk-title"
              type="text"
              value={taskForm.title}
              onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              placeholder="Ex: Confirmar leitura do orçamento atualizado"
              className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="tsk-date" className="block text-xs text-neutral-300 mb-1">
                Data
              </label>
              <input
                id="tsk-date"
                type="date"
                value={taskForm.dueDate}
                onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono bg-[#171A22] border border-white/[0.1] rounded-lg text-white"
              />
            </div>
            <div>
              <label htmlFor="tsk-time" className="block text-xs text-neutral-300 mb-1">
                Horário
              </label>
              <input
                id="tsk-time"
                type="time"
                value={taskForm.dueTime}
                onChange={(e) => setTaskForm({ ...taskForm, dueTime: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono bg-[#171A22] border border-white/[0.1] rounded-lg text-white"
              />
            </div>
            <div>
              <label htmlFor="tsk-priority" className="block text-xs text-neutral-300 mb-1">
                Prioridade
              </label>
              <select
                id="tsk-priority"
                value={taskForm.priority}
                onChange={(e) =>
                  setTaskForm({ ...taskForm, priority: e.target.value as Priority })
                }
                className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white"
              >
                <option value="alta">Alta</option>
                <option value="media">Média</option>
                <option value="baixa">Baixa</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="tsk-owner" className="block text-xs text-neutral-300 mb-1">
                Responsável
              </label>
              <select
                id="tsk-owner"
                value={taskForm.owner}
                onChange={(e) => setTaskForm({ ...taskForm, owner: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white"
              >
                {TEAM_OWNERS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="tsk-channel" className="block text-xs text-neutral-300 mb-1">
                Canal
              </label>
              <select
                id="tsk-channel"
                value={taskForm.channel}
                onChange={(e) =>
                  setTaskForm({
                    ...taskForm,
                    channel: e.target.value as ConversationChannel,
                  })
                }
                className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="telefone">Telefone</option>
                <option value="email">E-mail</option>
                <option value="reuniao">Reunião</option>
              </select>
            </div>
            <div>
              <label htmlFor="tsk-context" className="block text-xs text-neutral-300 mb-1">
                Etapa / Contexto
              </label>
              <input
                id="tsk-context"
                type="text"
                value={taskForm.contextLabel}
                onChange={(e) =>
                  setTaskForm({ ...taskForm, contextLabel: e.target.value })
                }
                className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white"
              />
            </div>
          </div>

          {taskFormError && (
            <p className="text-xs text-[#F87171]">{taskFormError}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setTaskModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-neutral-300 bg-white/[0.05] hover:bg-white/[0.09] rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold bg-[#D4AF37] hover:bg-[#E8C96D] text-[#090A0D] rounded-lg"
            >
              Agendar follow-up
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Prepare Message Manually + Contextual AI Suggestion */}
      <Modal
        open={Boolean(messageModalTask)}
        title="Preparar Mensagem de Follow-up"
        subtitle="Revisão manual obrigatória — o WhatsApp não está conectado nesta demo; você revisa e decide quando enviar."
        onClose={() => setMessageModalTask(null)}
      >
        {messageModalTask && (
          <div className="space-y-4">
            {(() => {
              const client = clientById.get(messageModalTask.clientId);
              const opp = messageModalTask.opportunityId
                ? oppById.get(messageModalTask.opportunityId)
                : undefined;
              const daysStalled = opp
                ? daysBetweenDates(opp.updatedAt.slice(0, 10), state.referenceDate)
                : 2;
              const aiSug = generateContextualSuggestion({
                contactName: client?.contactName ?? 'Cliente',
                companyName: client?.company ?? 'Empresa',
                ownerName: messageModalTask.owner,
                stageLabel: opp
                  ? getStageConfig(opp.stage).label
                  : messageModalTask.contextLabel,
                value: opp?.value,
                daysWithoutReturn: daysStalled,
              });
              const tpl =
                selectedTemplateId === '__ai_suggestion__'
                  ? null
                  : state.templates.find((t) => t.id === selectedTemplateId) ??
                    state.templates[0];
              const rendered =
                selectedTemplateId === '__ai_suggestion__' || !tpl
                  ? aiSug.suggestedMessage
                  : getRenderedMessage(
                      tpl,
                      messageModalTask.clientId,
                      messageModalTask.opportunityId
                    );

              return (
                <>
                  <div>
                    <label htmlFor="msg-tpl" className="block text-xs text-neutral-300 mb-1">
                      Origem da mensagem
                    </label>
                    <select
                      id="msg-tpl"
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white"
                    >
                      <option value="__ai_suggestion__">
                        Sugestão contextual (IA — revisão manual)
                      </option>
                      {state.templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          Modelo: {t.name} ({t.channel})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedTemplateId === '__ai_suggestion__' && (
                    <div className="p-3 rounded-lg bg-[#D4AF37]/[0.08] border border-[#D4AF37]/25 text-[11.5px] text-neutral-200 leading-relaxed">
                      <strong className="text-[#E8C96D] font-medium">
                        Sugestão de abordagem (identificada como sugestão):
                      </strong>{' '}
                      {aiSug.rationale}
                    </div>
                  )}

                  <div className="p-4 rounded-lg bg-[#171A22] border border-[#D4AF37]/30">
                    <p className="text-xs text-neutral-200 whitespace-pre-line leading-relaxed">
                      {rendered}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => handleCopyText(rendered, 'modal-msg')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-neutral-200 bg-white/[0.06] hover:bg-white/[0.1] rounded-lg"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copiedId === 'modal-msg' ? 'Copiado!' : 'Copiar mensagem'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onLogPreparedMessage(
                          messageModalTask.clientId,
                          tpl ? tpl.channel : messageModalTask.channel,
                          rendered
                        );
                        setMessageModalTask(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#D4AF37] hover:bg-[#E8C96D] text-[#090A0D] rounded-lg"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Autorizar e registrar envio
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </Modal>

      {/* Modal: Create / Edit Message Template */}
      <Modal
        open={tplModalOpen}
        title={editingTpl ? 'Editar Modelo de Mensagem' : 'Novo Modelo de Mensagem'}
        subtitle="Use variáveis {{cliente}}, {{empresa}}, {{valor}}, {{responsavel}} e {{etapa}}."
        onClose={() => setTplModalOpen(false)}
      >
        <form onSubmit={handleSaveTplSubmit} className="space-y-4">
          <div>
            <label htmlFor="tpl-name" className="block text-xs text-neutral-300 mb-1">
              Nome do modelo *
            </label>
            <input
              id="tpl-name"
              type="text"
              value={tplForm.name}
              onChange={(e) => setTplForm({ ...tplForm, name: e.target.value })}
              placeholder="Ex: Follow-up 48h pós-proposta"
              className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="tpl-channel" className="block text-xs text-neutral-300 mb-1">
                Canal
              </label>
              <select
                id="tpl-channel"
                value={tplForm.channel}
                onChange={(e) =>
                  setTplForm({
                    ...tplForm,
                    channel: e.target.value as 'whatsapp' | 'email',
                  })
                }
                className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="email">E-mail</option>
              </select>
            </div>
            <div>
              <label htmlFor="tpl-stage" className="block text-xs text-neutral-300 mb-1">
                Etapa sugerida
              </label>
              <select
                id="tpl-stage"
                value={tplForm.stage}
                onChange={(e) =>
                  setTplForm({
                    ...tplForm,
                    stage: e.target.value as PipelineStage | 'geral',
                  })
                }
                className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white"
              >
                <option value="geral">Geral</option>
                {PIPELINE_STAGES.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="tpl-body" className="block text-xs text-neutral-300 mb-1">
              Texto do modelo *
            </label>
            <textarea
              id="tpl-body"
              rows={4}
              value={tplForm.body}
              onChange={(e) => setTplForm({ ...tplForm, body: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white leading-relaxed"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setTplModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-neutral-300 bg-white/[0.05] hover:bg-white/[0.09] rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold bg-[#D4AF37] hover:bg-[#E8C96D] text-[#090A0D] rounded-lg"
            >
              Salvar modelo
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
