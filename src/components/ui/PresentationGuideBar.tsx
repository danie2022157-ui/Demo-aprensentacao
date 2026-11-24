import React from 'react';
import { ChevronLeft, ChevronRight, Presentation, X, ArrowUpRight } from 'lucide-react';
import { NavSection } from '../../types/crm';

export interface PresentationStep {
  id: number;
  minuteLabel: string;
  title: string;
  scriptPrompt: string;
  targetSection: NavSection;
  actionHint: string;
  opensDiagnosticModal?: boolean;
}

export const PRESENTATION_STEPS: PresentationStep[] = [
  {
    id: 1,
    minuteLabel: 'Minuto 1 · Diagnóstico',
    title: 'Abrir com a dor real da empresa',
    scriptPrompt:
      '“Hoje, como vocês controlam os clientes que pedem orçamento e não retornam?”',
    targetSection: 'simulador',
    actionHint: 'Usar o Simulador com números reais do empresário',
  },
  {
    id: 2,
    minuteLabel: 'Minuto 2 · Mostrar o problema',
    title: 'Evidenciar oportunidades esquecidas e atrasos',
    scriptPrompt:
      'Mostrar no Dashboard quais oportunidades estão paradas, há quantos dias e quantos orçamentos venceram sem retorno.',
    targetSection: 'dashboard',
    actionHint: 'Apontar o painel de Atenção Imediata e Central de Follow-up',
  },
  {
    id: 3,
    minuteLabel: 'Minutos 3 e 4 · Mostrar a solução',
    title: 'Fluxo vivo: cliente → funil → orçamento → follow-up',
    scriptPrompt:
      'Mover uma oportunidade no funil para demonstrar a criação automática do follow-up e o controle de propostas enviadas.',
    targetSection: 'funil',
    actionHint: 'Avançar uma oportunidade ou abrir Orçamentos',
  },
  {
    id: 4,
    minuteLabel: 'Minuto 5 · Mostrar inteligência',
    title: 'Follow-up contextualizado com revisão humana',
    scriptPrompt:
      'Demonstrar a sugestão de abordagem contextualizada — sempre revisada pelo vendedor antes do envio, sem disparo robótico.',
    targetSection: 'orcamentos',
    actionHint: 'Clicar em “Sugestão IA” em um orçamento sem retorno',
  },
  {
    id: 5,
    minuteLabel: 'Minuto 6 · Personalizar',
    title: 'Adaptar regras, recorrência e visão financeira',
    scriptPrompt:
      'Mostrar como etapas, intervalos de retorno e previsibilidade de caixa se adaptam ao processo real da empresa.',
    targetSection: 'financeiro',
    actionHint: 'Explorar Financeiro e Regras Inteligentes',
  },
  {
    id: 6,
    minuteLabel: 'Minuto 7 · Próximo passo comercial',
    title: 'Propor diagnóstico operacional e implantação',
    scriptPrompt:
      'Oferecer o diagnóstico operacional com escopo, etapas e investimento definidos para a operação do cliente.',
    targetSection: 'simulador',
    actionHint: 'Abrir formulário de Solicitar Diagnóstico',
    opensDiagnosticModal: true,
  },
];

interface PresentationGuideBarProps {
  open: boolean;
  stepIndex: number;
  onSelectStep: (idx: number) => void;
  onClose: () => void;
  onOpenDiagnosticModal: () => void;
}

export const PresentationGuideBar: React.FC<PresentationGuideBarProps> = ({
  open,
  stepIndex,
  onSelectStep,
  onClose,
  onOpenDiagnosticModal,
}) => {
  if (!open) return null;

  const step = PRESENTATION_STEPS[stepIndex] ?? PRESENTATION_STEPS[0];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === PRESENTATION_STEPS.length - 1;

  return (
    <aside
      aria-label="Roteiro do modo de apresentação comercial"
      className="fixed bottom-4 left-4 right-4 lg:left-[256px] z-40 max-w-4xl mx-auto bg-[#12141B]/95 backdrop-blur-md border border-[#D4AF37]/40 rounded-xl shadow-2xl px-4 py-3.5"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs">
            <Presentation className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
            <span className="font-semibold text-[#E8C96D] font-mono tabular-nums">
              {step.minuteLabel}
            </span>
            <span className="text-neutral-600">·</span>
            <span className="font-medium text-white truncate">{step.title}</span>
          </div>
          <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
            {step.scriptPrompt}{' '}
            <span className="text-neutral-400">({step.actionHint})</span>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {step.opensDiagnosticModal && (
            <button
              type="button"
              onClick={onOpenDiagnosticModal}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-[#D4AF37] hover:bg-[#E8C96D] text-[#090A0D] rounded-lg whitespace-nowrap"
            >
              Solicitar diagnóstico
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            disabled={isFirst}
            onClick={() => onSelectStep(stepIndex - 1)}
            aria-label="Etapa anterior da apresentação"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-neutral-200 bg-white/[0.06] hover:bg-white/[0.12] disabled:opacity-30 rounded-lg"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Anterior
          </button>
          <span className="text-xs font-mono tabular-nums text-neutral-400 px-1">
            {stepIndex + 1}/{PRESENTATION_STEPS.length}
          </span>
          <button
            type="button"
            disabled={isLast}
            onClick={() => onSelectStep(stepIndex + 1)}
            aria-label="Próxima etapa da apresentação"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#090A0D] bg-[#D4AF37] hover:bg-[#E8C96D] disabled:opacity-30 rounded-lg"
          >
            Próximo
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Encerrar modo apresentação"
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/[0.06]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
