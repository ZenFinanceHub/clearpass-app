import React from 'react';
import { Redirect } from 'expo-router';
import { uiV2 } from '@/src/uiFlags';
import { TestsHubV2 } from '@/src/nav/HubScreens';

/**
 * ClearPass 2.0 Tests tab hub (ui_v2 only): Full mock, Quick mock, Hazard
 * perception (existing screens) and recent results from the existing local
 * history. With the flag off this route doesn't exist as far as the learner
 * can tell: it's hidden from the tab bar and redirects to Home.
 */
export default function TestsRoute() {
  if (!uiV2) return <Redirect href="/(tabs)/home" />;
  return <TestsHubV2 />;
}
