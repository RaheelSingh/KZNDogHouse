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
import { colors, radius } from '@/theme';
import type { CalendarEvent, Dog } from '@/types/models';

type SectionKey = 'welcome' | 'dogs' | 'calendar' | 'availability' | 'alerts';
type Section = { key: SectionKey; label: string };

const SECTIONS: Section[] = [
  { key: 'welcome', label: 'Welcome back' },
  { key: 'dogs', label: 'Dogs' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'availability', label: 'Availability' },
  { key: 'alerts', label: 'Alerts' },
];


const SLIDE_COLORS = ['#12241c', '#17302a', '#1f3d2e', '#14281f', '#2b4d3b'];
const CARD = 'rgba(18,36,28,0.82)';

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
  const [myShift, setMyShift] = useState<ShiftWithAssignment | null>(null);
  const [attentionDogs, setAttentionDogs] = useState<AttentionDog[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  const loadHome = useCallback(async () => {
    const { start, end } = startEndOfToday();
    const todayIso = start.toISOString();
    const todayEndIso = end.toISOString();
    const todayDateOnly = start.toISOString().slice(0, 10);
    const profileId = await getCurrentProfileId();

    const [dogsCountRes, fostersCountRes, scheduleRes, attentionRes, photosRes] = await Promise.all([
      supabase.from('dogs').select('id', { count: 'exact', head: true }).neq('status', 'Adopted'),
      supabase.from('fostering_records').select('id', { count: 'exact', head: true }).eq('status', 'Active'),
      supabase
        .from('calendar_events')
        .select('id, title, category, description, location, start_at, end_at, visibility, dog_id, created_by, created_at')
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
    ]);

    setDogsInCareCount(dogsCountRes.count ?? 0);
    setFostersOutCount(fostersCountRes.count ?? 0);
    setTodaysSchedule((scheduleRes.data as CalendarEvent[]) ?? []);
    setPhotos(((photosRes.data as { photo_url: string }[]) ?? []).map((r) => r.photo_url));

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

  // Reload whenever the Home tab comes into view.
  useFocusEffect(
    useCallback(() => {
      loadHome()
        .catch((err) => console.warn('[home] failed to load:', err))
        .finally(() => setIsLoading(false));
    }, [loadHome])
  );

  const handleCheckIn = async () => {
    if (!myShift || myShift.event_assignments.length === 0) return;
    setIsCheckingIn(true);
    try {
      const { error } = await supabase
        .from('event_assignments')
        .update({ checked_in_at: new Date().toISOString() })
        .eq('id', myShift.event_assignments[0].id);
      if (error) throw error;
      await loadHome();
    } catch (err) {
      console.warn('[home] check-in failed:', err);
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

  const checkedInAt = myShift?.event_assignments[0]?.checked_in_at ?? null;
  const firstName = session?.name?.split(' ')[0] || session?.name || '';

  const renderBottom = (key: SectionKey) => {
    switch (key) {
      case 'welcome':
        return (
          <View>
            <Text style={styles.bigText}>
              {getGreeting()}, {firstName}.
            </Text>
            <Text style={styles.subText}>Here's what's happening at the shelter today.</Text>

            {myShift ? (
              <View style={[styles.card, { marginTop: 14 }]}>
                <Text style={styles.eyebrow}>ON DUTY TODAY</Text>
                <Text style={styles.cardBigTitle}>
                  {formatTime(myShift.start_at)}
                  {myShift.end_at ? ` – ${formatTime(myShift.end_at)}` : ''}
                </Text>
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {[myShift.location, myShift.title].filter(Boolean).join(' · ')}
                </Text>
                <Pressable
                  style={[styles.goldBtn, !!checkedInAt && styles.goldBtnDisabled]}
                  onPress={handleCheckIn}
                  disabled={!!checkedInAt || isCheckingIn}
                >
                  {isCheckingIn ? (
                    <ActivityIndicator color={colors.header} />
                  ) : (
                    <Text style={styles.goldBtnText}>
                      {checkedInAt ? `Checked in ${formatTime(checkedInAt)}` : 'Check in'}
                    </Text>
                  )}
                </Pressable>
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

      case 'availability':
        return (
          <View>
            <Text style={styles.bigText}>Next week</Text>
            <Text style={styles.subText}>Tell us when you're free to volunteer.</Text>
            <View style={styles.whiteCard}>
              <Text style={styles.whiteCardTitle}>Set your availability</Text>
              <Text style={styles.whiteCardText}>
                Tap the mornings, afternoons and evenings you can help. A coordinator will approve them.
              </Text>
              <Pressable style={styles.solidBtn} onPress={() => router.push('/availability')}>
                <Text style={styles.solidBtnText}>Open availability</Text>
              </Pressable>
            </View>
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
              {/* Soft fade: dark at the top for the titles, dark at the bottom for the cards */}
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
          <Pressable onPress={() => router.push('/(tabs)/alerts')} hitSlop={10}>
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

      {/* Dots on the right */}
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
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 8 },
  cardMeta: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 },

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

  whiteCard: { backgroundColor: '#fff', borderRadius: radius.md, padding: 20, marginTop: 16 },
  whiteCardTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  whiteCardText: { color: colors.textMuted, fontSize: 13, marginTop: 6, lineHeight: 19 },
  solidBtn: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: 13, alignItems: 'center', marginTop: 16 },
  solidBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});