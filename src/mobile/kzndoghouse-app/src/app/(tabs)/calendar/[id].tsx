import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { getCurrentProfileId } from '@/lib/profile';
import { isStaff } from '@/lib/roles';
import { getCategoryColor } from '@/lib/eventCategory';
import {
  EVENT_COLUMNS,
  cancelEventSignup,
  checkInToEvent,
  fetchSignupCounts,
  getSignupState,
  hasStarted,
  isActiveAssignment,
  isCheckInOpen,
  signUpForEvent,
  spotsLabel,
  toFriendlyMessage,
} from '@/lib/events';
import { colors, radius } from '@/theme';
import { HeroHeader, PillButton, SectionTitle, Tag } from '@/components/ui';
import { ChipGroup, ErrorText, Field, FieldLabel } from '@/components/form';
import DateTimeField from '@/components/DateTimeField';
import type { CalendarEvent, EventAssignment, EventCategory } from '@/types/models';

const CATEGORIES: readonly EventCategory[] = ['Shift', 'Vet & Care', 'Meeting', 'Public Event', 'Other'];
const ASSIGNMENT_COLUMNS = 'id, event_id, profile_id, status, checked_in_at, created_at';
const MAX_TITLE_LENGTH = 120;
const MAX_VOLUNTEERS_LIMIT = 200;

type BusyAction = 'signup' | 'cancel' | 'checkin' | 'delete' | `remove:${string}` | null;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const staff = isStaff(session?.role);

  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [assignments, setAssignments] = useState<EventAssignment[]>([]);
  const [myProfileId, setMyProfileId] = useState<string | null>(null);
  const [signedUpCount, setSignedUpCount] = useState(0);
  const [relatedDogName, setRelatedDogName] = useState<string | null>(null);
  const [volunteerNames, setVolunteerNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Edit form (staff only). Filled once when editing starts, so a refresh never wipes typing.
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<EventCategory>('Shift');
  const [editDescription, setEditDescription] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editStartAt, setEditStartAt] = useState<string | null>(null);
  const [editEndAt, setEditEndAt] = useState<string | null>(null);
  const [editSignupEnabled, setEditSignupEnabled] = useState(false);
  const [editMaxVolunteers, setEditMaxVolunteers] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;

    const [profileId, eventRes, assignmentsRes, counts] = await Promise.all([
      getCurrentProfileId(),
      supabase.from('calendar_events').select(EVENT_COLUMNS).eq('id', id).maybeSingle(),
      supabase.from('event_assignments').select(ASSIGNMENT_COLUMNS).eq('event_id', id),
      fetchSignupCounts([id]).catch((err) => {
        console.warn('[event-detail] could not load spot count:', err);
        return {} as Record<string, number>;
      }),
    ]);

    if (eventRes.error) throw eventRes.error;
    if (assignmentsRes.error) throw assignmentsRes.error;

    const eventData = eventRes.data as unknown as CalendarEvent | null;
    const rows = (assignmentsRes.data as EventAssignment[] | null) ?? [];

    setMyProfileId(profileId);
    setEvent(eventData);
    setAssignments(rows);
    setSignedUpCount(counts[id] ?? 0);

    if (eventData?.dog_id) {
      const { data: dogData } = await supabase.from('dogs').select('name').eq('id', eventData.dog_id).maybeSingle();
      setRelatedDogName((dogData as { name: string } | null)?.name ?? null);
    } else {
      setRelatedDogName(null);
    }

    if (staff) {
      const activeIds = Array.from(new Set(rows.filter(isActiveAssignment).map((a) => a.profile_id)));
      if (activeIds.length === 0) {
        setVolunteerNames({});
      } else {
        const { data: namesData, error: namesError } = await supabase.rpc('get_profile_names', {
          profile_ids: activeIds,
        });
        if (namesError) {
          console.warn('[event-detail] could not load volunteer names:', namesError);
        } else {
          const map: Record<string, string> = {};
          ((namesData as { id: string; first_name: string; last_name: string }[] | null) ?? []).forEach((p) => {
            map[p.id] = `${p.first_name} ${p.last_name}`.trim() || 'Volunteer';
          });
          setVolunteerNames(map);
        }
      }
    }
  }, [id, staff]);

  const reload = useCallback(async () => {
    try {
      setLoadError(null);
      await load();
    } catch (err) {
      console.warn('[event-detail] failed to load:', err);
      setLoadError(toFriendlyMessage(err, 'Could not load this event. Pull down to try again.'));
    }
  }, [load]);

  // Reload every time the screen comes into focus (e.g. coming back from the calendar).
  useFocusEffect(
    useCallback(() => {
      reload().finally(() => setIsLoading(false));
    }, [reload])
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await reload();
    setIsRefreshing(false);
  }, [reload]);

  const runAction = async (key: BusyAction, action: () => Promise<unknown>, fallback: string) => {
    setBusy(key);
    setActionError(null);
    try {
      await action();
      await reload();
    } catch (err) {
      console.warn(`[event-detail] ${key} failed:`, err);
      setActionError(toFriendlyMessage(err, fallback));
    } finally {
      setBusy(null);
    }
  };

  // ---- Volunteer actions ---------------------------------------------------

  const handleSignUp = () => {
    if (!event) return;
    runAction('signup', () => signUpForEvent(event.id), 'Could not sign you up. Please try again.');
  };

  const handleCancel = () => {
    if (!event) return;
    Alert.alert('Cancel your spot?', `You'll be removed from "${event.title}".`, [
      { text: 'Keep my spot', style: 'cancel' },
      {
        text: 'Cancel spot',
        style: 'destructive',
        onPress: () => runAction('cancel', () => cancelEventSignup(event.id), 'Could not cancel your spot.'),
      },
    ]);
  };

  const handleCheckIn = () => {
    if (!event) return;
    runAction('checkin', () => checkInToEvent(event.id), 'Could not check you in. Please try again.');
  };

  // ---- Staff actions -------------------------------------------------------

  const handleRemoveVolunteer = (assignment: EventAssignment) => {
    const name = volunteerNames[assignment.profile_id] ?? 'this volunteer';
    Alert.alert('Remove volunteer?', `Remove ${name} from this event?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          runAction(
            `remove:${assignment.id}`,
            async () => {
              const { error } = await supabase
                .from('event_assignments')
                .update({ status: 'Cancelled', checked_in_at: null })
                .eq('id', assignment.id);
              if (error) throw error;
            },
            'Could not remove this volunteer.'
          ),
      },
    ]);
  };

  const handleDelete = () => {
    if (!event) return;
    Alert.alert('Delete event?', `"${event.title}" and all its sign-ups will be removed. This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy('delete');
          setActionError(null);
          const { error } = await supabase.from('calendar_events').delete().eq('id', event.id);
          setBusy(null);
          if (error) {
            console.warn('[event-detail] delete failed:', error);
            setActionError(toFriendlyMessage(error, 'Could not delete this event.'));
            return;
          }
          router.back();
        },
      },
    ]);
  };

  const startEditing = () => {
    if (!event) return;
    setEditTitle(event.title);
    setEditCategory(event.category);
    setEditDescription(event.description ?? '');
    setEditLocation(event.location ?? '');
    setEditStartAt(event.start_at);
    setEditEndAt(event.end_at);
    setEditSignupEnabled(event.volunteer_signup_enabled);
    setEditMaxVolunteers(event.max_volunteers != null ? String(event.max_volunteers) : '');
    setEditError(null);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!event) return;
    setEditError(null);

    const title = editTitle.trim();
    if (!title) return setEditError('Title is required.');
    if (title.length > MAX_TITLE_LENGTH) return setEditError(`Title must be ${MAX_TITLE_LENGTH} characters or fewer.`);
    if (!editStartAt) return setEditError('Start date & time is required.');
    if (editEndAt && new Date(editEndAt).getTime() <= new Date(editStartAt).getTime()) {
      return setEditError('The end time must be after the start time.');
    }

    let max: number | null = null;
    if (editSignupEnabled && editMaxVolunteers.trim()) {
      max = Number(editMaxVolunteers.trim());
      if (!Number.isInteger(max) || max < 1 || max > MAX_VOLUNTEERS_LIMIT) {
        return setEditError(`Max volunteers must be a whole number from 1 to ${MAX_VOLUNTEERS_LIMIT}.`);
      }
      if (max < signedUpCount) {
        return setEditError(`${signedUpCount} people are already signed up. Remove some first or raise the limit.`);
      }
    }

    setIsSavingEdit(true);
    try {
      const { error } = await supabase
        .from('calendar_events')
        .update({
          title,
          category: editCategory,
          description: editDescription.trim() || null,
          location: editLocation.trim() || null,
          start_at: editStartAt,
          end_at: editEndAt,
          volunteer_signup_enabled: editSignupEnabled,
          max_volunteers: editSignupEnabled ? max : null,
        })
        .eq('id', event.id);
      if (error) throw error;
      setIsEditing(false);
      await reload();
    } catch (err) {
      console.warn('[event-detail] update failed:', err);
      setEditError(toFriendlyMessage(err, 'Could not save your changes. Please try again.'));
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ---- Render --------------------------------------------------------------

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
        <Text style={styles.empty}>{loadError ?? 'This event could not be found.'}</Text>
        <PillButton label="Go back" variant="outline" onPress={() => router.back()} style={{ marginTop: 18 }} />
      </View>
    );
  }

  const color = getCategoryColor(event.category);
  const myAssignment = assignments.find((a) => a.profile_id === myProfileId) ?? null;
  const activeAssignments = assignments.filter(isActiveAssignment);
  const checkedInCount = activeAssignments.filter((a) => a.checked_in_at).length;
  const signupState = getSignupState(event, myAssignment, signedUpCount);
  const spots = spotsLabel(event, signedUpCount);
  const started = hasStarted(event);

  const renderVolunteerSection = () => {
    switch (signupState) {
      case 'joined':
        return (
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Ionicons name="checkmark-circle" size={26} color={colors.gold} />
              <View style={{ flex: 1 }}>
                <Text style={styles.statusTitle}>You're in</Text>
                <Text style={styles.meta}>
                  {myAssignment?.checked_in_at
                    ? `Checked in at ${formatTime(myAssignment.checked_in_at)}`
                    : 'We will remind you 24 hours and 1 hour before.'}
                </Text>
              </View>
            </View>

            {!myAssignment?.checked_in_at && isCheckInOpen(event) ? (
              <PillButton label="Check in" loading={busy === 'checkin'} onPress={handleCheckIn} style={{ marginTop: 16 }} />
            ) : null}

            {!started ? (
              <PillButton
                label="Cancel my spot"
                variant="danger"
                loading={busy === 'cancel'}
                onPress={handleCancel}
                style={{ marginTop: 12 }}
              />
            ) : null}
          </View>
        );
      case 'open':
        return <PillButton label="Sign up" loading={busy === 'signup'} onPress={handleSignUp} />;
      case 'full':
        return <Text style={styles.bodyText}>This event is full. Check back later in case a spot opens up.</Text>;
      case 'started':
        return <Text style={styles.bodyText}>This event has already started.</Text>;
      case 'closed':
      default:
        return <Text style={styles.bodyText}>Sign-ups aren't open for this event.</Text>;
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: 60 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#fff" />}
    >
      <HeroHeader
        height={270}
        title={isEditing ? 'Edit event' : event.title}
        subtitle={isEditing ? undefined : formatDateTime(event.start_at)}
        onBack={() => (isEditing ? setIsEditing(false) : router.back())}
      >
        {!isEditing ? (
          <View style={styles.tagRow}>
            <Tag label={event.category.toUpperCase()} bg={color.bg} fg={color.text} />
            <Tag
              label={event.visibility === 'Public' ? 'ON WEBSITE' : 'INTERNAL'}
              bg={event.visibility === 'Public' ? '#f3e1c2' : '#dfe4dc'}
              fg={event.visibility === 'Public' ? '#8a5a12' : '#4d5c52'}
            />
            {signupState === 'joined' ? <Tag label="YOU'RE IN" bg={colors.gold} fg={colors.header} /> : null}
          </View>
        ) : null}
      </HeroHeader>

      <View style={styles.body}>
        {isEditing ? (
          <View>
            <Field label="Title" value={editTitle} onChangeText={setEditTitle} maxLength={MAX_TITLE_LENGTH} />
            <FieldLabel>Category</FieldLabel>
            <ChipGroup options={CATEGORIES} value={editCategory} onChange={setEditCategory} />
            <DateTimeField label="Starts" value={editStartAt} onChange={setEditStartAt} />
            <DateTimeField
              label="Ends (optional)"
              value={editEndAt}
              onChange={setEditEndAt}
              minimumDate={editStartAt ? new Date(editStartAt) : undefined}
            />
            <Field label="Location" value={editLocation} onChangeText={setEditLocation} />
            <Field label="Description" value={editDescription} onChangeText={setEditDescription} multiline numberOfLines={4} />

            <View style={styles.switchCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchTitle}>Volunteers can sign up</Text>
                <Text style={styles.meta}>Turning this off keeps existing sign-ups.</Text>
              </View>
              <Switch
                value={editSignupEnabled}
                onValueChange={setEditSignupEnabled}
                trackColor={{ false: colors.line, true: colors.gold }}
                thumbColor="#fff"
                accessibilityLabel="Volunteers can sign up"
              />
            </View>
            {editSignupEnabled ? (
              <Field
                label="Max volunteers (optional)"
                value={editMaxVolunteers}
                onChangeText={(text) => setEditMaxVolunteers(text.replace(/[^0-9]/g, ''))}
                placeholder="Leave blank for no limit"
                keyboardType="number-pad"
                maxLength={3}
              />
            ) : null}

            <ErrorText text={editError} />

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
                  {event.end_at ? ` – ${formatTime(event.end_at)}` : ''}
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
              {spots ? (
                <View style={styles.infoRow}>
                  <Ionicons name="people-outline" size={20} color={colors.gold} />
                  <Text style={styles.infoText}>{spots}</Text>
                </View>
              ) : null}
            </View>

            {event.description ? (
              <View>
                <SectionTitle title="Details" />
                <Text style={styles.bodyText}>{event.description}</Text>
              </View>
            ) : null}

            {!staff ? (
              <View>
                <SectionTitle title="Your spot" />
                {renderVolunteerSection()}
              </View>
            ) : (
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
                        <Text style={styles.assignName}>{volunteerNames[a.profile_id] ?? 'Volunteer'}</Text>
                        <Text style={styles.meta}>
                          {a.checked_in_at ? `Checked in at ${formatTime(a.checked_in_at)}` : 'Not checked in yet'}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => handleRemoveVolunteer(a)}
                        disabled={busy !== null}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${volunteerNames[a.profile_id] ?? 'volunteer'}`}
                      >
                        {busy === `remove:${a.id}` ? (
                          <ActivityIndicator color={colors.dangerSoft} />
                        ) : (
                          <Text style={styles.removeText}>Remove</Text>
                        )}
                      </Pressable>
                    </View>
                  ))
                )}

                <View style={[styles.buttonRow, { marginTop: 26 }]}>
                  <PillButton label="Edit event" variant="outline" style={styles.flex1} onPress={startEditing} />
                  <PillButton
                    label="Delete"
                    variant="danger"
                    style={styles.flex1}
                    loading={busy === 'delete'}
                    onPress={handleDelete}
                  />
                </View>
              </View>
            )}

            <ErrorText text={actionError} />
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.page, padding: 24 },
  body: { paddingHorizontal: 20 },
  flex1: { flex: 1 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },

  infoCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 14, marginTop: 18 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoText: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600' },

  statusCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, borderWidth: 1.5, borderColor: colors.gold },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },

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

  bodyText: { color: colors.fgMuted, fontSize: 14, lineHeight: 21 },
  meta: { color: colors.fgMuted, fontSize: 12, marginTop: 2 },
  empty: { color: colors.fgMuted, fontSize: 14, textAlign: 'center' },

  assignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
    marginTop: 10,
  },
  assignName: { color: '#fff', fontSize: 14, fontWeight: '800' },
  removeText: { color: colors.dangerSoft, fontSize: 13, fontWeight: '800' },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
});