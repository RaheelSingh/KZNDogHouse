import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '@/context/AuthContext';
import { colors, radius } from '@/theme';
import { PillButton, UnderlineTabs } from '@/components/ui';
import { Field } from '@/components/form';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AccountType = 'volunteer' | 'staff';

export default function SignInScreen() {
  const { signIn } = useAuth();

  const [accountType, setAccountType] = useState<AccountType>('volunteer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [staySignedIn, setStaySignedIn] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = () => {
    const next: { email?: string; password?: string } = {};
    if (!email.trim()) next.email = 'Email is required.';
    else if (!EMAIL_REGEX.test(email.trim())) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Password is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSignIn = async () => {
    setFormError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch (err: any) {
      setFormError(err?.message ?? 'Sign in failed. Please check your details and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="light" />
      <LinearGradient colors={[colors.header, colors.primary]} style={StyleSheet.absoluteFill} />
      <Ionicons name="paw" size={420} color="rgba(255,255,255,0.045)" style={styles.paw} />

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.brandPill}>
          <Ionicons name="paw" size={16} color={colors.gold} />
          <Text style={styles.brandText}>The KZN Doghouse</Text>
        </View>

        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.subtitle}>Welcome back to the pack.</Text>

        <UnderlineTabs
          tabs={[
            { key: 'volunteer', label: 'Volunteer' },
            { key: 'staff', label: 'Staff' },
          ]}
          active={accountType}
          onChange={setAccountType}
        />

        <Field
          label="Email address"
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
        />
        <Field
          label="Password"
          placeholder="••••••••"
          secureTextEntry
          autoComplete="password"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
        />

        <View style={styles.row}>
          <Pressable style={styles.checkRow} onPress={() => setStaySignedIn((v) => !v)}>
            <View style={[styles.checkbox, staySignedIn && styles.checkboxOn]}>
              {staySignedIn ? <Ionicons name="checkmark" size={12} color={colors.header} /> : null}
            </View>
            <Text style={styles.checkLabel}>Stay signed in</Text>
          </Pressable>

          <Pressable onPress={() => Alert.alert('Forgot password', 'Password reset is not implemented yet.')}>
            <Text style={styles.forgot}>Forgot?</Text>
          </Pressable>
        </View>

        {formError ? <Text style={styles.formError}>{formError}</Text> : null}

        <PillButton label="Sign in" onPress={handleSignIn} loading={isSubmitting} style={{ marginTop: 24 }} />

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>New volunteer? </Text>
          <Link href="/(auth)/register" asChild>
            <Pressable>
              <Text style={styles.footerLink}>Apply to join the team</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  paw: { position: 'absolute', right: -110, bottom: 40 },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingTop: 70 },

  brandPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 9,
    marginBottom: 36,
  },
  brandText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  title: { color: '#fff', fontSize: 40, fontWeight: '800' },
  subtitle: { color: colors.fgMuted, fontSize: 15, marginTop: 4, marginBottom: 6 },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.fgMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  checkLabel: { color: colors.fgMuted, fontSize: 13 },
  forgot: { color: colors.gold, fontSize: 13, fontWeight: '800' },

  formError: { color: colors.dangerSoft, fontSize: 13, marginTop: 16, textAlign: 'center' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 22 },
  footerText: { color: colors.fgMuted, fontSize: 13 },
  footerLink: { color: '#fff', fontSize: 13, fontWeight: '800' },
});