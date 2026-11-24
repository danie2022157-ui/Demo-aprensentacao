import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  MessageSquare,
  X,
  Phone,
  Mail,
  Building2,
  MapPin,
  Send,
} from 'lucide-react';
import {
  Client,
  ClientStatus,
  ConversationChannel,
  CrmState,
  TEAM_OWNERS,
} from '../../types/crm';
import {
  ClientHistoryApproachSuggestion,
  formatCurrencyBRL,
  generateClientHistoryApproachSuggestion,
  getStageConfig,
} from '../../lib/crm-engine';
import { ConfirmDialog, Modal } from '../ui/Modal';
import { ClientHistoryAiSuggestion } from './ClientHistoryAiSuggestion';

interface ClientsViewProps {
  state: CrmState;
  globalSearch: string;
  selectedClientId: string | null;
  onSelectClient: (clientId: string | null) => void;
  onAddClient: (client: Omit<Client, 'id' | 'createdAt'>) => void;
  onUpdateClient: (client: Client) => void;
  onDeleteClient: (clientId: string) => void;
  onAddConversation: (entry: {
    clientId: string;
    channel: ConversationChannel;
    direction: 'enviado' | 'recebido' | 'interno';
    summary: string;
    owner: string;
  }) => void;
  onLogSuggestedMessage: (
    clientId: string,
    channel: ConversationChannel,
    messageText: string
  ) => void;
  onScheduleFollowUpFromSuggestion: (
    suggestion: ClientHistoryApproachSuggestion
  ) => void;
}

const STATUS_LABELS: Record<ClientStatus, { label: string; colorClass: string }> = {
  ativo: { label: 'Ativo', colorClass: 'text-[#4ADE80]' },
  negociacao: { label: 'Em negociação', colorClass: 'text-[#E8C96D]' },
  lead: { label: 'Novo lead', colorClass: 'text-neutral-300' },
  inativo: { label: 'Inativo', colorClass: 'text-neutral-500' },
};

const CHANNEL_LABELS: Record<ConversationChannel, string> = {
  whatsapp: 'WhatsApp',
  telefone: 'Telefone',
  email: 'E-mail',
  reuniao: 'Reunião',
};

const EMPTY_CLIENT_FORM: Omit<Client, 'id' | 'createdAt'> = {
  company: '',
  contactName: '',
  role: '',
  email: '',
  phone: '',
  segment: '',
  city: '',
  owner: TEAM_OWNERS[0],
  status: 'lead',
  notes: '',
};

export const ClientsView: React.FC<ClientsViewProps> = ({
  state,
  globalSearch,
  selectedClientId,
  onSelectClient,
  onAddClient,
  onUpdateClient,
  onDeleteClient,
  onAddConversation,
  onLogSuggestedMessage,
  onScheduleFollowUpFromSuggestion,
}) => {
  const [localSearch, setLocalSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | ClientStatus>('todos');
  const [ownerFilter, setOwnerFilter] = useState<string>('todos');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState<Omit<Client, 'id' | 'createdAt'>>(EMPTY_CLIENT_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);

  // Conversation form inside Client Detail Drawer
  const [convChannel, setConvChannel] = useState<ConversationChannel>('whatsapp');
  const [convDirection, setConvDirection] = useState<'enviado' | 'recebido' | 'interno'>('enviado');
  const [convSummary, setConvSummary] = useState('');
  const [convError, setConvError] = useState<string | null>(null);

  const combinedQuery = (localSearch || globalSearch).trim().toLowerCase();

  const filteredClients = useMemo(() => {
    return state.clients.filter((c) => {
      if (statusFilter !== 'todos' && c.status !== statusFilter) return false;
      if (ownerFilter !== 'todos' && c.owner !== ownerFilter) return false;
      if (!combinedQuery) return true;
      return (
        c.company.toLowerCase().includes(combinedQuery) ||
        c.contactName.toLowerCase().includes(combinedQuery) ||
        c.email.toLowerCase().includes(combinedQuery) ||
        c.segment.toLowerCase().includes(combinedQuery) ||
        c.city.toLowerCase().includes(combinedQuery)
      );
    });
  }, [state.clients, statusFilter, ownerFilter, combinedQuery]);

  const selectedClient = selectedClientId
    ? state.clients.find((c) => c.id === selectedClientId) ?? null
    : null;

  const clientConversations = useMemo(() => {
    if (!selectedClient) return [];
    return state.conversations
      .filter((cv) => cv.clientId === selectedClient.id)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [state.conversations, selectedClient]);

  const clientOpps = useMemo(() => {
    if (!selectedClient) return [];
    return state.opportunities.filter((o) => o.clientId === selectedClient.id);
  }, [state.opportunities, selectedClient]);

  const clientSuggestion = useMemo(() => {
    if (!selectedClient) return null;
    return generateClientHistoryApproachSuggestion(state, selectedClient.id);
  }, [state, selectedClient]);

  const openCreateModal = () => {
    setEditingClient(null);
    setForm(EMPTY_CLIENT_FORM);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setForm({
      company: client.company,
      contactName: client.contactName,
      role: client.role,
      email: client.email,
      phone: client.phone,
      segment: client.segment,
      city: client.city,
      owner: client.owner,
      status: client.status,
      notes: client.notes,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmitClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company.trim() || !form.contactName.trim() || !form.email.trim()) {
      setFormError('Preencha empresa, nome do contato e e-mail para continuar.');
      return;
    }
    if (editingClient) {
      onUpdateClient({
        ...editingClient,
        ...form,
        company: form.company.trim(),
        contactName: form.contactName.trim(),
        email: form.email.trim(),
      });
    } else {
      onAddClient({
        ...form,
        company: form.company.trim(),
        contactName: form.contactName.trim(),
        email: form.email.trim(),
      });
    }
    setModalOpen(false);
  };

  const handleSubmitConversation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    if (!convSummary.trim()) {
      setConvError('Descreva o resumo da interação antes de registrar.');
      return;
    }
    onAddConversation({
      clientId: selectedClient.id,
      channel: convChannel,
      direction: convDirection,
      summary: convSummary.trim(),
      owner: selectedClient.owner,
    });
    setConvSummary('');
    setConvError(null);
  };

  return (
    <div className="space-y-5">
      {/* Filter & Action Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#12141A] border border-white/[0.07] rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Filtrar empresa, contato ou cidade..."
              aria-label="Filtrar clientes"
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#171A22] border border-white/[0.08] rounded-lg text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-[#D4AF37]/60"
            />
          </div>

          <div
            role="group"
            aria-label="Filtrar por status do cliente"
            className="flex items-center gap-1 p-1 bg-[#171A22] rounded-lg border border-white/[0.06]"
          >
            {(
              [
                ['todos', 'Todos'],
                ['ativo', 'Ativos'],
                ['negociacao', 'Negociação'],
                ['lead', 'Leads'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  statusFilter === key
                    ? 'bg-[#D4AF37] text-[#090A0D]'
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
            aria-label="Filtrar por responsável"
            className="px-3 py-2 text-xs bg-[#171A22] border border-white/[0.08] rounded-lg text-neutral-200 focus:outline-none focus:border-[#D4AF37]/60"
          >
            <option value="todos">Todos os responsáveis</option>
            {TEAM_OWNERS.map((owner) => (
              <option key={owner} value={owner}>
                {owner}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold bg-[#D4AF37] hover:bg-[#E8C96D] text-[#090A0D] rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Novo Cliente
        </button>
      </div>

      {/* Clients Table */}
      <div className="bg-[#12141A] border border-white/[0.07] rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
          <p className="text-xs text-neutral-400">
            Exibindo{' '}
            <span className="font-mono tabular-nums text-white font-medium">
              {filteredClients.length}
            </span>{' '}
            de{' '}
            <span className="font-mono tabular-nums text-neutral-300">
              {state.clients.length}
            </span>{' '}
            contatos cadastrados
          </p>
        </div>

        {filteredClients.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-neutral-300">
              Nenhum cliente encontrado com os filtros aplicados.
            </p>
            <button
              type="button"
              onClick={() => {
                setLocalSearch('');
                setStatusFilter('todos');
                setOwnerFilter('todos');
              }}
              className="mt-3 text-xs text-[#E8C96D] hover:underline"
            >
              Limpar filtros
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.07] text-[11.5px] font-medium text-neutral-400 bg-[#151821]">
                  <th className="py-3 px-5">Empresa & Segmento</th>
                  <th className="py-3 px-4">Contato Principal</th>
                  <th className="py-3 px-4">Responsável</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Volume Funil</th>
                  <th className="py-3 px-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05] text-sm">
                {filteredClients.map((client) => {
                  const opps = state.opportunities.filter(
                    (o) => o.clientId === client.id
                  );
                  const totalValue = opps.reduce((s, o) => s + o.value, 0);
                  const convCount = state.conversations.filter(
                    (cv) => cv.clientId === client.id
                  ).length;
                  const statusMeta = STATUS_LABELS[client.status];

                  return (
                    <tr
                      key={client.id}
                      className="hover:bg-white/[0.025] transition-colors"
                    >
                      <td className="py-3.5 px-5">
                        <button
                          type="button"
                          onClick={() => onSelectClient(client.id)}
                          className="font-medium text-white hover:text-[#E8C96D] transition-colors text-left block"
                        >
                          {client.company}
                        </button>
                        <span className="text-xs text-neutral-500">
                          {client.segment || 'Geral'} · {client.city || 'Brasil'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="text-xs font-medium text-neutral-200">
                          {client.contactName}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {client.phone} · {client.email}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-neutral-300 whitespace-nowrap">
                        {client.owner}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`text-xs font-medium ${statusMeta.colorClass}`}>
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span className="text-xs font-mono tabular-nums text-neutral-100">
                          {formatCurrencyBRL(totalValue)}
                        </span>
                        <span className="block text-[11px] text-neutral-500 font-mono tabular-nums">
                          {opps.length} oport. · {convCount} reg.
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onSelectClient(client.id)}
                            aria-label={`Abrir histórico de ${client.company}`}
                            className="px-2.5 py-1.5 text-xs text-neutral-300 hover:text-[#E8C96D] hover:bg-white/[0.05] rounded-md transition-colors inline-flex items-center gap-1"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            Histórico
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(client)}
                            aria-label={`Editar ${client.company}`}
                            className="p-1.5 text-neutral-400 hover:text-white hover:bg-white/[0.06] rounded-md transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(client)}
                            aria-label={`Excluir ${client.company}`}
                            className="p-1.5 text-neutral-400 hover:text-[#F87171] hover:bg-white/[0.06] rounded-md transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Client Detail Slide-Over Drawer (Histórico de Conversas + Oportunidades) */}
      {selectedClient && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label={`Detalhes e histórico de ${selectedClient.company}`}
        >
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-[2px]"
            onClick={() => onSelectClient(null)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-xl bg-[#111319] border-l border-white/[0.1] h-full flex flex-col shadow-2xl">
            <div className="px-6 py-4 border-b border-white/[0.07] flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {selectedClient.company}
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {selectedClient.contactName}
                  {selectedClient.role ? ` · ${selectedClient.role}` : ''} · Responsável:{' '}
                  <span className="text-neutral-200">{selectedClient.owner}</span>
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openEditModal(selectedClient)}
                  className="px-3 py-1.5 text-xs font-medium text-neutral-200 bg-white/[0.05] hover:bg-white/[0.09] rounded-lg"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => onSelectClient(null)}
                  aria-label="Fechar painel do cliente"
                  className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/[0.06]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Contact info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-[#171A22] border border-white/[0.06] rounded-lg p-4">
                <div className="flex items-center gap-2 text-neutral-300">
                  <Phone className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                  <span>{selectedClient.phone || 'Não informado'}</span>
                </div>
                <div className="flex items-center gap-2 text-neutral-300 truncate">
                  <Mail className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                  <span className="truncate">{selectedClient.email}</span>
                </div>
                <div className="flex items-center gap-2 text-neutral-300">
                  <Building2 className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                  <span>{selectedClient.segment || 'Segmento não definido'}</span>
                </div>
                <div className="flex items-center gap-2 text-neutral-300">
                  <MapPin className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                  <span>{selectedClient.city || 'Brasil'}</span>
                </div>
                {selectedClient.notes && (
                  <p className="sm:col-span-2 text-neutral-400 pt-2 border-t border-white/[0.06] leading-relaxed">
                    {selectedClient.notes}
                  </p>
                )}
              </div>

              {/* Linked opportunities */}
              <div>
                <h3 className="text-xs font-semibold text-neutral-300 mb-2.5">
                  Oportunidades vinculadas ({clientOpps.length})
                </h3>
                {clientOpps.length === 0 ? (
                  <p className="text-xs text-neutral-500">
                    Nenhuma oportunidade vinculada a este cliente.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {clientOpps.map((opp) => (
                      <li
                        key={opp.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-lg bg-[#171A22] border border-white/[0.06]"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-white truncate">
                            {opp.title}
                          </p>
                          <p className="text-[11px] text-neutral-400 mt-0.5">
                            {getStageConfig(opp.stage).label} · Probabilidade{' '}
                            <span className="font-mono tabular-nums">{opp.probability}%</span>
                          </p>
                        </div>
                        <span className="text-xs font-mono tabular-nums font-semibold text-[#E8C96D] shrink-0">
                          {formatCurrencyBRL(opp.value)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* AI Next Approach Suggestion (Rules Engine + Funnel + History) */}
              {clientSuggestion && (
                <ClientHistoryAiSuggestion
                  suggestion={clientSuggestion}
                  onUseInForm={(channel, message) => {
                    setConvChannel(channel);
                    setConvDirection('enviado');
                    setConvSummary(message);
                    setConvError(null);
                    const el = document.getElementById('conv-summary');
                    if (el) el.focus();
                  }}
                  onRegisterManualSend={(channel, message) => {
                    onLogSuggestedMessage(selectedClient.id, channel, message);
                  }}
                  onScheduleFollowUp={onScheduleFollowUpFromSuggestion}
                />
              )}

              {/* Register New Interaction */}
              <form
                onSubmit={handleSubmitConversation}
                className="bg-[#171A22] border border-white/[0.07] rounded-xl p-4 space-y-3"
              >
                <h3 className="text-xs font-semibold text-white">
                  Registrar nova interação no histórico
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="conv-channel"
                      className="block text-[11px] text-neutral-400 mb-1"
                    >
                      Canal
                    </label>
                    <select
                      id="conv-channel"
                      value={convChannel}
                      onChange={(e) =>
                        setConvChannel(e.target.value as ConversationChannel)
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-[#111319] border border-white/[0.08] rounded-lg text-neutral-100"
                    >
                      <option value="whatsapp">WhatsApp</option>
                      <option value="telefone">Telefone</option>
                      <option value="email">E-mail</option>
                      <option value="reuniao">Reunião</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="conv-direction"
                      className="block text-[11px] text-neutral-400 mb-1"
                    >
                      Tipo de registro
                    </label>
                    <select
                      id="conv-direction"
                      value={convDirection}
                      onChange={(e) =>
                        setConvDirection(
                          e.target.value as 'enviado' | 'recebido' | 'interno'
                        )
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-[#111319] border border-white/[0.08] rounded-lg text-neutral-100"
                    >
                      <option value="enviado">Contato enviado</option>
                      <option value="recebido">Retorno recebido</option>
                      <option value="interno">Anotação interna</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="conv-summary"
                    className="block text-[11px] text-neutral-400 mb-1"
                  >
                    Resumo da conversa
                  </label>
                  <textarea
                    id="conv-summary"
                    rows={2}
                    value={convSummary}
                    onChange={(e) => {
                      setConvSummary(e.target.value);
                      setConvError(null);
                    }}
                    placeholder="Ex: Cliente confirmou interesse e pediu revisão do prazo..."
                    className="w-full px-3 py-2 text-xs bg-[#111319] border border-white/[0.08] rounded-lg text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-[#D4AF37]/60"
                  />
                  {convError && (
                    <p className="text-[11px] text-[#F87171] mt-1">{convError}</p>
                  )}
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-[#D4AF37] hover:bg-[#E8C96D] text-[#090A0D] rounded-lg transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Salvar interação
                  </button>
                </div>
              </form>

              {/* Conversation History Timeline */}
              <div>
                <h3 className="text-xs font-semibold text-neutral-300 mb-3">
                  Histórico de conversas ({clientConversations.length})
                </h3>
                {clientConversations.length === 0 ? (
                  <p className="text-xs text-neutral-500">
                    Nenhuma conversa registrada ainda para este cliente.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {clientConversations.map((cv) => (
                      <li
                        key={cv.id}
                        className="p-3.5 rounded-lg bg-[#151821] border border-white/[0.06]"
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px] text-neutral-400">
                          <span className="font-medium text-[#E8C96D]">
                            {CHANNEL_LABELS[cv.channel]} ·{' '}
                            {cv.direction === 'enviado'
                              ? 'Enviado'
                              : cv.direction === 'recebido'
                              ? 'Recebido'
                              : 'Interno'}
                          </span>
                          <span className="font-mono tabular-nums">
                            {cv.timestamp.slice(0, 10).split('-').reverse().join('/')} · {cv.owner}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-200 mt-1.5 leading-relaxed">
                          {cv.summary}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Client Modal */}
      <Modal
        open={modalOpen}
        title={editingClient ? 'Editar Cliente' : 'Novo Cliente Fictício'}
        subtitle="Os dados são salvos localmente no navegador para demonstração."
        onClose={() => setModalOpen(false)}
        maxWidthClass="max-w-xl"
      >
        <form onSubmit={handleSubmitClient} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="cli-company" className="block text-xs text-neutral-300 mb-1">
                Empresa *
              </label>
              <input
                id="cli-company"
                type="text"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                placeholder="Ex: Construtora Horizonte"
                className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
            <div>
              <label htmlFor="cli-contact" className="block text-xs text-neutral-300 mb-1">
                Nome do contato *
              </label>
              <input
                id="cli-contact"
                type="text"
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                placeholder="Ex: Renata Almeida"
                className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
            <div>
              <label htmlFor="cli-email" className="block text-xs text-neutral-300 mb-1">
                E-mail *
              </label>
              <input
                id="cli-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="renata@horizonte.com.br"
                className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
            <div>
              <label htmlFor="cli-phone" className="block text-xs text-neutral-300 mb-1">
                Telefone / WhatsApp
              </label>
              <input
                id="cli-phone"
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(11) 99000-0000"
                className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
            <div>
              <label htmlFor="cli-role" className="block text-xs text-neutral-300 mb-1">
                Cargo
              </label>
              <input
                id="cli-role"
                type="text"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                placeholder="Diretora Comercial"
                className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
            <div>
              <label htmlFor="cli-segment" className="block text-xs text-neutral-300 mb-1">
                Segmento
              </label>
              <input
                id="cli-segment"
                type="text"
                value={form.segment}
                onChange={(e) => setForm({ ...form, segment: e.target.value })}
                placeholder="Construção Civil"
                className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
            <div>
              <label htmlFor="cli-city" className="block text-xs text-neutral-300 mb-1">
                Cidade / UF
              </label>
              <input
                id="cli-city"
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="São Paulo, SP"
                className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
            <div>
              <label htmlFor="cli-owner" className="block text-xs text-neutral-300 mb-1">
                Responsável
              </label>
              <select
                id="cli-owner"
                value={form.owner}
                onChange={(e) => setForm({ ...form, owner: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
              >
                {TEAM_OWNERS.map((owner) => (
                  <option key={owner} value={owner}>
                    {owner}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="cli-status" className="block text-xs text-neutral-300 mb-1">
                Status
              </label>
              <select
                id="cli-status"
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as ClientStatus })
                }
                className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
              >
                <option value="lead">Novo lead</option>
                <option value="negociacao">Em negociação</option>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="cli-notes" className="block text-xs text-neutral-300 mb-1">
              Observações comerciais
            </label>
            <textarea
              id="cli-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Principais dores, contexto e próximos passos..."
              className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          {formError && <p className="text-xs text-[#F87171]">{formError}</p>}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-neutral-300 bg-white/[0.05] hover:bg-white/[0.09] rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold bg-[#D4AF37] hover:bg-[#E8C96D] text-[#090A0D] rounded-lg"
            >
              {editingClient ? 'Salvar alterações' : 'Cadastrar cliente'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Excluir cliente"
        description={`Deseja remover "${deleteTarget?.company ?? ''}" da demonstração local? As oportunidades vinculadas também serão removidas.`}
        confirmLabel="Excluir cliente"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            onDeleteClient(deleteTarget.id);
            if (selectedClientId === deleteTarget.id) {
              onSelectClient(null);
            }
          }
          setDeleteTarget(null);
        }}
      />
    </div>
  );
};
