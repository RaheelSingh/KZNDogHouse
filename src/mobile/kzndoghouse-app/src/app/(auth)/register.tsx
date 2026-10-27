import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { colors, radius } from '@/theme';
import { PillButton } from '@/components/ui';
import { ErrorText, Field, FieldLabel, FormScreen } from '@/components/form';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Same rule as the website's RegisterViewModel.
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MIN_AGE = 16;
const MAX_NAME_LENGTH = 50;
const MAX_NOTE_LENGTH = 500;
const INTEREST_OPTIONS = ['Dog walking', 'Bathing & grooming', 'Events', 'Fundraising', 'Admin help'];

type StepOneField = 'firstName' | 'lastName' | 'email' | 'phone' | 'dob' | 'password' | 'confirmPassword';
type StepOneErrors = Partial<Record<StepOneField, string>>;

/** Returns an error message, or null if the date is a real date and the person is old enough. */
function validateDob(value: string): string | null {
  if (!DATE_REGEX.test(value)) return 'Use the format YYYY-MM-DD.';
  const [year, month, day] = value.split('-').map(Number);
  const dob = new Date(year, month - 1, day);
  if (dob.getFullYear() !== year || dob.getMonth() !== month - 1 || dob.getDate() !== day) {
    return 'Enter a real date.';
  }
  const today = new Date();
  if (dob > today) return 'Date of birth cannot be in the future.';

  let age = today.getFullYear() - year;
  const birthdayPassed = today.getMonth() > month - 1 || (today.getMonth() === month - 1 && today.getDate() >= day);
  if (!birthdayPassed) age -= 1;
  if (age < MIN_AGE) return `Volunteers must be at least ${MIN_AGE} years old.`;
  if (age > 110) return 'Enter a valid date of birth.';
  return null;
}

function validatePhone(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  if (!/^\+?[\d\s()-]+$/.test(value) || digits.length < 9 || digits.length > 15) {
    return 'Enter a valid phone number.';
  }
  return null;
}

export default function RegisterScreen() {
  const { register } = useAuth();
  const [step, setStep] = useState<0 | 1>(0);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [stepOneErrors, setStepOneErrors] = useState<StepOneErrors>({});

  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [note, setNote] = useState('');

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmEmailSentTo, setConfirmEmailSentTo] = useState<string | null>(null);

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  const validateStepOne = () => {
    const next: StepOneErrors = {};
    if (!firstName.trim()) next.firstName = 'First name is required.';
    if (!lastName.trim()) next.lastName = 'Last name is required.';

    if (!email.trim()) next.email = 'Email is required.';
    else if (!EMAIL_REGEX.test(email.trim())) next.email = 'Enter a valid email address.';

    if (!phone.trim()) next.phone = 'Phone number is required.';
    else {
      const phoneError = validatePhone(phone.trim());
      if (phoneError) next.phone = phoneError;
    }

    if (!dob.trim()) next.dob = 'Date of birth is required.';
    else {
      const dobError = validateDob(dob.trim());
      if (dobError) next.dob = dobError;
    }

    if (!password) next.password = 'Password is required.';
    else if (!PASSWORD_REGEX.test(password)) {
      next.password = 'At least 8 characters, with an uppercase letter, a number and a symbol.';
    }

    if (!confirmPassword) next.confirmPassword = 'Please confirm your password.';
    else if (confirmPassword !== password) next.confirmPassword = 'Passwords do not match.';

    setStepOneErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleNext = () => {
    setFormError(null);
    if (validateStepOne()) setStep(1);
  };

  const handleSubmit = async () => {
    setFormError(null);
    if (selectedInterests.length === 0) {
      setFormError('Pick at least one way you would like to help.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { needsEmailConfirmation } = await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        dateOfBirth: dob.trim(),
        interests: selectedInterests,
        note: note.trim(),
        password,
      });

      if (needsEmailConfirmation) {
        setConfirmEmailSentTo(email.trim().toLowerCase());
      }
      // Otherwise the user is signed in and the root layout shows the "awaiting approval" screen.
    } catch (err: any) {
      console.warn('[register] sign up failed:', err);
      const message = String(err?.message ?? '');
      if (/already registered|already exists/i.test(message)) {
        setFormError('An account with this email already exists. Try signing in instead.');
      } else if (/password/i.test(message)) {
        setFormError('That password was rejected. Please choose a stronger one.');
      } else {
        setFormError('Something went wrong creating your account. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (confirmEmailSentTo) {
    return (
      <FormScreen title="Check your email" onBack={() => router.replace('/(auth)/sign-in')}>
        <View style={styles.doneBox}>
          <Ionicons name="mail-open-outline" size={48} color={colors.gold} />
          <Text style={styles.doneText}>
            We sent a confirmation link to <Text style={styles.doneEmail}>{confirmEmailSentTo}</Text>. Tap it, then
            sign in. A coordinator will review your application within 3–5 days.
          </Text>
          <PillButton
            label="Back to sign in"
            onPress={() => router.replace('/(auth)/sign-in')}
            style={{ marginTop: 26, alignSelf: 'stretch' }}
          />
        </View>
      </FormScreen>
    );
  }

  const progress = (
    <View>
      <View style={styles.progressRow}>
        <View style={[styles.segment, styles.segmentOn]} />
        <View style={[styles.segment, step === 1 && styles.segmentOn]} />
      </View>
      <View style={styles.progressLabels}>
        <Text style={[styles.progressLabel, step === 0 && styles.progressLabelOn]}>Your details</Text>
        <Text style={[styles.progressLabel, step === 1 && styles.progressLabelOn]}>How you'd like to help</Text>
      </View>
    </View>
  );

  return (
    <FormScreen
      title="Apply to volunteer"
      subtitle="A coordinator will review your application within 3–5 days."
      onBack={() => (step === 0 ? router.back() : setStep(0))}
      header={progress}
    >
      {step === 0 ? (
        <View>
          <Text style={styles.sectionTitle}>About you</Text>

          <View style={styles.rowTwo}>
            <View style={styles.half}>
              <Field
                label="First name"
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Zola"
                autoComplete="given-name"
                maxLength={MAX_NAME_LENGTH}
                error={stepOneErrors.firstName}
              />
            </View>
            <View style={styles.half}>
              <Field
                label="Last name"
                value={lastName}
                onChangeText={setLastName}
                placeholder="Mthembu"
                autoComplete="family-name"
                maxLength={MAX_NAME_LENGTH}
                error={stepOneErrors.lastName}
              />
            </View>
          </View>

          <Field
            label="Email address"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            error={stepOneErrors.email}
          />
          <Field
            label="Phone number"
            value={phone}
            onChangeText={setPhone}
            placeholder="+27 82 000 0000"
            keyboardType="phone-pad"
            autoComplete="tel"
            maxLength={20}
            error={stepOneErrors.phone}
          />
          <Field
            label="Date of birth"
            value={dob}
            onChangeText={setDob}
            placeholder="YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            error={stepOneErrors.dob}
          />

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Create a password</Text>
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="8+ characters, A–Z, 0–9 and a symbol"
            secureTextEntry
            autoComplete="new-password"
            error={stepOneErrors.password}
          />
          <Field
            label="Confirm password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter password"
            secureTextEntry
            autoComplete="new-password"
            error={stepOneErrors.confirmPassword}
          />

          <ErrorText text={formError} />

          <PillButton label="Next" onPress={handleNext} style={{ marginTop: 26 }} />
        </View>
      ) : (
        <View>
          <Text style={styles.sectionTitle}>How would you like to help?</Text>
          <Text style={styles.helper}>Select any that interest you.</Text>

          <View style={styles.chipsWrap}>
            {INTEREST_OPTIONS.map((interest) => {
              const on = selectedInterests.includes(interest);
              return (
                <Pressable
                  key={interest}
                  onPress={() => toggleInterest(interest)}
                  style={[styles.chip, on && styles.chipOn]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{interest}</Text>
                </Pressable>
              );
            })}
          </View>

          <FieldLabel>Anything else you'd like us to know?</FieldLabel>
          <Field
            value={note}
            onChangeText={setNote}
            placeholder="Optional - e.g. which days usually suit you"
            multiline
            numberOfLines={4}
            maxLength={MAX_NOTE_LENGTH}
            style={{ marginTop: -8 }}
          />
          <Text style={styles.counter}>
            {note.length}/{MAX_NOTE_LENGTH}
          </Text>

          <ErrorText text={formError} />

          <PillButton label="Submit application" loading={isSubmitting} onPress={handleSubmit} style={{ marginTop: 26 }} />
        </View>
      )}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  progressRow: { flexDirection: 'row', gap: 8, marginTop: 18 },
  segment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
  segmentOn: { backgroundColor: colors.gold },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: 6 },
  progressLabel: { color: colors.fgFaint, fontSize: 11 },
  progressLabelOn: { color: '#fff', fontWeight: '800' },

  sectionTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  helper: { color: colors.fgMuted, fontSize: 13, marginTop: 4, marginBottom: 14 },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 26 },
  rowTwo: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  counter: { color: colors.fgFaint, fontSize: 11, textAlign: 'right', marginTop: 6 },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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

  doneBox: { alignItems: 'center', paddingTop: 30 },
  doneText: { color: colors.fgMuted, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 18 },
  doneEmail: { color: '#fff', fontWeight: '800' },
});