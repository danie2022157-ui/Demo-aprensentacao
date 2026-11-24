import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  Send,
  CalendarPlus,
  ArrowDownToLine,
  RotateCcw,
} from 'lucide-react';
import { ConversationChannel } from '../../types/crm';
import {
  ClientHistoryApproachSuggestion,
  formatCurrencyBRL,
} from '../../lib/crm-engine';

interface ClientHistoryAiSuggestionProps {
  suggestion: ClientHistoryApproachSuggestion;
  onUseInForm: (channel: ConversationChannel, message: string) => void;
  onRegisterManualSend: (channel: ConversationChannel, message: string) => void;
  onScheduleFollowUp: (suggestion: ClientHistoryApproachSuggestion) => void;
}

const CHANNEL_LABELS: Record<ConversationChannel, string> = {
  whatsapp: 'WhatsApp',
  telefone: 'Telefone',
  email: 'E-mail',
  reuniao: 'Reunião',
};

const DIRECTION_LABELS: Record<'enviado' | 'recebido' | 'interno', string> = {
  enviado: 'Enviado',
  recebido: 'Recebido',
  interno: 'Interno',
};

export const ClientHistoryAiSuggestion: React.FC<
  ClientHistoryAiSuggestionProps
> = ({
  suggestion,
  onUseInForm,
  onRegisterManualSend,
  onScheduleFollowUp,
}) => {
  const [draft, setDraft] = useState(suggestion.suggestedMessage);
  const [channel, setChannel] = useState<ConversationChannel>(
    suggestion.recommendedChannel
  );
  const [copied, setCopied] = useState(false);

  // Sync draft & channel whenever client, funnel stage, or latest history changes
  useEffect(() => {
    setDraft(suggestion.suggestedMessage);
    setChannel(suggestion.recommendedChannel);
    setCopied(false);
  }, [
    suggestion.clientId,
    suggestion.stageId,
    suggestion.suggestedMessage,
    suggestion.recommendedChannel,
  ]);

  const isEdited = draft.trim() !== suggestion.suggestedMessage.trim();

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(draft).catch(() => {});
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const lastContactLabel =
    suggestion.daysSinceLastContact === null
      ? 'Sem registros'
      : suggestion.daysSinceLastContact === 0
      ? 'Hoje'
      : `Há ${suggestion.daysSinceLastContact}d`;

  const lastContactMeta =
    suggestion.lastInteractionChannel && suggestion.lastInteractionDirection
      ? `${CHANNEL_LABELS[suggestion.lastInteractionChannel]} (${
          DIRECTION_LABELS[suggestion.lastInteractionDirection]
        })`
      : 'Primeiro contato';

  return (
    <section
      aria-label="Sugestão de IA para próxima abordagem"
      data-testid="client-ai-suggestion-panel"
      className="bg-[#151822] border border-[#D4AF37]/30 rounded-xl p-4 space-y-3.5"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="w-3.5 h-3.5 text-[#E8C96D]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-white">
              Sugestão de IA · Próxima abordagem
            </h3>
            <p className="text-[11px] text-[#E8C96D]/90 mt-0.5">
              Baseada no status do funil, histórico do cliente e motor de regras
            </p>
          </div>
        </div>
        <span className="text-[11px] font-medium text-neutral-400 whitespace-nowrap shrink-0">
          Revisão manual
        </span>
      </div>

      {/* Rules Engine Context Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-[#101218] border border-white/[0.06] rounded-lg p-3 text-[11px]">
        <div className="min-w-0">
          <p className="text-neutral-500">Etapa no funil</p>
          <p
            data-testid="ai-suggestion-stage"
            className="text-neutral-100 font-medium truncate mt-0.5"
          >
            {suggestion.stageLabel}
          </p>
          {suggestion.opportunityValue ? (
            <p className="font-mono tabular-nums text-[#E8C96D] mt-0.5">
              {formatCurrencyBRL(suggestion.opportunityValue)}
            </p>
          ) : null}
        </div>

        <div className="min-w-0">
          <p className="text-neutral-500">Regra aplicada</p>
          <p
            data-testid="ai-suggestion-rule"
            className="text-neutral-100 font-medium truncate mt-0.5"
          >
            {suggestion.matchedRuleName ?? 'Cadência padrão'}
          </p>
          <p className="font-mono tabular-nums text-neutral-400 mt-0.5">
            {suggestion.matchedRuleName
              ? `${suggestion.matchedRuleActive ? 'Ativa' : 'Pausada'} · +${suggestion.suggestedFollowUpDelayDays}d`
              : `Retorno +${suggestion.suggestedFollowUpDelayDays}d`}
          </p>
        </div>

        <div className="min-w-0">
          <p className="text-neutral-500">Última interação</p>
          <p
            data-testid="ai-suggestion-last-contact"
            className="text-neutral-100 font-medium font-mono tabular-nums mt-0.5"
          >
            {lastContactLabel}
          </p>
          <p className="text-neutral-400 truncate mt-0.5">{lastContactMeta}</p>
        </div>
      </div>

      {/* Diagnosis & Recommended Next Action */}
      <div className="space-y-1.5">
        <p
          data-testid="ai-suggestion-headline"
          className="text-xs font-semibold text-[#E8C96D]"
        >
          {suggestion.headline}
        </p>
        <p className="text-xs text-neutral-300 leading-relaxed">
          {suggestion.rationale}
        </p>
        <p className="text-[11px] text-neutral-200 pt-0.5">
          <span className="text-neutral-400">Próximo passo recomendado:</span>{' '}
          <span className="font-medium">{suggestion.recommendedAction}</span>
        </p>
      </div>

      {/* Editable Message Draft */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="client-ai-suggestion-draft"
            className="text-[11px] font-medium text-neutral-300"
          >
            Abordagem sugerida (editável antes de usar)
          </label>
          <div className="flex items-center gap-2">
            {isEdited && (
              <button
                type="button"
                onClick={() => setDraft(suggestion.suggestedMessage)}
                className="inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white"
              >
                <RotateCcw className="w-3 h-3" />
                Restaurar
              </button>
            )}
            <label htmlFor="client-ai-channel" className="sr-only">
              Canal da abordagem sugerida
            </label>
            <select
              id="client-ai-channel"
              value={channel}
              onChange={(e) =>
                setChannel(e.target.value as ConversationChannel)
              }
              className="px-2 py-1 text-[11px] bg-[#101218] border border-white/[0.08] rounded-md text-neutral-200 focus:outline-none focus:border-[#D4AF37]/60"
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="telefone">Telefone</option>
              <option value="email">E-mail</option>
              <option value="reuniao">Reunião</option>
            </select>
          </div>
        </div>

        <textarea
          id="client-ai-suggestion-draft"
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full px-3 py-2 text-xs bg-[#101218] border border-white/[0.08] rounded-lg text-neutral-100 leading-relaxed focus:outline-none focus:border-[#D4AF37]/70"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <button
          type="button"
          onClick={() => {
            if (!draft.trim()) return;
            onRegisterManualSend(channel, draft.trim());
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#D4AF37] hover:bg-[#E8C96D] text-[#090A0D] rounded-lg transition-colors whitespace-nowrap"
        >
          <Send className="w-3.5 h-3.5" />
          Registrar envio manual
        </button>

        <button
          type="button"
          onClick={() => onUseInForm(channel, draft.trim())}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-200 bg-white/[0.06] hover:bg-white/[0.11] rounded-lg transition-colors whitespace-nowrap"
        >
          <ArrowDownToLine className="w-3.5 h-3.5" />
          Usar no registro
        </button>

        <button
          type="button"
          onClick={() => onScheduleFollowUp(suggestion)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#E8C96D] bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 border border-[#D4AF37]/25 rounded-lg transition-colors whitespace-nowrap"
        >
          <CalendarPlus className="w-3.5 h-3.5" />
          Agendar follow-up (+{suggestion.suggestedFollowUpDelayDays}d)
        </button>

        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copiar texto da sugestão de IA"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-neutral-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors whitespace-nowrap ml-auto"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-[#4ADE80]" />
              Copiado
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copiar
            </>
          )}
        </button>
      </div>

      <p className="text-[11px] text-neutral-500 leading-relaxed">
        Sugestão gerada localmente pelo motor de regras. Nenhuma mensagem é enviada automaticamente sem revisão e confirmação humana.
      </p>
    </section>
  );
};
