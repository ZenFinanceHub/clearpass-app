/**
 * P1-2 ListRow: the accessibility contract, PURE so plain Node tests it
 * (scripts/lib/listRow.test.mjs). ListRow.tsx renders from this.
 */

/** 48pt rows (spec: 44/48pt targets; list rows use the larger). */
export const LIST_ROW_MIN_HEIGHT = 48;

export interface ListRowSemanticsInput {
  title: string;
  subtitle?: string | null;
  /** Right-aligned value (a score, a date). */
  value?: string | null;
  /** True when the row has an onPress. */
  pressable?: boolean;
  /** Shown instead of the subtitle; disables the row (e.g. "Requires internet"). */
  disabledNote?: string | null;
  /** Hide the chevron on a pressable row. */
  chevron?: boolean;
  accessibilityLabel?: string;
}

export interface ListRowSemantics {
  role: 'button' | 'text';
  label: string;
  state: { disabled: boolean };
  minHeight: number;
  showChevron: boolean;
}

export function listRowSemantics(p: ListRowSemanticsInput): ListRowSemantics {
  const disabled = !!p.disabledNote;
  const parts = [p.title, disabled ? p.disabledNote : p.subtitle, disabled ? null : p.value]
    .map((x) => (x ?? '').trim())
    .filter((x) => x.length > 0);
  const pressable = !!p.pressable;
  return {
    role: pressable ? 'button' : 'text',
    label: p.accessibilityLabel ?? parts.join('. '),
    state: { disabled },
    minHeight: LIST_ROW_MIN_HEIGHT,
    showChevron: pressable && !disabled && p.chevron !== false,
  };
}
