import React, { useEffect, useState } from 'react';
import {
  Alert as RNAlert,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type AlertButton,
  type AlertOptions,
} from 'react-native';
import { Colors } from './constants/theme';

// Drop-in replacement for react-native's Alert: on iOS/Android it forwards
// straight to Alert.alert with identical arguments (native behaviour is
// completely unchanged), but Alert.alert is a documented no-op on
// react-native-web — every call site that reaches it on web today shows
// nothing at all. On web this renders a Modal instead (same visual recipe
// as Mock Test's exit-confirmation card), so migrating a call site to this
// module is just changing where `Alert` is imported from — the
// `Alert.alert(title, message, buttons, options)` call itself never
// changes.
//
// Requires <CrossPlatformAlertHost /> mounted once near the app root
// (app/_layout.tsx) — it owns the actual Modal on web. Calling alert()
// before the host has mounted is a silent no-op on web, same as calling it
// after unmount; there is exactly one host for the whole app.

type WebAlertState = {
  title: string;
  message?: string;
  buttons: AlertButton[];
} | null;

let setWebAlertState: ((s: WebAlertState) => void) | null = null;

function alert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions): void {
  if (Platform.OS !== 'web') {
    RNAlert.alert(title, message, buttons, options);
    return;
  }
  // RN shows a single "OK" button when none are given — match that.
  const resolvedButtons = buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }];
  setWebAlertState?.({ title, message, buttons: resolvedButtons });
}

export const Alert = { alert };

export function CrossPlatformAlertHost() {
  const [state, setState] = useState<WebAlertState>(null);

  useEffect(() => {
    setWebAlertState = setState;
    return () => {
      setWebAlertState = null;
    };
  }, []);

  // Native never reaches this — alert() forwards straight to RNAlert there
  // — so the host only ever renders its Modal on web.
  if (Platform.OS !== 'web' || !state) return null;

  function press(button: AlertButton) {
    setState(null);
    button.onPress?.();
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setState(null)}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{state.title}</Text>
          {!!state.message && <Text style={styles.message}>{state.message}</Text>}
          {state.buttons.map((button, i) => (
            <TouchableOpacity
              key={i}
              style={[
                styles.btn,
                button.style === 'destructive'
                  ? styles.destructiveBtn
                  : button.style === 'cancel'
                    ? styles.cancelBtn
                    : styles.defaultBtn,
              ]}
              onPress={() => press(button)}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.btnText,
                  button.style === 'destructive'
                    ? styles.destructiveBtnText
                    : button.style === 'cancel'
                      ? styles.cancelBtnText
                      : styles.defaultBtnText,
                ]}
              >
                {button.text ?? 'OK'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
}

// Same recipe as mock.tsx's pauseOverlay/pauseCard and hazard.tsx's
// exitConfirmOverlay/exitConfirmCard — dark overlay, centered white rounded
// card — kept local rather than a shared style module since none exists
// between these files today.
const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    width: '82%',
    maxWidth: 400,
    alignItems: 'center',
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: '900', color: '#111827', textAlign: 'center' },
  message: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  btn: { borderRadius: 14, paddingVertical: 14, width: '100%', alignItems: 'center' },
  btnText: { fontSize: 16, fontWeight: '700' },
  defaultBtn: { backgroundColor: Colors.indigo, marginTop: 4 },
  defaultBtnText: { color: '#FFFFFF' },
  cancelBtn: { borderWidth: 1, borderColor: '#E5E7EB' },
  cancelBtnText: { color: '#6B7280', fontSize: 14, fontWeight: '600' },
  destructiveBtn: { backgroundColor: '#EF4444' },
  destructiveBtnText: { color: '#FFFFFF' },
});
