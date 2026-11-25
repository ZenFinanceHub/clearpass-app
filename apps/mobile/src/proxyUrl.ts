import { appConfig } from './appConfig';

// Production: __DEV__ -> http://localhost:3001, release -> the production
// Railway server (unchanged). Local: EXPO_PUBLIC_API_URL or localhost:3001.
// Staging: EXPO_PUBLIC_API_URL (required). See src/appEnv.ts.
export function getProxyUrl(): string {
  return appConfig.apiUrl;
}
