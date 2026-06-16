const RAILWAY = 'https://clearpass-app-production.up.railway.app';

export function getProxyUrl(): string {
  return __DEV__ ? 'http://localhost:3001' : RAILWAY;
}
