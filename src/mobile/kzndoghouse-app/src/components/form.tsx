import { useState, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { colors, radius } from '@/theme';
import { PageHeader } from '@/components/ui';


export function FormScreen({
  title,
  subtitle,
  onBack,
  header,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  header?: ReactNode;
  children: ReactNode;
}) {
  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <PageHeader title={title} subtitle={subtitle} onBack={onBack}>
        {header}
      </PageHeader>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function FieldLabel({ children }: { children: string }) {
  return <Text style={[s.label, { marginTop: 18 }]}>{children}</Text>;
}

export function ErrorText({ text }: { text?: string | null }) {
  return text ? <Text style={s.error}>{text}</Text> : null;
}

export function Field({
  label,
  error,
  style,
  ...props
}: TextInputProps & { label?: string; error?: string | null }) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = Boolean(props.secureTextEntry);
  return (
    <View style={{ marginTop: 16 }}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <View style={isPassword ? s.passwordRow : undefined}>
        <TextInput
          placeholderTextColor={colors.fgFaint}
          {...props}
          secureTextEntry={isPassword && !passwordVisible}
          autoCapitalize={isPassword ? 'none' : props.autoCapitalize}
          autoCorrect={isPassword ? false : props.autoCorrect}
          spellCheck={isPassword ? false : props.spellCheck}
          style={[s.input, props.multiline && s.inputMulti, isPassword && s.passwordInput, style]}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setPasswordVisible((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
            accessibilityState={{ selected: passwordVisible }}
            hitSlop={8}
            style={s.visibilityButton}
          >
            <Ionicons name={passwordVisible ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.fgMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={s.chipWrap}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable key={o} onPress={() => onChange(o)} style={[s.chip, on && s.chipOn]}>
            <Text style={[s.chipText, on && s.chipTextOn]}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  content: { padding: 20, paddingBottom: 60 },
  label: { color: colors.fgMuted, fontSize: 12, fontWeight: '800', letterSpacing: 0.4, marginBottom: 8 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.fg,
  },
  inputMulti: { minHeight: 100, textAlignVertical: 'top' },
  passwordRow: { position: 'relative', justifyContent: 'center' },
  passwordInput: { width: '100%', paddingRight: 58 },
  visibilityButton: { position: 'absolute', right: 3, top: 0, bottom: 0, width: 50, alignItems: 'center', justifyContent: 'center' },
  error: { color: colors.dangerSoft, fontSize: 12, marginTop: 6 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chipOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: colors.header, fontWeight: '800' },
});