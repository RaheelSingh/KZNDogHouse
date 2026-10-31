import { useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/theme';
import { PillButton } from '@/components/ui';
import { ErrorText, Field, FormScreen } from '@/components/form';
import { EMAIL_REGEX, getPasswordResetErrorMessage } from '@/lib/passwordReset';

export default function ForgotPasswordScreen() {
  const { requestPasswordReset } = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const sendingRef = useRef(false);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(auth)/sign-in');
  };

  const handleSend = async () => {
    // Rule: one request per tap.
    if (sendingRef.current) return;

    setFormError(null);
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setEmailError('Email is required.');
      return;
    }
    if (!EMAIL_REGEX.test(cleanEmail)) {
      setEmailError('Enter a valid email address.');
      return;
    }
    setEmailError(null);

    sendingRef.current = true;
    setIsSending(true);
    try {
      const result = await requestPasswordReset(cleanEmail);
      router.push({
        pathname: '/(auth)/reset-code',
        params: { email: cleanEmail, sent: result.sent ? '1' : '0' },
      });
    } catch (err) {
      setFormError(
        getPasswordResetErrorMessage(err, 'We could not send a code right now. Please try again shortly.')
      );
    } finally {
      sendingRef.current = false;
      setIsSending(false);
    }
  };

  return (
    <FormScreen title="Forgot password" subtitle="We'll email you a verification code." onBack={goBack}>
      <Text style={styles.helper}>
        Enter the email address you use to sign in. If it belongs to an account, we'll send it a code.
      </Text>

      <Field
        label="Email address"
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
        error={emailError}
        editable={!isSending}
      />

      <ErrorText text={formError} />

      <PillButton label="Send code" onPress={handleSend} loading={isSending} style={{ marginTop: 28 }} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  helper: { color: colors.fgMuted, fontSize: 14, lineHeight: 20, marginTop: 4 },
});