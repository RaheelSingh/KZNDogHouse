import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '@/context/NotificationsContext';
import { colors, radius } from '@/theme';
import { PageHeader, UnderlineTabs } from '@/components/ui';
import type { AppNotification, NotificationCategory } from '@/types/models';

type Filter = 'All' | NotificationCategory;
const TABS: { key: Filter; label: string }[] = [
  { key: 'All', label: 'All' },
  { key: 'Medical', label: 'Medical' },
  { key: 'Calendar', label: 'Calendar' },
  { key: 'Tasks', label: 'Tasks' },
  { key: 'Messages', label: 'Messages' },
];

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const CATEGORY_STYLE: Record<NotificationCategory, { bg: string; fg: string; icon: IconName }> = {
  Medical: { bg: '#f4d3cf', fg: '#b3261e', icon: 'medkit-outline' },
  Calendar: { bg: '#f3e1c2', fg: '#8a5a12', icon: 'calendar-outline' },
  Tasks: { bg: '#dcecdd', fg: '#1f6b3a', icon: 'checkbox-outline' },
  Messages: { bg: '#dbe3f0', fg: '#2b4a8a', icon: 'chatbubble-ellipses-outline' },
  General: { bg: '#e8ebe5', fg: '#555555', icon: 'notifications-outline' },
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

  return (
    <View style={styles.root}>
      <PageHeader
        title="Notifications"
        subtitle={unreadCount === 0 ? "You're all caught up" : `${unreadCount} new update${unreadCount === 1 ? '' : 's'}`}
        right={
          <Pressable onPress={onClearAll} hitSlop={10}>
            <Text style={styles.clearAll}>Clear all</Text>
          </Pressable>
        }
      >
        <UnderlineTabs tabs={TABS} active={filter} onChange={setFilter} />
      </PageHeader>

      {isLoading && notifications.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#fff" />}
          renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={40} color={colors.fgFaint} />
              <Text style={styles.emptyText}>No notifications yet.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const look = CATEGORY_STYLE[item.category] ?? CATEGORY_STYLE.General;
            return (
              <Pressable style={[styles.card, !item.is_read && styles.cardUnread]} onPress={() => onPressItem(item)}>
                <View style={[styles.iconBox, { backgroundColor: look.bg }]}>
                  <Ionicons name={look.icon} size={20} color={look.fg} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  {item.body ? <Text style={styles.cardText}>{item.body}</Text> : null}
                  <Text style={styles.cardTime}>{formatWhen(item.created_at)}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  clearAll: { color: colors.gold, fontSize: 14, fontWeight: '800' },
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  sectionHeader: { color: colors.fgFaint, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginTop: 22, marginBottom: 12 },
  card: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cardUnread: { borderColor: colors.gold },
  iconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  cardText: { color: colors.fgMuted, fontSize: 13, marginTop: 3, lineHeight: 18 },
  cardTime: { color: colors.fgFaint, fontSize: 11, marginTop: 6 },
  empty: { alignItems: 'center', paddingTop: 70, gap: 10 },
  emptyText: { color: colors.fgMuted, fontSize: 15 },
});