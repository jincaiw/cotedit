export const DEFAULT_SELECTION_INSTANCE_HIGHLIGHT_DELAY = 0.5;
export const MAX_SELECTION_INSTANCE_HIGHLIGHT_DELAY = 10;
export const SELECTION_INSTANCE_HIGHLIGHT_DELAY_STEP = 0.25;

/** Normalize a persisted or UI-provided delay to CotEditor's 0.25-second step. */
export function normalizeSelectionInstanceHighlightDelay(value) {
  if (!Number.isFinite(value)) return DEFAULT_SELECTION_INSTANCE_HIGHLIGHT_DELAY;
  const bounded = Math.max(0, Math.min(MAX_SELECTION_INSTANCE_HIGHLIGHT_DELAY, value));
  const steps = Math.round(bounded / SELECTION_INSTANCE_HIGHLIGHT_DELAY_STEP);
  return Number((steps * SELECTION_INSTANCE_HIGHLIGHT_DELAY_STEP).toFixed(2));
}
