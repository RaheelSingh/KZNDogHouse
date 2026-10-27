import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { getCurrentProfileId } from '@/lib/profile';
import { isStaff } from '@/lib/roles';
import { getCategoryColor } from '@/lib/eventCategory';
import { EVENT_COLUMNS, fetchSignupCounts, hasStarted, isActiveAssignment, toFriendlyMessage } from '@/lib/events';
import { colors, radius } from '@/theme';
import { IconBtn, PageHeader, PillButton, Tag, UnderlineTabs } from '@/components/ui';
import type { AssignmentStatus, CalendarEvent, EventCategory } from '@/types/models';

type EventRow = CalendarEvent & {
  event_assignments: { id: string; profile_id: string; status: AssignmentStatus }[];
};
type CalendarItem = { event: CalendarEvent; joined: boolean };
type FilterKey = 'All' | 'Mine' | EventCategory;

const TABS: { key: FilterKey; label: string }[] = [
  { key: 'All', label: 'All' },
  { key: 'Mine', label: 'Mine' },
  { key: 'Shift', label: 'Shifts' },
  { key: 'Vet & Care', label: 'Vet & Care' },
  { key: 'Public Event', label: 'Public events' },
  { key: 'Meeting', label: 'Meetings' },
  { key: 'Other', label: 'Other' },
];

// ---- Date helpers (all in the phone's local time) --------------------------

function localKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const diff = (d.getDay() === 0 ? -6 : 1) - d.getDay(); // weeks start on Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatRange(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  const short = (d: Date) => d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  return `${short(weekStart)} – ${short(end)}`;
}

function formatDayLong(key: string): string {
  return new Date(`${key}T00:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

// ---- Screen ----------------------------------------------------------------

export default function CalendarScreen() {
  const { session } = useAuth();
  const staff = isStaff(session?.role);

  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('All');

  const [items, setItems] = useState<CalendarItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Only the newest request may update state (prevents a slow old week overwriting a new one).
  const requestRef = useRef(0);

  const todayKey = localKey(new Date());
  const weekStart = useMemo(() => addDays(startOfWeek(new Date()), weekOffset * 7), [weekOffset]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    setLoadError(null);

    try {
      const weekEnd = addDays(weekStart, 7);
      const [profileId, eventsRes] = await Promise.all([
        getCurrentProfileId(),
        supabase
          .from('calendar_events')
          .select(`${EVENT_COLUMNS}, event_assignments(id, profile_id, status)`)
          .gte('start_at', weekStart.toISOString())
          .lt('start_at', weekEnd.toISOString())
          .order('start_at', { ascending: true })
          .limit(300),
      ]);
      if (eventsRes.error) throw eventsRes.error;

      const rows = (eventsRes.data as unknown as EventRow[] | null) ?? [];
      const nextItems: CalendarItem[] = rows.map(({ event_assignments, ...event }) => ({
        event,
        joined: !!profileId && event_assignments.some((a) => a.profile_id === profileId && isActiveAssignment(a)),
      }));

      const nextCounts = await fetchSignupCounts(
        nextItems.filter((i) => i.event.volunteer_signup_enabled).map((i) => i.event.id)
      ).catch((err) => {
        console.warn('[calendar] could not load spot counts:', err);
        return {} as Record<string, number>;
      });

      if (requestId !== requestRef.current) return; // a newer week was requested meanwhile
      setItems(nextItems);
      setCounts(nextCounts);
    } catch (err) {
      if (requestId !== requestRef.current) return;
      console.warn('[calendar] failed to load:', err);
      setLoadError(toFriendlyMessage(err, 'Could not load the calendar.'));
    } finally {
      if (requestId === requestRef.current) setIsLoading(false);
    }
  }, [weekStart]);

  // Runs when the tab gains focus AND whenever the week changes.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  const changeWeek = (next: number) => {
    setSelectedDay(null);
    setIsLoading(true);
    setWeekOffset(next);
  };

  const onPressDay = (key: string) => {
    setSelectedDay((current) => (current === key ? null : key));
  };

  // ---- Derived data ----

  const daysWithEvents = useMemo(() => new Set(items.map((i) => localKey(new Date(i.event.start_at)))), [items]);

  const weekSummary = useMemo(() => {
    if (items.length === 0) return 'No events this week';
    const mine = items.filter((i) => i.joined).length;
    const shifts = items.filter((i) => i.event.category === 'Shift').length;
    const parts = [plural(items.length, 'event', 'events')];
    if (shifts) parts.push(plural(shifts, 'shift', 'shifts'));
    if (mine) parts.push(`${mine} you're in`);
    return parts.join(' · ');
  }, [items]);

  const sections = useMemo(() => {
    const visible = items.filter(({ event, joined }) => {
      if (filter === 'Mine' && !joined) return false;
      if (filter !== 'All' && filter !== 'Mine' && event.category !== filter) return false;
      if (selectedDay && localKey(new Date(event.start_at)) !== selectedDay) return false;
      return true;
    });

    const map = new Map<string, CalendarItem[]>();
    visible.forEach((item) => {
      const key = localKey(new Date(item.event.start_at));
      const bucket = map.get(key);
      if (bucket) bucket.push(item);
      else map.set(key, [item]);
    });
    return Array.from(map.entries()).map(([key, dayItems]) => ({ key, items: dayItems }));
  }, [items, filter, selectedDay]);

  const heading = (key: string) => {
    const tomorrowKey = localKey(addDays(new Date(), 1));
    const date = new Date(`${key}T00:00:00`);
    const prefix =
      key === todayKey ? 'Today' : key === tomorrowKey ? 'Tomorrow' : date.toLocaleDateString([], { weekday: 'long' });
    return `${prefix}, ${date.getDate()} ${date.toLocaleDateString([], { month: 'long' })}`;
  };

  // ---- Render pieces ----

  const renderCard = ({ event, joined }: CalendarItem) => {
    const color = getCategoryColor(event.category);
    const past = hasStarted(event) && localKey(new Date(event.start_at)) !== todayKey;
    const count = counts[event.id] ?? 0;
    const full = event.max_volunteers != null && count >= event.max_volunteers;

    return (
      <Pressable
        key={event.id}
        style={({ pressed }) => [
          styles.card,
          { borderLeftColor: color.text },
          past && styles.cardPast,
          pressed && styles.cardPressed,
        ]}
        onPress={() => router.push(`/(tabs)/calendar/${event.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${event.title}, ${formatTime(event.start_at)}${joined ? ", you're in" : ''}`}
      >
        <View style={styles.timeCol}>
          <Text style={styles.timeStart}>{formatTime(event.start_at)}</Text>
          {event.end_at ? <Text style={styles.timeEnd}>{formatTime(event.end_at)}</Text> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {event.title}
          </Text>
          {event.location ? (
            <Text style={styles.cardMeta} numberOfLines={1}>
              {event.location}
            </Text>
          ) : null}
          <View style={styles.tagRow}>
            {joined ? <Tag label="YOU'RE IN" bg={colors.gold} fg={colors.header} /> : null}
            {event.category !== 'Other' ? <Tag label={event.category.toUpperCase()} bg={color.bg} fg={color.text} /> : null}
            {event.volunteer_signup_enabled ? (
              full && !joined ? (
                <Tag label="FULL" bg="#f4d3cf" fg="#b3261e" />
              ) : (
                <Tag
                  label={event.max_volunteers != null ? `${count}/${event.max_volunteers} SPOTS` : `${count} GOING`}
                  bg="#dfe4dc"
                  fg="#4d5c52"
                />
              )
            ) : null}
            {event.visibility === 'Public' ? <Tag label="ON WEBSITE" bg="#f3e1c2" fg="#8a5a12" /> : null}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.fgFaint} style={{ alignSelf: 'center' }} />
      </Pressable>
    );
  };

  const emptyMessage = () => {
    if (loadError) return null;
    if (filter === 'Mine') return "You're not signed up for anything this week.";
    if (selectedDay) return `Nothing on ${formatDayLong(selectedDay)}.`;
    return 'No events match this view.';
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
        <View style={styles.weekNav}>
          <Pressable
            onPress={() => changeWeek(weekOffset - 1)}
            hitSlop={12}
            style={styles.navBtn}
            accessibilityLabel="Previous week"
          >
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </Pressable>
          <Pressable
            onPress={() => changeWeek(0)}
            disabled={weekOffset === 0}
            style={styles.weekLabelWrap}
            accessibilityLabel="Jump to this week"
          >
            <Text style={styles.weekLabel}>{formatRange(weekStart)}</Text>
            <Text style={styles.weekHint}>{weekOffset === 0 ? 'This week' : 'Tap for this week'}</Text>
          </Pressable>
          <Pressable
            onPress={() => changeWeek(weekOffset + 1)}
            hitSlop={12}
            style={styles.navBtn}
            accessibilityLabel="Next week"
          >
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.weekRow}>
          {weekDays.map((d) => {
            const key = localKey(d);
            const active = selectedDay === key;
            const isToday = key === todayKey;
            return (
              <Pressable
                key={key}
                style={[styles.dayPill, isToday && styles.dayPillToday, active && styles.dayPillOn]}
                onPress={() => onPressDay(key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
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

      {selectedDay ? (
        <Pressable style={styles.dayBanner} onPress={() => setSelectedDay(null)} accessibilityRole="button">
          <Text style={styles.dayBannerText}>Showing {formatDayLong(selectedDay)}</Text>
          <View style={styles.dayBannerAction}>
            <Text style={styles.dayBannerActionText}>Show whole week</Text>
            <Ionicons name="close" size={14} color={colors.header} />
          </View>
        </Pressable>
      ) : null}

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
          ListHeaderComponent={
            loadError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{loadError}</Text>
                <PillButton label="Retry" variant="outline" onPress={() => { setIsLoading(true); load(); }} style={{ marginTop: 12 }} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            emptyMessage() ? (
              <View style={styles.emptyBox}>
                <Ionicons name="calendar-clear-outline" size={40} color={colors.fgFaint} />
                <Text style={styles.emptyText}>{emptyMessage()}</Text>
                {filter === 'Mine' || selectedDay ? (
                  <PillButton
                    label="Show all events"
                    variant="outline"
                    onPress={() => {
                      setFilter('All');
                      setSelectedDay(null);
                    }}
                    style={{ marginTop: 14 }}
                  />
                ) : null}
              </View>
            ) : null
          }
          renderItem={({ item: section }) => (
            <View>
              <Text style={styles.dayHeading}>{heading(section.key)}</Text>
              {section.items.map(renderCard)}
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

  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekLabelWrap: { alignItems: 'center', paddingHorizontal: 12 },
  weekLabel: { color: '#fff', fontSize: 16, fontWeight: '800' },
  weekHint: { color: colors.fgMuted, fontSize: 11, marginTop: 2 },

  weekRow: { flexDirection: 'row', gap: 6, marginTop: 14 },
  dayPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  dayPillToday: { borderColor: colors.gold },
  dayPillOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  dayName: { color: colors.fgMuted, fontSize: 9, fontWeight: '700' },
  dayNum: { color: '#fff', fontSize: 17, fontWeight: '800', marginTop: 2 },
  dayTextOn: { color: colors.header },
  dayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.gold, marginTop: 4 },

  dayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  dayBannerText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  dayBannerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dayBannerActionText: { color: colors.header, fontSize: 12, fontWeight: '800' },

  listContent: { paddingHorizontal: 20, paddingBottom: 40, flexGrow: 1 },
  dayHeading: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 22, marginBottom: 12 },

  card: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    padding: 14,
    marginBottom: 10,
  },
  cardPast: { opacity: 0.55 },
  cardPressed: { opacity: 0.8 },
  timeCol: { width: 48 },
  timeStart: { color: '#fff', fontSize: 15, fontWeight: '800' },
  timeEnd: { color: colors.fgMuted, fontSize: 11, marginTop: 2 },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  cardMeta: { color: colors.fgMuted, fontSize: 12, marginTop: 2 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },

  errorBox: { alignItems: 'center', marginTop: 30 },
  errorText: { color: colors.dangerSoft, fontSize: 14, textAlign: 'center' },
  emptyBox: { alignItems: 'center', paddingTop: 50 },
  emptyText: { textAlign: 'center', color: colors.fgMuted, marginTop: 10, fontSize: 14 },
});