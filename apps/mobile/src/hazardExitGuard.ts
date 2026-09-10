// Bridges the hazard-clip exit confirmation between app/(tabs)/_layout.tsx
// and app/(tabs)/hazard.tsx — same reasoning as mockTestExitGuard.ts.
// Switching tabs is a focus change, not a route removal, so React
// Navigation's beforeRemove/usePreventRemove never fires for it — there is
// no per-screen event that fires when a different tab is pressed. The tab
// bar tap is intercepted centrally in _layout.tsx's screenListeners and,
// while a hazard clip is playing (or its solution is), redirected into
// hazard.tsx's own exit-confirmation modal via this shared object instead.
export type HazardExitGuard = {
  active: boolean;
  routeKey: string | null;
  requestExit: ((onConfirmed?: () => void) => void) | null;
};

export const hazardExitGuard: HazardExitGuard = {
  active: false,
  routeKey: null,
  requestExit: null,
};
