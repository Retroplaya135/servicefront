import { describe, expect, test } from 'vitest';
import { assertPreviewTransition, previewStates, type PreviewState } from '../src/preview-state.js';

const allowedTransitions: Array<[PreviewState, PreviewState]> = [
  ['queued', 'instant_ready'],
  ['instant_ready', 'enriching'],
  ['enriching', 'ai_enriched'],
  ['ai_enriched', 'sent'],
  ['sent', 'viewed'],
  ['viewed', 'promoted'],
  ['instant_ready', 'qa_warning'],
  ['instant_ready', 'revoked'],
  ['instant_ready', 'expired'],
  ['enriching', 'qa_warning'],
  ['enriching', 'revoked'],
  ['enriching', 'expired'],
  ['ai_enriched', 'qa_warning'],
  ['ai_enriched', 'revoked'],
  ['ai_enriched', 'expired'],
  ['enriching', 'failed'],
  ['qa_warning', 'revoked'],
  ['qa_warning', 'expired'],
];

describe('assertPreviewTransition', () => {
  test.each(allowedTransitions)('allows %s to %s', (current, next) => {
    expect(() => assertPreviewTransition(current, next)).not.toThrow();
  });

  test.each(['failed', 'promoted', 'expired', 'revoked'] satisfies PreviewState[])(
    'rejects every outgoing transition from terminal state %s',
    (terminalState) => {
      for (const nextState of previewStates) {
        expect(() => assertPreviewTransition(terminalState, nextState)).toThrow(/PREVIEW_STATE_CONFLICT/);
      }
    },
  );
});
