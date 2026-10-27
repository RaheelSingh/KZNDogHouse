import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationsContext';
import { supabase } from '@/lib/supabase';
import { getCurrentProfileId } from '@/lib/profile';
import { EVENT_COLUMNS, checkInToEvent, isCheckInOpen, toFriendlyMessage } from '@/lib/events';
import { colors, radius } from '@/theme';
import type { CalendarEvent, Dog } from '@/types/models';

type SectionKey = 'welcome' | 'dogs' | 'calendar' | 'myEvents' | 'alerts';
type Section = { key: SectionKey; label: string };

const SECTIONS: Section[] = [
  { key: 'welcome', label: 'Welcome back' },
  { key: 'dogs', label: 'Dogs' },
  { key: 'calendar', label: 'Today' },
  { key: 'myEvents', label: 'My events' },
  { key: 'alerts', label: 'Alerts' },
];

const SLIDE_COLORS = ['#12241c', '#17302a', '#1f3d2e', '#14281f', '#2b4d3b'];
const CARD = 'rgba(18,36,28,0.82)';
const DEFAULT_EVENT_LENGTH_MS = 12 * 60 * 60 * 1000;
const MY_EVENTS_SHOWN = 3;

type MyEvent = { assignmentId: string; checkedInAt: string | null; event: CalendarEvent };
type AttentionDog = Pick<Dog, 'id' | 'name' | 'status'> & { reason: string };

type MyAssignmentRow = {
  id: string;
  checked_in_at: string | null;
  calendar_events: CalendarEvent | null;
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDayTime(iso: string): string {
  return new Date(iso).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

function startEndOfToday() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function hasEnded(event: CalendarEvent, now: number = Date.now()): boolean {
  const start = new Date(event.start_at).getTime();
  const end = event.end_at ? new Date(event.end_at).getTime() : start + DEFAULT_EVENT_LENGTH_MS;
  return now > end;
}

function SlideBackground({ index, uri }: { index: number; uri?: string }) {
  if (uri) {
    return <ImageBackground source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />;
  }
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: SLIDE_COLORS[index % SLIDE_COLORS.length] }]}>
      <Ionicons name="paw" size={420} color="rgba(255,255,255,0.045)" style={styles.pawBig} />
      <Ionicons name="paw" size={150} color="rgba(201,138,44,0.12)" style={styles.pawSmall} />
    </View>
  );
}

export default function HomeScreen() {
  const { session } = useAuth();
  const { unreadCount } = useNotifications();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Section>>(null);

  const [pageHeight, setPageHeight] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [dogsInCareCount, setDogsInCareCount] = useState(0);
  const [fostersOutCount, setFostersOutCount] = useState(0);
  const [todaysSchedule, setTodaysSchedule] = useState<CalendarEvent[]>([]);
  const [myEvents, setMyEvents] = useState<MyEvent[]>([]);
  const [attentionDogs, setAttentionDogs] = useState<AttentionDog[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);

  const loadHome = useCallback(async () => {
    const { start, end } = startEndOfToday();
    const todayIso = start.toISOString();
    const todayEndIso = end.toISOString();
    const todayDateOnly = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(
      start.getDate()
    ).padStart(2, '0')}`;

    const profileId = await getCurrentProfileId();

    const [dogsCountRes, fostersCountRes, scheduleRes, attentionRes, photosRes, myRes] = await Promise.all([
      supabase.from('dogs').select('id', { count: 'exact', head: true }).neq('status', 'Adopted'),
      supabase.from('fostering_records').select('id', { count: 'exact', head: true }).eq('status', 'Active'),
      supabase
        .from('calendar_events')
        .select(EVENT_COLUMNS)
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
      supabase.from('dogs').select('photo_url').not('photo_url', 'is', null).neq('status', 'Adopted').limit(5),
      profileId
        ? supabase
            .from('event_assignments')
            .select(`id, checked_in_at, calendar_events!inner(${EVENT_COLUMNS})`)
            .eq('profile_id', profileId)
            .neq('status', 'Cancelled')
            .gte('calendar_events.start_at', todayIso)
            .limit(20)
        : Promise.resolve({ data: [] as MyAssignmentRow[], error: null }),
    ]);

    setDogsInCareCount(dogsCountRes.count ?? 0);
    setFostersOutCount(fostersCountRes.count ?? 0);
    setTodaysSchedule((scheduleRes.data as unknown as CalendarEvent[] | null) ?? []);
    setPhotos(((photosRes.data as { photo_url: string }[] | null) ?? []).map((r) => r.photo_url));

    // Embedded rows can't be ordered by the parent query, so sort by event start here.
    const mine = ((myRes.data as unknown as MyAssignmentRow[] | null) ?? [])
      .filter((row): row is MyAssignmentRow & { calendar_events: CalendarEvent } => !!row.calendar_events)
      .map((row) => ({ assignmentId: row.id, checkedInAt: row.checked_in_at, event: row.calendar_events }))
      .filter((m) => !hasEnded(m.event))
      .sort((a, b) => new Date(a.event.start_at).getTime() - new Date(b.event.start_at).getTime());
    setMyEvents(mine);

    const seen = new Set<string>();
    const dogs: AttentionDog[] = [];
    for (const row of (attentionRes.data as any[] | null) ?? []) {
      const dog = row.dogs;
      if (!dog || seen.has(dog.id)) continue;
      seen.add(dog.id);
      dogs.push({ id: dog.id, name: dog.name, status: dog.status, reason: row.title });
    }
    setAttentionDogs(dogs);
  }, []);

  // Reload whenever Home comes into view; only the very first load shows a spinner.
  useFocusEffect(
    useCallback(() => {
      loadHome()
        .catch((err) => console.warn('[home] failed to load:', err))
        .finally(() => setIsLoading(false));
    }, [loadHome])
  );

  // Today's event I'm signed up for that hasn't finished yet.
  const { end: todayEnd } = startEndOfToday();
  const onDuty = myEvents.find((m) => new Date(m.event.start_at).getTime() <= todayEnd.getTime()) ?? null;

  const handleCheckIn = async () => {
    if (!onDuty) return;
    setIsCheckingIn(true);
    setCheckInError(null);
    try {
      await checkInToEvent(onDuty.event.id);
      await loadHome();
    } catch (err) {
      console.warn('[home] check-in failed:', err);
      setCheckInError(toFriendlyMessage(err, 'Could not check you in. Please try again.'));
    } finally {
      setIsCheckingIn(false);
    }
  };

  const goToSection = (index: number) => {
    setActiveIndex(index);
    listRef.current?.scrollToIndex({ index, animated: true });
  };

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (pageHeight === 0) return;
    setActiveIndex(Math.round(e.nativeEvent.contentOffset.y / pageHeight));
  };

  const firstName = session?.name?.split(' ')[0] || session?.name || '';

  const renderOnDutyCard = () => {
    if (!onDuty) return null;
    const { event, checkedInAt } = onDuty;
    const open = isCheckInOpen(event);
    const opensAt = new Date(new Date(event.start_at).getTime() - 60 * 60 * 1000).toISOString();

    return (
      <View style={[styles.card, { marginTop: 14 }]}>
        <Text style={styles.eyebrow}>YOU'RE ON TODAY</Text>
        <Text style={styles.cardBigTitle}>
          {formatTime(event.start_at)}
          {event.end_at ? ` – ${formatTime(event.end_at)}` : ''}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {[event.title, event.location].filter(Boolean).join(' · ')}
        </Text>
        <Pressable
          style={[styles.goldBtn, (!!checkedInAt || !open) && styles.goldBtnDisabled]}
          onPress={handleCheckIn}
          disabled={!!checkedInAt || !open || isCheckingIn}
          accessibilityRole="button"
        >
          {isCheckingIn ? (
            <ActivityIndicator color={colors.header} />
          ) : (
            <Text style={[styles.goldBtnText, (!!checkedInAt || !open) && { color: '#fff' }]}>
              {checkedInAt
                ? `Checked in ${formatTime(checkedInAt)}`
                : open
                  ? 'Check in'
                  : `Check-in opens ${formatTime(opensAt)}`}
            </Text>
          )}
        </Pressable>
        {checkInError ? <Text style={styles.errorText}>{checkInError}</Text> : null}
      </View>
    );
  };

  const renderBottom = (key: SectionKey) => {
    switch (key) {
      case 'welcome':
        return (
          <View>
            <Text style={styles.bigText}>
              {getGreeting()}, {firstName}.
            </Text>
            <Text style={styles.subText}>Here's what's happening at the shelter today.</Text>

            {renderOnDutyCard()}

            <View style={styles.statsRow}>
              <View style={styles.statTile}>
                <Text style={styles.statNumber}>{dogsInCareCount}</Text>
                <Text style={styles.statLabel}>Dogs in care</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statNumber}>{todaysSchedule.length}</Text>
                <Text style={styles.statLabel}>Events today</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statNumber}>{fostersOutCount}</Text>
                <Text style={styles.statLabel}>Fosters out</Text>
              </View>
            </View>
          </View>
        );

      case 'dogs':
        return (
          <View>
            <View style={styles.rowBetween}>
              <Text style={styles.bigText}>Needing attention</Text>
              <Pressable style={styles.outlinePill} onPress={() => router.push('/(tabs)/dogs')}>
                <Text style={styles.outlinePillText}>View all</Text>
              </Pressable>
            </View>
            {attentionDogs.length === 0 ? (
              <Text style={[styles.subText, { marginTop: 10 }]}>No flagged dogs right now.</Text>
            ) : (
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={attentionDogs}
                keyExtractor={(d) => d.id}
                style={{ marginTop: 14 }}
                ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
                renderItem={({ item }) => (
                  <Pressable style={styles.dogCard} onPress={() => router.push(`/(tabs)/dogs/${item.id}`)}>
                    <View style={styles.dogAvatar}>
                      <Text style={styles.dogInitial}>{item.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <Text style={styles.cardMeta} numberOfLines={1}>
                      {item.reason}
                    </Text>
                  </Pressable>
                )}
              />
            )}
          </View>
        );

      case 'calendar':
        return (
          <View>
            <View style={styles.rowBetween}>
              <Text style={styles.bigText}>Today's schedule</Text>
              <Pressable style={styles.outlinePill} onPress={() => router.push('/(tabs)/calendar')}>
                <Text style={styles.outlinePillText}>View all</Text>
              </Pressable>
            </View>
            {todaysSchedule.length === 0 ? (
              <Text style={[styles.subText, { marginTop: 10 }]}>Nothing on the calendar for today.</Text>
            ) : (
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={todaysSchedule}
                keyExtractor={(e) => e.id}
                style={{ marginTop: 14 }}
                ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
                renderItem={({ item }) => (
                  <Pressable style={styles.eventCard} onPress={() => router.push(`/(tabs)/calendar/${item.id}`)}>
                    <Text style={styles.eyebrow}>{formatTime(item.start_at)}</Text>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    {item.location ? (
                      <Text style={styles.cardMeta} numberOfLines={1}>
                        {item.location}
                      </Text>
                    ) : null}
                  </Pressable>
                )}
              />
            )}
          </View>
        );

      case 'myEvents':
        return (
          <View>
            <View style={styles.rowBetween}>
              <Text style={styles.bigText}>My events</Text>
              <Pressable style={styles.outlinePill} onPress={() => router.push('/(tabs)/calendar')}>
                <Text style={styles.outlinePillText}>Find more</Text>
              </Pressable>
            </View>
            {myEvents.length === 0 ? (
              <Text style={[styles.subText, { marginTop: 10 }]}>
                You haven't signed up for anything yet. Open the calendar to join an event.
              </Text>
            ) : (
              <View style={{ marginTop: 14, gap: 10 }}>
                {myEvents.slice(0, MY_EVENTS_SHOWN).map((m) => (
                  <Pressable
                    key={m.assignmentId}
                    style={styles.myEventRow}
                    onPress={() => router.push(`/(tabs)/calendar/${m.event.id}`)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.eyebrow}>{formatDayTime(m.event.start_at)}</Text>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {m.event.title}
                      </Text>
                      {m.event.location ? (
                        <Text style={styles.cardMeta} numberOfLines={1}>
                          {m.event.location}
                        </Text>
                      ) : null}
                    </View>
                    {m.checkedInAt ? (
                      <Ionicons name="checkmark-circle" size={22} color={colors.gold} />
                    ) : (
                      <Ionicons name="chevron-forward" size={20} color="#fff" />
                    )}
                  </Pressable>
                ))}
                {myEvents.length > MY_EVENTS_SHOWN ? (
                  <Text style={styles.cardMeta}>+{myEvents.length - MY_EVENTS_SHOWN} more on your calendar</Text>
                ) : null}
              </View>
            )}
          </View>
        );

      case 'alerts':
        return (
          <View>
            <Text style={styles.bigText}>
              {unreadCount === 0 ? "You're all caught up" : `${unreadCount} new update${unreadCount === 1 ? '' : 's'}`}
            </Text>
            <Text style={styles.subText}>Medical, calendar and task alerts live here.</Text>
            <Pressable style={[styles.goldBtn, styles.alignStart]} onPress={() => router.push('/(tabs)/alerts')}>
              <Text style={styles.goldBtnText}>Open alerts</Text>
            </Pressable>
          </View>
        );
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <StatusBar style="light" />
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root} onLayout={(e: LayoutChangeEvent) => setPageHeight(e.nativeEvent.layout.height)}>
      <StatusBar style="light" />

      {pageHeight > 0 ? (
        <FlatList
          ref={listRef}
          data={SECTIONS}
          keyExtractor={(s) => s.key}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumEnd}
          getItemLayout={(_, index) => ({ length: pageHeight, offset: pageHeight * index, index })}
          renderItem={({ item, index }) => (
            <View style={{ height: pageHeight }}>
              <SlideBackground index={index} uri={photos.length > 0 ? photos[index % photos.length] : undefined} />
              {/* Dark at the top for the titles, dark at the bottom for the cards */}
              <LinearGradient
                colors={['rgba(9,19,15,0.85)', 'rgba(9,19,15,0.15)', 'rgba(9,19,15,0.9)']}
                locations={[0, 0.45, 1]}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.slideBottom}>{renderBottom(item.key)}</View>
            </View>
          )}
        />
      ) : null}

      <View style={[styles.header, { paddingTop: insets.top + 10 }]} pointerEvents="box-none">
        <View style={styles.headerRow}>
          <View style={styles.brandPill}>
            <Ionicons name="paw" size={16} color={colors.gold} />
            <Text style={styles.brandText}>KZN Doghouse</Text>
          </View>
          <Pressable onPress={() => router.push('/(tabs)/alerts')} hitSlop={10} accessibilityLabel="Open alerts">
            <Ionicons name="notifications-outline" size={27} color="#fff" />
            {unreadCount > 0 ? (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
        <View style={styles.divider} />

        {SECTIONS.map((s, i) => (
          <Pressable key={s.key} onPress={() => goToSection(i)} hitSlop={4}>
            <Text style={[styles.titleItem, i === activeIndex && styles.titleItemActive]}>{s.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Page dots on the right */}
      <View style={[styles.dots, { top: insets.top + 118 }]} pointerEvents="none">
        {SECTIONS.map((s, i) => (
          <View key={s.key} style={[styles.dot, i === activeIndex && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.header },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.header },

  pawBig: { position: 'absolute', right: -90, top: 260 },
  pawSmall: { position: 'absolute', left: 30, top: 470, transform: [{ rotate: '-20deg' }] },

  header: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 9,
    backgroundColor: 'rgba(18,36,28,0.55)',
  },
  brandText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  bellBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  bellBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginVertical: 14 },

  titleItem: { fontSize: 18, lineHeight: 31, color: 'rgba(255,255,255,0.55)', fontWeight: '500' },
  titleItemActive: { color: '#fff', fontWeight: '800', fontSize: 25 },

  dots: { position: 'absolute', right: 14, gap: 8, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { height: 26, backgroundColor: colors.gold },

  slideBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20, paddingBottom: 24 },

  bigText: { color: '#fff', fontSize: 26, fontWeight: '800' },
  subText: { color: 'rgba(255,255,255,0.78)', fontSize: 14, marginTop: 6 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  outlinePill: { borderWidth: 2, borderColor: '#fff', borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 7 },
  outlinePillText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  card: { backgroundColor: CARD, borderRadius: radius.md, padding: 16 },
  eyebrow: { color: colors.gold, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  cardBigTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 6 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 6 },
  cardMeta: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 },
  errorText: { color: colors.dangerSoft, fontSize: 12, marginTop: 8, textAlign: 'center' },

  goldBtn: { backgroundColor: colors.gold, borderRadius: radius.pill, paddingVertical: 12, alignItems: 'center', marginTop: 14 },
  goldBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.22)' },
  goldBtnText: { color: colors.header, fontWeight: '800', fontSize: 14 },
  alignStart: { alignSelf: 'flex-start', paddingHorizontal: 30 },

  statsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  statTile: { flex: 1, backgroundColor: CARD, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  statNumber: { color: '#fff', fontSize: 24, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 },

  dogCard: { width: 150, backgroundColor: CARD, borderRadius: radius.md, padding: 14 },
  dogAvatar: { width: 46, height: 46, borderRadius: 12, backgroundColor: colors.cardGreen, alignItems: 'center', justifyContent: 'center' },
  dogInitial: { color: '#fff', fontSize: 20, fontWeight: '800' },
  eventCard: { width: 210, backgroundColor: CARD, borderRadius: radius.md, padding: 14 },
  myEventRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: CARD, borderRadius: radius.md, padding: 14 },
});