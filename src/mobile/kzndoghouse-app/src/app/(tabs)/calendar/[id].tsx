import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { getCurrentProfileId } from '@/lib/profile';
import { isStaff } from '@/lib/roles';
import { getCategoryColor } from '@/lib/eventCategory';
import { colors, radius } from '@/theme';
import { HeroHeader, PillButton, SectionTitle, Tag } from '@/components/ui';
import { ChipGroup, Field, FieldLabel } from '@/components/form';
import DateTimeField from '@/components/DateTimeField';
import type { CalendarEvent, EventAssignment, EventCategory } from '@/types/models';

const CATEGORIES: readonly EventCategory[] = ['Shift', 'Vet & Care', 'Meeting', 'Public Event', 'Other'];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const staff = isStaff(session?.role);

  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [myAssignment, setMyAssignment] = useState<EventAssignment | null>(null);
  const [allAssignments, setAllAssignments] = useState<EventAssignment[]>([]);
  const [relatedDogName, setRelatedDogName] = useState<string | null>(null);
  const [volunteerNames, setVolunteerNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isActing, setIsActing] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<EventCategory>('Shift');
  const [editDescription, setEditDescription] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editStartAt, setEditStartAt] = useState<string | null>(null);
  const [editEndAt, setEditEndAt] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const profileId = await getCurrentProfileId();

    const [eventRes, assignmentsRes] = await Promise.all([
      supabase.from('calendar_events').select('*').eq('id', id).single(),
      supabase.from('event_assignments').select('*').eq('event_id', id),
    ]);

    const eventData = eventRes.data as CalendarEvent | null;
    setEvent(eventData);

    const assignments = (assignmentsRes.data as EventAssignment[]) ?? [];
    setAllAssignments(assignments);
    setMyAssignment(assignments.find((a) => a.profile_id === profileId) ?? null);

    if (staff) {
      const activeIds = Array.from(
        new Set(assignments.filter((a) => a.status !== 'Cancelled').map((a) => a.profile_id))
      );
      if (activeIds.length > 0) {
        const { data: namesData, error: namesError } = await supabase.rpc('get_profile_names', {
          profile_ids: activeIds,
        });
        if (namesError) {
          console.warn('[event-detail] could not load volunteer names:', namesError);
        } else {
          const map: Record<string, string> = {};
          ((namesData as { id: string; first_name: string; last_name: string }[]) ?? []).forEach((p) => {
            map[p.id] = `${p.first_name} ${p.last_name}`.trim();
          });
          setVolunteerNames(map);
        }
      } else {
        setVolunteerNames({});
      }
    }

    if (eventData) {
      setEditTitle(eventData.title);
      setEditCategory(eventData.category);
      setEditDescription(eventData.description ?? '');
      setEditLocation(eventData.location ?? '');
      setEditStartAt(eventData.start_at);
      setEditEndAt(eventData.end_at);

      if (eventData.dog_id) {
        const { data: dogData } = await supabase.from('dogs').select('name').eq('id', eventData.dog_id).single();
        setRelatedDogName((dogData as { name: string } | null)?.name ?? null);
      } else {
        setRelatedDogName(null);
      }
    }
  }, [id, staff]);

  useEffect(() => {
    setIsLoading(true);
    load()
      .catch((err) => console.warn('[event-detail] failed to load:', err))
      .finally(() => setIsLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await load();
    } finally {
      setIsRefreshing(false);
    }
  }, [load]);

  const handleSignUp = async () => {
    if (!event) return;
    setIsActing(true);
    try {
      const profileId = await getCurrentProfileId();
      const { error } = await supabase
        .from('event_assignments')
        .insert({ event_id: event.id, profile_id: profileId, status: 'Registered' });
      if (error) throw error;
      await load();
    } catch (err) {
      console.warn('[event-detail] sign up failed:', err);
    } finally {
      setIsActing(false);
    }
  };

  const cancelAssignment = async (assignmentId: string) => {
    setIsActing(true);
    try {
      const { error } = await supabase.from('event_assignments').update({ status: 'Cancelled' }).eq('id', assignmentId);
      if (error) throw error;
      await load();
    } catch (err) {
      console.warn('[event-detail] cancel failed:', err);
    } finally {
      setIsActing(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!event) return;
    setIsSavingEdit(true);
    try {
      const { error } = await supabase
        .from('calendar_events')
        .update({
          title: editTitle.trim(),
          category: editCategory,
          description: editDescription.trim() || null,
          location: editLocation.trim() || null,
          start_at: editStartAt,
          end_at: editEndAt,
        })
        .eq('id', event.id);
      if (error) throw error;
      setIsEditing(false);
      await load();
    } catch (err) {
      console.warn('[event-detail] update failed:', err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>This event could not be found.</Text>
      </View>
    );
  }

  const color = getCategoryColor(event.category);
  const activeAssignments = allAssignments.filter((a) => a.status !== 'Cancelled');
  const checkedInCount = activeAssignments.filter((a) => a.checked_in_at).length;
  const iAmIn = !!myAssignment && myAssignment.status !== 'Cancelled';

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#fff" />}
    >
      <HeroHeader
        height={270}
        title={isEditing ? 'Edit event' : event.title}
        subtitle={isEditing ? undefined : formatDateTime(event.start_at)}
        onBack={() => router.back()}
      >
        {!isEditing ? (
          <View style={styles.tagRow}>
            <Tag label={event.category.toUpperCase()} bg={color.bg} fg={color.text} />
            <Tag
              label={event.visibility === 'Public' ? 'ON WEBSITE' : 'INTERNAL'}
              bg={event.visibility === 'Public' ? '#f3e1c2' : '#dfe4dc'}
              fg={event.visibility === 'Public' ? '#8a5a12' : '#4d5c52'}
            />
          </View>
        ) : null}
      </HeroHeader>

      <View style={styles.body}>
        {isEditing ? (
          <View>
            <Field label="Title" value={editTitle} onChangeText={setEditTitle} />
            <FieldLabel>Category</FieldLabel>
            <ChipGroup options={CATEGORIES} value={editCategory} onChange={setEditCategory} />
            <DateTimeField label="Starts" value={editStartAt} onChange={setEditStartAt} />
            <DateTimeField label="Ends (optional)" value={editEndAt} onChange={setEditEndAt} />
            <Field label="Location" value={editLocation} onChangeText={setEditLocation} />
            <Field label="Description" value={editDescription} onChangeText={setEditDescription} multiline numberOfLines={4} />
            <View style={styles.buttonRow}>
              <PillButton label="Cancel" variant="outline" style={styles.flex1} onPress={() => setIsEditing(false)} />
              <PillButton label="Save" style={styles.flex1} loading={isSavingEdit} onPress={handleSaveEdit} />
            </View>
          </View>
        ) : (
          <View>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={20} color={colors.gold} />
                <Text style={styles.infoText}>
                  {formatDateTime(event.start_at)}
                  {event.end_at ? ` – ${formatDateTime(event.end_at)}` : ''}
                </Text>
              </View>
              {event.location ? (
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={20} color={colors.gold} />
                  <Text style={styles.infoText}>{event.location}</Text>
                </View>
              ) : null}
              {relatedDogName ? (
                <View style={styles.infoRow}>
                  <Ionicons name="paw-outline" size={20} color={colors.gold} />
                  <Text style={styles.infoText}>Related dog: {relatedDogName}</Text>
                </View>
              ) : null}
            </View>

            {event.description ? (
              <View>
                <SectionTitle title="Details" />
                <Text style={styles.bodyText}>{event.description}</Text>
              </View>
            ) : null}

            {staff ? <PillButton label="Edit event" variant="outline" onPress={() => setIsEditing(true)} style={{ marginTop: 24 }} /> : null}

            {staff ? (
              <View>
                <SectionTitle title="Volunteers" />
                <Text style={styles.meta}>
                  {activeAssignments.length} signed up · {checkedInCount} checked in
                </Text>
                {activeAssignments.length === 0 ? (
                  <Text style={[styles.empty, { marginTop: 10 }]}>No one has signed up yet.</Text>
                ) : (
                  activeAssignments.map((a) => (
                    <View key={a.id} style={styles.assignRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.assignName}>
                          {volunteerNames[a.profile_id] ?? 'Volunteer'} · {a.status}
                        </Text>
                        <Text style={styles.meta}>
                          {a.checked_in_at ? `Checked in at ${formatDateTime(a.checked_in_at)}` : 'Not checked in yet'}
                        </Text>
                      </View>
                      <Pressable onPress={() => cancelAssignment(a.id)} disabled={isActing}>
                        <Text style={styles.removeText}>Remove</Text>
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
            ) : (
              <View>
                <SectionTitle title="Your spot" />
                {iAmIn && myAssignment ? (
                  <View>
                    <Text style={styles.bodyText}>
                      You're {myAssignment.status.toLowerCase()} for this {event.category === 'Shift' ? 'shift' : 'event'}.
                    </Text>
                    <PillButton
                      label="Cancel my spot"
                      variant="outline"
                      loading={isActing}
                      onPress={() => cancelAssignment(myAssignment.id)}
                      style={{ marginTop: 16 }}
                    />
                  </View>
                ) : (
                  <PillButton label="Sign up" loading={isActing} onPress={handleSignUp} />
                )}
              </View>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.page },
  body: { paddingHorizontal: 20 },
  flex1: { flex: 1 },
  tagRow: { flexDirection: 'row', gap: 8, marginTop: 12 },

  infoCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 14, marginTop: 18 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoText: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600' },

  bodyText: { color: colors.fgMuted, fontSize: 14, lineHeight: 21 },
  meta: { color: colors.fgMuted, fontSize: 12, marginTop: 2 },
  empty: { color: colors.fgMuted, fontSize: 14 },

  assignRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, marginTop: 10 },
  assignName: { color: '#fff', fontSize: 14, fontWeight: '800' },
  removeText: { color: colors.dangerSoft, fontSize: 13, fontWeight: '800' },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
});