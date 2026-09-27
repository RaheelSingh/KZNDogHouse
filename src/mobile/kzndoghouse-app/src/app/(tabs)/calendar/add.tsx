import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getCurrentProfileId } from '@/lib/profile';
import DateTimeField from '@/components/DateTimeField';
import type { EventCategory } from '@/types/models';

const GREEN = '#16302a';
const GREEN_DARK = '#0f231e';

const CATEGORIES: EventCategory[] = ['Shift', 'Vet & Care', 'Meeting', 'Public Event', 'Other'];
const VISIBILITIES: ('Internal' | 'Public')[] = ['Internal', 'Public'];

export default function AddEventScreen() {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<EventCategory>('Shift');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startAt, setStartAt] = useState<string | null>(null);
  const [endAt, setEndAt] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<'Internal' | 'Public'>('Internal');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setFormError(null);
    if (!title.trim()) {
      setFormError('Title is required.');
      return;
    }
    if (!startAt) {
      setFormError('Start date & time is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const profileId = await getCurrentProfileId();
      const { data, error } = await supabase
        .from('calendar_events')
        .insert({
          title: title.trim(),
          category,
          description: description.trim() || null,
          location: location.trim() || null,
          start_at: startAt,
          end_at: endAt,
          visibility,
          created_by: profileId,
        })
        .select('id')
        .single();

      if (error) throw error;
      router.replace(`/(tabs)/calendar/${data.id}`);
    } catch (err: any) {
      setFormError(err?.message ?? 'Could not create this event. Please try again.');
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

        <Text style={styles.heading}>Add an event</Text>
        <Text style={styles.subtitle}>Create a shift, meeting, or public event for the calendar.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Title</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Saturday morning walk shift" placeholderTextColor="#8a9a8f" />

          <Text style={styles.label}>Category</Text>
          <View style={styles.chipsWrap}>
            {CATEGORIES.map((c) => (
              <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, category === c && styles.chipSelected]}>
                <Text style={[styles.chipText, category === c && styles.chipTextSelected]}>{c}</Text>
              </Pressable>
            ))}
          </View>

          <DateTimeField label="Starts" value={startAt} onChange={setStartAt} placeholder="Select start date & time" />
          <DateTimeField label="Ends (optional)" value={endAt} onChange={setEndAt} placeholder="Select end date & time" />

          <Text style={styles.label}>Location</Text>
          <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="Main shelter yard" placeholderTextColor="#8a9a8f" />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="What volunteers need to know..."
            placeholderTextColor="#8a9a8f"
            multiline
            numberOfLines={4}
          />

          <Text style={styles.label}>Visibility</Text>
          <View style={styles.chipsWrap}>
            {VISIBILITIES.map((v) => (
              <Pressable key={v} onPress={() => setVisibility(v)} style={[styles.chip, visibility === v && styles.chipSelected]}>
                <Text style={[styles.chipText, visibility === v && styles.chipTextSelected]}>{v}</Text>
              </Pressable>
            ))}
          </View>

          {formError ? <Text style={styles.formError}>{formError}</Text> : null}

          <Pressable style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Save event</Text>}
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