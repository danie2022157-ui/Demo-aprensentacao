import { CrmState } from '../types/crm';
import { createDemoState } from './demo-data';

const STORAGE_KEY = 'onethy_crm_demo_state_v1';

export function loadCrmState(): CrmState {
  if (typeof window === 'undefined') {
    return createDemoState();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createDemoState();
    }
    const parsed = JSON.parse(raw) as Partial<CrmState>;
    if (
      !parsed ||
      !Array.isArray(parsed.clients) ||
      !Array.isArray(parsed.opportunities) ||
      !Array.isArray(parsed.tasks)
    ) {
      return createDemoState();
    }
    const fallback = createDemoState();
    return {
      ...fallback,
      ...parsed,
      proposals: Array.isArray(parsed.proposals)
        ? parsed.proposals
        : fallback.proposals,
      financialEntries: Array.isArray(parsed.financialEntries)
        ? parsed.financialEntries
        : fallback.financialEntries,
      diagnosticRequests: Array.isArray(parsed.diagnosticRequests)
        ? parsed.diagnosticRequests
        : fallback.diagnosticRequests,
    };
  } catch {
    return createDemoState();
  }
}

export function saveCrmState(state: CrmState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors in sandboxed browsers
  }
}

export function resetCrmState(): CrmState {
  const fresh = createDemoState();
  saveCrmState(fresh);
  return fresh;
}
