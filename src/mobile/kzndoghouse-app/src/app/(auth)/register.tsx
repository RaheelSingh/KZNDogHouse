import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { colors, radius } from '@/theme';
import { PillButton } from '@/components/ui';
import { ErrorText, Field, FieldLabel, FormScreen } from '@/components/form';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INTEREST_OPTIONS = ['Dog walking', 'Bathing & grooming', 'Events', 'Fundraising', 'Admin help'];

type StepOneErrors = Partial<
  Record<'firstName' | 'lastName' | 'email' | 'phone' | 'dob' | 'password' | 'confirmPassword', string>
>;

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
  const [availabilityNote, setAvailabilityNote] = useState('');

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    if (!dob.trim()) next.dob = 'Date of birth is required.';
    if (!password) next.password = 'Password is required.';
    else if (password.length < 8) next.password = 'Password must be at least 8 characters.';
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
    setIsSubmitting(true);
    try {
      await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
      });
    } catch (err: any) {
      setFormError(err?.message ?? 'Something went wrong creating your account. Please try again.');
      setIsSubmitting(false);
    }
  };

  const progress = (
    <View>
      <View style={styles.progressRow}>
        <View style={[styles.segment, styles.segmentOn]} />
        <View style={[styles.segment, step === 1 && styles.segmentOn]} />
      </View>
      <View style={styles.progressLabels}>
        <Text style={[styles.progressLabel, step === 0 && styles.progressLabelOn]}>Your details</Text>
        <Text style={[styles.progressLabel, step === 1 && styles.progressLabelOn]}>Availability & interests</Text>
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
              <Field label="First name" value={firstName} onChangeText={setFirstName} placeholder="Zola" error={stepOneErrors.firstName} />
            </View>
            <View style={styles.half}>
              <Field label="Last name" value={lastName} onChangeText={setLastName} placeholder="Mthembu" error={stepOneErrors.lastName} />
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
            error={stepOneErrors.phone}
          />
          <Field label="Date of birth" value={dob} onChangeText={setDob} placeholder="YYYY-MM-DD" error={stepOneErrors.dob} />

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Create a password</Text>
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            secureTextEntry
            error={stepOneErrors.password}
          />
          <Field
            label="Confirm password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter password"
            secureTextEntry
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
                <Pressable key={interest} onPress={() => toggleInterest(interest)} style={[styles.chip, on && styles.chipOn]}>
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{interest}</Text>
                </Pressable>
              );
            })}
          </View>

          <FieldLabel>Anything else you'd like us to know?</FieldLabel>
          <Field
            value={availabilityNote}
            onChangeText={setAvailabilityNote}
            placeholder="Optional"
            multiline
            numberOfLines={4}
            style={{ marginTop: -8 }}
          />

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
});