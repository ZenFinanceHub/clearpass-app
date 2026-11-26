// Mirrors src/conversion.ts hasFreeMockLeft (FREE_MOCK_ALLOWANCE = 1) and
// src/subscription.ts FREE_QUESTION_LIMIT (10). Those modules import
// @clearpass/content / Supabase, so they can't load under plain Node; the
// screen passes the real values in. homeViewModel.test.mjs guards drift.
export const hasFreeMockLeft = (progress) => (progress?.mockTestHistory?.length ?? 0) < 1;
export const FREE_QUESTION_LIMIT = 10;
