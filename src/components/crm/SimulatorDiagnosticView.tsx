import React from 'react';
import {
  Calculator,
  ArrowRight,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
} from 'lucide-react';
import { CrmState, LOSS_REASON_LABELS, NavSection } from '../../types/crm';
import {
  calculateLossSimulator,
  computeFinancialSummary,
  computeProposalMetrics,
  computeStalledOpportunities,
  formatCurrencyBRL,
  LossSimulatorInput,
} from '../../lib/crm-engine';

interface SimulatorDiagnosticViewProps {
  state: CrmState;
  simInput: LossSimulatorInput;
  onChangeSimInput: (next: LossSimulatorInput) => void;
  onRequestDiagnostic: () => void;
  onNavigate: (section: NavSection) => void;
}

export const SimulatorDiagnosticView: React.FC<SimulatorDiagnosticViewProps> = ({
  state,
  simInput,
  onChangeSimInput,
  onRequestDiagnostic,
  onNavigate,
}) => {
  const simOutput = calculateLossSimulator(simInput);
  const stalled = computeStalledOpportunities(state);
  const proposalMetrics = computeProposalMetrics(state);
  const financial = computeFinancialSummary(state);

  const unattendedValue = stalled
    .filter((s) => !s.hasPendingFollowUp)
    .reduce((sum, s) => sum + s.opportunity.value, 0);

  return (
    <div className="space-y-6">
      {/* Strategic Framing Banner */}
      <section className="bg-[#12141A] border border-[#D4AF37]/25 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="max-w-3xl">
          <p className="text-xs font-medium text-[#E8C96D]">
            Onethy · Inteligência operacional para empresas
          </p>
          <h2 className="text-xl font-semibold text-white mt-1">
            Diagnóstico de perdas e oportunidades não acompanhadas
          </h2>
          <p className="text-xs sm:text-sm text-neutral-300 mt-1.5 leading-relaxed">
            Informe os números aproximados da sua operação comercial para estimar quantos contatos esfriam por falta de acompanhamento estruturado e o impacto hipotético de organizar o follow-up.
          </p>
        </div>
        <button
          type="button"
          onClick={onRequestDiagnostic}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold bg-[#D4AF37] hover:bg-[#E8C96D] text-[#090A0D] rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          Solicitar diagnóstico operacional
          <ArrowRight className="w-4 h-4" />
        </button>
      </section>

      {/* Main Split: Interactive Loss Simulator + Real-Time Result Card */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Inputs */}
        <div className="lg:col-span-7 bg-[#12141A] border border-white/[0.07] rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-white/[0.07]">
            <Calculator className="w-4 h-4 text-[#D4AF37]" />
            <h3 className="text-sm font-semibold text-white">
              Simulador de oportunidades não acompanhadas
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <label htmlFor="sim-contacts" className="text-neutral-300">
                  Contatos recebidos por mês
                </label>
                <span className="font-mono tabular-nums text-[#E8C96D] font-medium">
                  {simInput.contactsPerMonth}
                </span>
              </div>
              <input
                id="sim-contacts"
                type="number"
                min="0"
                max="10000"
                value={simInput.contactsPerMonth}
                onChange={(e) =>
                  onChangeSimInput({
                    ...simInput,
                    contactsPerMonth: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#171A22] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <label htmlFor="sim-proposals" className="text-neutral-300">
                  Orçamentos enviados por mês
                </label>
                <span className="font-mono tabular-nums text-neutral-300">
                  {simInput.proposalsPerMonth}
                </span>
              </div>
              <input
                id="sim-proposals"
                type="number"
                min="0"
                max="10000"
                value={simInput.proposalsPerMonth}
                onChange={(e) =>
                  onChangeSimInput({
                    ...simInput,
                    proposalsPerMonth: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#171A22] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <label htmlFor="sim-unfollowed" className="text-neutral-300">
                  Sem acompanhamento (%)
                </label>
                <span className="font-mono tabular-nums text-[#F87171] font-medium">
                  {simInput.unfollowedPct}%
                </span>
              </div>
              <input
                id="sim-unfollowed"
                type="range"
                min="5"
                max="80"
                step="1"
                value={simInput.unfollowedPct}
                onChange={(e) =>
                  onChangeSimInput({
                    ...simInput,
                    unfollowedPct: Number(e.target.value),
                  })
                }
                className="w-full accent-[#D4AF37]"
              />
              <div className="flex justify-between text-[11px] font-mono text-neutral-500 mt-1">
                <span>5%</span>
                <span>40%</span>
                <span>80%</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <label htmlFor="sim-ticket" className="text-neutral-300">
                  Valor médio de venda (R$)
                </label>
                <span className="font-mono tabular-nums text-neutral-200">
                  {formatCurrencyBRL(simInput.avgTicket)}
                </span>
              </div>
              <input
                id="sim-ticket"
                type="number"
                min="0"
                step="50"
                value={simInput.avgTicket}
                onChange={(e) =>
                  onChangeSimInput({
                    ...simInput,
                    avgTicket: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#171A22] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <label htmlFor="sim-conv" className="text-neutral-300">
                  Conversão atual estimada (%)
                </label>
                <span className="font-mono tabular-nums text-neutral-300">
                  {simInput.currentConversionPct}%
                </span>
              </div>
              <input
                id="sim-conv"
                type="range"
                min="5"
                max="70"
                step="1"
                value={simInput.currentConversionPct}
                onChange={(e) =>
                  onChangeSimInput({
                    ...simInput,
                    currentConversionPct: Number(e.target.value),
                  })
                }
                className="w-full accent-[#D4AF37]"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <label htmlFor="sim-recovery" className="text-neutral-300">
                  Taxa hipotética de recuperação (%)
                </label>
                <span className="font-mono tabular-nums text-[#4ADE80] font-medium">
                  {simInput.hypotheticalRecoveryPct}%
                </span>
              </div>
              <input
                id="sim-recovery"
                type="range"
                min="5"
                max="60"
                step="1"
                value={simInput.hypotheticalRecoveryPct}
                onChange={(e) =>
                  onChangeSimInput({
                    ...simInput,
                    hypotheticalRecoveryPct: Number(e.target.value),
                  })
                }
                className="w-full accent-[#D4AF37]"
              />
            </div>
          </div>

          {/* Quick Scenario Presets */}
          <div className="pt-3 border-t border-white/[0.06] flex flex-wrap items-center gap-2 text-xs">
            <span className="text-neutral-400">Cenários rápidos:</span>
            <button
              type="button"
              onClick={() =>
                onChangeSimInput({
                  contactsPerMonth: 100,
                  proposalsPerMonth: 45,
                  unfollowedPct: 20,
                  avgTicket: 500,
                  currentConversionPct: 25,
                  hypotheticalRecoveryPct: 25,
                })
              }
              className="px-2.5 py-1 rounded-md bg-[#171A22] hover:bg-[#1F2430] border border-white/[0.08] text-neutral-200"
            >
              Serviços locais (R$ 500)
            </button>
            <button
              type="button"
              onClick={() =>
                onChangeSimInput({
                  contactsPerMonth: 80,
                  proposalsPerMonth: 40,
                  unfollowedPct: 30,
                  avgTicket: 2800,
                  currentConversionPct: 20,
                  hypotheticalRecoveryPct: 25,
                })
              }
              className="px-2.5 py-1 rounded-md bg-[#171A22] hover:bg-[#1F2430] border border-white/[0.08] text-neutral-200"
            >
              Comércio B2B (R$ 2.800)
            </button>
            <button
              type="button"
              onClick={() =>
                onChangeSimInput({
                  contactsPerMonth: 150,
                  proposalsPerMonth: 70,
                  unfollowedPct: 25,
                  avgTicket: 1200,
                  currentConversionPct: 22,
                  hypotheticalRecoveryPct: 20,
                })
              }
              className="px-2.5 py-1 rounded-md bg-[#171A22] hover:bg-[#1F2430] border border-white/[0.08] text-neutral-200"
            >
              Clínica / Estética (R$ 1.200)
            </button>
          </div>
        </div>

        {/* Outputs */}
        <div className="lg:col-span-5 bg-[#12141A] border border-[#D4AF37]/30 rounded-xl p-6 flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white">
              Exposição comercial estimada (mês)
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-[#171A22] border border-white/[0.06]">
                <p className="text-xs text-neutral-400">
                  Contatos sem acompanhamento
                </p>
                <p
                  data-testid="sim-unfollowed-contacts"
                  className="text-2xl font-semibold text-[#F87171] font-mono tabular-nums mt-1.5"
                >
                  {simOutput.unfollowedContacts}
                </p>
                <p className="text-[11px] text-neutral-500 mt-1">
                  ~{simOutput.unfollowedProposals} orçamentos sem retorno
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#171A22] border border-white/[0.06]">
                <p className="text-xs text-neutral-400">
                  Valor potencial associado
                </p>
                <p
                  data-testid="sim-potential-value"
                  className="text-2xl font-semibold text-white font-mono tabular-nums mt-1.5"
                >
                  {formatCurrencyBRL(simOutput.potentialAssociatedValue)}
                </p>
                <p className="text-[11px] text-neutral-500 mt-1">
                  Por mês sem cadência ativa
                </p>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-[#D4AF37]/[0.1] border border-[#D4AF37]/35">
              <p className="text-xs font-medium text-[#E8C96D]">
                Cenário hipotético de vendas recuperadas
              </p>
              <p
                data-testid="sim-recovered-sales"
                className="text-3xl font-semibold text-white font-mono tabular-nums mt-1.5"
              >
                {formatCurrencyBRL(simOutput.hypotheticalRecoveredSales)}
                <span className="text-xs font-sans font-normal text-neutral-400">
                  {' '}
                  / mês
                </span>
              </p>
              <p className="text-xs text-neutral-300 mt-2">
                Projeção hipotética em 12 meses:{' '}
                <span className="font-mono tabular-nums text-[#E8C96D] font-medium">
                  {formatCurrencyBRL(simOutput.annualHypotheticalValue)}
                </span>
              </p>
            </div>

            <p className="text-[11.5px] text-neutral-400 leading-relaxed">
              Estimativa baseada na taxa hipotética escolhida, não faturamento recuperado nem promessa de resultado.
            </p>
          </div>

          <button
            type="button"
            onClick={onRequestDiagnostic}
            className="w-full py-2.5 px-4 text-xs font-semibold bg-[#D4AF37] hover:bg-[#E8C96D] text-[#090A0D] rounded-lg transition-colors"
          >
            Levar estes números para um diagnóstico personalizado
          </button>
        </div>
      </section>

      {/* Bottlenecks Detected in Demo Operation + Brazilian Market Benchmark */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-[#12141A] border border-white/[0.07] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Gargalos detectados na operação fictícia atual
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Leitura automática dos pontos onde a empresa demonstração perde tração hoje
              </p>
            </div>
          </div>

          <div className="divide-y divide-white/[0.06] text-xs">
            <div className="py-3 flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-white flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B]" />
                  Oportunidades sem acompanhamento agendado
                </p>
                <p className="text-neutral-400 mt-0.5">
                  {stalled.filter((s) => !s.hasPendingFollowUp).length} negócios abertos sem tarefa futura ({formatCurrencyBRL(unattendedValue)})
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('funil')}
                className="text-[#E8C96D] hover:underline whitespace-nowrap"
              >
                Ver no funil
              </button>
            </div>

            <div className="py-3 flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-white flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#F87171]" />
                  Orçamentos com retorno vencido
                </p>
                <p className="text-neutral-400 mt-0.5">
                  {proposalMetrics.overdueCount} propostas sem retorno ({formatCurrencyBRL(proposalMetrics.overdueValue)})
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('orcamentos')}
                className="text-[#E8C96D] hover:underline whitespace-nowrap"
              >
                Abrir orçamentos
              </button>
            </div>

            <div className="py-3 flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-white flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-[#D4AF37]" />
                  Alertas financeiros de vencimento
                </p>
                <p className="text-neutral-400 mt-0.5">
                  {financial.overdueTotalCount} títulos vencidos · Fluxo projetado de {formatCurrencyBRL(financial.projectedCashBalance)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('financeiro')}
                className="text-[#E8C96D] hover:underline whitespace-nowrap"
              >
                Ver caixa
              </button>
            </div>

            {proposalMetrics.lossByReason.length > 0 && (
              <div className="pt-3">
                <p className="text-neutral-300 font-medium mb-2">
                  Principais motivos de perda registrados
                </p>
                <div className="space-y-1.5">
                  {proposalMetrics.lossByReason.map((item) => (
                    <div
                      key={item.reason}
                      className="flex items-center justify-between text-neutral-400"
                    >
                      <span>
                        {LOSS_REASON_LABELS[item.reason as keyof typeof LOSS_REASON_LABELS] ??
                          item.reason}
                      </span>
                      <span className="font-mono tabular-nums text-neutral-200">
                        {item.count} ({formatCurrencyBRL(item.value)})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Contexto de Mercado Brasileiro (Sebrae / Serasa) */}
        <div className="lg:col-span-5 bg-[#12141A] border border-white/[0.07] rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-white">
            Por que pequenas empresas perdem vendas no Brasil
          </h3>
          <p className="text-xs text-neutral-400 leading-relaxed">
            O problema raramente é falta de canais de contato — é falta de método entre o pedido de orçamento e o fechamento.
          </p>

          <div className="space-y-3 pt-1">
            <div className="p-3.5 rounded-lg bg-[#171A22] border border-white/[0.06]">
              <p className="text-xl font-semibold text-[#E8C96D] font-mono tabular-nums">
                80%+
              </p>
              <p className="text-xs text-neutral-300 mt-0.5">
                Dos pequenos negócios já atendem clientes pelo WhatsApp (Sebrae, visão 2026).
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-[#171A22] border border-white/[0.06]">
              <p className="text-xl font-semibold text-white font-mono tabular-nums">
                6%
              </p>
              <p className="text-xs text-neutral-300 mt-0.5">
                Dos micronegócios de serviços utilizam CRM organizado para acompanhar retornos (Sebrae).
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-[#171A22] border border-white/[0.06]">
              <p className="text-xl font-semibold text-white font-mono tabular-nums">
                59%
              </p>
              <p className="text-xs text-neutral-300 mt-0.5">
                Dos empreendedores apontam aumentar vendas como principal desafio comercial (Sebrae RS).
              </p>
            </div>
          </div>

          {state.diagnosticRequests.length > 0 && (
            <div className="pt-3 border-t border-white/[0.07]">
              <p className="text-xs font-medium text-[#4ADE80] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {state.diagnosticRequests.length} solicitação(ões) de diagnóstico registrada(s) nesta sessão
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
