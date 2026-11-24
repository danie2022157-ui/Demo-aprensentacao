import React, { useState, useMemo } from 'react';
import {
  Plus,
  Sparkles,
  CheckCircle2,
  XCircle,
  CalendarPlus,
  Copy,
  Send,
  AlertTriangle,
} from 'lucide-react';
import {
  CrmState,
  LOSS_REASON_LABELS,
  LossReason,
  Proposal,
  ProposalStatus,
  TEAM_OWNERS,
} from '../../types/crm';
import {
  computeProposalMetrics,
  daysBetweenDates,
  formatCurrencyBRL,
  generateContextualSuggestion,
} from '../../lib/crm-engine';
import { Modal } from '../ui/Modal';

interface ProposalsViewProps {
  state: CrmState;
  globalSearch: string;
  onAddProposal: (proposal: Omit<Proposal, 'id' | 'code'>) => void;
  onApproveProposal: (proposalId: string) => void;
  onMarkProposalLost: (proposalId: string, reason: LossReason) => void;
  onScheduleProposalFollowUp: (proposal: Proposal) => void;
  onLogSuggestedMessage: (clientId: string, message: string) => void;
  onOpenClientDetail: (clientId: string) => void;
}

const STATUS_META: Record<ProposalStatus, { label: string; colorClass: string }> = {
  aguardando_retorno: { label: 'Aguardando retorno', colorClass: 'text-[#FBBF24]' },
  em_revisao: { label: 'Em revisão', colorClass: 'text-[#E8C96D]' },
  aprovado: { label: 'Aprovado', colorClass: 'text-[#4ADE80]' },
  perdido: { label: 'Perdido', colorClass: 'text-[#F87171]' },
};

export const ProposalsView: React.FC<ProposalsViewProps> = ({
  state,
  globalSearch,
  onAddProposal,
  onApproveProposal,
  onMarkProposalLost,
  onScheduleProposalFollowUp,
  onLogSuggestedMessage,
  onOpenClientDetail,
}) => {
  const [statusFilter, setStatusFilter] = useState<'todos' | ProposalStatus | 'vencidos'>('todos');
  const [createOpen, setCreateOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    clientId: state.clients[0]?.id ?? '',
    opportunityId: state.opportunities[0]?.id ?? '',
    title: '',
    value: '24000',
    sentDate: state.referenceDate,
    expectedReturnDate: '2026-11-27',
    owner: TEAM_OWNERS[0] as string,
    notes: '',
  });

  // Loss reason modal
  const [lossTarget, setLossTarget] = useState<Proposal | null>(null);
  const [lossReason, setLossReason] = useState<LossReason>('sem_retorno');

  // Contextual suggestion modal
  const [suggestionProposal, setSuggestionProposal] = useState<Proposal | null>(null);
  const [editableSuggestion, setEditableSuggestion] = useState('');
  const [suggestionRationale, setSuggestionRationale] = useState('');
  const [suggestionHeadline, setSuggestionHeadline] = useState('');
  const [copied, setCopied] = useState(false);

  const clientById = useMemo(
    () => new Map(state.clients.map((c) => [c.id, c])),
    [state.clients]
  );

  const metrics = useMemo(() => computeProposalMetrics(state), [state]);
  const query = globalSearch.trim().toLowerCase();

  const filteredProposals = useMemo(() => {
    return [...state.proposals]
      .filter((p) => {
        const isOverdue =
          (p.status === 'aguardando_retorno' || p.status === 'em_revisao') &&
          p.expectedReturnDate < state.referenceDate;
        if (statusFilter === 'vencidos' && !isOverdue) return false;
        if (
          statusFilter !== 'todos' &&
          statusFilter !== 'vencidos' &&
          p.status !== statusFilter
        ) {
          return false;
        }
        if (!query) return true;
        const client = clientById.get(p.clientId);
        return (
          p.code.toLowerCase().includes(query) ||
          p.title.toLowerCase().includes(query) ||
          (client?.company.toLowerCase().includes(query) ?? false)
        );
      })
      .sort((a, b) => {
        const rank = (status: ProposalStatus) => {
          if (status === 'aguardando_retorno' || status === 'em_revisao') return 0;
          if (status === 'aprovado') return 1;
          return 2;
        };
        const rankDiff = rank(a.status) - rank(b.status);
        if (rankDiff !== 0) return rankDiff;
        return a.expectedReturnDate.localeCompare(b.expectedReturnDate);
      });
  }, [state.proposals, state.referenceDate, statusFilter, query, clientById]);

  const openSuggestionModal = (proposal: Proposal) => {
    const client = clientById.get(proposal.clientId);
    const daysWithoutReturn = daysBetweenDates(
      proposal.sentDate,
      state.referenceDate
    );
    const generated = generateContextualSuggestion({
      contactName: client?.contactName ?? 'Cliente',
      companyName: client?.company ?? 'Empresa',
      ownerName: proposal.owner,
      stageLabel: 'Orçamento enviado',
      value: proposal.value,
      daysWithoutReturn,
      proposalCode: proposal.code,
    });
    setSuggestionProposal(proposal);
    setSuggestionHeadline(generated.headline);
    setSuggestionRationale(generated.rationale);
    setEditableSuggestion(generated.suggestedMessage);
    setCopied(false);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericVal = Number(form.value);
    if (!form.clientId || !form.title.trim() || Number.isNaN(numericVal) || numericVal <= 0) {
      setFormError('Informe cliente, título e valor válido para registrar o orçamento.');
      return;
    }
    onAddProposal({
      clientId: form.clientId,
      opportunityId: form.opportunityId || undefined,
      title: form.title.trim(),
      value: Math.round(numericVal),
      sentDate: form.sentDate,
      expectedReturnDate: form.expectedReturnDate,
      owner: form.owner,
      status: 'aguardando_retorno',
      notes: form.notes.trim(),
    });
    setCreateOpen(false);
  };

  const handleCopySuggestion = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(editableSuggestion).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-5">
      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-[#12141A] border border-white/[0.07] rounded-xl p-5">
          <p className="text-xs text-neutral-400">Orçamentos em aberto</p>
          <p className="text-2xl font-semibold text-[#E8C96D] font-mono tabular-nums mt-2">
            {formatCurrencyBRL(metrics.totalOpenValue)}
          </p>
          <p className="text-xs text-neutral-400 mt-1.5">
            <span className="font-mono tabular-nums text-white">{metrics.totalOpenCount}</span>{' '}
            propostas aguardando retorno ou revisão
          </p>
        </div>

        <div className="bg-[#12141A] border border-[#F59E0B]/30 rounded-xl p-5">
          <p className="text-xs text-neutral-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B]" />
            Retorno vencido (sem resposta)
          </p>
          <p
            data-testid="proposals-overdue-count"
            className="text-2xl font-semibold text-[#F87171] font-mono tabular-nums mt-2"
          >
            {metrics.overdueCount}
          </p>
          <p className="text-xs text-neutral-400 mt-1.5">
            Volume exposto:{' '}
            <span className="font-mono tabular-nums text-neutral-200">
              {formatCurrencyBRL(metrics.overdueValue)}
            </span>
          </p>
        </div>

        <div className="bg-[#12141A] border border-white/[0.07] rounded-xl p-5">
          <p className="text-xs text-neutral-400">Orçamentos aprovados</p>
          <p className="text-2xl font-semibold text-[#4ADE80] font-mono tabular-nums mt-2">
            {formatCurrencyBRL(metrics.approvedValue)}
          </p>
          <p className="text-xs text-neutral-400 mt-1.5">
            Propostas convertidas em venda
          </p>
        </div>

        <div className="bg-[#12141A] border border-white/[0.07] rounded-xl p-5">
          <p className="text-xs text-neutral-400">Perdidos registrados</p>
          <p className="text-2xl font-semibold text-white font-mono tabular-nums mt-2">
            {formatCurrencyBRL(metrics.lostValue)}
          </p>
          <p className="text-xs text-neutral-400 mt-1.5">
            <span className="font-mono tabular-nums text-neutral-200">{metrics.lostCount}</span>{' '}
            com motivo de perda documentado
          </p>
        </div>
      </div>

      {/* Filter & Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#12141A] border border-white/[0.07] rounded-xl p-4">
        <div
          role="group"
          aria-label="Filtrar orçamentos por status"
          className="flex flex-wrap items-center gap-1 p-1 bg-[#171A22] rounded-lg border border-white/[0.06]"
        >
          {(
            [
              ['todos', 'Todos'],
              ['vencidos', `Sem retorno vencido (${metrics.overdueCount})`],
              ['aguardando_retorno', 'Aguardando'],
              ['em_revisao', 'Em revisão'],
              ['aprovado', 'Aprovados'],
              ['perdido', 'Perdidos'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                statusFilter === key
                  ? 'bg-[#D4AF37] text-[#090A0D] font-semibold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            setForm({
              clientId: state.clients[0]?.id ?? '',
              opportunityId: state.opportunities[0]?.id ?? '',
              title: '',
              value: '24000',
              sentDate: state.referenceDate,
              expectedReturnDate: '2026-11-27',
              owner: TEAM_OWNERS[0],
              notes: '',
            });
            setFormError(null);
            setCreateOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold bg-[#D4AF37] hover:bg-[#E8C96D] text-[#090A0D] rounded-lg whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Novo Orçamento
        </button>
      </div>

      {/* Proposals Table */}
      <div className="bg-[#12141A] border border-white/[0.07] rounded-xl overflow-hidden">
        {filteredProposals.length === 0 ? (
          <div className="p-10 text-center text-sm text-neutral-400">
            Nenhum orçamento encontrado neste filtro.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.07] text-[11.5px] font-medium text-neutral-400 bg-[#151821]">
                  <th className="py-3 px-5">Proposta & Cliente</th>
                  <th className="py-3 px-4 text-right">Valor</th>
                  <th className="py-3 px-4">Envio / Retorno previsto</th>
                  <th className="py-3 px-4">Status / Motivo</th>
                  <th className="py-3 px-5 text-right">Ações comerciais</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05] text-xs">
                {filteredProposals.map((prop) => {
                  const client = clientById.get(prop.clientId);
                  const isOpen =
                    prop.status === 'aguardando_retorno' ||
                    prop.status === 'em_revisao';
                  const isOverdue =
                    isOpen && prop.expectedReturnDate < state.referenceDate;
                  const daysSinceSent = daysBetweenDates(
                    prop.sentDate,
                    state.referenceDate
                  );
                  const meta = STATUS_META[prop.status];

                  return (
                    <tr
                      key={prop.id}
                      data-testid={`proposal-row-${prop.id}`}
                      className="hover:bg-white/[0.02]"
                    >
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[#E8C96D] font-medium">
                            {prop.code}
                          </span>
                          <span className="text-neutral-600">·</span>
                          <button
                            type="button"
                            onClick={() => onOpenClientDetail(prop.clientId)}
                            className="font-semibold text-white hover:text-[#E8C96D] text-left"
                          >
                            {client?.company ?? 'Cliente'}
                          </button>
                        </div>
                        <p className="text-neutral-300 mt-0.5">{prop.title}</p>
                        <p className="text-[11px] text-neutral-500 mt-0.5">
                          Responsável: {prop.owner}
                          {prop.notes ? ` · ${prop.notes}` : ''}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-mono tabular-nums font-semibold text-white">
                        {formatCurrencyBRL(prop.value)}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap font-mono tabular-nums">
                        <p className="text-neutral-300">
                          Envio: {prop.sentDate.split('-').reverse().join('/')}
                        </p>
                        <p
                          className={
                            isOverdue
                              ? 'text-[#F87171] font-medium mt-0.5'
                              : 'text-neutral-400 mt-0.5'
                          }
                        >
                          Retorno:{' '}
                          {prop.expectedReturnDate.split('-').reverse().join('/')}
                          {isOpen ? ` · ${daysSinceSent}d` : ''}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`font-medium ${meta.colorClass}`}>
                          {meta.label}
                        </span>
                        {isOverdue && (
                          <span className="block text-[11px] text-[#F87171] mt-0.5">
                            Alerta: retorno atrasado
                          </span>
                        )}
                        {prop.status === 'perdido' && prop.lossReason && (
                          <span className="block text-[11px] text-neutral-400 mt-0.5">
                            Motivo: {LOSS_REASON_LABELS[prop.lossReason]}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        {isOpen ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openSuggestionModal(prop)}
                              aria-label={`Gerar sugestão de abordagem para ${prop.code}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#D4AF37]/12 hover:bg-[#D4AF37]/22 border border-[#D4AF37]/30 text-[#E8C96D] font-medium transition-colors"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              Sugestão IA
                            </button>
                            <button
                              type="button"
                              onClick={() => onScheduleProposalFollowUp(prop)}
                              aria-label={`Agendar follow-up para ${prop.code}`}
                              className="p-1.5 rounded-lg text-neutral-300 hover:text-white hover:bg-white/[0.06]"
                              title="Agendar follow-up"
                            >
                              <CalendarPlus className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onApproveProposal(prop.id)}
                              aria-label={`Aprovar orçamento ${prop.code}`}
                              className="p-1.5 rounded-lg text-[#4ADE80] hover:bg-[#22C55E]/15"
                              title="Marcar como aprovado"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setLossTarget(prop);
                                setLossReason('sem_retorno');
                              }}
                              aria-label={`Registrar perda do orçamento ${prop.code}`}
                              className="p-1.5 rounded-lg text-[#F87171] hover:bg-[#EF4444]/15"
                              title="Registrar perda com motivo"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-neutral-500">
                            Encerrado
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create Proposal */}
      <Modal
        open={createOpen}
        title="Registrar Novo Orçamento"
        subtitle="Acompanhe propostas enviadas com prazo de retorno e alertas automáticos."
        onClose={() => setCreateOpen(false)}
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label htmlFor="prop-client" className="block text-xs text-neutral-300 mb-1">
              Cliente *
            </label>
            <select
              id="prop-client"
              value={form.clientId}
              onChange={(e) => {
                const cid = e.target.value;
                const opp = state.opportunities.find((o) => o.clientId === cid);
                setForm({
                  ...form,
                  clientId: cid,
                  opportunityId: opp?.id ?? '',
                });
              }}
              className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white"
            >
              {state.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company} ({c.contactName})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="prop-title" className="block text-xs text-neutral-300 mb-1">
              Escopo / Título do orçamento *
            </label>
            <input
              id="prop-title"
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex: Implantação Comercial + Treinamento de Equipe"
              className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="prop-val" className="block text-xs text-neutral-300 mb-1">
                Valor (R$) *
              </label>
              <input
                id="prop-val"
                type="number"
                min="1"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono bg-[#171A22] border border-white/[0.1] rounded-lg text-white"
              />
            </div>
            <div>
              <label htmlFor="prop-sent" className="block text-xs text-neutral-300 mb-1">
                Data de envio
              </label>
              <input
                id="prop-sent"
                type="date"
                value={form.sentDate}
                onChange={(e) => setForm({ ...form, sentDate: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono bg-[#171A22] border border-white/[0.1] rounded-lg text-white"
              />
            </div>
            <div>
              <label htmlFor="prop-ret" className="block text-xs text-neutral-300 mb-1">
                Retorno previsto
              </label>
              <input
                id="prop-ret"
                type="date"
                value={form.expectedReturnDate}
                onChange={(e) =>
                  setForm({ ...form, expectedReturnDate: e.target.value })
                }
                className="w-full px-3 py-2 text-xs font-mono bg-[#171A22] border border-white/[0.1] rounded-lg text-white"
              />
            </div>
          </div>

          <div>
            <label htmlFor="prop-owner" className="block text-xs text-neutral-300 mb-1">
              Responsável
            </label>
            <select
              id="prop-owner"
              value={form.owner}
              onChange={(e) => setForm({ ...form, owner: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white"
            >
              {TEAM_OWNERS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          {formError && <p className="text-xs text-[#F87171]">{formError}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="px-4 py-2 text-xs font-medium text-neutral-300 bg-white/[0.05] hover:bg-white/[0.09] rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold bg-[#D4AF37] hover:bg-[#E8C96D] text-[#090A0D] rounded-lg"
            >
              Salvar orçamento
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Mark Lost with Reason */}
      <Modal
        open={Boolean(lossTarget)}
        title="Registrar Motivo de Perda"
        subtitle={
          lossTarget
            ? `${lossTarget.code} · ${lossTarget.title} (${formatCurrencyBRL(lossTarget.value)})`
            : undefined
        }
        onClose={() => setLossTarget(null)}
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs text-neutral-300 leading-relaxed">
            Registrar o motivo real da perda alimenta os relatórios de gargalos comerciais da operação.
          </p>
          <div>
            <label htmlFor="loss-reason" className="block text-xs text-neutral-300 mb-1.5">
              Motivo principal da perda
            </label>
            <select
              id="loss-reason"
              value={lossReason}
              onChange={(e) => setLossReason(e.target.value as LossReason)}
              className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white"
            >
              {(Object.entries(LOSS_REASON_LABELS) as Array<[LossReason, string]>).map(
                ([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                )
              )}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setLossTarget(null)}
              className="px-4 py-2 text-xs text-neutral-300 bg-white/[0.05] hover:bg-white/[0.09] rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                if (lossTarget) {
                  onMarkProposalLost(lossTarget.id, lossReason);
                }
                setLossTarget(null);
              }}
              className="px-4 py-2 text-xs font-semibold bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-lg"
            >
              Confirmar perda
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Contextual AI Approach Suggestion (Explicitly labeled as suggestion) */}
      <Modal
        open={Boolean(suggestionProposal)}
        title={suggestionHeadline || 'Sugestão de abordagem'}
        subtitle="Sugestão gerada pela camada de inteligência para revisão manual — nenhuma mensagem é enviada automaticamente."
        onClose={() => setSuggestionProposal(null)}
      >
        {suggestionProposal && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-lg bg-[#D4AF37]/[0.08] border border-[#D4AF37]/25 text-xs text-neutral-200 leading-relaxed">
              <strong className="text-[#E8C96D] font-medium">
                Contexto analisado (sugestão):
              </strong>{' '}
              {suggestionRationale}
            </div>

            <div>
              <label
                htmlFor="ai-suggestion-text"
                className="block text-xs text-neutral-300 mb-1.5"
              >
                Mensagem sugerida (edite livremente antes de copiar ou registrar)
              </label>
              <textarea
                id="ai-suggestion-text"
                rows={4}
                value={editableSuggestion}
                onChange={(e) => setEditableSuggestion(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-neutral-100 leading-relaxed focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <p className="text-[11px] text-neutral-400">
              Canal prioritário futuro: WhatsApp. Nesta demonstração, o WhatsApp não está conectado — copie o texto revisado ou registre o envio manual no histórico do cliente.
            </p>

            <div className="flex flex-wrap justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleCopySuggestion}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-neutral-200 bg-white/[0.06] hover:bg-white/[0.1] rounded-lg"
              >
                <Copy className="w-3.5 h-3.5" />
                {copied ? 'Copiado!' : 'Copiar mensagem'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onLogSuggestedMessage(
                    suggestionProposal.clientId,
                    editableSuggestion
                  );
                  setSuggestionProposal(null);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#D4AF37] hover:bg-[#E8C96D] text-[#090A0D] rounded-lg"
              >
                <Send className="w-3.5 h-3.5" />
                Registrar envio manual
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
