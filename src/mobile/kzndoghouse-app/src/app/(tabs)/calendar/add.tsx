import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getCurrentProfileId } from '@/lib/profile';
import { toFriendlyMessage } from '@/lib/events';
import { colors, radius } from '@/theme';
import { PillButton } from '@/components/ui';
import { ChipGroup, ErrorText, Field, FieldLabel, FormScreen } from '@/components/form';
import DateTimeField from '@/components/DateTimeField';
import type { EventCategory } from '@/types/models';

const CATEGORIES: readonly EventCategory[] = ['Shift', 'Vet & Care', 'Meeting', 'Public Event', 'Other'];
const VISIBILITIES = ['Internal', 'Public'] as const;
const SIGNUP_BY_DEFAULT: readonly EventCategory[] = ['Shift', 'Public Event'];

const MAX_TITLE_LENGTH = 120;
const MAX_VOLUNTEERS_LIMIT = 200; // matches calendar_events_max_volunteers_check in SQL

export default function AddEventScreen() {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<EventCategory>('Shift');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startAt, setStartAt] = useState<string | null>(null);
  const [endAt, setEndAt] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<(typeof VISIBILITIES)[number]>('Internal');
  const [signupEnabled, setSignupEnabled] = useState(true);
  const [signupTouched, setSignupTouched] = useState(false);
  const [maxVolunteers, setMaxVolunteers] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Follow the category's sensible default until the user flips the switch themselves.
  const handleCategoryChange = (next: EventCategory) => {
    setCategory(next);
    if (!signupTouched) setSignupEnabled(SIGNUP_BY_DEFAULT.includes(next));
  };

  const handleSignupToggle = (value: boolean) => {
    setSignupTouched(true);
    setSignupEnabled(value);
  };

  const validate = (): { error: string | null; max: number | null } => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return { error: 'Title is required.', max: null };
    if (trimmedTitle.length > MAX_TITLE_LENGTH) {
      return { error: `Title must be ${MAX_TITLE_LENGTH} characters or fewer.`, max: null };
    }
    if (!startAt) return { error: 'Start date & time is required.', max: null };
    if (new Date(startAt).getTime() <= Date.now()) {
      return { error: 'The start time must be in the future.', max: null };
    }
    if (endAt && new Date(endAt).getTime() <= new Date(startAt).getTime()) {
      return { error: 'The end time must be after the start time.', max: null };
    }

    let max: number | null = null;
    if (signupEnabled && maxVolunteers.trim()) {
      max = Number(maxVolunteers.trim());
      if (!Number.isInteger(max) || max < 1 || max > MAX_VOLUNTEERS_LIMIT) {
        return { error: `Max volunteers must be a whole number from 1 to ${MAX_VOLUNTEERS_LIMIT}.`, max: null };
      }
    }
    return { error: null, max };
  };

  const handleSubmit = async () => {
    setFormError(null);
    const { error: validationError, max } = validate();
    if (validationError) {
      setFormError(validationError);
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
          volunteer_signup_enabled: signupEnabled,
          max_volunteers: max,
          created_by: profileId,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Notifications are sent by the database trigger on insert - nothing else to call here.
      router.replace(`/(tabs)/calendar/${data.id}`);
    } catch (err) {
      console.warn('[calendar/add] create failed:', err);
      setFormError(toFriendlyMessage(err, 'Could not create this event. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormScreen title="New event" subtitle="Create a shift, meeting, or public event." onBack={() => router.back()}>
      <Field
        label="Title"
        value={title}
        onChangeText={setTitle}
        placeholder="Saturday morning walk shift"
        maxLength={MAX_TITLE_LENGTH}
      />

      <FieldLabel>Category</FieldLabel>
      <ChipGroup options={CATEGORIES} value={category} onChange={handleCategoryChange} />

      <DateTimeField
        label="Starts"
        value={startAt}
        onChange={setStartAt}
        placeholder="Select start date & time"
        minimumDate={new Date()}
      />
      <DateTimeField
        label="Ends (optional)"
        value={endAt}
        onChange={setEndAt}
        placeholder="Select end date & time"
        minimumDate={startAt ? new Date(startAt) : new Date()}
      />

      <Field label="Location" value={location} onChangeText={setLocation} placeholder="Main shelter yard" />
      <Field
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="What volunteers need to know..."
        multiline
        numberOfLines={4}
      />

      <FieldLabel>Visibility</FieldLabel>
      <ChipGroup options={VISIBILITIES} value={visibility} onChange={setVisibility} />

      <View style={styles.switchCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.switchTitle}>Volunteers can sign up</Text>
          <Text style={styles.switchHint}>
            {signupEnabled ? 'Volunteers will see a Sign up button.' : 'Only staff can add people to this event.'}
          </Text>
        </View>
        <Switch
          value={signupEnabled}
          onValueChange={handleSignupToggle}
          trackColor={{ false: colors.line, true: colors.gold }}
          thumbColor="#fff"
          accessibilityLabel="Volunteers can sign up"
        />
      </View>

      {signupEnabled ? (
        <Field
          label="Max volunteers (optional)"
          value={maxVolunteers}
          onChangeText={(text) => setMaxVolunteers(text.replace(/[^0-9]/g, ''))}
          placeholder="Leave blank for no limit"
          keyboardType="number-pad"
          maxLength={3}
        />
      ) : null}

      <ErrorText text={formError} />

      <PillButton label="Save event" loading={isSubmitting} onPress={handleSubmit} style={{ marginTop: 24 }} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: 16,
    marginTop: 22,
  },
  switchTitle: { color: colors.fg, fontSize: 15, fontWeight: '800' },
  switchHint: { color: colors.fgMuted, fontSize: 12, marginTop: 3 },
});