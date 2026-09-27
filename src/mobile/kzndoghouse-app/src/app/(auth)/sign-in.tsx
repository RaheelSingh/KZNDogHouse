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
  TextInput,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignInScreen() {
  const { signIn } = useAuth();

 
  const [accountType, setAccountType] = useState<'volunteer' | 'staff'>('volunteer');

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
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.logoWrap}>
          <Text style={styles.brand}>The KZN Doghouse</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.subtitle}>Welcome back</Text>

          <View style={styles.toggleRow}>
            <Pressable
              style={[styles.toggleBtn, accountType === 'volunteer' && styles.toggleBtnActive]}
              onPress={() => setAccountType('volunteer')}
            >
              <Text
                style={[
                  styles.toggleText,
                  accountType === 'volunteer' && styles.toggleTextActive,
                ]}
              >
                Volunteer
              </Text>
            </Pressable>
            <Pressable
              style={[styles.toggleBtn, accountType === 'staff' && styles.toggleBtnActive]}
              onPress={() => setAccountType('staff')}
            >
              <Text
                style={[styles.toggleText, accountType === 'staff' && styles.toggleTextActive]}
              >
                Staff
              </Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Email address</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="#8a9a8f"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
          />
          {errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#8a9a8f"
            secureTextEntry
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
          />
          {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}

          <View style={styles.row}>
            <Pressable style={styles.checkboxRow} onPress={() => setStaySignedIn((v) => !v)}>
              <View style={[styles.checkbox, staySignedIn && styles.checkboxChecked]} />
              <Text style={styles.checkboxLabel}>Stay signed in</Text>
            </Pressable>

            <Pressable
              onPress={() =>
                Alert.alert('Forgot password', 'Password reset is not implemented yet.')
              }
            >
              <Text style={styles.link}>Forgot?</Text>
            </Pressable>
          </View>

          {formError ? <Text style={styles.formError}>{formError}</Text> : null}

          <Pressable
            style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
            onPress={handleSignIn}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Sign in</Text>
            )}
          </Pressable>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>New volunteer? </Text>
            <Link href="/(auth)/register" asChild>
              <Pressable>
                <Text style={styles.link}>Apply to join the team</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const GREEN = '#16302a';
const GREEN_DARK = '#0f231e';

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: GREEN_DARK },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoWrap: { alignItems: 'center', marginBottom: 24 },
  brand: { color: '#fff', fontSize: 20, fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 24 },
  title: { fontSize: 24, fontWeight: '700', color: '#16302a' },
  subtitle: { fontSize: 14, color: '#6b7a70', marginBottom: 20 },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#eef2ee',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: '#fff' },
  toggleText: { color: '#6b7a70', fontWeight: '600' },
  toggleTextActive: { color: GREEN },
  label: { fontSize: 13, fontWeight: '600', color: '#16302a', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#d9e0d9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#16302a',
  },
  fieldError: { color: '#b3261e', fontSize: 12, marginTop: 4 },
  formError: {
    color: '#b3261e',
    fontSize: 13,
    marginTop: 14,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'center' },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#9aa89f',
    marginRight: 8,
  },
  checkboxChecked: { backgroundColor: GREEN, borderColor: GREEN },
  checkboxLabel: { fontSize: 13, color: '#16302a' },
  link: { fontSize: 13, color: GREEN, fontWeight: '600' },
  submitBtn: {
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 22,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },
  footerText: { fontSize: 13, color: '#6b7a70' },
});