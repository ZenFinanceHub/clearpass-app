// Bridges the mock-test exit confirmation between app/(tabs)/_layout.tsx and
// app/(tabs)/mock.tsx. Switching tabs is a focus change, not a route removal,
// so React Navigation's beforeRemove/usePreventRemove never fires for it —
// there is no per-screen event that fires when a DIFFERENT tab is pressed.
// The tab bar tap is intercepted centrally in _layout.tsx's screenListeners
// and, while a mock test is in progress, redirected into mock.tsx's own
// exit-confirmation modal via this shared object instead.
export type MockTestExitGuard = {
  active: boolean;
  routeKey: string | null;
  requestExit: ((onConfirmed?: () => void) => void) | null;
};

export const mockTestExitGuard: MockTestExitGuard = {
  active: false,
  routeKey: null,
  requestExit: null,
};
