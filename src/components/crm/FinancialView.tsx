import React, { useState, useMemo } from 'react';
import {
  Plus,
  Check,
  RotateCcw,
  Trash2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  CrmState,
  FinancialEntry,
  FinancialEntryType,
} from '../../types/crm';
import {
  computeFinancialSummary,
  daysBetweenDates,
  formatCurrencyBRL,
} from '../../lib/crm-engine';
import { Modal } from '../ui/Modal';

interface FinancialViewProps {
  state: CrmState;
  globalSearch: string;
  onAddEntry: (entry: Omit<FinancialEntry, 'id'>) => void;
  onToggleEntryPaid: (entryId: string) => void;
  onDeleteEntry: (entryId: string) => void;
}

export const FinancialView: React.FC<FinancialViewProps> = ({
  state,
  globalSearch,
  onAddEntry,
  onToggleEntryPaid,
  onDeleteEntry,
}) => {
  const [typeFilter, setTypeFilter] = useState<'todos' | FinancialEntryType | 'vencidos'>('todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    description: '',
    type: 'receber' as FinancialEntryType,
    category: 'Serviços & Licenças',
    amount: '5000',
    dueDate: state.referenceDate,
    clientId: '',
  });

  const summary = useMemo(() => computeFinancialSummary(state), [state]);
  const clientById = useMemo(
    () => new Map(state.clients.map((c) => [c.id, c])),
    [state.clients]
  );

  const query = globalSearch.trim().toLowerCase();

  const filteredEntries = useMemo(() => {
    return [...state.financialEntries]
      .filter((e) => {
        const isOverdue =
          e.status === 'pendente' && e.dueDate < state.referenceDate;
        if (typeFilter === 'vencidos' && !isOverdue) return false;
        if (
          typeFilter !== 'todos' &&
          typeFilter !== 'vencidos' &&
          e.type !== typeFilter
        ) {
          return false;
        }
        if (!query) return true;
        return (
          e.description.toLowerCase().includes(query) ||
          e.category.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [state.financialEntries, state.referenceDate, typeFilter, query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numeric = Number(form.amount);
    if (!form.description.trim() || Number.isNaN(numeric) || numeric <= 0) {
      setFormError('Informe descrição e valor positivo para o lançamento.');
      return;
    }
    onAddEntry({
      description: form.description.trim(),
      category: form.category.trim() || 'Operacional',
      type: form.type,
      amount: Math.round(numeric),
      dueDate: form.dueDate,
      status: 'pendente',
      clientId: form.clientId || undefined,
    });
    setModalOpen(false);
  };

  const totalFlowVolume = Math.max(
    1,
    summary.receivedTotal +
      summary.pendingReceivables +
      summary.paidExpenses +
      summary.pendingExpenses
  );

  return (
    <div className="space-y-5">
      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-[#12141A] border border-white/[0.07] rounded-xl p-5">
          <p className="text-xs text-neutral-400">Contas a receber (previsto)</p>
          <p className="text-2xl font-semibold text-[#4ADE80] font-mono tabular-nums mt-2">
            {formatCurrencyBRL(summary.pendingReceivables)}
          </p>
          <p className="text-xs text-neutral-400 mt-1.5">
            Já recebido:{' '}
            <span className="font-mono tabular-nums text-neutral-200">
              {formatCurrencyBRL(summary.receivedTotal)}
            </span>
          </p>
        </div>

        <div className="bg-[#12141A] border border-white/[0.07] rounded-xl p-5">
          <p className="text-xs text-neutral-400">Despesas previstas</p>
          <p className="text-2xl font-semibold text-white font-mono tabular-nums mt-2">
            {formatCurrencyBRL(summary.pendingExpenses)}
          </p>
          <p className="text-xs text-neutral-400 mt-1.5">
            Já pago:{' '}
            <span className="font-mono tabular-nums text-neutral-200">
              {formatCurrencyBRL(summary.paidExpenses)}
            </span>
          </p>
        </div>

        <div className="bg-[#12141A] border border-[#D4AF37]/25 rounded-xl p-5">
          <p className="text-xs text-neutral-400">Fluxo de caixa projetado</p>
          <p
            data-testid="financial-projected-balance"
            className={`text-2xl font-semibold font-mono tabular-nums mt-2 ${
              summary.projectedCashBalance >= 0
                ? 'text-[#E8C96D]'
                : 'text-[#F87171]'
            }`}
          >
            {formatCurrencyBRL(summary.projectedCashBalance)}
          </p>
          <p className="text-xs text-neutral-400 mt-1.5">
            Caixa atual realizado:{' '}
            <span className="font-mono tabular-nums text-neutral-200">
              {formatCurrencyBRL(summary.currentCashBalance)}
            </span>
          </p>
        </div>

        <div className="bg-[#12141A] border border-white/[0.07] rounded-xl p-5">
          <p className="text-xs text-neutral-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B]" />
            Alertas de vencimento
          </p>
          <p
            data-testid="financial-overdue-count"
            className={`text-2xl font-semibold font-mono tabular-nums mt-2 ${
              summary.overdueTotalCount > 0 ? 'text-[#F87171]' : 'text-[#4ADE80]'
            }`}
          >
            {summary.overdueTotalCount}
          </p>
          <p className="text-xs text-neutral-400 mt-1.5">
            {summary.overdueReceivablesCount} a receber · {summary.overdueExpensesCount}{' '}
            despesas vencidas
          </p>
        </div>
      </div>

      {/* Visual Cashflow Composition */}
      <div className="bg-[#12141A] border border-white/[0.07] rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold text-white">
            Visibilidade de Caixa Operacional
          </h2>
          <span className="text-xs text-neutral-400">
            Entradas vs saídas realizadas e previstas
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-neutral-300">Entradas (Recebido + Previsto)</span>
              <span className="font-mono tabular-nums text-[#4ADE80]">
                {formatCurrencyBRL(summary.receivedTotal + summary.pendingReceivables)}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden flex">
              <div
                className="h-full bg-[#22C55E]"
                style={{
                  width: `${Math.round((summary.receivedTotal / totalFlowVolume) * 100)}%`,
                }}
              />
              <div
                className="h-full bg-[#4ADE80]/45"
                style={{
                  width: `${Math.round((summary.pendingReceivables / totalFlowVolume) * 100)}%`,
                }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-neutral-300">Saídas (Pago + Previsto)</span>
              <span className="font-mono tabular-nums text-[#F87171]">
                {formatCurrencyBRL(summary.paidExpenses + summary.pendingExpenses)}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden flex">
              <div
                className="h-full bg-[#DC2626]"
                style={{
                  width: `${Math.round((summary.paidExpenses / totalFlowVolume) * 100)}%`,
                }}
              />
              <div
                className="h-full bg-[#F87171]/45"
                style={{
                  width: `${Math.round((summary.pendingExpenses / totalFlowVolume) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Add Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#12141A] border border-white/[0.07] rounded-xl p-4">
        <div
          role="group"
          aria-label="Filtrar lançamentos financeiros"
          className="flex flex-wrap items-center gap-1 p-1 bg-[#171A22] rounded-lg border border-white/[0.06]"
        >
          {(
            [
              ['todos', 'Todos'],
              ['receber', 'Contas a receber'],
              ['despesa', 'Despesas'],
              ['vencidos', `Vencidos (${summary.overdueTotalCount})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTypeFilter(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                typeFilter === key
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
              description: '',
              type: 'receber',
              category: 'Serviços & Licenças',
              amount: '5000',
              dueDate: state.referenceDate,
              clientId: '',
            });
            setFormError(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold bg-[#D4AF37] hover:bg-[#E8C96D] text-[#090A0D] rounded-lg whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Novo Lançamento
        </button>
      </div>

      {/* Ledger Table */}
      <div className="bg-[#12141A] border border-white/[0.07] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.07] text-[11.5px] font-medium text-neutral-400 bg-[#151821]">
                <th className="py-3 px-5">Descrição & Categoria</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Vencimento</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Valor</th>
                <th className="py-3 px-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05] text-xs">
              {filteredEntries.map((entry) => {
                const isOverdue =
                  entry.status === 'pendente' &&
                  entry.dueDate < state.referenceDate;
                const overdueDays = isOverdue
                  ? daysBetweenDates(entry.dueDate, state.referenceDate)
                  : 0;
                const client = entry.clientId
                  ? clientById.get(entry.clientId)
                  : undefined;

                return (
                  <tr key={entry.id} className="hover:bg-white/[0.02]">
                    <td className="py-3.5 px-5">
                      <p className="font-medium text-white">
                        {entry.description}
                      </p>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        {entry.category}
                        {client ? ` · ${client.company}` : ''}
                      </p>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${
                          entry.type === 'receber'
                            ? 'text-[#4ADE80]'
                            : 'text-neutral-300'
                        }`}
                      >
                        {entry.type === 'receber' ? (
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowDownRight className="w-3.5 h-3.5 text-[#F87171]" />
                        )}
                        {entry.type === 'receber' ? 'A receber' : 'Despesa'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap font-mono tabular-nums">
                      <span
                        className={
                          isOverdue ? 'text-[#F87171] font-medium' : 'text-neutral-300'
                        }
                      >
                        {entry.dueDate.split('-').reverse().join('/')}
                      </span>
                      {isOverdue && (
                        <span className="block text-[10.5px] text-[#F87171]">
                          Vencido há {overdueDays}d
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={
                          entry.status === 'pago'
                            ? 'text-[#4ADE80] font-medium'
                            : isOverdue
                            ? 'text-[#F87171] font-medium'
                            : 'text-[#FBBF24]'
                        }
                      >
                        {entry.status === 'pago'
                          ? entry.type === 'receber'
                            ? 'Recebido'
                            : 'Pago'
                          : isOverdue
                          ? 'Vencido'
                          : 'Previsto'}
                      </span>
                    </td>

                    <td
                      className={`py-3.5 px-4 text-right whitespace-nowrap font-mono tabular-nums font-semibold ${
                        entry.type === 'receber'
                          ? 'text-[#4ADE80]'
                          : 'text-neutral-200'
                      }`}
                    >
                      {entry.type === 'despesa' ? '- ' : '+ '}
                      {formatCurrencyBRL(entry.amount)}
                    </td>

                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onToggleEntryPaid(entry.id)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                            entry.status === 'pendente'
                              ? 'bg-[#D4AF37]/12 hover:bg-[#D4AF37] text-[#E8C96D] hover:text-[#090A0D] border border-[#D4AF37]/30'
                              : 'bg-white/[0.05] hover:bg-white/[0.1] text-neutral-300'
                          }`}
                        >
                          {entry.status === 'pendente' ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              {entry.type === 'receber' ? 'Receber' : 'Pagar'}
                            </>
                          ) : (
                            <>
                              <RotateCcw className="w-3.5 h-3.5" />
                              Estornar
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteEntry(entry.id)}
                          aria-label={`Excluir lançamento ${entry.description}`}
                          className="p-1.5 text-neutral-500 hover:text-[#F87171] rounded-lg hover:bg-white/[0.05]"
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
      </div>

      {/* Modal: New Financial Entry */}
      <Modal
        open={modalOpen}
        title="Novo Lançamento Financeiro"
        subtitle="Atualize contas a receber, despesas previstas e fluxo projetado."
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="fin-type" className="block text-xs text-neutral-300 mb-1">
                Tipo
              </label>
              <select
                id="fin-type"
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as FinancialEntryType })
                }
                className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white"
              >
                <option value="receber">Conta a receber</option>
                <option value="despesa">Despesa operacional</option>
              </select>
            </div>
            <div>
              <label htmlFor="fin-date" className="block text-xs text-neutral-300 mb-1">
                Vencimento
              </label>
              <input
                id="fin-date"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono bg-[#171A22] border border-white/[0.1] rounded-lg text-white"
              />
            </div>
          </div>

          <div>
            <label htmlFor="fin-desc" className="block text-xs text-neutral-300 mb-1">
              Descrição *
            </label>
            <input
              id="fin-desc"
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Ex: Parcela de implantação ou software mensal"
              className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="fin-amount" className="block text-xs text-neutral-300 mb-1">
                Valor (R$) *
              </label>
              <input
                id="fin-amount"
                type="number"
                min="1"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono bg-[#171A22] border border-white/[0.1] rounded-lg text-white"
              />
            </div>
            <div>
              <label htmlFor="fin-cat" className="block text-xs text-neutral-300 mb-1">
                Categoria
              </label>
              <input
                id="fin-cat"
                type="text"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white"
              />
            </div>
          </div>

          {formError && <p className="text-xs text-[#F87171]">{formError}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-xs text-neutral-300 bg-white/[0.05] hover:bg-white/[0.09] rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold bg-[#D4AF37] hover:bg-[#E8C96D] text-[#090A0D] rounded-lg"
            >
              Salvar lançamento
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
