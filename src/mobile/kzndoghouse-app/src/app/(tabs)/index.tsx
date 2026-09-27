import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { getCurrentProfileId } from '@/lib/profile';
import type { CalendarEvent, Dog } from '@/types/models';

const GREEN = '#16302a';
const GREEN_DARK = '#0f231e';
const GOLD = '#c98a2c';

type ShiftWithAssignment = CalendarEvent & {
  event_assignments: { id: string; checked_in_at: string | null; status: string; profile_id: string }[];
};

type AttentionDog = Pick<Dog, 'id' | 'name' | 'status'> & { reason: string };

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function startEndOfToday() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export default function HomeScreen() {
  const { session } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dogsInCareCount, setDogsInCareCount] = useState(0);
  const [fostersOutCount, setFostersOutCount] = useState(0);
  const [todaysSchedule, setTodaysSchedule] = useState<CalendarEvent[]>([]);
  const [myShift, setMyShift] = useState<ShiftWithAssignment | null>(null);
  const [attentionDogs, setAttentionDogs] = useState<AttentionDog[]>([]);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  const loadHome = useCallback(async () => {
    const { start, end } = startEndOfToday();
    const todayIso = start.toISOString();
    const todayEndIso = end.toISOString();
    const todayDateOnly = start.toISOString().slice(0, 10);

    const profileId = await getCurrentProfileId();

    const [dogsCountRes, fostersCountRes, scheduleRes, attentionRes] = await Promise.all([
      supabase.from('dogs').select('id', { count: 'exact', head: true }).neq('status', 'Adopted'),
      supabase
        .from('fostering_records')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'Active'),
      supabase
        .from('calendar_events')
        .select(
          'id, title, category, description, location, start_at, end_at, visibility, dog_id, created_by, created_at'
        )
        .gte('start_at', todayIso)
        .lte('start_at', todayEndIso)
        .order('start_at', { ascending: true }),
      supabase
        .from('dog_medical_records')
        .select('dog_id, next_action_date, title, dogs(id, name, status)')
        .eq('status', 'Active')
        .lte('next_action_date', todayDateOnly)
        .order('next_action_date', { ascending: true })
        .limit(6),
    ]);

    setDogsInCareCount(dogsCountRes.count ?? 0);
    setFostersOutCount(fostersCountRes.count ?? 0);
    setTodaysSchedule((scheduleRes.data as CalendarEvent[]) ?? []);

    if (profileId) {
      const shiftRes = await supabase
        .from('calendar_events')
        .select(
          'id, title, category, description, location, start_at, end_at, visibility, dog_id, created_by, created_at, event_assignments!inner(id, checked_in_at, status, profile_id)'
        )
        .eq('category', 'Shift')
        .gte('start_at', todayIso)
        .lte('start_at', todayEndIso)
        .eq('event_assignments.profile_id', profileId)
        .neq('event_assignments.status', 'Cancelled')
        .order('start_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      setMyShift((shiftRes.data as ShiftWithAssignment | null) ?? null);
    } else {
      setMyShift(null);
    }

    const seen = new Set<string>();
    const dogs: AttentionDog[] = [];
    for (const row of (attentionRes.data as any[]) ?? []) {
      const dog = row.dogs;
      if (!dog || seen.has(dog.id)) continue;
      seen.add(dog.id);
      dogs.push({ id: dog.id, name: dog.name, status: dog.status, reason: row.title });
    }
    setAttentionDogs(dogs);
  }, []);

  useEffect(() => {
    setIsLoading(true);
    loadHome()
      .catch((err) => console.warn('[home] failed to load dashboard:', err))
      .finally(() => setIsLoading(false));
  }, [loadHome]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadHome();
    } catch (err) {
      console.warn('[home] failed to refresh dashboard:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadHome]);

  const handleCheckIn = async () => {
    if (!myShift || myShift.event_assignments.length === 0) return;
    setIsCheckingIn(true);
    try {
      const assignmentId = myShift.event_assignments[0].id;
      const { error } = await supabase
        .from('event_assignments')
        .update({ checked_in_at: new Date().toISOString() })
        .eq('id', assignmentId);
      if (error) throw error;
      await loadHome();
    } catch (err) {
      console.warn('[home] check-in failed:', err);
    } finally {
      setIsCheckingIn(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  const checkedInAt = myShift?.event_assignments[0]?.checked_in_at ?? null;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#fff" />}
    >
      <View style={styles.headerRow}>
        <Text style={styles.brand}>KZN Doghouse</Text>
        <Pressable onPress={() => router.push('/(tabs)/alerts')} style={styles.bellButton}>
          <Ionicons name="notifications-outline" size={20} color="#fff" />
        </Pressable>
      </View>

      <Text style={styles.eyebrow}>{session?.role === 'staff' ? 'STAFF' : 'STAFF & VOLUNTEERS'}</Text>
      <Text style={styles.greeting}>
        {getGreeting()}, {session?.name?.split(' ')[0] || session?.name}.
      </Text>
      <Text style={styles.subtitle}>Here's what's happening at the shelter today.</Text>

      {myShift ? (
        <View style={styles.shiftCard}>
          <Text style={styles.shiftLabel}>ON DUTY TODAY</Text>
          <Text style={styles.shiftTime}>
            {formatTime(myShift.start_at)}
            {myShift.end_at ? ` – ${formatTime(myShift.end_at)}` : ''}
          </Text>
          <Text style={styles.shiftDetail}>
            {[myShift.location, myShift.title].filter(Boolean).join(' · ')}
          </Text>
          <View style={styles.shiftFooter}>
            <Text style={styles.shiftCheckedIn}>
              {checkedInAt ? `Checked in: ${formatTime(checkedInAt)}` : 'Checked in: not yet'}
            </Text>
            <Pressable
              style={[styles.checkInBtn, !!checkedInAt && styles.checkInBtnDisabled]}
              onPress={handleCheckIn}
              disabled={!!checkedInAt || isCheckingIn}
            >
              {isCheckingIn ? (
                <ActivityIndicator color={GREEN_DARK} size="small" />
              ) : (
                <Text style={styles.checkInText}>{checkedInAt ? 'Checked in' : 'Check in'}</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.statsRow}>
        <View style={styles.statTile}>
          <Text style={styles.statNumber}>{dogsInCareCount}</Text>
          <Text style={styles.statLabel}>Dogs in care</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={styles.statNumber}>{todaysSchedule.length}</Text>
          <Text style={styles.statLabel}>Tasks today</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={styles.statNumber}>{fostersOutCount}</Text>
          <Text style={styles.statLabel}>Fosters out</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Quick access</Text>
      <View style={styles.quickGrid}>
        <Pressable style={styles.quickCard} onPress={() => router.push('/(tabs)/dogs')}>
          <Text style={styles.quickTitle}>Dogs</Text>
          <Text style={styles.quickSubtitle}>Profiles & records</Text>
        </Pressable>
        <Pressable style={styles.quickCard} onPress={() => router.push('/(tabs)/calendar')}>
          <Text style={styles.quickTitle}>Calendar</Text>
          <Text style={styles.quickSubtitle}>Shifts & events</Text>
        </Pressable>
        <Pressable style={styles.quickCard} onPress={() => router.push('/availability')}>
          <Text style={styles.quickTitle}>Availability</Text>
          <Text style={styles.quickSubtitle}>Set your hours</Text>
        </Pressable>
        <Pressable style={styles.quickCard} onPress={() => router.push('/(tabs)/profile')}>
          <Text style={styles.quickTitle}>Profile</Text>
          <Text style={styles.quickSubtitle}>Your details</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Today's schedule</Text>
        <Pressable onPress={() => router.push('/(tabs)/calendar')}>
          <Text style={styles.linkText}>Full calendar</Text>
        </Pressable>
      </View>
      {todaysSchedule.length === 0 ? (
        <Text style={styles.emptyText}>Nothing on the calendar for today.</Text>
      ) : (
        todaysSchedule.map((event) => (
          <View key={event.id} style={styles.scheduleRow}>
            <Text style={styles.scheduleTime}>{formatTime(event.start_at)}</Text>
            <View style={styles.scheduleDot} />
            <View style={styles.scheduleTextWrap}>
              <Text style={styles.scheduleTitle}>{event.title}</Text>
              {event.location ? <Text style={styles.scheduleSubtitle}>{event.location}</Text> : null}
            </View>
          </View>
        ))
      )}

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Dogs needing attention</Text>
        <Pressable onPress={() => router.push('/(tabs)/dogs')}>
          <Text style={styles.linkText}>See all</Text>
        </Pressable>
      </View>
      {attentionDogs.length === 0 ? (
        <Text style={styles.emptyText}>No flagged dogs right now.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.attentionRow}>
          {attentionDogs.map((dog) => (
            <Pressable
              key={dog.id}
              style={styles.attentionCard}
              onPress={() => router.push(`/(tabs)/dogs/${dog.id}`)}
            >
              <View style={styles.attentionAvatar}>
                <Text style={styles.attentionInitial}>{dog.name.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={styles.attentionName}>{dog.name}</Text>
              <Text style={styles.attentionReason} numberOfLines={1}>
                {dog.reason}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: GREEN_DARK },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: GREEN_DARK },
  container: { padding: 20, paddingTop: 56, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: '#fff', fontSize: 16, fontWeight: '700' },
  bellButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginTop: 24 },
  greeting: { color: '#fff', fontSize: 24, fontWeight: '700', marginTop: 4 },
  subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 },

  shiftCard: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 18, marginTop: 20 },
  shiftLabel: { color: GOLD, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  shiftTime: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 6 },
  shiftDetail: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 },
  shiftFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  shiftCheckedIn: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  checkInBtn: { backgroundColor: GOLD, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  checkInBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.15)' },
  checkInText: { color: GREEN_DARK, fontWeight: '700', fontSize: 13 },

  statsRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  statTile: { flex: 1, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  statNumber: { fontSize: 22, fontWeight: '700', color: GREEN },
  statLabel: { fontSize: 11, color: '#6b7a70', marginTop: 2, textAlign: 'center' },

  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 24, marginBottom: 12 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  linkText: { color: GOLD, fontSize: 12, fontWeight: '600' },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickCard: { width: '48%', backgroundColor: '#fff', borderRadius: 14, padding: 14 },
  quickTitle: { color: GREEN, fontSize: 14, fontWeight: '700' },
  quickSubtitle: { color: '#6b7a70', fontSize: 11, marginTop: 2 },

  emptyText: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },

  scheduleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  scheduleTime: { color: 'rgba(255,255,255,0.6)', fontSize: 12, width: 56 },
  scheduleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GOLD, marginTop: 6, marginRight: 10 },
  scheduleTextWrap: { flex: 1 },
  scheduleTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  scheduleSubtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },

  attentionRow: { marginTop: 4 },
  attentionCard: { width: 90, marginRight: 12, alignItems: 'center' },
  attentionAvatar: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  attentionInitial: { color: '#fff', fontSize: 22, fontWeight: '700' },
  attentionName: { color: '#fff', fontSize: 12, fontWeight: '600' },
  attentionReason: { color: 'rgba(255,255,255,0.5)', fontSize: 10, textAlign: 'center' },
});