import React, { useState } from 'react';
import { CheckCircle2, Copy } from 'lucide-react';
import { DiagnosticSubmission } from '../../types/crm';
import { formatCurrencyBRL } from '../../lib/crm-engine';
import { Modal } from './Modal';

interface DiagnosticRequestModalProps {
  open: boolean;
  onClose: () => void;
  simulatedPotential: number;
  simulatedRecovery: number;
  onSubmit: (submission: Omit<DiagnosticSubmission, 'id' | 'createdAt'>) => void;
}

const PAIN_OPTIONS = [
  'Clientes entram em contato e ficam sem acompanhamento',
  'Orçamentos enviados sem retorno ou controle de prazo',
  'Informações espalhadas em WhatsApp e planilhas',
  'Falta de visibilidade financeira e fluxo previsto',
  'Tarefas e prazos da equipe esquecidos',
  'Falta de clareza sobre onde a empresa perde vendas',
];

export const DiagnosticRequestModal: React.FC<DiagnosticRequestModalProps> = ({
  open,
  onClose,
  simulatedPotential,
  simulatedRecovery,
  onSubmit,
}) => {
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [segment, setSegment] = useState('');
  const [mainPain, setMainPain] = useState(PAIN_OPTIONS[0]);
  const [error, setError] = useState<string | null>(null);
  const [submittedSummary, setSubmittedSummary] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleClose = () => {
    setSubmittedSummary(null);
    setError(null);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !contactName.trim() || !whatsapp.trim()) {
      setError('Preencha nome da empresa, responsável e WhatsApp de contato.');
      return;
    }

    onSubmit({
      companyName: companyName.trim(),
      contactName: contactName.trim(),
      whatsapp: whatsapp.trim(),
      segment: segment.trim() || 'Não informado',
      mainPain,
      simulatedPotential,
      simulatedRecovery,
    });

    const summaryText = [
      `Solicitação de Diagnóstico Operacional — Onethy`,
      `Empresa: ${companyName.trim()} (${segment.trim() || 'Segmento geral'})`,
      `Contato: ${contactName.trim()} · WhatsApp: ${whatsapp.trim()}`,
      `Principal dor: ${mainPain}`,
      `Simulação local: ${formatCurrencyBRL(simulatedPotential)}/mês em valor potencial associado · ${formatCurrencyBRL(simulatedRecovery)}/mês em cenário hipotético de recuperação.`,
    ].join('\n');

    setSubmittedSummary(summaryText);
    setCompanyName('');
    setContactName('');
    setWhatsapp('');
    setSegment('');
    setError(null);
  };

  return (
    <Modal
      open={open}
      title="Solicitar Diagnóstico Operacional Onethy"
      subtitle="Mapeamento da sua operação comercial com proposta de implantação, escopo e prazo definidos."
      onClose={handleClose}
      maxWidthClass="max-w-lg"
    >
      {submittedSummary ? (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-[#22C55E]/[0.1] border border-[#22C55E]/30 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#4ADE80] shrink-0 mt-0.5" />
            <div className="text-xs text-neutral-200 leading-relaxed">
              <p className="font-semibold text-white">
                Solicitação registrada na sessão de demonstração!
              </p>
              <p className="mt-1 text-neutral-300">
                Como esta demonstração opera com dados locais (sem envio automático para servidores externos), você pode copiar o resumo estruturado abaixo para encaminhar à equipe Onethy.
              </p>
            </div>
          </div>

          <pre className="p-3.5 rounded-lg bg-[#171A22] border border-white/[0.08] text-xs text-neutral-200 whitespace-pre-wrap font-sans leading-relaxed">
            {submittedSummary}
          </pre>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => {
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(submittedSummary).catch(() => {});
                }
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-neutral-200 bg-white/[0.06] hover:bg-white/[0.1] rounded-lg"
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? 'Resumo copiado!' : 'Copiar resumo'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-semibold bg-[#D4AF37] hover:bg-[#E8C96D] text-[#090A0D] rounded-lg"
            >
              Fechar resumo
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3.5 rounded-lg bg-[#171A22] border border-[#D4AF37]/25 text-xs text-neutral-300 flex items-center justify-between gap-3">
            <span>Simulação anexada ao diagnóstico</span>
            <span className="font-mono tabular-nums text-[#E8C96D] font-medium">
              {formatCurrencyBRL(simulatedPotential)} potencial ·{' '}
              {formatCurrencyBRL(simulatedRecovery)} hipotético
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="diag-company" className="block text-xs text-neutral-300 mb-1">
                Nome da empresa *
              </label>
              <input
                id="diag-company"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ex: Clínica Vitalis"
                className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <label htmlFor="diag-contact" className="block text-xs text-neutral-300 mb-1">
                Seu nome *
              </label>
              <input
                id="diag-contact"
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Ex: Daniel Souza"
                className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <label htmlFor="diag-whatsapp" className="block text-xs text-neutral-300 mb-1">
                WhatsApp para retorno *
              </label>
              <input
                id="diag-whatsapp"
                type="text"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="(11) 99999-0000"
                className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <label htmlFor="diag-segment" className="block text-xs text-neutral-300 mb-1">
                Segmento
              </label>
              <input
                id="diag-segment"
                type="text"
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                placeholder="Ex: Serviços B2B, Clínica, Engenharia"
                className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="diag-pain" className="block text-xs text-neutral-300 mb-1">
              Principal gargalo hoje
            </label>
            <select
              id="diag-pain"
              value={mainPain}
              onChange={(e) => setMainPain(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#171A22] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
            >
              {PAIN_OPTIONS.map((pain) => (
                <option key={pain} value={pain}>
                  {pain}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-xs text-[#F87171]">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs text-neutral-300 bg-white/[0.05] hover:bg-white/[0.09] rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold bg-[#D4AF37] hover:bg-[#E8C96D] text-[#090A0D] rounded-lg"
            >
              Registrar solicitação
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
