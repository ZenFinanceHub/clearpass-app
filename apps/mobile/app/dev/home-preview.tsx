import React, { useEffect, useMemo, useState } from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { calculateReadiness, type UserProgress } from '@clearpass/core';
import { devScreensEnabled } from '@/src/uiFlags';
import { DesignThemeProvider, useDesignTheme, type ColorScheme, type DesignThemeOverrides } from '@/src/design';
import { SIDE_NAV_BREAKPOINT, SideNavV2, TabBarV2 } from '@/src/ui';
import { usePipVisibility } from '@/src/PipVisibilityContext';
import { DailyCoachHome } from '@/src/home/DailyCoachHome';
import { buildHomeViewModel, type HomePlatform } from '@/src/home/homeViewModel';
import { FIXTURE_NAMES, getFixture, type FixtureName } from '@/src/home/homeFixtures';
import { hasFreeMockLeft } from '@/src/conversion';
import { FREE_QUESTION_LIMIT } from '@/src/subscription';

/**
 * Daily Coach Home preview (milestone M0.5). Renders the real Home
 * component from synthetic fixtures: no network, no auth, no storage
 * writes. Navigation taps are no-ops.
 *
 *   /dev/home-preview?fixture=new|established|pro|no-test-date|loading|error
 *     &theme=light|dark  &platform=ios|android|web
 *     &name=<display name>  &largeText=1  &fontScale=1.3
 *
 * Wide windows (≥ 1024px) show the desktop sidebar; narrower ones the bottom
 * tab bar. Only available in a development build or a local/staging build
 * (devScreensEnabled); a production export redirects to "/".
 */
export default function HomePreviewRoute() {
  if (!devScreensEnabled) return <Redirect href="/" />;
  return <HomePreview />;
}

function HomePreview() {
  const params = useLocalSearchParams<{ fixture?: string; theme?: string; platform?: string; name?: string; largeText?: string; fontScale?: string }>();
  const fixtureName: FixtureName = FIXTURE_NAMES.includes(params.fixture as FixtureName) ? (params.fixture as FixtureName) : 'established';
  const scheme: ColorScheme | undefined = params.theme === 'dark' ? 'dark' : params.theme === 'light' ? 'light' : undefined;
  const platform: HomePlatform =
    params.platform === 'ios' || params.platform === 'android' || params.platform === 'web' ? params.platform : (Platform.OS as HomePlatform);
  const fontScale = Number(params.fontScale);

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

  const overrides = useMemo<DesignThemeOverrides>(() => ({
    scheme,
    largeText: params.largeText === '1' ? true : undefined,
    fontScale: Number.isFinite(fontScale) && fontScale >= 1 && fontScale <= 2 ? fontScale : undefined,
  }), [scheme, params.largeText, fontScale]);
  if (!mounted) return <Stack.Screen options={{ headerShown: false, title: 'Home preview' }} />;
  return (
    <DesignThemeProvider overrides={overrides}>
      <Stack.Screen options={{ headerShown: false, title: 'Home preview' }} />
      <PreviewBody fixtureName={fixtureName} platform={platform} nameOverride={params.name ?? null} />
    </DesignThemeProvider>
  );
}

function PreviewBody({ fixtureName, platform, nameOverride }: { fixtureName: FixtureName; platform: HomePlatform; nameOverride: string | null }) {
  const { colors } = useDesignTheme();
  const { width } = useWindowDimensions();
  const now = useMemo(() => new Date(), []);
  const fixture = useMemo(() => getFixture(fixtureName, now), [fixtureName, now]);
  const progress = fixture.progress as unknown as UserProgress | null;

  const vm = useMemo(() => buildHomeViewModel({
    now,
    platform,
    loading: fixture.loading,
    error: fixture.error,
    displayName: nameOverride ?? fixture.displayName,
    progress: fixture.progress,
    // The real readiness function, consumed as-is.
    readinessScore: progress ? calculateReadiness(progress).score : 0,
    passProbability: null,
    dueReviewCount: fixture.dueReviewCount,
    freeMockAvailable: hasFreeMockLeft(progress),
    freeDailyQuestionLimit: FREE_QUESTION_LIMIT,
  }), [fixture, platform, progress, now, nameOverride]);

  const noop = () => {};
  const wide = width >= SIDE_NAV_BREAKPOINT;
  const home = (
    <DailyCoachHome vm={vm} progress={progress} onNavigate={noop} onSetTestDate={noop} onRetry={noop} hideBrand={wide} />
  );
  return wide ? (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.bg.canvas }}>
      <SideNavV2 active="home" />
      <View style={{ flex: 1 }}>{home}</View>
    </View>
  ) : (
    <View style={{ flex: 1, backgroundColor: colors.bg.canvas }}>
      {home}
      <TabBarV2 active="home" />
    </View>
  );
}
