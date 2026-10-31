import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/theme';
import { PillButton } from '@/components/ui';
import { ErrorText, Field, FormScreen } from '@/components/form';
import { PASSWORD_REGEX, getPasswordResetErrorMessage } from '@/lib/passwordReset';

type PasswordErrors = { password?: string; confirmPassword?: string };

export default function NewPasswordScreen() {
  const { completePasswordReset, cancelPasswordReset } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const completedRef = useRef(false);

  // Leaving this screen without saving (back arrow / Android back button)
  // throws away the half-finished reset session.
  useEffect(() => {
    return () => {
      if (!completedRef.current) {
        cancelPasswordReset();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validate = () => {
    const next: PasswordErrors = {};
    if (!password) next.password = 'Password is required.';
    else if (!PASSWORD_REGEX.test(password)) {
      next.password = 'At least 8 characters, with an uppercase letter, a number and a symbol.';
    }
    if (!confirmPassword) next.confirmPassword = 'Please confirm your password.';
    else if (confirmPassword !== password) next.confirmPassword = 'Passwords do not match.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (savingRef.current) return;

    setFormError(null);
    if (!validate()) return;

    savingRef.current = true;
    setIsSaving(true);
    // Mark as completed first: on success this screen unmounts as the app opens.
    completedRef.current = true;
    try {
      await completePasswordReset(password);
      setIsSaving(false);
      router.replace('/(auth)/sign-in');
      Alert.alert('Password updated', 'Your password has been changed. Please sign in with your new password.');
    } catch (err) {
      completedRef.current = false;
      setFormError(getPasswordResetErrorMessage(err, "We couldn't change your password. Please try again."));
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    // Unmounting runs cancelPasswordReset (see the effect above).
    router.replace('/(auth)/sign-in');
  };

  return (
    <FormScreen title="New password" subtitle="Code verified - choose a new password." onBack={handleBack}>
      <Text style={styles.helper}>
        After saving, any other phones or browsers signed in to your account will be signed out.
      </Text>

      <Field
        label="New password"
        placeholder="••••••••••••"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        editable={!isSaving}
      />

      <Field
        label="Confirm new password"
        placeholder="••••••••••••"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        error={errors.confirmPassword}
        editable={!isSaving}
      />

      <ErrorText text={formError} />

      <PillButton label="Save new password" onPress={handleSave} loading={isSaving} style={{ marginTop: 28 }} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  helper: { color: colors.fgMuted, fontSize: 14, lineHeight: 20, marginTop: 4 },
});
