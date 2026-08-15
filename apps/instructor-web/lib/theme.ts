// Copied from apps/mobile/src/constants/theme.ts — values only, not imported.
// apps/instructor-web is deliberately self-contained (see apps/mobile/
// server/README.md): importing this file directly would reach across the
// same deployment boundary that caused two production incidents. If the
// mobile app's palette changes, this needs updating by hand to match.
export const Colors = {
  indigo: "#4F46E5",
  indigoBg: "#EDE9FE",
  indigoText: "#3730A3", // darker than indigo — for small text on indigoBg, not in the source file

  emerald: "#10B981",
  emeraldBg: "#D1FAE5",
  emeraldText: "#065F46", // darker than emerald — for small text on emeraldBg, not in the source file

  red: "#EF4444",
  redBg: "#FEE2E2",
  redText: "#991B1B", // darker than red — for small text on redBg, not in the source file

  textPrimary: "#111827",
  textDark: "#374151",
  mutedText: "#6B7280",
  subtleText: "#9CA3AF",
  cardWhite: "#FFFFFF",
  offWhite: "#F7F8FA",
  border: "#E5E7EB",
} as const;
