import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INTEREST_OPTIONS = ['Dog walking', 'Bathing & grooming', 'Events', 'Fundraising', 'Admin help'];

type StepOneErrors = Partial<Record<'firstName' | 'lastName' | 'email' | 'phone' | 'dob' | 'password' | 'confirmPassword', string>>;

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

  const handleBack = () => setStep(0);

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

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => (step === 0 ? router.back() : handleBack())} style={styles.backBtn}>
          <Text style={styles.backText}>{'←'}</Text>
        </Pressable>

        <Text style={styles.title}>Apply to volunteer</Text>
        <Text style={styles.heading}>Let's get you started.</Text>
        <Text style={styles.subtitle}>
          A coordinator will review your application within 3–5 days.
        </Text>

        <View style={styles.progressRow}>
          <View style={[styles.progressSegment, styles.progressActive]} />
          <View style={[styles.progressSegment, step === 1 && styles.progressActive]} />
        </View>
        <View style={styles.progressLabels}>
          <Text style={[styles.progressLabel, step === 0 && styles.progressLabelActive]}>
            Your details
          </Text>
          <Text style={[styles.progressLabel, step === 1 && styles.progressLabelActive]}>
            Availability & interests
          </Text>
        </View>

        {step === 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>About you</Text>

            <View style={styles.rowTwo}>
              <View style={styles.half}>
                <Text style={styles.label}>First name</Text>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="Zola"
                  placeholderTextColor="#8a9a8f"
                />
                {stepOneErrors.firstName ? (
                  <Text style={styles.fieldError}>{stepOneErrors.firstName}</Text>
                ) : null}
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>Last name</Text>
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Mthembu"
                  placeholderTextColor="#8a9a8f"
                />
                {stepOneErrors.lastName ? (
                  <Text style={styles.fieldError}>{stepOneErrors.lastName}</Text>
                ) : null}
              </View>
            </View>

            <Text style={styles.label}>Email address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#8a9a8f"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            {stepOneErrors.email ? <Text style={styles.fieldError}>{stepOneErrors.email}</Text> : null}

            <Text style={styles.label}>Phone number</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+27 82 000 0000"
              placeholderTextColor="#8a9a8f"
              keyboardType="phone-pad"
            />
            {stepOneErrors.phone ? <Text style={styles.fieldError}>{stepOneErrors.phone}</Text> : null}

            <Text style={styles.label}>Date of birth</Text>
            <TextInput
              style={styles.input}
              value={dob}
              onChangeText={setDob}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#8a9a8f"
            />
            {stepOneErrors.dob ? <Text style={styles.fieldError}>{stepOneErrors.dob}</Text> : null}

            <Text style={styles.sectionTitle}>Create a password</Text>

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              placeholderTextColor="#8a9a8f"
              secureTextEntry
            />
            {stepOneErrors.password ? (
              <Text style={styles.fieldError}>{stepOneErrors.password}</Text>
            ) : null}

            <Text style={styles.label}>Confirm password</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter password"
              placeholderTextColor="#8a9a8f"
              secureTextEntry
            />
            {stepOneErrors.confirmPassword ? (
              <Text style={styles.fieldError}>{stepOneErrors.confirmPassword}</Text>
            ) : null}

            {formError ? <Text style={styles.formError}>{formError}</Text> : null}

            <Pressable style={styles.submitBtn} onPress={handleNext}>
              <Text style={styles.submitText}>Next</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>How would you like to help?</Text>
            <Text style={styles.helperText}>Select any that interest you.</Text>

            <View style={styles.chipsWrap}>
              {INTEREST_OPTIONS.map((interest) => {
                const selected = selectedInterests.includes(interest);
                return (
                  <Pressable
                    key={interest}
                    onPress={() => toggleInterest(interest)}
                    style={[styles.chip, selected && styles.chipSelected]}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {interest}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Anything else you'd like us to know?</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={availabilityNote}
              onChangeText={setAvailabilityNote}
              placeholder="Optional"
              placeholderTextColor="#8a9a8f"
              multiline
              numberOfLines={4}
            />

            {formError ? <Text style={styles.formError}>{formError}</Text> : null}

            <Pressable
              style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>Submit application</Text>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const GREEN = '#16302a';
const GREEN_DARK = '#0f231e';
const GOLD = '#c98a2c';

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: GREEN_DARK },
  container: { flexGrow: 1, padding: 24, paddingTop: 60 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  backText: { color: '#fff', fontSize: 18 },
  title: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 4 },
  heading: { color: '#fff', fontSize: 24, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 6, marginBottom: 20 },
  progressRow: { flexDirection: 'row', gap: 8 },
  progressSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
  progressActive: { backgroundColor: GOLD },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: 20 },
  progressLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11 },
  progressLabelActive: { color: '#fff', fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 24, marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: GREEN, marginTop: 8, marginBottom: 4 },
  helperText: { fontSize: 12, color: '#6b7a70', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: GREEN, marginBottom: 6, marginTop: 12 },
  rowTwo: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: '#d9e0d9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: GREEN,
  },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  fieldError: { color: '#b3261e', fontSize: 12, marginTop: 4 },
  formError: { color: '#b3261e', fontSize: 13, marginTop: 16, textAlign: 'center' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#d9e0d9',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipSelected: { backgroundColor: GREEN, borderColor: GREEN },
  chipText: { color: GREEN, fontSize: 13 },
  chipTextSelected: { color: '#fff' },
  submitBtn: {
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 22,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});