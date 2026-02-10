export const previewStates = [
  'queued',
  'instant_ready',
  'enriching',
  'ai_enriched',
  'qa_warning',
  'failed',
  'sent',
  'viewed',
  'promoted',
  'expired',
  'revoked',
] as const;

export type PreviewState = (typeof previewStates)[number];

const previewTransitions = {
  queued: ['instant_ready'],
  instant_ready: ['enriching', 'qa_warning', 'revoked', 'expired'],
  enriching: ['ai_enriched', 'qa_warning', 'revoked', 'expired', 'failed'],
  ai_enriched: ['sent', 'qa_warning', 'revoked', 'expired'],
  qa_warning: ['revoked', 'expired'],
  failed: [],
  sent: ['viewed'],
  viewed: ['promoted'],
  promoted: [],
  expired: [],
  revoked: [],
} as const satisfies Record<PreviewState, readonly PreviewState[]>;

export class PreviewStateConflictError extends Error {
  readonly code = 'PREVIEW_STATE_CONFLICT';

  constructor(
    readonly current: PreviewState,
    readonly next: PreviewState,
  ) {
    super(`PREVIEW_STATE_CONFLICT: cannot transition preview from ${current} to ${next}`);
    this.name = 'PreviewStateConflictError';
  }
}

export function assertPreviewTransition(current: PreviewState, next: PreviewState): void {
  const allowedTransitions: readonly PreviewState[] = previewTransitions[current];
  if (!allowedTransitions.includes(next)) {
    throw new PreviewStateConflictError(current, next);
  }
}
