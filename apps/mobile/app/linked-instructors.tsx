import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/src/supabase';
import { useTheme } from '@/src/theme';
import { Colors } from '@/src/constants/theme';
import { Pip } from '@/src/components/Pip';

type RelStatus = 'pending' | 'accepted' | 'rejected';

type Relationship = {
  id: string;
  instructor_id: string;
  learner_id: string | null;
  learner_email: string | null;
  learner_name: string | null;
  status: RelStatus;
  created_at: string;
  invite_code: string | null;
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getInitials(name: string): string {
  const p = name.trim().split(/\s+/);
  if (p.length >= 2) return (p[0][0] + p[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export default function LinkedInstructorsScreen() {
  const theme = useTheme();
  const [instructors, setInstructors] = useState<Relationship[]>([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => { void loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/auth/signin'); return; }

      const { data: rels } = await supabase
        .from('instructor_relationships')
        .select('*')
        .eq('learner_id', user.id)
        .neq('status', 'rejected');
      setInstructors((rels as Relationship[] | null) ?? []);
    } catch {
      // Table likely doesn't exist yet — show empty state
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.backgroundColor }]}>
      <View style={[styles.header, { backgroundColor: theme.cardColor, borderBottomColor: theme.borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack} activeOpacity={0.7}>
          <Text style={[styles.headerBackArrow, { color: theme.textColor }]}>{'←'}</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textColor }]}>{'Linked Instructors'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.indigo} />
        </View>
      ) : (
        <LearnerModeView instructors={instructors} loading={loading} onRefresh={() => void loadData()} />
      )}
    </View>
  );
}

// ─── LearnerModeView (moved verbatim from app/instructor.tsx:1031-1229) ──────

function LearnerModeView({
  instructors,
  loading,
  onRefresh,
}: {
  instructors: Relationship[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const theme = useTheme();
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [enteredCode, setEnteredCode]     = useState('');
  const [linking, setLinking]             = useState(false);

  async function handleEnterCode() {
    const code = enteredCode.trim().toUpperCase();
    if (code.length !== 6 || linking) return;
    setLinking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: instructorProfile, error } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('instructor_code', code)
        .single();

      if (error || !instructorProfile) {
        Alert.alert('Code not found', 'Please check the code and try again.');
        return;
      }

      if (instructorProfile.id === user.id) {
        Alert.alert('That\'s your own code', 'You cannot link to yourself.');
        return;
      }

      const { data: existing } = await supabase
        .from('instructor_relationships')
        .select('id')
        .eq('instructor_id', instructorProfile.id)
        .eq('learner_id', user.id)
        .maybeSingle();

      if (existing) {
        Alert.alert('Already linked', 'You are already linked to this instructor.');
        return;
      }

      const { data: myProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .maybeSingle();

      await supabase.from('instructor_relationships').insert({
        instructor_id: instructorProfile.id,
        learner_id: user.id,
        learner_name: (myProfile as { username?: string } | null)?.username ?? null,
        status: 'accepted',
        invite_code: code,
      });

      const iname = (instructorProfile as { username?: string }).username ?? 'your instructor';
      Alert.alert('Linked!', `You are now linked to ${iname}.`);
      setEnteredCode('');
      setShowCodeModal(false);
      onRefresh();
    } catch {
      Alert.alert('Error', 'Could not link. Please try again.');
    } finally {
      setLinking(false);
    }
  }

  async function handleRemove(relId: string, instructorName: string) {
    Alert.alert(
      'Remove access',
      `${instructorName} will no longer be able to view your progress.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await supabase.from('instructor_relationships').delete().eq('id', relId);
              onRefresh();
            })();
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={[styles.loadingText, { color: theme.subTextColor }]}>{'Loading...'}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.backgroundColor }]}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.dashTitle, { color: theme.textColor }]}>{'Linked Instructors'}</Text>
      <Text style={[styles.learnerModeSub, { color: theme.subTextColor }]}>
        {'These people can view your progress on ClearPass.'}
      </Text>

      {instructors.length === 0 ? (
        <View style={[styles.instructorEmpty, { backgroundColor: theme.cardColor }]}>
          <Pip size={64} mood="curious" />
          <Text style={[styles.instructorEmptyTitle, { color: theme.textColor }]}>
            {'No one is monitoring you yet'}
          </Text>
          <Text style={[styles.instructorEmptySub, { color: theme.subTextColor }]}>
            {'Enter an instructor code to allow a parent or instructor to follow your progress.'}
          </Text>
        </View>
      ) : (
        instructors.map(rel => (
          <View key={rel.id} style={[styles.instructorCard, { backgroundColor: theme.cardColor }]}>
            <View style={[styles.avatarCircle, { backgroundColor: Colors.indigo }]}>
              <Text style={styles.avatarText}>
                {getInitials(rel.learner_name ?? rel.learner_email ?? 'IN')}
              </Text>
            </View>
            <View style={styles.learnerMeta}>
              <Text style={[styles.learnerName, { color: theme.textColor }]}>
                {rel.learner_name ?? rel.learner_email ?? 'Instructor'}
              </Text>
              <Text style={[styles.learnerSub, { color: theme.subTextColor }]}>
                {'Linked '}{formatDate(rel.created_at)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => void handleRemove(rel.id, rel.learner_name ?? rel.learner_email ?? 'Instructor')}
              activeOpacity={0.75}
            >
              <Text style={styles.removeBtnText}>{'Remove'}</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      <TouchableOpacity
        style={styles.enterCodeBtn}
        onPress={() => setShowCodeModal(true)}
        activeOpacity={0.85}
      >
        <Text style={styles.enterCodeBtnText}>{'Enter Instructor Code'}</Text>
      </TouchableOpacity>

      {/* Enter code modal */}
      <Modal visible={showCodeModal} transparent animationType="fade" onRequestClose={() => setShowCodeModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardColor }]}>
            <Text style={[styles.modalTitle, { color: theme.textColor }]}>{'Enter Instructor Code'}</Text>
            <Text style={[styles.codeLabel, { color: theme.subTextColor }]}>
              {'Ask your instructor or parent for their 6-character code.'}
            </Text>
            <TextInput
              style={[styles.codeInput, { color: theme.textColor }]}
              value={enteredCode}
              onChangeText={v => setEnteredCode(v.toUpperCase().slice(0, 6))}
              placeholder="ABC123"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
            />
            <TouchableOpacity
              style={[styles.addEmailBtn, (enteredCode.length < 6 || linking) && styles.btnDisabled]}
              onPress={() => void handleEnterCode()}
              activeOpacity={0.85}
              disabled={enteredCode.length < 6 || linking}
            >
              <Text style={styles.addEmailBtnText}>{linking ? 'Linking...' : 'Link Account'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => { setEnteredCode(''); setShowCodeModal(false); }}
              activeOpacity={0.85}
            >
              <Text style={styles.modalCancelText}>{'Cancel'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ─── Styles (copied from app/instructor.tsx — both files share the same
// header/card/modal visual language; trimming to only the keys this file
// uses is a safe follow-up cleanup, not required for correctness) ─────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 14 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
  },
  headerBack: { width: 32 },
  headerBackArrow: { fontSize: 22 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  headerSpacer: { width: 32 },

  listContent: { padding: 16, gap: 12, paddingBottom: 48 },
  dashTitle: { fontSize: 18, fontWeight: '800', marginTop: 8 },
  learnerModeSub: { fontSize: 13, marginBottom: 4 },

  instructorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  avatarCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  learnerMeta: { flex: 1 },
  learnerName: { fontSize: 15, fontWeight: '700' },
  learnerSub: { fontSize: 12, marginTop: 2 },

  removeBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  removeBtnText: { color: '#EF4444', fontSize: 13, fontWeight: '700' },

  instructorEmpty: { alignItems: 'center', borderRadius: 16, padding: 24, gap: 8 },
  instructorEmptyTitle: { fontSize: 16, fontWeight: '800' },
  instructorEmptySub: { fontSize: 13, textAlign: 'center' },

  enterCodeBtn: {
    backgroundColor: Colors.indigo,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  enterCodeBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', borderRadius: 16, padding: 20, gap: 12 },
  modalTitle: { fontSize: 17, fontWeight: '800' },
  codeLabel: { fontSize: 13 },
  codeInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 4,
    textAlign: 'center',
  },
  addEmailBtn: { backgroundColor: Colors.indigo, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  addEmailBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
  modalCancelBtn: { alignItems: 'center', paddingVertical: 10 },
  modalCancelText: { fontSize: 14, fontWeight: '600' },
});
