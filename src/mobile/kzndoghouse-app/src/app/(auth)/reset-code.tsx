import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/theme';
import { PillButton } from '@/components/ui';
import { ErrorText, Field, FormScreen } from '@/components/form';
import {
  RESET_CODE_REGEX,
  formatCountdown,
  getPasswordResetErrorMessage,
  getResetCooldownRemaining,
  useCountdown,
} from '@/lib/passwordReset';

export default function ResetCodeScreen() {
  const { requestPasswordReset, verifyPasswordResetCode } = useAuth();
  const params = useLocalSearchParams<{ email?: string; sent?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';

  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string>(
    params.sent === '0'
      ? 'A code was already sent to this address recently. Use the latest code in your inbox.'
      : "If an account exists for this email, we've sent it a code. Check your spam folder too."
  );
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const busyRef = useRef(false);

  const { secondsLeft, restart } = useCountdown(0);

  // Load the real remaining wait (it survives closing the app).
  useEffect(() => {
    let active = true;
    getResetCooldownRemaining(email).then((seconds) => {
      if (active) restart(seconds);
    });
    return () => {
      active = false;
    };
  }, [email, restart]);

  // Opened without an email (should not happen) - start again.
  useEffect(() => {
    if (!email) router.replace('/(auth)/forgot-password');
  }, [email]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(auth)/sign-in');
  };

  const handleVerify = async () => {
    if (busyRef.current) return;

    setFormError(null);
    const cleanCode = code.replace(/\s/g, '');
    if (!cleanCode) {
      setCodeError('Enter the code from your email.');
      return;
    }
    if (!RESET_CODE_REGEX.test(cleanCode)) {
      setCodeError('The code is the 6 to 10 digit number in your email.');
      return;
    }
    setCodeError(null);

    busyRef.current = true;
    setIsVerifying(true);
    try {
      await verifyPasswordResetCode(email, cleanCode);
      router.replace('/(auth)/new-password');
    } catch (err) {
      setCode('');
      setFormError(
        getPasswordResetErrorMessage(
          err,
          'That code is incorrect or has expired. Check the latest email we sent you, or request a new code.'
        )
      );
    } finally {
      busyRef.current = false;
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    // Rule: one request per tap, and only after the 5-minute wait.
    if (busyRef.current || secondsLeft > 0) return;

    setFormError(null);
    busyRef.current = true;
    setIsResending(true);
    try {
      const result = await requestPasswordReset(email);
      restart(result.retryAfterSeconds);
      setCode('');
      setNotice(
        result.sent
          ? 'We sent you a new code. Codes from earlier emails no longer work.'
          : 'Please wait before requesting another code.'
      );
    } catch (err) {
      setFormError(
        getPasswordResetErrorMessage(err, 'We could not send a new code right now. Please try again shortly.')
      );
    } finally {
      busyRef.current = false;
      setIsResending(false);
    }
  };

  const resendLabel = secondsLeft > 0 ? `Resend code in ${formatCountdown(secondsLeft)}` : 'Resend code';

  return (
    <FormScreen title="Enter your code" subtitle={email} onBack={goBack}>
      <Text style={styles.notice}>{notice}</Text>
      <Text style={styles.helper}>Codes expire after 15 minutes. Only the latest code works.</Text>

      <Field
        label="Verification code"
        placeholder="12345678"
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        maxLength={10}
        value={code}
        onChangeText={(text) => setCode(text.replace(/[^0-9]/g, ''))}
        error={codeError}
        editable={!isVerifying}
      />

      <ErrorText text={formError} />

      <PillButton
        label="Verify code"
        onPress={handleVerify}
        loading={isVerifying}
        disabled={isResending}
        style={{ marginTop: 28 }}
      />

      <PillButton
        label={resendLabel}
        variant="outline"
        onPress={handleResend}
        loading={isResending}
        disabled={secondsLeft > 0 || isVerifying}
        style={{ marginTop: 14 }}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  notice: { color: '#fff', fontSize: 14, lineHeight: 20, fontWeight: '700', marginTop: 4 },
  helper: { color: colors.fgMuted, fontSize: 13, lineHeight: 19, marginTop: 8 },
});