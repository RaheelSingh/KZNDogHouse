import { useState } from 'react';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getCurrentProfileId } from '@/lib/profile';
import { PillButton } from '@/components/ui';
import { ChipGroup, ErrorText, Field, FieldLabel, FormScreen } from '@/components/form';
import DateTimeField from '@/components/DateTimeField';
import type { EventCategory } from '@/types/models';

const CATEGORIES: readonly EventCategory[] = ['Shift', 'Vet & Care', 'Meeting', 'Public Event', 'Other'];
const VISIBILITIES = ['Internal', 'Public'] as const;

export default function AddEventScreen() {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<EventCategory>('Shift');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startAt, setStartAt] = useState<string | null>(null);
  const [endAt, setEndAt] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<(typeof VISIBILITIES)[number]>('Internal');
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

      // Tell every active volunteer about the new event (appears in their Notifications tab).
      const { error: notifyError } = await supabase.rpc('notify_event_created', { p_event_id: data.id });
      if (notifyError) console.warn('[calendar] could not notify volunteers:', notifyError);

      router.replace(`/(tabs)/calendar/${data.id}`);
    } catch (err: any) {
      setFormError(err?.message ?? 'Could not create this event. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormScreen
      title="New event"
      subtitle="Create a shift, meeting, or public event."
      onBack={() => router.back()}
    >
      <Field label="Title" value={title} onChangeText={setTitle} placeholder="Saturday morning walk shift" />

      <FieldLabel>Category</FieldLabel>
      <ChipGroup options={CATEGORIES} value={category} onChange={setCategory} />

      <DateTimeField label="Starts" value={startAt} onChange={setStartAt} placeholder="Select start date & time" />
      <DateTimeField label="Ends (optional)" value={endAt} onChange={setEndAt} placeholder="Select end date & time" />

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

      <ErrorText text={formError} />

      <PillButton label="Save event" loading={isSubmitting} onPress={handleSubmit} style={{ marginTop: 24 }} />
    </FormScreen>
  );
}