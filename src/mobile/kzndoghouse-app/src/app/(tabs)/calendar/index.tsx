import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { getCurrentProfileId } from '@/lib/profile';
import { isStaff } from '@/lib/roles';
import { getCategoryColor } from '@/lib/eventCategory';
import { colors, radius } from '@/theme';
import { IconBtn, PageHeader, Tag, UnderlineTabs } from '@/components/ui';
import type { CalendarEvent, EventCategory } from '@/types/models';

type EventWithMyAssignment = CalendarEvent & {
  event_assignments: { id: string; profile_id: string; status: string }[];
};

type FilterKey = 'All' | EventCategory;
const TABS: { key: FilterKey; label: string }[] = [
  { key: 'All', label: 'All' },
  { key: 'Shift', label: 'Shifts' },
  { key: 'Vet & Care', label: 'Vet & Care' },
  { key: 'Public Event', label: 'Public events' },
  { key: 'Meeting', label: 'Meetings' },
  { key: 'Other', label: 'Other' },
];

function localKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const diff = (d.getDay() === 0 ? -6 : 1) - d.getDay();
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export default function CalendarScreen() {
  const { session } = useAuth();
  const staff = isStaff(session?.role);

  const [events, setEvents] = useState<EventWithMyAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('All');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const weekStart = useMemo(() => startOfWeek(new Date()), []);
  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
      }),
    [weekStart]
  );
  const todayKey = localKey(new Date());

  const load = useCallback(async () => {
    const profileId = await getCurrentProfileId();

    const { data, error } = await supabase
      .from('calendar_events')
      .select(
        'id, title, category, description, location, start_at, end_at, visibility, dog_id, created_by, created_at, event_assignments(id, profile_id, status)'
      )
      .gte('start_at', weekStart.toISOString())
      .order('start_at', { ascending: true })
      .limit(200);

    if (error) throw error;

    const rows = ((data as EventWithMyAssignment[]) ?? []).map((event) => ({
      ...event,
      event_assignments: profileId ? event.event_assignments.filter((a) => a.profile_id === profileId) : [],
    }));
    setEvents(rows);
  }, [weekStart]);

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

  const weekKeys = useMemo(() => weekDays.map(localKey), [weekDays]);
  const daysWithEvents = useMemo(() => new Set(events.map((e) => localKey(new Date(e.start_at)))), [events]);

  const weekSummary = useMemo(() => {
    const inWeek = events.filter((e) => weekKeys.includes(localKey(new Date(e.start_at))));
    if (inWeek.length === 0) return 'No events this week';
    const shifts = inWeek.filter((e) => e.category === 'Shift').length;
    const vets = inWeek.filter((e) => e.category === 'Vet & Care').length;
    const publics = inWeek.filter((e) => e.category === 'Public Event').length;
    const parts: string[] = [];
    if (shifts) parts.push(plural(shifts, 'shift', 'shifts'));
    if (vets) parts.push(plural(vets, 'vet visit', 'vet visits'));
    if (publics) parts.push(plural(publics, 'public event', 'public events'));
    const others = inWeek.length - shifts - vets - publics;
    if (others) parts.push(plural(others, 'other', 'others'));
    return parts.join(', ');
  }, [events, weekKeys]);

  const sections = useMemo(() => {
    const visible = events.filter((e) => {
      if (filter !== 'All' && e.category !== filter) return false;
      const key = localKey(new Date(e.start_at));
      return selectedDay ? key === selectedDay : key >= todayKey;
    });
    const map = new Map<string, EventWithMyAssignment[]>();
    visible.forEach((event) => {
      const key = localKey(new Date(event.start_at));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    });
    return Array.from(map.entries()).map(([key, items]) => ({ key, items }));
  }, [events, filter, selectedDay, todayKey]);

  const heading = (key: string) => {
    const date = new Date(`${key}T00:00:00`);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekday = date.toLocaleDateString([], { weekday: 'long' });
    const prefix = key === todayKey ? 'Today' : key === localKey(tomorrow) ? 'Tomorrow' : weekday;
    return `${prefix}, ${date.getDate()} ${date.toLocaleDateString([], { month: 'long' })}`;
  };

  return (
    <View style={styles.root}>
      <PageHeader
        title="Calendar"
        subtitle={weekSummary}
        right={
          staff ? (
            <IconBtn icon="add-circle-outline" color={colors.gold} onPress={() => router.push('/(tabs)/calendar/add')} />
          ) : undefined
        }
      >
        <View style={styles.weekRow}>
          {weekDays.map((d) => {
            const key = localKey(d);
            const active = selectedDay === key;
            return (
              <Pressable
                key={key}
                style={[styles.dayPill, active && styles.dayPillOn]}
                onPress={() => setSelectedDay(active ? null : key)}
              >
                <Text style={[styles.dayName, active && styles.dayTextOn]}>
                  {d.toLocaleDateString([], { weekday: 'short' }).toUpperCase()}
                </Text>
                <Text style={[styles.dayNum, active && styles.dayTextOn]}>{d.getDate()}</Text>
                <View
                  style={[
                    styles.dayDot,
                    { opacity: daysWithEvents.has(key) ? 1 : 0 },
                    active && { backgroundColor: colors.header },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
        <UnderlineTabs tabs={TABS} active={filter} onChange={setFilter} />
      </PageHeader>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(section) => section.key}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#fff" />}
          ListEmptyComponent={<Text style={styles.emptyText}>No events match this view.</Text>}
          renderItem={({ item: section }) => (
            <View>
              <Text style={styles.dayHeading}>{heading(section.key)}</Text>
              {section.items.map((event) => {
                const color = getCategoryColor(event.category);
                const mySignup = event.event_assignments[0];
                const isIn = !!mySignup && mySignup.status !== 'Cancelled';
                return (
                  <Pressable
                    key={event.id}
                    style={[styles.card, { borderLeftColor: color.text }]}
                    onPress={() => router.push(`/(tabs)/calendar/${event.id}`)}
                  >
                    <View style={styles.timeCol}>
                      <Text style={styles.timeStart}>{formatTime(event.start_at)}</Text>
                      {event.end_at ? <Text style={styles.timeEnd}>{formatTime(event.end_at)}</Text> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{event.title}</Text>
                      {event.location ? <Text style={styles.cardMeta}>{event.location}</Text> : null}
                      <View style={styles.tagRow}>
                        <Tag
                          label={event.visibility === 'Public' ? 'ON WEBSITE' : 'INTERNAL'}
                          bg={event.visibility === 'Public' ? '#f3e1c2' : '#dfe4dc'}
                          fg={event.visibility === 'Public' ? '#8a5a12' : '#4d5c52'}
                        />
                        {event.category !== 'Other' ? (
                          <Tag label={event.category.toUpperCase()} bg={color.bg} fg={color.text} />
                        ) : null}
                        {isIn ? <Tag label="YOU'RE IN" bg={colors.gold} fg={colors.header} /> : null}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
  dayPill: { width: 43, paddingVertical: 8, borderRadius: 14, alignItems: 'center', backgroundColor: colors.surface },
  dayPillOn: { backgroundColor: colors.gold },
  dayName: { color: colors.fgMuted, fontSize: 9, fontWeight: '700' },
  dayNum: { color: '#fff', fontSize: 17, fontWeight: '800', marginTop: 2 },
  dayTextOn: { color: colors.header },
  dayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.gold, marginTop: 4 },

  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  dayHeading: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 24, marginBottom: 12 },

  card: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    padding: 14,
    marginBottom: 10,
  },
  timeCol: { width: 48 },
  timeStart: { color: '#fff', fontSize: 15, fontWeight: '800' },
  timeEnd: { color: colors.fgMuted, fontSize: 11, marginTop: 2 },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  cardMeta: { color: colors.fgMuted, fontSize: 12, marginTop: 2 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  emptyText: { textAlign: 'center', color: colors.fgMuted, marginTop: 40, fontSize: 14 },
});