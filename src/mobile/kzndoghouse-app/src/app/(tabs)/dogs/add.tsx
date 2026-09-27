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
import { supabase } from '@/lib/supabase';
import { getCurrentProfileId } from '@/lib/profile';

const GREEN = '#16302a';
const GREEN_DARK = '#0f231e';

const GENDERS = ['Male', 'Female', 'Unknown'] as const;

export default function AddDogScreen() {
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [gender, setGender] = useState<(typeof GENDERS)[number]>('Unknown');
  const [ageYears, setAgeYears] = useState('');
  const [size, setSize] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [eyeColour, setEyeColour] = useState('');
  const [kennelLocation, setKennelLocation] = useState('');
  const [about, setAbout] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setFormError(null);
    if (!name.trim()) {
      setFormError('Name is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const profileId = await getCurrentProfileId();
      const { data, error } = await supabase
        .from('dogs')
        .insert({
          name: name.trim(),
          breed: breed.trim() || null,
          gender,
          estimated_age_years: ageYears ? Number(ageYears) : null,
          size: size.trim() || null,
          weight_kg: weightKg ? Number(weightKg) : null,
          eye_colour: eyeColour.trim() || null,
          kennel_location: kennelLocation.trim() || null,
          about: about.trim() || null,
          created_by: profileId,
        })
        .select('id')
        .single();

      if (error) throw error;
      router.replace(`/(tabs)/dogs/${data.id}`);
    } catch (err: any) {
      setFormError(err?.message ?? 'Could not add this dog. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{'←'}</Text>
        </Pressable>

        <Text style={styles.heading}>Add a dog</Text>
        <Text style={styles.subtitle}>Create a digital profile for a new arrival.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Rosie" placeholderTextColor="#8a9a8f" />

          <Text style={styles.label}>Breed</Text>
          <TextInput style={styles.input} value={breed} onChangeText={setBreed} placeholder="Mixed breed" placeholderTextColor="#8a9a8f" />

          <Text style={styles.label}>Gender</Text>
          <View style={styles.chipsWrap}>
            {GENDERS.map((g) => (
              <Pressable key={g} onPress={() => setGender(g)} style={[styles.chip, gender === g && styles.chipSelected]}>
                <Text style={[styles.chipText, gender === g && styles.chipTextSelected]}>{g}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.rowTwo}>
            <View style={styles.half}>
              <Text style={styles.label}>Age (years)</Text>
              <TextInput style={styles.input} value={ageYears} onChangeText={setAgeYears} placeholder="3" placeholderTextColor="#8a9a8f" keyboardType="numeric" />
            </View>
            <View style={styles.half}>
              <Text style={styles.label}>Weight (kg)</Text>
              <TextInput style={styles.input} value={weightKg} onChangeText={setWeightKg} placeholder="18" placeholderTextColor="#8a9a8f" keyboardType="numeric" />
            </View>
          </View>

          <View style={styles.rowTwo}>
            <View style={styles.half}>
              <Text style={styles.label}>Size</Text>
              <TextInput style={styles.input} value={size} onChangeText={setSize} placeholder="Medium" placeholderTextColor="#8a9a8f" />
            </View>
            <View style={styles.half}>
              <Text style={styles.label}>Eye colour</Text>
              <TextInput style={styles.input} value={eyeColour} onChangeText={setEyeColour} placeholder="Brown" placeholderTextColor="#8a9a8f" />
            </View>
          </View>

          <Text style={styles.label}>Kennel location</Text>
          <TextInput style={styles.input} value={kennelLocation} onChangeText={setKennelLocation} placeholder="Block B · Run 4" placeholderTextColor="#8a9a8f" />

          <Text style={styles.label}>About</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={about}
            onChangeText={setAbout}
            placeholder="Temperament, background, anything staff should know..."
            placeholderTextColor="#8a9a8f"
            multiline
            numberOfLines={4}
          />

          {formError ? <Text style={styles.formError}>{formError}</Text> : null}

          <Pressable style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Save dog</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: GREEN_DARK },
  container: { flexGrow: 1, padding: 24, paddingTop: 60 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  backText: { color: '#fff', fontSize: 18 },
  heading: { color: '#fff', fontSize: 24, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 6, marginBottom: 20 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 24 },
  label: { fontSize: 13, fontWeight: '600', color: GREEN, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#d9e0d9', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: GREEN },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  rowTwo: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#d9e0d9', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipSelected: { backgroundColor: GREEN, borderColor: GREEN },
  chipText: { color: GREEN, fontSize: 13 },
  chipTextSelected: { color: '#fff' },
  formError: { color: '#b3261e', fontSize: 13, marginTop: 16, textAlign: 'center' },
  submitBtn: { backgroundColor: GREEN, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 22 },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});