import React, { useState, useMemo } from 'react';
import {
  Plus,
  GripVertical,
  AlertTriangle,
  CalendarPlus,
  Pencil,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import {
  CrmState,
  Opportunity,
  PIPELINE_STAGES,
  PipelineStage,
  TEAM_OWNERS,
} from '../../types/crm';
import {
  detectUnattendedOpportunities,
  formatCurrencyBRL,
  getStageConfig,
} from '../../lib/crm-engine';
import { ConfirmDialog, Modal } from '../ui/Modal';

interface PipelineViewProps {
  state: CrmState;
  globalSearch: string;
  onMoveStage: (opportunityId: string, targetStage: PipelineStage) => void;
  onAddOpportunity: (
    opp: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  onUpdateOpportunity: (opp: Opportunity) => void;
  onDeleteOpportunity: (oppId: string) => void;
  onQuickScheduleForOpportunity: (oppId: string) => void;
  onOpenClientDetail: (clientId: string) => void;
}

export const PipelineView: React.FC<PipelineViewProps> = ({
  state,
  globalSearch,
  onMoveStage,
  onAddOpportunity,
  onUpdateOpportunity,
  onDeleteOpportunity,
  onQuickScheduleForOpportunity,
  onOpenClientDetail,
}) => {
  const [ownerFilter, setOwnerFilter] = useState<string>('todos');
  const [onlyUnattended, setOnlyUnattended] = useState(false);
  const [draggedOppId, setDraggedOppId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<PipelineStage | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingOpp, setEditingOpp] = useState<Opportunity | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Opportunity | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState({
    clientId: state.clients[0]?.id ?? '',
    title: '',
    value: '25000',
    stage: 'novo_interessado' as PipelineStage,
    owner: TEAM_OWNERS[0] as string,
    expectedCloseDate: '2026-12-15',
  });

  const clientById = useMemo(
    () => new Map(state.clients.map((c) => [c.id, c])),
    [state.clients]
  );

  const unattendedIds = useMemo(
    () =>
      new Set(
        detectUnattendedOpportunities(state.opportunities, state.tasks).map(
          (o) => o.id
        )
      ),
    [state.opportunities, state.tasks]
  );

  const query = globalSearch.trim().toLowerCase();

  const filteredOpps = useMemo(() => {
    return state.opportunities.filter((o) => {
      if (ownerFilter !== 'todos' && o.owner !== ownerFilter) return false;
      if (onlyUnattended && !unattendedIds.has(o.id)) return false;
      if (!query) return true;
      const client = clientById.get(o.clientId);
      return (
        o.title.toLowerCase().includes(query) ||
        (client?.company.toLowerCase().includes(query) ?? false) ||
        o.owner.toLowerCase().includes(query)
      );
    });
  }, [state.opportunities, ownerFilter, onlyUnattended, unattendedIds, query, clientById]);

  const totalPipelineValue = filteredOpps
    .filter((o) => o.stage !== 'fechado')
    .reduce((sum, o) => sum + o.value, 0);

  const openCreateModal = (initialStage: PipelineStage = 'novo_interessado') => {
    setEditingOpp(null);
    setForm({
      clientId: state.clients[0]?.id ?? '',
      title: '',
      value: '25000',
      stage: initialStage,
      owner: TEAM_OWNERS[0],
      expectedCloseDate: '2026-12-15',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (opp: Opportunity) => {
    setEditingOpp(opp);
    setForm({
      clientId: opp.clientId,
      title: opp.title,
      value: String(opp.value),
      stage: opp.stage,
      owner: opp.owner,
      expectedCloseDate: opp.expectedCloseDate,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericVal = Number(form.value);
    if (!form.clientId || !form.title.trim() || Number.isNaN(numericVal) || numericVal <= 0) {
      setFormError('Informe cliente, título e um valor positivo para a oportunidade.');
      return;
    }

    const stageCfg = getStageConfig(form.stage);
    if (editingOpp) {
      onUpdateOpportunity({
        ...editingOpp,
        clientId: form.clientId,
        title: form.title.trim(),
        value: Math.round(numericVal),
        stage: form.stage,
        probability: stageCfg.defaultProbability,
        owner: form.owner,
        expectedCloseDate: form.expectedCloseDate,
        updatedAt: new Date().toISOString(),
      });
    } else {
      onAddOpportunity({
        clientId: form.clientId,
        title: form.title.trim(),
        value: Math.round(numericVal),
        stage: form.stage,
        probability: stageCfg.defaultProbability,
        owner: form.owner,
        expectedCloseDate: form.expectedCloseDate,
      });
    }
    setModalOpen(false);
  };

  const handleDragStart = (e: React.DragEvent, oppId: string) => {
    setDraggedOppId(oppId);
    e.dataTransfer.setData('text/plain', oppId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, stageId: PipelineStage) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStage !== stageId) {
      setDragOverStage(stageId);
    }
  };

  const handleDrop = (e: React.DragEvent, targetStage: PipelineStage) => {
    e.preventDefault();
    const droppedId = e.dataTransfer.getData('text/plain') || draggedOppId;
    if (droppedId) {
      onMoveStage(droppedId, targetStage);
    }
    setDraggedOppId(null);
    setDragOverStage(null);
  };

  const activeAutoRulesCount = state.rules.filter((r) => r.enabled).length;

  return (
    <div className="space-y-5">
      {/* Pipeline Top Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#12141A] border border-white/[0.07] rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="text-xs text-neutral-400">
              Volume aberto filtrado:{' '}
              <span className="font-mono tabular-nums font-semibold text-[#E8C96D]">
                {formatCurrencyBRL(totalPipelineValue)}
              </span>{' '}
              ·{' '}
              <span className="text-neutral-300">
                {activeAutoRulesCount} regras de follow-up automático ativas
              </span>
            </p>
          </div>

          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            aria-label="Filtrar funil por responsável"
            className="px-3 py-1.5 text-xs bg-[#171A22] border border-white/[0.08] rounded-lg text-neutral-200 focus:outline-none focus:border-[#D4AF37]/60"
          >
            <option value="todos">Todos os responsáveis</option>
            {TEAM_OWNERS.map((owner) => (
              <option key={owner} value={owner}>
                {owner}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setOnlyUnattended((v) => !v)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap inline-flex items-center gap-1.5 ${
              onlyUnattended
                ? 'bg-[#F59E0B]/15 border-[#F59E0B]/40 text-[#FBBF24]'
                : 'bg-[#171A22] border-white/[0.08] text-neutral-300 hover:text-white'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B]" />
            Sem acompanhamento ({unattendedIds.size})
          </button>
        </div>

        <button
          type="button"
          onClick={() => openCreateModal()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold bg-[#D4AF37] hover:bg-[#E8C96D] text-[#090A0D] rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nova Oportunidade
        </button>
      </div>

      {/* Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 items-start">
        {PIPELINE_STAGES.map((stage, stageIdx) => {
          const stageOpps = filteredOpps.filter((o) => o.stage === stage.id);
          const stageSum = stageOpps.reduce((s, o) => s + o.value, 0);
          const isDropTarget = dragOverStage === stage.id;
          const prevStage = stageIdx > 0 ? PIPELINE_STAGES[stageIdx - 1] : null;
          const nextStage =
            stageIdx < PIPELINE_STAGES.length - 1
              ? PIPELINE_STAGES[stageIdx + 1]
              : null;

          return (
            <div
              key={stage.id}
              data-testid={`pipeline-column-${stage.id}`}
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDragLeave={() => {
                if (dragOverStage === stage.id) setDragOverStage(null);
              }}
              onDrop={(e) => handleDrop(e, stage.id)}
              className={`bg-[#111319] border rounded-xl flex flex-col min-h-[380px] transition-colors ${
                isDropTarget
                  ? 'border-[#D4AF37] bg-[#171A24]'
                  : 'border-white/[0.07]'
              }`}
            >
              {/* Stage Header */}
              <div className="p-3.5 border-b border-white/[0.07]">
                <div
                  className="h-0.5 w-10 rounded-full mb-2.5"
                  style={{ backgroundColor: stage.accentHex }}
                />
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-white truncate">
                    {stage.label}
                  </h2>
                  <span className="text-xs font-mono tabular-nums text-neutral-400">
                    {stageOpps.length}
                  </span>
                </div>
                <p className="text-xs font-mono tabular-nums text-[#E8C96D] mt-1">
                  {formatCurrencyBRL(stageSum)}
                </p>
              </div>

              {/* Cards List */}
              <div className="p-3 space-y-3 flex-1">
                {stageOpps.length === 0 ? (
                  <div className="py-8 px-3 text-center border border-dashed border-white/[0.07] rounded-lg">
                    <p className="text-xs text-neutral-500">
                      Arraste uma oportunidade para esta etapa
                    </p>
                  </div>
                ) : (
                  stageOpps.map((opp) => {
                    const client = clientById.get(opp.clientId);
                    const isUnattended = unattendedIds.has(opp.id);
                    const isDragging = draggedOppId === opp.id;

                    return (
                      <article
                        key={opp.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, opp.id)}
                        onDragEnd={() => {
                          setDraggedOppId(null);
                          setDragOverStage(null);
                        }}
                        data-testid={`deal-card-${opp.id}`}
                        className={`bg-[#171A22] border rounded-xl p-3.5 transition-all cursor-grab active:cursor-grabbing ${
                          isDragging
                            ? 'opacity-50 border-[#D4AF37]/60'
                            : isUnattended
                            ? 'border-[#F59E0B]/35 hover:border-[#F59E0B]/60'
                            : 'border-white/[0.08] hover:border-[#D4AF37]/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="min-w-0">
                            <p className="text-[11px] text-neutral-400 whitespace-nowrap">
                              Valor
                            </p>
                            <p className="text-[17px] font-semibold text-white font-mono tabular-nums mt-0.5 whitespace-nowrap">
                              {formatCurrencyBRL(opp.value)}
                            </p>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => openEditModal(opp)}
                              aria-label={`Editar oportunidade ${opp.title}`}
                              className="p-1 text-neutral-500 hover:text-white rounded"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(opp)}
                              aria-label={`Excluir oportunidade ${opp.title}`}
                              className="p-1 text-neutral-500 hover:text-[#F87171] rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <GripVertical
                              className="w-3.5 h-3.5 text-neutral-600 ml-0.5"
                              aria-hidden="true"
                            />
                          </div>
                        </div>

                        <div className="mt-2.5">
                          <button
                            type="button"
                            onClick={() => onOpenClientDetail(opp.clientId)}
                            className="text-xs font-semibold text-[#E8C96D] hover:underline block truncate text-left w-full"
                          >
                            {client?.company ?? 'Cliente'}
                          </button>
                          <p className="text-xs text-neutral-200 mt-0.5 line-clamp-2 leading-snug">
                            {opp.title}
                          </p>
                        </div>

                        {/* Probability bar */}
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1">
                            <span>Probabilidade</span>
                            <span className="font-mono tabular-nums text-neutral-200">
                              {opp.probability}%
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${opp.probability}%`,
                                backgroundColor: stage.accentHex,
                              }}
                            />
                          </div>
                        </div>

                        <div className="mt-2.5 flex items-center justify-between text-[11px] text-neutral-400">
                          <span className="truncate">{opp.owner}</span>
                          {opp.recovered && (
                            <span className="text-[#4ADE80] inline-flex items-center gap-1 shrink-0">
                              <Sparkles className="w-3 h-3" />
                              Recuperada
                            </span>
                          )}
                        </div>

                        {/* Unattended Alert */}
                        {isUnattended && (
                          <div className="mt-3 pt-2.5 border-t border-white/[0.06] space-y-2">
                            <span className="text-[11px] text-[#FBBF24] flex items-center gap-1.5">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              Sem acompanhamento
                            </span>
                            <button
                              type="button"
                              onClick={() => onQuickScheduleForOpportunity(opp.id)}
                              className="w-full py-1.5 px-2.5 text-[11px] font-medium text-[#E8C96D] bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 border border-[#D4AF37]/25 rounded-lg inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors"
                            >
                              <CalendarPlus className="w-3 h-3 shrink-0" />
                              Agendar retorno
                            </button>
                          </div>
                        )}

                        {/* Accessible Stage Move Controls (Keyboard / Mobile / Fast Click) */}
                        <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between gap-2">
                          <button
                            type="button"
                            disabled={!prevStage}
                            onClick={() =>
                              prevStage && onMoveStage(opp.id, prevStage.id)
                            }
                            aria-label={
                              prevStage
                                ? `Voltar ${client?.company ?? opp.title} para ${prevStage.label}`
                                : 'Primeira etapa'
                            }
                            className="inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                          >
                            <ArrowLeft className="w-3 h-3" />
                            Voltar
                          </button>
                          <button
                            type="button"
                            disabled={!nextStage}
                            onClick={() =>
                              nextStage && onMoveStage(opp.id, nextStage.id)
                            }
                            aria-label={
                              nextStage
                                ? `Avançar ${client?.company ?? opp.title} para ${nextStage.label}`
                                : 'Etapa final'
                            }
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#E8C96D] hover:text-[#F6E2A1] disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                          >
                            Avançar
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>

              <div className="p-2.5 border-t border-white/[0.05]">
                <button
                  type="button"
                  onClick={() => openCreateModal(stage.id)}
                  className="w-full py-1.5 text-xs text-neutral-400 hover:text-[#E8C96D] hover:bg-white/[0.04] rounded-lg transition-colors"
                >
                  + Adicionar em {stage.shortLabel}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create / Edit Opportunity Modal */}
      <Modal
        open={modalOpen}
        title={editingOpp ? 'Editar Oportunidade' : 'Nova Oportunidade'}
        subtitle="Ao mover ou criar oportunidades em etapas com regra ativa, um follow-up pode ser gerado automaticamente."
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="opp-client" className="block text-xs text-neutral-300 mb-1">
              Cliente *
            </label>
            <select
              id="opp-client"
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
            >
              {state.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company} ({c.contactName})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="opp-title" className="block text-xs text-neutral-300 mb-1">
              Título da oportunidade *
            </label>
            <input
              id="opp-title"
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex: Implantação Onethy Comercial — 15 licenças"
              className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="opp-value" className="block text-xs text-neutral-300 mb-1">
                Valor estimado (R$) *
              </label>
              <input
                id="opp-value"
                type="number"
                min="1"
                step="100"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono bg-[#171A22] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <label htmlFor="opp-stage" className="block text-xs text-neutral-300 mb-1">
                Etapa do funil
              </label>
              <select
                id="opp-stage"
                value={form.stage}
                onChange={(e) =>
                  setForm({ ...form, stage: e.target.value as PipelineStage })
                }
                className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
              >
                {PIPELINE_STAGES.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="opp-owner" className="block text-xs text-neutral-300 mb-1">
                Responsável
              </label>
              <select
                id="opp-owner"
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
              <label htmlFor="opp-close" className="block text-xs text-neutral-300 mb-1">
                Previsão de fechamento
              </label>
              <input
                id="opp-close"
                type="date"
                value={form.expectedCloseDate}
                onChange={(e) =>
                  setForm({ ...form, expectedCloseDate: e.target.value })
                }
                className="w-full px-3 py-2 text-xs font-mono bg-[#171A22] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
          </div>

          {formError && <p className="text-xs text-[#F87171]">{formError}</p>}

          <div className="flex justify-end gap-3 pt-2">
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
              {editingOpp ? 'Salvar oportunidade' : 'Criar oportunidade'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Excluir oportunidade"
        description={`Confirmar remoção de "${deleteTarget?.title ?? ''}" do funil comercial?`}
        confirmLabel="Excluir"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) onDeleteOpportunity(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
};
