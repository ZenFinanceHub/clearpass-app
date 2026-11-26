// Mirrors src/conversion.ts hasFreeMockLeft (FREE_MOCK_ALLOWANCE = 1). That
// module imports @clearpass/content, so it can't load under plain Node; the
// screen calls the real function and passes the boolean in.
export const hasFreeMockLeft = (progress) => (progress?.mockTestHistory?.length ?? 0) < 1;
