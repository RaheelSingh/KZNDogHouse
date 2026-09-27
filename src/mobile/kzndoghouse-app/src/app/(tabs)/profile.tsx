import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { getCurrentProfileId } from '@/lib/profile';
import { isStaff } from '@/lib/roles';

const GREEN = '#16302a';
const GREEN_DARK = '#0f231e';

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const staff = isStaff(session?.role);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);

  const load = useCallback(async () => {
    const profileId = await getCurrentProfileId();
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

  useEffect(() => {
    setIsLoading(true);
    load()
      .catch((err) => console.warn('[profile] failed to load:', err))
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

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setIsSigningOut(true);
          try {
            await signOut();
          } catch (err) {
            console.warn('[profile] sign out failed:', err);
          } finally {
            setIsSigningOut(false);
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={GREEN} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials || '?'}</Text>
        </View>
        <Text style={styles.name}>{session?.name ?? 'Unknown'}</Text>
        <Text style={styles.email}>{session?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>{staff ? 'Staff' : 'Volunteer'}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statTile}>
          <Text style={styles.statValue}>{upcomingCount}</Text>
          <Text style={styles.statLabel}>Upcoming shifts</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={styles.statValue}>{completedCount}</Text>
          <Text style={styles.statLabel}>Shifts completed</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Pressable
          style={[styles.signOutBtn, isSigningOut && styles.signOutBtnDisabled]}
          onPress={handleSignOut}
          disabled={isSigningOut}
        >
          {isSigningOut ? <ActivityIndicator color="#b3261e" /> : <Text style={styles.signOutText}>Sign out</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  container: { padding: 20, paddingTop: 56, paddingBottom: 60 },
  header: { alignItems: 'center', marginBottom: 28 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { color: '#fff', fontSize: 26, fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '700', color: GREEN },
  email: { fontSize: 13, color: '#6b7a70', marginTop: 2 },
  roleBadge: { backgroundColor: '#eef2ee', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginTop: 10 },
  roleBadgeText: { fontSize: 12, fontWeight: '700', color: GREEN },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  statTile: { flex: 1, backgroundColor: GREEN_DARK, borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 22, fontWeight: '700' },
  statLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 4, textAlign: 'center' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: GREEN, marginBottom: 10 },
  signOutBtn: { borderWidth: 1, borderColor: '#b3261e', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  signOutBtnDisabled: { opacity: 0.6 },
  signOutText: { color: '#b3261e', fontWeight: '700', fontSize: 15 },
});