import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { getCurrentProfileId } from '@/lib/profile';
import { isStaff } from '@/lib/roles';
import { getCategoryColor } from '@/lib/eventCategory';
import DateTimeField from '@/components/DateTimeField';
import type { CalendarEvent, EventAssignment, EventCategory } from '@/types/models';

const GREEN = '#16302a';

const CATEGORIES: EventCategory[] = ['Shift', 'Vet & Care', 'Meeting', 'Public Event', 'Other'];

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
  const [volunteerNames, setVolunteerNames] = useState<Record<string, string>>({});

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
      const { error } = await supabase.from('event_assignments').insert({ event_id: event.id, profile_id: profileId, status: 'Registered' });
      if (error) throw error;
      await load();
    } catch (err) {
      console.warn('[event-detail] sign up failed:', err);
    } finally {
      setIsActing(false);
    }
  };

  const handleCancelMySpot = async () => {
    if (!myAssignment) return;
    setIsActing(true);
    try {
      const { error } = await supabase.from('event_assignments').update({ status: 'Cancelled' }).eq('id', myAssignment.id);
      if (error) throw error;
      await load();
    } catch (err) {
      console.warn('[event-detail] cancel failed:', err);
    } finally {
      setIsActing(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    setIsActing(true);
    try {
      const { error } = await supabase.from('event_assignments').update({ status: 'Cancelled' }).eq('id', assignmentId);
      if (error) throw error;
      await load();
    } catch (err) {
      console.warn('[event-detail] remove assignment failed:', err);
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={GREEN} size="large" />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.emptyText}>This event could not be found.</Text>
      </View>
    );
  }

  const color = getCategoryColor(event.category);
  const activeAssignments = allAssignments.filter((a) => a.status !== 'Cancelled');
  const checkedInCount = activeAssignments.filter((a) => a.checked_in_at).length;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}>
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>{'←'}</Text>
      </Pressable>

      <View style={[styles.categoryBadge, { backgroundColor: color.bg }]}>
        <Text style={[styles.categoryText, { color: color.text }]}>{event.category}</Text>
      </View>

      {isEditing ? (
        <View style={styles.editCard}>
          <Text style={styles.label}>Title</Text>
          <TextInput style={styles.input} value={editTitle} onChangeText={setEditTitle} />

          <Text style={styles.label}>Category</Text>
          <View style={styles.chipsWrap}>
            {CATEGORIES.map((c) => (
              <Pressable key={c} onPress={() => setEditCategory(c)} style={[styles.chip, editCategory === c && styles.chipSelected]}>
                <Text style={[styles.chipText, editCategory === c && styles.chipTextSelected]}>{c}</Text>
              </Pressable>
            ))}
          </View>

          <DateTimeField label="Starts" value={editStartAt} onChange={setEditStartAt} />
          <DateTimeField label="Ends (optional)" value={editEndAt} onChange={setEditEndAt} />

          <Text style={styles.label}>Location</Text>
          <TextInput style={styles.input} value={editLocation} onChangeText={setEditLocation} />

          <Text style={styles.label}>Description</Text>
          <TextInput style={[styles.input, styles.textArea]} value={editDescription} onChangeText={setEditDescription} multiline numberOfLines={4} />

          <View style={styles.editButtonsRow}>
            <Pressable style={styles.cancelBtn} onPress={() => setIsEditing(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.saveBtn} onPress={handleSaveEdit} disabled={isSavingEdit}>
              {isSavingEdit ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save</Text>}
            </Pressable>
          </View>
        </View>
      ) : (
        <View>
          <Text style={styles.title}>{event.title}</Text>
          <Text style={styles.meta}>
            {formatDateTime(event.start_at)}
            {event.end_at ? ` – ${formatDateTime(event.end_at)}` : ''}
          </Text>
          {event.location ? <Text style={styles.meta}>{event.location}</Text> : null}
          {relatedDogName ? <Text style={styles.meta}>Related dog: {relatedDogName}</Text> : null}
          {event.description ? <Text style={styles.bodyText}>{event.description}</Text> : null}

          {staff ? (
            <Pressable style={styles.updateBtn} onPress={() => setIsEditing(true)}>
              <Text style={styles.updateBtnText}>Edit event</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      <View style={styles.divider} />

      {staff ? (
        <View>
          <Text style={styles.sectionTitle}>Volunteers</Text>
          <Text style={styles.meta}>
            {activeAssignments.length} signed up · {checkedInCount} checked in
          </Text>
          {activeAssignments.length === 0 ? (
            <Text style={styles.emptyText}>No one has signed up yet.</Text>
          ) : (
            activeAssignments.map((assignment) => (
              <View key={assignment.id} style={styles.assignmentRow}>
                <View>
                  <Text style={styles.assignmentStatus}>
                    {volunteerNames[assignment.profile_id] ?? 'Volunteer'} · {assignment.status}
                  </Text>
                  <Text style={styles.assignmentMeta}>
                    {assignment.checked_in_at ? `Checked in at ${formatDateTime(assignment.checked_in_at)}` : 'Not checked in yet'}
                  </Text>
                </View>
                <Pressable onPress={() => handleRemoveAssignment(assignment.id)} disabled={isActing}>
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
      ) : (
        <View>
          <Text style={styles.sectionTitle}>Your spot</Text>
          {myAssignment && myAssignment.status !== 'Cancelled' ? (
            <View>
              <Text style={styles.bodyText}>
                You're {myAssignment.status.toLowerCase()} for this {event.category === 'Shift' ? 'shift' : 'event'}.
              </Text>
              <Pressable style={styles.cancelSpotBtn} onPress={handleCancelMySpot} disabled={isActing}>
                {isActing ? <ActivityIndicator color={GREEN} /> : <Text style={styles.cancelSpotText}>Cancel my spot</Text>}
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.signUpBtn} onPress={handleSignUp} disabled={isActing}>
              {isActing ? <ActivityIndicator color="#fff" /> : <Text style={styles.signUpText}>Sign up</Text>}
            </Pressable>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  container: { padding: 20, paddingTop: 56, paddingBottom: 60 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#eef2ee', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  backText: { color: GREEN, fontSize: 18 },
  categoryBadge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 12 },
  categoryText: { fontSize: 11, fontWeight: '700' },
  title: { fontSize: 24, fontWeight: '700', color: GREEN },
  meta: { fontSize: 13, color: '#6b7a70', marginTop: 6 },
  bodyText: { fontSize: 13, color: '#3d4a41', lineHeight: 19, marginTop: 12 },
  emptyText: { fontSize: 13, color: '#8a9a8f', marginTop: 4 },
  updateBtn: { marginTop: 20, borderRadius: 12, backgroundColor: GREEN, paddingVertical: 14, alignItems: 'center' },
  updateBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  divider: { height: 1, backgroundColor: '#eef2ee', marginVertical: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: GREEN, marginBottom: 8 },
  assignmentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f0f2f0', paddingVertical: 10 },
  assignmentStatus: { fontSize: 13, fontWeight: '600', color: GREEN },
  assignmentMeta: { fontSize: 11, color: '#8a9a8f', marginTop: 2 },
  removeText: { fontSize: 12, color: '#b3261e', fontWeight: '600' },
  signUpBtn: { backgroundColor: GREEN, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  signUpText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cancelSpotBtn: { borderWidth: 1, borderColor: '#d9e0d9', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  cancelSpotText: { color: GREEN, fontWeight: '700', fontSize: 14 },
  editCard: { backgroundColor: '#f8faf8', borderRadius: 14, padding: 16, marginTop: 4 },
  label: { fontSize: 12, fontWeight: '600', color: GREEN, marginBottom: 6, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#d9e0d9', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: GREEN, backgroundColor: '#fff' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#d9e0d9', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  chipSelected: { backgroundColor: GREEN, borderColor: GREEN },
  chipText: { color: GREEN, fontSize: 12 },
  chipTextSelected: { color: '#fff' },
  editButtonsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: '#d9e0d9', paddingVertical: 11, alignItems: 'center' },
  cancelText: { color: GREEN, fontWeight: '600', fontSize: 13 },
  saveBtn: { flex: 1, borderRadius: 10, backgroundColor: GREEN, paddingVertical: 11, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});