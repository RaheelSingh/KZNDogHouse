import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationsContext';
import { supabase } from '@/lib/supabase';
import { getCurrentProfileId } from '@/lib/profile';
import { isStaff } from '@/lib/roles';
import { colors, radius } from '@/theme';
import { ListRow } from '@/components/ui';

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const insets = useSafeAreaInsets();
  const staff = isStaff(session?.role);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [phone, setPhone] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [profileId, userRes] = await Promise.all([getCurrentProfileId(), supabase.auth.getUser()]);

    const metaPhone = userRes.data.user?.user_metadata?.phone;
    setPhone(typeof metaPhone === 'string' && metaPhone.length > 0 ? metaPhone : null);

    if (!profileId) return;
    const nowIso = new Date().toISOString();

    const [upcomingRes, completedRes] = await Promise.all([
      supabase
        .from('event_assignments')
        .select('id, calendar_events!inner(start_at)', { count: 'exact', head: true })
        .eq('profile_id', profileId)
        .neq('status', 'Cancelled')
        .gte('calendar_events.start_at', nowIso),
      supabase
        .from('event_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', profileId)
        .not('checked_in_at', 'is', null),
    ]);

    setUpcomingCount(upcomingRes.count ?? 0);
    setCompletedCount(completedRes.count ?? 0);
  }, []);

  // Refresh the stats every time this tab is opened (e.g. after signing up for an event).
  useFocusEffect(
    useCallback(() => {
      load()
        .catch((err) => console.warn('[profile] failed to load:', err))
        .finally(() => setIsLoading(false));
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await load();
    } catch (err) {
      console.warn('[profile] refresh failed:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [load]);

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (err) {
            console.warn('[profile] sign out failed:', err);
            Alert.alert('Sign out failed', 'Please check your connection and try again.');
          }
        },
      },
    ]);
  };

  const initials = (session?.name ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  if (isLoading) {
    return (
      <View style={styles.center}>
        <StatusBar style="light" />
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + 28, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#fff" />}
    >
      <StatusBar style="light" />

      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials || '?'}</Text>
        </View>
        <Text style={styles.name}>{session?.name ?? 'Unknown'}</Text>
        <View style={styles.rolePill}>
          <Ionicons name={staff ? 'shield-checkmark-outline' : 'heart-outline'} size={18} color={colors.gold} />
          <Text style={styles.roleText}>{staff ? 'Staff' : 'Volunteer'}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statTile}>
          <Text style={styles.statValue}>{upcomingCount}</Text>
          <Text style={styles.statLabel}>Upcoming events</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={styles.statValue}>{completedCount}</Text>
          <Text style={styles.statLabel}>Events attended</Text>
        </View>
      </View>

      <View style={styles.list}>
        <ListRow icon="mail-outline" title="Email" subtitle={session?.email} />
        {phone ? <ListRow icon="call-outline" title="Phone" subtitle={phone} /> : null}
        <ListRow
          icon="calendar-outline"
          title="My events"
          subtitle={upcomingCount > 0 ? `${upcomingCount} coming up` : 'Find an event to join'}
          onPress={() => router.push('/(tabs)/calendar')}
        />
        <ListRow
          icon="notifications-outline"
          title="Notifications"
          subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          onPress={() => router.push('/(tabs)/alerts')}
          right={
            unreadCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            ) : undefined
          }
        />
        <ListRow icon="log-out-outline" title="Sign out" danger onPress={handleSignOut} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.page },
  header: { alignItems: 'center', marginBottom: 26 },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.raised,
    borderWidth: 3,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  name: { color: '#fff', fontSize: 32, fontWeight: '800', textAlign: 'center', paddingHorizontal: 20 },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: colors.gold,
    borderRadius: radius.pill,
    paddingHorizontal: 22,
    paddingVertical: 9,
    marginTop: 16,
  },
  roleText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  statsRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginBottom: 22 },
  statTile: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: 20, alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 30, fontWeight: '800' },
  statLabel: { color: colors.fgMuted, fontSize: 12, marginTop: 4 },
  list: { paddingHorizontal: 20 },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  badgeText: { color: colors.header, fontSize: 12, fontWeight: '800' },
});