import React, { useEffect, useMemo, useState } from 'react';
import { Platform, View } from 'react-native';
import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { calculateReadiness, type UserProgress } from '@clearpass/core';
import { devScreensEnabled } from '@/src/uiFlags';
import { DesignThemeProvider, useDesignTheme, type ColorScheme } from '@/src/design';
import { TabBarV2 } from '@/src/ui';
import { usePipVisibility } from '@/src/PipVisibilityContext';
import { DailyCoachHome } from '@/src/home/DailyCoachHome';
import { buildHomeViewModel, type HomePlatform } from '@/src/home/homeViewModel';
import { FIXTURE_NAMES, getFixture, type FixtureName } from '@/src/home/homeFixtures';
import { homeProBannerSub } from '@/src/paywallCopy';
import { hasFreeMockLeft } from '@/src/conversion';

/**
 * Daily Coach Home preview (milestone M0.5). Renders the real Home
 * component from synthetic fixtures: no network, no auth, no storage
 * writes. Navigation taps are no-ops.
 *
 *   /dev/home-preview?fixture=new|established|pro|no-test-date|loading
 *                    &theme=light|dark  &platform=ios|android|web
 *
 * Only available in a development build or a local/staging build
 * (devScreensEnabled); a production export redirects to "/".
 */
export default function HomePreviewRoute() {
  if (!devScreensEnabled) return <Redirect href="/" />;
  return <HomePreview />;
}

function HomePreview() {
  const params = useLocalSearchParams<{ fixture?: string; theme?: string; platform?: string }>();
  const fixtureName: FixtureName = FIXTURE_NAMES.includes(params.fixture as FixtureName) ? (params.fixture as FixtureName) : 'established';
  const scheme: ColorScheme | undefined = params.theme === 'dark' ? 'dark' : params.theme === 'light' ? 'light' : undefined;
  const platform: HomePlatform =
    params.platform === 'ios' || params.platform === 'android' || params.platform === 'web' ? params.platform : (Platform.OS as HomePlatform);

  // Keep the global Pip FAB out of the preview.
  const { setHidden } = usePipVisibility();
  useEffect(() => {
    setHidden(true);
    return () => setHidden(false);
  }, [setHidden]);

  // Client-only: the static web export pre-renders without query params, so
  // rendering fixtures during hydration would mismatch (React #418).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const overrides = useMemo(() => ({ scheme }), [scheme]);
  if (!mounted) return <Stack.Screen options={{ headerShown: false, title: 'Home preview' }} />;
  return (
    <DesignThemeProvider overrides={overrides}>
      <Stack.Screen options={{ headerShown: false, title: 'Home preview' }} />
      <PreviewBody fixtureName={fixtureName} platform={platform} />
    </DesignThemeProvider>
  );
}

function PreviewBody({ fixtureName, platform }: { fixtureName: FixtureName; platform: HomePlatform }) {
  const { colors } = useDesignTheme();
  const now = useMemo(() => new Date(), []);
  const fixture = useMemo(() => getFixture(fixtureName, now), [fixtureName, now]);
  const progress = fixture.progress as unknown as UserProgress | null;

  const vm = useMemo(() => buildHomeViewModel({
    now,
    platform,
    loading: fixture.loading,
    displayName: fixture.displayName,
    progress: fixture.progress,
    // The real readiness function, consumed as-is.
    readinessScore: progress ? calculateReadiness(progress).score : 0,
    passProbability: null,
    dueReviewCount: fixture.dueReviewCount,
    freeMockAvailable: hasFreeMockLeft(progress),
  }), [fixture, platform, progress, now]);

  const noop = () => {};
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.canvas }}>
      <DailyCoachHome
        vm={vm}
        progress={progress}
        onNavigate={noop}
        onSetTestDate={noop}
        upgradeBody={homeProBannerSub(progress, now)}
      />
      <TabBarV2 active="home" />
    </View>
  );
}
