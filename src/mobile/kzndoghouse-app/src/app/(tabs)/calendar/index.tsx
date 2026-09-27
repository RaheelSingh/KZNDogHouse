import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { getCurrentProfileId } from '@/lib/profile';
import { isStaff } from '@/lib/roles';
import { getCategoryColor } from '@/lib/eventCategory';
import type { CalendarEvent, EventCategory } from '@/types/models';

const GREEN = '#16302a';
const GREEN_DARK = '#0f231e';

type EventWithMyAssignment = CalendarEvent & {
  event_assignments: { id: string; profile_id: string; status: string }[];
};

type FilterKey = 'All' | EventCategory;
const FILTERS: FilterKey[] = ['All', 'Shift', 'Vet & Care', 'Meeting', 'Public Event', 'Other'];

function dateKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function formatDayHeading(key: string): string {
  const date = new Date(`${key}T00:00:00`);
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = tomorrow.toISOString().slice(0, 10);

  if (key === todayKey) return 'Today';
  if (key === tomorrowKey) return 'Tomorrow';
  return date.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function CalendarScreen() {
  const { session } = useAuth();
  const staff = isStaff(session?.role);

  const [events, setEvents] = useState<EventWithMyAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('All');

  const load = useCallback(async () => {
    const profileId = await getCurrentProfileId();
    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from('calendar_events')
      .select(
        'id, title, category, description, location, start_at, end_at, visibility, dog_id, created_by, created_at, event_assignments(id, profile_id, status)'
      )
      .gte('start_at', nowIso)
      .order('start_at', { ascending: true })
      .limit(100);

    if (error) throw error;

    const rows = ((data as EventWithMyAssignment[]) ?? []).map((event) => ({
      ...event,
      event_assignments: profileId ? event.event_assignments.filter((a) => a.profile_id === profileId) : [],
    }));

    setEvents(rows);
  }, []);

  useEffect(() => {
    setIsLoading(true);
    load()
      .catch((err) => console.warn('[calendar] failed to load:', err))
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

  const filtered = useMemo(
    () => (filter === 'All' ? events : events.filter((e) => e.category === filter)),
    [events, filter]
  );

  const sections = useMemo(() => {
    const map = new Map<string, EventWithMyAssignment[]>();
    filtered.forEach((event) => {
      const key = dateKey(event.start_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    });
    return Array.from(map.entries()).map(([key, items]) => ({ key, items }));
  }, [filtered]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={GREEN} size="large" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.flex}
      contentContainerStyle={styles.listContent}
      data={sections}
      keyExtractor={(section) => section.key}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View>
          <Text style={styles.title}>Upcoming events</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={FILTERS}
            keyExtractor={(f) => f}
            contentContainerStyle={styles.filterRow}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.filterChip, filter === item && styles.filterChipActive]}
                onPress={() => setFilter(item)}
              >
                <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text>
              </Pressable>
            )}
          />
        </View>
      }
      renderItem={({ item: section }) => (
        <View>
          <Text style={styles.dayHeading}>{formatDayHeading(section.key)}</Text>
          {section.items.map((event) => {
            const color = getCategoryColor(event.category);
            const mySignup = event.event_assignments[0];
            return (
              <Pressable key={event.id} style={styles.card} onPress={() => router.push(`/(tabs)/calendar/${event.id}`)}>
                <View style={styles.cardTop}>
                  <View style={[styles.categoryBadge, { backgroundColor: color.bg }]}>
                    <Text style={[styles.categoryText, { color: color.text }]}>{event.category}</Text>
                  </View>
                  {mySignup && mySignup.status !== 'Cancelled' ? (
                    <View style={styles.myBadge}>
                      <Text style={styles.myBadgeText}>You're in</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.cardTitle}>{event.title}</Text>
                <Text style={styles.cardMeta}>
                  {formatTime(event.start_at)}
                  {event.end_at ? ` – ${formatTime(event.end_at)}` : ''}
                  {event.location ? ` · ${event.location}` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      ListEmptyComponent={<Text style={styles.emptyText}>No upcoming events match this filter.</Text>}
      ListFooterComponent={
        staff ? (
          <Pressable style={styles.addButton} onPress={() => router.push('/(tabs)/calendar/add')}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addButtonText}>Add an event</Text>
          </Pressable>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  listContent: { padding: 16, paddingTop: 56, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: GREEN, marginBottom: 12 },
  filterRow: { gap: 8, paddingBottom: 16 },
  filterChip: { borderWidth: 1, borderColor: '#d9e0d9', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  filterChipActive: { backgroundColor: GREEN, borderColor: GREEN },
  filterText: { color: GREEN, fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  dayHeading: { fontSize: 13, fontWeight: '700', color: '#6b7a70', marginTop: 16, marginBottom: 8, textTransform: 'uppercase' },
  card: { backgroundColor: GREEN_DARK, borderRadius: 16, padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  categoryText: { fontSize: 10, fontWeight: '700' },
  myBadge: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  myBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 10 },
  cardMeta: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 4 },
  emptyText: { textAlign: 'center', color: '#6b7a70', marginTop: 40, fontSize: 13 },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: GREEN, borderRadius: 12, paddingVertical: 14, marginTop: 10 },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});