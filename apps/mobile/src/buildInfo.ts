import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

export type BuildInfo = {
  appVersion: string;
  buildNumber: string;
  updateId: string;
  publishedAt: string;
  channel: string;
  runtimeVersion: string;
  launchType: string;
};

// Expo Go / dev-client builds leave most of expo-updates' fields null (it's
// disabled there) and can leave the platform build number/version code
// unset too, depending on how the dev build was configured. Show this
// instead of a blank value so the row still reads as intentional.
const DEV_FALLBACK = 'Development build';

function formatValue(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return DEV_FALLBACK;
  return String(v);
}

export function formatBuildDate(date: Date | null | undefined): string {
  if (!date || isNaN(date.getTime())) return DEV_FALLBACK;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}, ${hh}:${mm}`;
}

export function getBuildInfo(): BuildInfo {
  const buildNumber = Platform.OS === 'ios'
    ? Constants.expoConfig?.ios?.buildNumber
    : Constants.expoConfig?.android?.versionCode;

  return {
    appVersion: formatValue(Constants.expoConfig?.version),
    buildNumber: formatValue(buildNumber),
    updateId: formatValue(Updates.updateId),
    publishedAt: formatBuildDate(Updates.createdAt),
    channel: formatValue(Updates.channel),
    runtimeVersion: formatValue(Updates.runtimeVersion),
    // isEmbeddedLaunch is a real boolean even in dev/Expo Go (true there),
    // but updateId is null in that case — treat "embedded but no update id"
    // as the dev-build case rather than claim it's running an embedded
    // production bundle.
    launchType: Updates.updateId === null
      ? DEV_FALLBACK
      : Updates.isEmbeddedLaunch ? 'Embedded bundle' : 'OTA update',
  };
}

export function buildInfoClipboardText(info: BuildInfo): string {
  return [
    `App version: ${info.appVersion}`,
    `Build number: ${info.buildNumber}`,
    `Update ID: ${info.updateId}`,
    `Published: ${info.publishedAt}`,
    `Channel: ${info.channel}`,
    `Runtime version: ${info.runtimeVersion}`,
    `Launch type: ${info.launchType}`,
  ].join('\n');
}
