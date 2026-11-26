import React, { useEffect, useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';
import { testDateError } from '@/src/testDateRules';
import { useDesignTheme } from '@/src/design';
import { Button, Text } from '@/src/ui';

/** DD/MM/YYYY -> ISO, same parsing as the current Home's date modal. */
export function parseDdMmYyyy(input: string): string | null {
  const m = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const day = parseInt(m[1]!, 10);
  const month = parseInt(m[2]!, 10) - 1;
  const year = parseInt(m[3]!, 10);
  const d = new Date(year, month, day);
  if (isNaN(d.getTime()) || d.getMonth() !== month) return null;
  return d.toISOString();
}

/** Test-date editor for the ui_v2 Home: same validation (testDateError) as today. */
export function TestDateModal({ visible, initial, onClose, onSave }: {
  visible: boolean; initial: string | null; onClose: () => void; onSave: (iso: string) => Promise<void>;
}) {
  const { colors, radii, textStyle } = useDesignTheme();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!visible) return;
    if (initial) {
      const d = new Date(initial);
      setValue(`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`);
    } else setValue('');
    setError('');
  }, [visible, initial]);

  async function submit() {
    const iso = parseDdMmYyyy(value.trim());
    if (!iso) { setError('Enter a valid date in DD/MM/YYYY format'); return; }
    const rangeError = testDateError(iso, new Date());
    if (rangeError) { setError(rangeError); return; }
    await onSave(iso);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }} onPress={onClose} accessibilityLabel="Close">
        <Pressable style={{ backgroundColor: colors.bg.card, borderRadius: radii.card, padding: 20, gap: 12, maxWidth: 420, width: '100%', alignSelf: 'center' }} onPress={() => {}}>
          <Text variant="title">{'Your test date'}</Text>
          <Text variant="bodySmall" color="secondary">{'Optional. Add it for a countdown and a plan that fits.'}</Text>
          <Text variant="label" nativeID="testDateLabel">{'Date (DD/MM/YYYY)'}</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder="DD/MM/YYYY"
            placeholderTextColor={colors.text.secondary}
            accessibilityLabel="Test date, DD/MM/YYYY"
            accessibilityLabelledBy="testDateLabel"
            keyboardType="numbers-and-punctuation"
            style={[textStyle('body'), {
              color: colors.text.primary, borderWidth: 1.5, borderColor: error ? colors.status.error : colors.border.strong,
              borderRadius: radii.control, paddingHorizontal: 14, minHeight: 48,
            }]}
          />
          {error ? <Text variant="bodySmall" color="error" accessibilityLiveRegion="polite">{error}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
            <Button label="Cancel" variant="ghost" onPress={onClose} />
            <Button label="Save" onPress={() => void submit()} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
