import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { getCurrentProfileId } from '@/lib/profile';
import { isStaff } from '@/lib/roles';
import { colors, radius } from '@/theme';
import { PageHeader, PillButton, Tag } from '@/components/ui';
import type { AvailabilitySlot, AvailabilitySlotName } from '@/types/models';

const SLOTS: { name: AvailabilitySlotName; hours: string }[] = [
  { name: 'Morning', hours: '8–12' },
  { name: 'Afternoon', hours: '12–4' },
  { name: 'Evening', hours: '4–7' },
];

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toDateOnlyString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

function formatRange(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  if (weekStart.getMonth() === end.getMonth()) {
    return `${weekStart.getDate()} – ${end.getDate()} ${end.toLocaleDateString([], { month: 'long' })}`;
  }
  const short = (d: Date) => d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  return `${short(weekStart)} – ${short(end)}`;
}

export default function AvailabilityScreen() {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const staff = isStaff(session?.role);

  const [weekOffset, setWeekOffset] = useState(1); // default: next week
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [mySlots, setMySlots] = useState<AvailabilitySlot[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [allSlots, setAllSlots] = useState<AvailabilitySlot[]>([]);
  const [volunteerNames, setVolunteerNames] = useState<Record<string, string>>({});
  const [actingId, setActingId] = useState<string | null>(null);

  const todayStr = useMemo(() => toDateOnlyString(new Date()), []);
  const weekStart = useMemo(() => addDays(getMonday(new Date()), weekOffset * 7), [weekOffset]);
  const weekStartStr = useMemo(() => toDateOnlyString(weekStart), [weekStart]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const dayStrs = useMemo(() => days.map(toDateOnlyString), [days]);
  const weekNumber = useMemo(() => isoWeek(weekStart), [weekStart]);

  const rowsByKey = useMemo(() => {
    const map: Record<string, AvailabilitySlot> = {};
    mySlots.forEach((row) => {
      map[`${row.day_date}_${row.slot}`] = row;
    });
    return map;
  }, [mySlots]);

  const load = useCallback(async () => {
    if (staff) {
      const { data, error } = await supabase
        .from('availability_slots')
        .select('*')
        .eq('week_start', weekStartStr)
        .order('day_date', { ascending: true })
        .order('slot', { ascending: true });

      if (error) throw error;
      const rows = (data as AvailabilitySlot[]) ?? [];
      setAllSlots(rows);

      const ids = Array.from(new Set(rows.map((r) => r.volunteer_id)));
      if (ids.length > 0) {
        const { data: namesData, error: namesError } = await supabase.rpc('get_profile_names', {
          profile_ids: ids,
        });
        if (namesError) {
          console.warn('[availability] could not load volunteer names:', namesError);
        } else {
          const map: Record<string, string> = {};
          ((namesData as { id: string; first_name: string; last_name: string }[]) ?? []).forEach((p) => {
            map[p.id] = `${p.first_name} ${p.last_name}`.trim();
          });
          setVolunteerNames(map);
        }
      } else {
        setVolunteerNames({});
      }
    } else {
      const profileId = await getCurrentProfileId();
      const { data, error } = await supabase
        .from('availability_slots')
        .select('*')
        .eq('volunteer_id', profileId)
        .eq('week_start', weekStartStr);

      if (error) throw error;
      const rows = (data as AvailabilitySlot[]) ?? [];
      setMySlots(rows);
      setSelectedKeys(
        new Set(rows.filter((r) => r.status !== 'Rejected').map((r) => `${r.day_date}_${r.slot}`))
      );
    }
  }, [staff, weekStartStr]);

  useEffect(() => {
    setIsLoading(true);
    load()
      .catch((err) => console.warn('[availability] failed to load:', err))
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

  const toggleSlot = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const profileId = await getCurrentProfileId();
      const ops: PromiseLike<unknown>[] = [];

      dayStrs.forEach((dayStr) => {
        SLOTS.forEach(({ name: slot }) => {
          const key = `${dayStr}_${slot}`;
          const existingRow = rowsByKey[key];
          const isSelected = selectedKeys.has(key);

          if (isSelected) {
            if (!existingRow) {
              ops.push(
                supabase.from('availability_slots').insert({
                  volunteer_id: profileId,
                  week_start: weekStartStr,
                  day_date: dayStr,
                  slot,
                  status: 'Pending',
                })
              );
            } else if (existingRow.status === 'Rejected') {
              ops.push(
                supabase
                  .from('availability_slots')
                  .update({ status: 'Pending', reviewed_by: null, reviewed_at: null })
                  .eq('id', existingRow.id)
              );
            }
          } else if (existingRow && existingRow.status === 'Pending') {
            ops.push(supabase.from('availability_slots').delete().eq('id', existingRow.id));
          }
        });
      });

      await Promise.all(ops);
      await load();
    } catch (err) {
      console.warn('[availability] submit failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReview = async (rowId: string, newStatus: 'Approved' | 'Rejected') => {
    setActingId(rowId);
    try {
      const profileId = await getCurrentProfileId();
      const { error } = await supabase
        .from('availability_slots')
        .update({ status: newStatus, reviewed_by: profileId, reviewed_at: new Date().toISOString() })
        .eq('id', rowId);
      if (error) throw error;
      await load();
    } catch (err) {
      console.warn('[availability] review failed:', err);
    } finally {
      setActingId(null);
    }
  };

  const submittedRows = mySlots.filter((r) => r.status !== 'Rejected');
  const submissionStatus = submittedRows.some((r) => r.status === 'Pending') ? 'PENDING' : 'CONFIRMED';

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: staff ? 40 + insets.bottom : 190 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#fff" />}
      >
        <PageHeader
          title={staff ? 'Volunteer availability' : 'When are you free?'}
          subtitle={staff ? 'Review and approve submissions for this week.' : 'Tap the slots you can volunteer this week.'}
          onBack={() => router.back()}
        />

        <View style={styles.body}>
          <View style={styles.weekNav}>
            <Pressable onPress={() => setWeekOffset((w) => w - 1)} hitSlop={10} style={styles.navBtn}>
              <Ionicons name="chevron-back" size={20} color="#fff" />
            </Pressable>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.weekRange}>{formatRange(weekStart)}</Text>
              <Text style={styles.weekNum}>Week {weekNumber}</Text>
            </View>
            <Pressable onPress={() => setWeekOffset((w) => w + 1)} hitSlop={10} style={styles.navBtn}>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </Pressable>
          </View>

          {isLoading ? (
            <ActivityIndicator color="#fff" size="large" style={{ marginTop: 40 }} />
          ) : staff ? (
            <View>
              {days.map((day, i) => {
                const dayStr = dayStrs[i];
                const dayRows = allSlots.filter((row) => row.day_date === dayStr);
                if (dayRows.length === 0) return null;
                return (
                  <View key={dayStr} style={styles.dayCard}>
                    <View style={styles.dayHeadRow}>
                      <Text style={styles.dayName}>{day.toLocaleDateString([], { weekday: 'long' })}</Text>
                      <Text style={styles.dayDate}>{day.toLocaleDateString([], { day: 'numeric', month: 'long' })}</Text>
                    </View>
                    {dayRows.map((row) => {
                      const tone =
                        row.status === 'Approved'
                          ? { bg: '#dcecdd', fg: '#1f6b3a' }
                          : row.status === 'Rejected'
                            ? { bg: '#f4d3cf', fg: '#b3261e' }
                            : { bg: '#f3e1c2', fg: '#8a5a12' };
                      return (
                        <View key={row.id} style={styles.reviewRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.reviewName}>{volunteerNames[row.volunteer_id] ?? 'Volunteer'}</Text>
                            <Text style={styles.reviewSlot}>{row.slot}</Text>
                            <View style={{ marginTop: 6 }}>
                              <Tag label={row.status.toUpperCase()} bg={tone.bg} fg={tone.fg} />
                            </View>
                          </View>
                          {row.status === 'Pending' ? (
                            <View style={styles.reviewActions}>
                              <Pressable
                                style={styles.approveBtn}
                                onPress={() => handleReview(row.id, 'Approved')}
                                disabled={actingId === row.id}
                              >
                                <Text style={styles.approveText}>Approve</Text>
                              </Pressable>
                              <Pressable
                                style={styles.rejectBtn}
                                onPress={() => handleReview(row.id, 'Rejected')}
                                disabled={actingId === row.id}
                              >
                                <Text style={styles.rejectText}>Reject</Text>
                              </Pressable>
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                );
              })}
              {allSlots.length === 0 ? (
                <Text style={styles.emptyText}>No availability submitted for this week yet.</Text>
              ) : null}
            </View>
          ) : (
            <View>
              {days.map((day, i) => {
                const dayStr = dayStrs[i];
                const isToday = dayStr === todayStr;
                const isPast = dayStr < todayStr;
                return (
                  <View key={dayStr} style={[styles.dayCard, isToday && styles.dayCardToday]}>
                    <View style={styles.dayHeadRow}>
                      <Text style={styles.dayName}>
                        {day.toLocaleDateString([], { weekday: 'long' })}{' '}
                        <Text style={styles.dayDate}>{day.toLocaleDateString([], { day: 'numeric', month: 'long' })}</Text>
                      </Text>
                      {isToday ? <Tag label="TODAY" bg={colors.gold} fg={colors.header} /> : null}
                    </View>
                    <View style={styles.slotRow}>
                      {SLOTS.map(({ name, hours }) => {
                        const key = `${dayStr}_${name}`;
                        const existing = rowsByKey[key];
                        const selected = selectedKeys.has(key);
                        const approved = existing?.status === 'Approved';
                        const rejectedAndOff = existing?.status === 'Rejected' && !selected;
                        const locked = isPast || approved;
                        const dashed = isPast && !existing;
                        const caption = selected && existing ? existing.status : rejectedAndOff ? 'Rejected' : null;
                        return (
                          <Pressable
                            key={name}
                            disabled={locked}
                            onPress={() => toggleSlot(key)}
                            style={[styles.slot, selected && styles.slotOn, dashed && styles.slotDashed]}
                          >
                            <Text style={[styles.slotName, selected && styles.slotTextOn, dashed && styles.slotTextOff]}>
                              {name}
                            </Text>
                            <Text style={[styles.slotHours, selected && styles.slotTextOn, dashed && styles.slotTextOff]}>
                              {hours}
                            </Text>
                            {caption ? (
                              <Text style={[styles.slotCaption, rejectedAndOff && { color: colors.dangerSoft }]}>{caption}</Text>
                            ) : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              })}

              {submittedRows.length > 0 ? (
                <View>
                  <Text style={styles.sectionLabel}>Your submissions</Text>
                  <View style={styles.submissionCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.submissionTitle}>
                        Week {weekNumber} · {formatRange(weekStart)}
                      </Text>
                      <Text style={styles.submissionSub}>
                        {submittedRows.length} slot{submittedRows.length === 1 ? '' : 's'} submitted
                      </Text>
                    </View>
                    <Tag
                      label={submissionStatus}
                      bg={submissionStatus === 'CONFIRMED' ? '#dcecdd' : '#f3e1c2'}
                      fg={submissionStatus === 'CONFIRMED' ? '#1f6b3a' : '#8a5a12'}
                    />
                  </View>
                </View>
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>

      {!staff ? (
        <View style={[styles.bottomBar, { paddingBottom: 16 + insets.bottom }]}>
          <Text style={styles.bottomText}>
            {selectedKeys.size} slot{selectedKeys.size === 1 ? '' : 's'} selected for this week
          </Text>
          <PillButton label="Submit availability" loading={isSubmitting} onPress={handleSubmit} style={{ marginTop: 12 }} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  body: { paddingHorizontal: 20 },

  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 22 },
  navBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  weekRange: { color: '#fff', fontSize: 17, fontWeight: '800' },
  weekNum: { color: colors.fgMuted, fontSize: 12, marginTop: 2 },

  dayCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, marginBottom: 12, borderWidth: 1.5, borderColor: 'transparent' },
  dayCardToday: { borderColor: colors.gold },
  dayHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  dayName: { color: '#fff', fontSize: 17, fontWeight: '800' },
  dayDate: { color: colors.fgMuted, fontSize: 12, fontWeight: '500' },

  slotRow: { flexDirection: 'row', gap: 8 },
  slot: {
    flex: 1,
    minHeight: 62,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  slotOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  slotDashed: { borderStyle: 'dashed', backgroundColor: 'transparent' },
  slotName: { color: '#fff', fontSize: 13, fontWeight: '800' },
  slotHours: { color: colors.fgMuted, fontSize: 11, marginTop: 2 },
  slotTextOn: { color: colors.header },
  slotTextOff: { color: colors.fgFaint },
  slotCaption: { color: colors.header, fontSize: 9, fontWeight: '800', marginTop: 2 },

  sectionLabel: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 20, marginBottom: 12 },
  submissionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16 },
  submissionTitle: { color: '#fff', fontSize: 14, fontWeight: '800' },
  submissionSub: { color: colors.fgMuted, fontSize: 12, marginTop: 2 },

  reviewRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line },
  reviewName: { color: '#fff', fontSize: 15, fontWeight: '800' },
  reviewSlot: { color: colors.fgMuted, fontSize: 12, marginTop: 2 },
  reviewActions: { flexDirection: 'row', gap: 8 },
  approveBtn: { backgroundColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  approveText: { color: colors.header, fontSize: 12, fontWeight: '800' },
  rejectBtn: { borderWidth: 1.5, borderColor: colors.dangerSoft, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 7 },
  rejectText: { color: colors.dangerSoft, fontSize: 12, fontWeight: '800' },
  emptyText: { textAlign: 'center', color: colors.fgMuted, marginTop: 30, fontSize: 14 },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  bottomText: { textAlign: 'center', color: colors.fgMuted, fontSize: 13 },
});