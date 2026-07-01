import React, { useCallback, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/src/theme';
import {
  HCChapter,
  HCRule,
  highwayCodeChapters,
  getRuleByNumber,
  searchHighwayCode,
} from '@clearpass/content';
import { OfflineBanner } from '@/src/components/OfflineBanner';
import { Colors } from '@/src/constants/theme';

type ViewMode = 'list' | 'chapter' | 'rule';

const TEAL = Colors.indigo;
const TEAL_LIGHT = Colors.indigoBg;

export default function HighwayCodeScreen() {
  const params = useLocalSearchParams<{ ruleNumber?: string }>();
  const theme = useTheme();

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (params.ruleNumber) return 'rule';
    return 'list';
  });
  const [selectedChapter, setSelectedChapter] = useState<HCChapter | null>(() => {
    if (params.ruleNumber) {
      const n = parseInt(params.ruleNumber, 10);
      return getRuleByNumber(n)?.chapter ?? null;
    }
    return null;
  });
  const [selectedRule, setSelectedRule] = useState<HCRule | null>(() => {
    if (params.ruleNumber) {
      const n = parseInt(params.ruleNumber, 10);
      return getRuleByNumber(n)?.rule ?? null;
    }
    return null;
  });
  const [expandedRules, setExpandedRules] = useState<Set<string>>(() => {
    if (params.ruleNumber) {
      const n = parseInt(params.ruleNumber, 10);
      const rule = getRuleByNumber(n)?.rule;
      if (rule) return new Set([ruleKey(rule)]);
    }
    return new Set();
  });
  const [searchQuery, setSearchQuery] = useState('');

  function ruleKey(rule: HCRule) {
    return `${rule.ruleNumber}_${rule.title}`;
  }

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return searchHighwayCode(searchQuery);
  }, [searchQuery]);

  const openChapter = useCallback((chapter: HCChapter) => {
    setSelectedChapter(chapter);
    setExpandedRules(new Set());
    setViewMode('chapter');
  }, []);

  const openRule = useCallback((chapter: HCChapter, rule: HCRule) => {
    setSelectedChapter(chapter);
    setSelectedRule(rule);
    setViewMode('rule');
  }, []);

  const toggleRule = useCallback((key: string) => {
    setExpandedRules((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const goBack = useCallback(() => {
    if (viewMode === 'rule') {
      setViewMode(selectedChapter ? 'chapter' : 'list');
    } else {
      setViewMode('list');
      setSelectedChapter(null);
    }
    setSearchQuery('');
  }, [viewMode, selectedChapter]);

  // ── Rule deep-link view ───────────────────────────────────────────────────
  if (viewMode === 'rule' && selectedRule && selectedChapter) {
    return (
      <View style={styles.screen}>
        <OfflineBanner />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.backgroundColor }}
        contentContainerStyle={styles.content}
      >
        <TouchableOpacity style={styles.backBtn} onPress={goBack} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>{'<- '}{selectedChapter.title}</Text>
        </TouchableOpacity>

        <View style={styles.ruleHeader}>
          {selectedRule.ruleNumber > 0 && (
            <View style={styles.ruleBadgeLarge}>
              <Text style={styles.ruleBadgeLargeText}>{'Rule '}{selectedRule.ruleNumber}</Text>
            </View>
          )}
          <Text style={[styles.ruleViewTitle, { color: theme.textColor }]}>
            {selectedRule.title}
          </Text>
          <Text style={[styles.ruleViewChapter, { color: theme.subTextColor }]}>
            {selectedChapter.title} — {selectedChapter.ruleRange}
          </Text>
        </View>

        <View style={styles.ruleFullCard}>
          <Text style={[styles.ruleFullContent, { color: theme.textColor }]}>
            {selectedRule.content}
          </Text>
        </View>

        <View style={[styles.keyPointsCard, { borderColor: theme.borderColor }]}>
          <Text style={styles.keyPointsTitle}>Key Points from this Chapter</Text>
          {selectedChapter.keyPoints.map((kp, i) => (
            <View key={i} style={styles.keyPointRow}>
              <Text style={styles.keyPointBullet}>{'•'}</Text>
              <Text style={[styles.keyPointText, { color: theme.textColor }]}>{kp}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.chapterBtn}
          onPress={() => setViewMode('chapter')}
          activeOpacity={0.85}
        >
          <Text style={styles.chapterBtnText}>View all rules in this chapter</Text>
        </TouchableOpacity>
      </ScrollView>
      </View>
    );
  }

  // ── Chapter view ──────────────────────────────────────────────────────────
  if (viewMode === 'chapter' && selectedChapter) {
    return (
      <View style={styles.screen}>
        <OfflineBanner />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.backgroundColor }}
        contentContainerStyle={styles.content}
      >
        <TouchableOpacity style={styles.backBtn} onPress={goBack} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>{'<- Highway Code'}</Text>
        </TouchableOpacity>

        <Text style={[styles.chapterTitle, { color: theme.textColor }]}>
          {'Ch '}{selectedChapter.chapterNumber}{'  '}{selectedChapter.title}
        </Text>
        <Text style={[styles.chapterRuleRange, { color: theme.subTextColor }]}>
          {selectedChapter.ruleRange}
        </Text>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryText}>{selectedChapter.summary}</Text>
        </View>

        <View style={[styles.keyPointsCard, { borderColor: theme.borderColor }]}>
          <Text style={styles.keyPointsTitle}>Key Points</Text>
          {selectedChapter.keyPoints.map((kp, i) => (
            <View key={i} style={styles.keyPointRow}>
              <Text style={styles.keyPointBullet}>{'•'}</Text>
              <Text style={[styles.keyPointText, { color: theme.textColor }]}>{kp}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionLabel, { color: theme.subTextColor }]}>Rules</Text>

        <View style={{ gap: 8 }}>
          {selectedChapter.rules.map((rule) => {
            const key = ruleKey(rule);
            const isExpanded = expandedRules.has(key);
            return (
              <TouchableOpacity
                key={key}
                style={[styles.accordionItem, { borderColor: isExpanded ? TEAL : theme.borderColor }]}
                onPress={() => toggleRule(key)}
                activeOpacity={0.85}
              >
                <View style={styles.accordionHeader}>
                  {rule.ruleNumber > 0 && (
                    <View style={[styles.ruleBadge, isExpanded && styles.ruleBadgeActive]}>
                      <Text style={[styles.ruleBadgeText, isExpanded && styles.ruleBadgeTextActive]}>
                        {rule.ruleNumber}
                      </Text>
                    </View>
                  )}
                  <Text
                    style={[
                      styles.accordionTitle,
                      { color: theme.textColor, flex: 1 },
                      isExpanded && { color: TEAL },
                    ]}
                  >
                    {rule.title}
                  </Text>
                  <Text style={[styles.accordionChevron, { color: isExpanded ? TEAL : theme.subTextColor }]}>
                    {isExpanded ? 'v' : '>'}
                  </Text>
                </View>
                {isExpanded && (
                  <Text style={[styles.accordionContent, { color: theme.textColor }]}>
                    {rule.content}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={styles.practiceBtn}
          onPress={goBack}
          activeOpacity={0.85}
        >
          <Text style={styles.practiceBtnText}>{'<- Back to all chapters'}</Text>
        </TouchableOpacity>
      </ScrollView>
      </View>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      <OfflineBanner />
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundColor }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.screenTitle, { color: theme.textColor }]}>Highway Code</Text>
      <Text style={[styles.screenSub, { color: theme.subTextColor }]}>
        Official UK road rules — tap any chapter to read
      </Text>

      <View style={[styles.searchBar, { borderColor: theme.borderColor }]}>
        <Text style={styles.searchIcon}>{'[?]'}</Text>
        <TextInput
          style={[styles.searchInput, { color: theme.textColor }]}
          placeholder="Search rules, topics, rule numbers..."
          placeholderTextColor={theme.subTextColor}
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>

      {searchResults !== null ? (
        <>
          <Text style={[styles.sectionLabel, { color: theme.subTextColor }]}>
            {searchResults.length === 0
              ? 'No results'
              : `${searchResults.length} result${searchResults.length === 1 ? '' : 's'}`}
          </Text>
          <View style={{ gap: 8 }}>
            {searchResults.map((result, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.searchResultCard, { borderColor: theme.borderColor }]}
                onPress={() => {
                  if (result.rule) openRule(result.chapter, result.rule);
                  else openChapter(result.chapter);
                  setSearchQuery('');
                }}
                activeOpacity={0.85}
              >
                <Text style={[styles.searchResultChapter, { color: TEAL }]}>
                  {result.chapter.title}
                </Text>
                {result.rule && (
                  <>
                    <Text style={[styles.searchResultRuleTitle, { color: theme.textColor }]}>
                      {result.rule.ruleNumber > 0 ? `Rule ${result.rule.ruleNumber}: ` : ''}
                      {result.rule.title}
                    </Text>
                    <Text
                      style={[styles.searchResultSnippet, { color: theme.subTextColor }]}
                      numberOfLines={2}
                    >
                      {result.rule.content}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : (
        <View style={{ gap: 12 }}>
          {highwayCodeChapters.map((chapter) => (
            <TouchableOpacity
              key={chapter.id}
              style={[styles.chapterCard, { borderColor: theme.borderColor }]}
              onPress={() => openChapter(chapter)}
              activeOpacity={0.85}
            >
              <View style={styles.chapterCardHeader}>
                <View style={styles.chapterBadge}>
                  <Text style={styles.chapterBadgeText}>{chapter.chapterNumber}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.chapterCardTitle, { color: theme.textColor }]}>
                    {chapter.title}
                  </Text>
                  <Text style={[styles.chapterCardRange, { color: theme.subTextColor }]}>
                    {chapter.ruleRange}
                  </Text>
                </View>
                <Text style={[styles.chapterCardChevron, { color: theme.subTextColor }]}>{'>'}</Text>
              </View>
              <View style={styles.chapterKeyPoints}>
                {chapter.keyPoints.slice(0, 3).map((kp, i) => (
                  <View key={i} style={styles.chipRow}>
                    <Text style={styles.chipBullet}>{'•'}</Text>
                    <Text style={[styles.chipText, { color: theme.subTextColor }]} numberOfLines={1}>
                      {kp}
                    </Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={[styles.oglNotice, { color: theme.subTextColor }]}>
        {'Contains public sector information licensed under the Open Government Licence v3.0.\n© Crown copyright. Source: DVSA Highway Code.'}
      </Text>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  oglNotice: { fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 24, marginBottom: 4 },

  screenTitle: { fontSize: 26, fontWeight: '800', marginBottom: 4 },
  screenSub: { fontSize: 14, marginBottom: 16, lineHeight: 20 },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 16,
  },
  searchIcon: { fontSize: 16, color: TEAL, fontWeight: '700' },
  searchInput: { flex: 1, fontSize: 15 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 4,
  },

  // Chapter cards (list view)
  chapterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderLeftColor: TEAL,
    overflow: 'hidden',
  },
  chapterCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    paddingBottom: 8,
  },
  chapterBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: TEAL,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chapterBadgeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  chapterCardTitle: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  chapterCardRange: { fontSize: 12, marginTop: 2 },
  chapterCardChevron: { fontSize: 16, fontWeight: '600', paddingRight: 4 },
  chapterKeyPoints: { paddingHorizontal: 14, paddingBottom: 12, gap: 4 },
  chipRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  chipBullet: { fontSize: 12, color: TEAL, marginTop: 1 },
  chipText: { fontSize: 12, flex: 1, lineHeight: 18 },

  // Search results
  searchResultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  searchResultChapter: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  searchResultRuleTitle: { fontSize: 14, fontWeight: '700' },
  searchResultSnippet: { fontSize: 13, lineHeight: 18 },

  // Back button
  backBtn: { marginBottom: 16 },
  backBtnText: { fontSize: 14, fontWeight: '600', color: TEAL },

  // Chapter view
  chapterTitle: { fontSize: 22, fontWeight: '800', lineHeight: 30, marginBottom: 4 },
  chapterRuleRange: { fontSize: 13, marginBottom: 14 },
  summaryCard: {
    backgroundColor: TEAL_LIGHT,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderLeftWidth: 3,
    borderLeftColor: TEAL,
  },
  summaryText: { fontSize: 14, lineHeight: 22, color: '#065F46' },
  keyPointsCard: {
    backgroundColor: TEAL_LIGHT,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
  },
  keyPointsTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: TEAL,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  keyPointRow: { flexDirection: 'row', gap: 8, marginBottom: 6, alignItems: 'flex-start' },
  keyPointBullet: { color: TEAL, fontSize: 14, marginTop: 1, flexShrink: 0 },
  keyPointText: { fontSize: 13, flex: 1, lineHeight: 20 },

  // Accordion
  accordionItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  ruleBadge: {
    width: 36,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  ruleBadgeActive: { backgroundColor: TEAL },
  ruleBadgeText: { fontSize: 11, fontWeight: '800', color: '#6B7280' },
  ruleBadgeTextActive: { color: '#FFFFFF' },
  accordionTitle: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  accordionChevron: { fontSize: 14, fontWeight: '700', paddingLeft: 4 },
  accordionContent: {
    fontSize: 14,
    lineHeight: 22,
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 0,
  },

  practiceBtn: {
    marginTop: 20,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TEAL,
    backgroundColor: '#FFFFFF',
  },
  practiceBtnText: { color: TEAL, fontSize: 14, fontWeight: '700' },

  chapterBtn: {
    marginTop: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: TEAL,
  },
  chapterBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  // Rule deep-link view
  ruleHeader: { marginBottom: 16, gap: 6 },
  ruleBadgeLarge: {
    alignSelf: 'flex-start',
    backgroundColor: TEAL,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  ruleBadgeLargeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  ruleViewTitle: { fontSize: 22, fontWeight: '800', lineHeight: 30 },
  ruleViewChapter: { fontSize: 13 },
  ruleFullCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderLeftColor: TEAL,
    borderColor: '#E5E7EB',
  },
  ruleFullContent: { fontSize: 15, lineHeight: 24 },
});
