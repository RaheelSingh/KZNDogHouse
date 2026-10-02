import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '@/context/NotificationsContext';
import type { AppNotification, NotificationCategory } from '@/types/models';

const GREEN = '#16302a';
const GREEN_DARK = '#0f231e';
const PAGE_BG = '#eef0ea';

type Filter = 'All' | NotificationCategory;
const FILTERS: Filter[] = ['All', 'Medical', 'Calendar', 'Tasks', 'Messages'];

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const CATEGORY_STYLE: Record<NotificationCategory, { bg: string; fg: string; icon: IconName }> = {
  Medical: { bg: '#f4d3cf', fg: '#b3261e', icon: 'medkit-outline' },
  Calendar: { bg: '#e6dcc2', fg: '#8a5a12', icon: 'calendar-outline' },
  Tasks: { bg: '#e3ece6', fg: GREEN, icon: 'checkbox-outline' },
  Messages: { bg: '#dbe3f0', fg: '#2b4a8a', icon: 'chatbubble-ellipses-outline' },
  General: { bg: '#e5e5e5', fg: '#555555', icon: 'notifications-outline' },
};

type SectionTitle = 'TODAY' | 'YESTERDAY' | 'EARLIER';

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function sectionFor(iso: string): SectionTitle {
  const today = startOfDay(new Date());
  const day = startOfDay(new Date(iso));
  if (day === today) return 'TODAY';
  if (day === today - 86_400_000) return 'YESTERDAY';
  return 'EARLIER';
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const section = sectionFor(iso);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (section === 'TODAY') {
    const hours = Math.floor(minutes / 60);
    return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  }
  if (section === 'YESTERDAY') return `Yesterday, ${time}`;
  return `${date.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${time}`;
}

export default function AlertsScreen() {
  const { notifications, unreadCount, isLoading, refresh, markAsRead, clearAll } = useNotifications();
  const [filter, setFilter] = useState<Filter>('All');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const sections = useMemo(() => {
    const visible = filter === 'All' ? notifications : notifications.filter((n) => n.category === filter);
    const groups: Record<SectionTitle, AppNotification[]> = { TODAY: [], YESTERDAY: [], EARLIER: [] };
    visible.forEach((n) => groups[sectionFor(n.created_at)].push(n));
    return (Object.keys(groups) as SectionTitle[])
      .filter((title) => groups[title].length > 0)
      .map((title) => ({ title, data: groups[title] }));
  }, [notifications, filter]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [refresh]);

  const onPressItem = (item: AppNotification) => {
    if (!item.is_read) markAsRead(item.id);
    const route = item.data?.route;
    if (typeof route === 'string' && route.length > 0 && route !== '/alerts') {
      router.push(route as Href);
    }
  };

  const onClearAll = () => {
    if (notifications.length === 0) return;
    Alert.alert('Clear all notifications', 'This removes every notification from your list.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear all', style: 'destructive', onPress: () => clearAll() },
    ]);
  };

  if (isLoading && notifications.length === 0) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={GREEN} size="large" />
      </View>
    );
  }

  return (
    <SectionList
      style={styles.flex}
      contentContainerStyle={styles.listContent}
      sections={sections}
      keyExtractor={(item) => item.id}
      stickySectionHeadersEnabled={false}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View>
          <View style={styles.hero}>
            <View style={styles.heroTopRow}>
              <Text style={styles.heroTitle}>Notifications</Text>
              <Pressable onPress={onClearAll} hitSlop={8}>
                <Text style={styles.clearAll}>Clear all</Text>
              </Pressable>
            </View>
            <Text style={styles.heroCount}>
              {unreadCount === 0 ? "You're all caught up" : `${unreadCount} new update${unreadCount === 1 ? '' : 's'}`}
            </Text>
            <Text style={styles.heroSubtitle}>Everything that needs your attention.</Text>
          </View>

          <View style={styles.chipsRow}>
            {FILTERS.map((f) => (
              <Pressable key={f} onPress={() => setFilter(f)} style={[styles.chip, filter === f && styles.chipActive]}>
                <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>{f}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      }
      renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="notifications-off-outline" size={36} color="#9aa89f" />
          <Text style={styles.emptyText}>No notifications yet.</Text>
        </View>
      }
      renderItem={({ item }) => {
        const look = CATEGORY_STYLE[item.category] ?? CATEGORY_STYLE.General;
        return (
          <Pressable style={[styles.card, !item.is_read && styles.cardUnread]} onPress={() => onPressItem(item)}>
            <View style={[styles.iconBox, { backgroundColor: look.bg }]}>
              <Ionicons name={look.icon} size={18} color={look.fg} />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              {item.body ? <Text style={styles.cardText}>{item.body}</Text> : null}
              <Text style={styles.cardTime}>{formatWhen(item.created_at)}</Text>
            </View>
            {!item.is_read ? <View style={styles.unreadDot} /> : null}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: PAGE_BG },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: PAGE_BG },
  listContent: { paddingBottom: 40 },
  hero: {
    backgroundColor: GREEN_DARK,
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  heroTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  clearAll: { color: '#fff', fontSize: 12, fontWeight: '700' },
  heroCount: { color: '#fff', fontSize: 24, fontWeight: '700' },
  heroSubtitle: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 4 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingTop: 16 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9e0d9',
  },
  chipActive: { backgroundColor: GREEN, borderColor: GREEN },
  chipText: { fontSize: 12, color: GREEN, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8a9a8f',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e3e8e3',
  },
  cardUnread: { borderColor: GREEN },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: GREEN },
  cardText: { fontSize: 12, color: '#4d5c52', marginTop: 3, lineHeight: 17 },
  cardTime: { fontSize: 11, color: '#8a9a8f', marginTop: 6 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#b3261e', marginLeft: 8, marginTop: 4 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { color: '#6b7a70', fontSize: 14 },
});