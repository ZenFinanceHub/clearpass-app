import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/src/supabase';
import { signInWithApple, signInWithGoogle } from '@/src/socialAuth';
import { resolvePostAuthRoute } from '@/src/postAuthRouting';
import { Colors } from '@/src/constants/theme';
import PasswordInput from '@/src/components/PasswordInput';

const PENDING_USERNAME_KEY = '@clearpass/pending_username';
const REFERRAL_CODE_KEY    = 'referral_code';

export default function SignUpScreen() {
  const params = useLocalSearchParams<{ ref?: string }>();

  const [username,        setUsername]        = useState('');
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [referralCode,    setReferralCode]    = useState('');
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState('');
  const [referralWarn,    setReferralWarn]    = useState('');
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [resendLoading,   setResendLoading]   = useState(false);
  const [resendMessage,   setResendMessage]   = useState('');
  const [socialLoading,   setSocialLoading]   = useState(false);
  const [socialError,     setSocialError]     = useState('');

  useEffect(() => {
    // Don't persist params.ref to storage here — that would write on mere
    // page visit, before the user has actually chosen to sign up (and
    // linger indefinitely if they never do). A ?ref= on this exact page
    // only needs to survive for the lifetime of this screen, which local
    // state already covers; it's read directly at submission time below.
    // Storage is reserved for codes captured via a *different* deep link
    // that doesn't land here directly (_layout.tsx's 'referralCapture'),
    // which this still needs to fall back to.
    if (params.ref) {
      setReferralCode(params.ref);
      return;
    }
    void AsyncStorage.getItem(REFERRAL_CODE_KEY).then((stored) => {
      if (stored) setReferralCode(stored);
    });
  }, [params.ref]);

  async function handleSignUp() {
    setError('');
    if (username.trim().length < 3) { setError('Username must be at least 3 characters.'); return; }
    if (!email.trim())               { setError('Please enter an email address.'); return; }
    if (password.length < 6)         { setError('Password must be at least 6 characters.'); return; }

    setLoading(true);
    try {
      const { data: { user, session }, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (authError) { setError(authError.message); return; }

      // user.id is available even when email confirmation is required (session will be null)
      const userId = session?.user?.id ?? user?.id;
      const name = username.trim();
      await AsyncStorage.setItem(PENDING_USERNAME_KEY, name);

      const code = referralCode.trim().toUpperCase() || (await AsyncStorage.getItem(REFERRAL_CODE_KEY)) || null;

      if (userId && code) {
        // A referral/instructor code — typed manually or pre-filled from a
        // ?ref= link — always forces the learner path with no picker shown.
        await AsyncStorage.setItem(REFERRAL_CODE_KEY, code);
        const { error: profileError } = await supabase.from('profiles').insert({
          id: userId,
          username: name,
          account_type: 'learner',
          referred_by: code,
        });
        if (!profileError || profileError.code === '23505') {
          try {
            const { data: refProfile } = await supabase
              .from('profiles')
              .select('id, account_type')
              .eq('referral_code', code)
              .maybeSingle();

            if (!refProfile) {
              setReferralWarn('Code not recognised — continuing without it.');
            } else if ((refProfile as { account_type?: string }).account_type === 'instructor') {
              // Code owner is an instructor — create a pending relationship;
              // the pupil must explicitly accept before progress is shared
              // (see Settings → Linked Instructors → Instructor Requests).
              await supabase.from('instructor_relationships').insert({
                instructor_id: (refProfile as { id: string }).id,
                learner_id: userId,
                status: 'pending',
                invite_code: code,
              });
            }
          } catch {}
        }
        // The code has now been used to create this account — clear it so
        // it can't silently attach to an unrelated future signup on the
        // same browser/device.
        await AsyncStorage.removeItem(REFERRAL_CODE_KEY);
      }

      if (!session) {
        // Email confirmation is required — show holding screen rather than redirecting
        setAwaitingConfirm(true);
        return;
      }

      await new Promise<void>((res) => setTimeout(res, 400));
      router.replace(code ? '/auth/testdate' : '/auth/choose-account-type');
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResendMessage('');
    setResendLoading(true);
    try {
      const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
      setResendMessage(resendError ? resendError.message : 'Verification email resent — check your inbox.');
    } catch {
      setResendMessage('Could not resend. Please try again.');
    } finally {
      setResendLoading(false);
    }
  }

  async function handleAppleSignIn() {
    setSocialLoading(true);
    setSocialError('');
    try {
      const result = await signInWithApple();
      router.replace(result.isNewUser ? '/auth/choose-account-type' : await resolvePostAuthRoute(result.session.user.id));
    } catch (e: unknown) {
      if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return;
      setSocialError('Apple Sign In failed. Please try again.');
    } finally {
      setSocialLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setSocialLoading(true);
    setSocialError('');
    try {
      const result = await signInWithGoogle();
      if (result) router.replace(result.isNewUser ? '/auth/choose-account-type' : await resolvePostAuthRoute(result.session.user.id));
    } catch {
      setSocialError('Google Sign In failed. Please try again.');
    } finally {
      setSocialLoading(false);
    }
  }

  if (awaitingConfirm) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inner}>
          <Text style={styles.logo}>{'ClearPass'}</Text>
          <Text style={styles.confirmTitle}>{'Check your inbox'}</Text>
          <Text style={styles.confirmBody}>
            {'We sent a verification link to '}
            <Text style={styles.confirmEmail}>{email.trim()}</Text>
            {'. Tap the link to activate your account, then sign in below.'}
          </Text>

          <TouchableOpacity
            style={styles.submitBtn}
            onPress={() => router.replace('/auth/signin')}
            activeOpacity={0.85}
          >
            <Text style={styles.submitBtnText}>{'Go to Sign In'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.resendBtn, resendLoading && styles.submitBtnDisabled]}
            onPress={() => void handleResend()}
            disabled={resendLoading}
            activeOpacity={0.75}
          >
            {resendLoading
              ? <ActivityIndicator color={Colors.indigo} />
              : <Text style={styles.resendBtnText}>{'Resend verification email'}</Text>}
          </TouchableOpacity>

          {resendMessage.length > 0 && <Text style={styles.resendMessage}>{resendMessage}</Text>}
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.logo}>{'ClearPass'}</Text>
        <Text style={styles.tagline}>{'Pass your theory test. First time.'}</Text>

        {Platform.OS !== 'web' && (
          <>
            {socialError.length > 0 && <Text style={styles.socialErrorText}>{socialError}</Text>}

            <TouchableOpacity
              style={[styles.socialBtn, socialLoading && styles.submitBtnDisabled]}
              onPress={() => void handleGoogleSignIn()}
              disabled={socialLoading}
              activeOpacity={0.85}
            >
              {socialLoading
                ? <ActivityIndicator color="#111827" />
                : (
                    <>
                      <Text style={styles.googleG}>{'G'}</Text>
                      <Text style={styles.socialBtnText}>{'Continue with Google'}</Text>
                    </>
                  )}
            </TouchableOpacity>

            {Platform.OS === 'ios' && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={14}
                style={styles.appleBtn}
                onPress={() => void handleAppleSignIn()}
              />
            )}

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{'or sign up with email'}</Text>
              <View style={styles.dividerLine} />
            </View>
          </>
        )}

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Username"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            autoComplete="username"
          />
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <PasswordInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Password (6+ characters)"
            placeholderTextColor="#9CA3AF"
            autoComplete="new-password"
          />
          <TextInput
            style={[styles.input, styles.inputOptional]}
            value={referralCode}
            onChangeText={(t) => { setReferralCode(t.toUpperCase()); setReferralWarn(''); }}
            placeholder="Instructor or friend's code (optional)"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={10}
          />
          {referralWarn.length > 0 && <Text style={styles.warnText}>{referralWarn}</Text>}

          {error.length > 0 && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={() => void handleSignUp()}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitBtnText}>{'Create Account'}</Text>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.switchLink} onPress={() => router.replace('/auth/signin')} activeOpacity={0.75}>
          <Text style={styles.switchText}>{'Already have an account? '}<Text style={styles.switchAccent}>{'Sign in'}</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  inner: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 80, paddingBottom: 48 },

  logo: { fontSize: 36, fontWeight: '900', color: Colors.indigo, letterSpacing: 2, marginBottom: 6 },
  tagline: { fontSize: 14, color: '#6B7280', marginBottom: 24 },

  confirmTitle: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 12, marginTop: 16 },
  confirmBody: { fontSize: 15, color: '#6B7280', lineHeight: 22, marginBottom: 32 },
  confirmEmail: { color: '#111827', fontWeight: '600' },
  resendBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 8 },
  resendBtnText: { fontSize: 14, color: Colors.indigo, fontWeight: '600' },
  resendMessage: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginTop: 8 },

  socialErrorText: { fontSize: 13, color: '#EF4444', marginBottom: 8, textAlign: 'center' },

  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 10,
    marginBottom: 12,
  },
  googleG: { fontSize: 17, fontWeight: '800', color: '#4285F4' },
  socialBtnText: { fontSize: 15, color: '#111827', fontWeight: '600' },

  appleBtn: { height: 50, width: '100%', marginBottom: 12 },

  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText: { paddingHorizontal: 12, fontSize: 12, color: '#9CA3AF' },

  form: { gap: 12, marginBottom: 24 },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    color: '#111827',
    fontSize: 15,
  },
  inputOptional: { borderStyle: 'dashed' },
  warnText:  { fontSize: 12, color: '#B45309', marginTop: -4 },
  errorText: { fontSize: 13, color: '#EF4444', marginTop: 2 },
  submitBtn: {
    backgroundColor: Colors.indigo,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  switchLink: { alignItems: 'center', paddingVertical: 8 },
  switchText: { fontSize: 14, color: '#6B7280' },
  switchAccent: { color: Colors.indigo, fontWeight: '600' },
});
