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
  { key: 'Calendar', label: 'Calendar' },
  { key: 'Tasks', label: 'Tasks' },
  { key: 'Medical', label: 'Medical' },
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
  const { notifications, unreadCount, isLoading, refresh, markAsRead, markAllAsRead, clearOne, clearAll } =
    useNotifications();
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

  const onLongPressItem = (item: AppNotification) => {
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];
    if (!item.is_read) buttons.push({ text: 'Mark as read', onPress: () => markAsRead(item.id) });
    buttons.push({ text: 'Clear', style: 'destructive', onPress: () => clearOne(item.id) });
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(item.title, undefined, buttons);
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
          <>
            {unreadCount > 0 ? (
              <Pressable onPress={markAllAsRead} hitSlop={10} accessibilityRole="button">
                <Text style={styles.headerAction}>Mark all read</Text>
              </Pressable>
            ) : null}
            {notifications.length > 0 ? (
              <Pressable onPress={onClearAll} hitSlop={10} accessibilityRole="button">
                <Text style={styles.headerAction}>Clear all</Text>
              </Pressable>
            ) : null}
          </>
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
              <Text style={styles.emptyText}>
                {filter === 'All' ? 'No notifications yet.' : `No ${filter.toLowerCase()} notifications.`}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const look = CATEGORY_STYLE[item.category] ?? CATEGORY_STYLE.General;
            return (
              <Pressable
                style={({ pressed }) => [styles.card, !item.is_read && styles.cardUnread, pressed && { opacity: 0.85 }]}
                onPress={() => onPressItem(item)}
                onLongPress={() => onLongPressItem(item)}
                delayLongPress={350}
                accessibilityRole="button"
                accessibilityLabel={`${item.is_read ? '' : 'Unread. '}${item.title}. ${item.body ?? ''}`}
                accessibilityHint="Long press for more options"
              >
                <View style={[styles.iconBox, { backgroundColor: look.bg }]}>
                  <Ionicons name={look.icon} size={20} color={look.fg} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    {!item.is_read ? <View style={styles.unreadDot} /> : null}
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                  </View>
                  {item.body ? <Text style={styles.cardText}>{item.body}</Text> : null}
                  <Text style={styles.cardTime}>{formatWhen(item.created_at)}</Text>
                </View>
                <Pressable
                  onPress={() => clearOne(item.id)}
                  hitSlop={12}
                  style={styles.clearBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Clear ${item.title}`}
                >
                  <Ionicons name="close" size={18} color={colors.fgFaint} />
                </Pressable>
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
  headerAction: { color: colors.gold, fontSize: 14, fontWeight: '800' },
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '800', flexShrink: 1 },
  cardText: { color: colors.fgMuted, fontSize: 13, marginTop: 3, lineHeight: 18 },
  cardTime: { color: colors.fgFaint, fontSize: 11, marginTop: 6 },
  clearBtn: { alignSelf: 'flex-start', padding: 2 },
  empty: { alignItems: 'center', paddingTop: 70, gap: 10 },
  emptyText: { color: colors.fgMuted, fontSize: 15 },
});