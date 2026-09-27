import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { getCurrentProfileId } from '@/lib/profile';
import { isStaff } from '@/lib/roles';
import type { AvailabilitySlot, AvailabilitySlotName } from '@/types/models';

const GREEN = '#16302a';
const GOLD = '#c98a2c';

const SLOTS: AvailabilitySlotName[] = ['Morning', 'Afternoon', 'Evening'];

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

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString([], { weekday: 'short', day: 'numeric' });
}

function formatWeekLabel(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  const startLabel = weekStart.toLocaleDateString([], { day: 'numeric', month: sameMonth ? undefined : 'short' });
  const endLabel = weekEnd.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  return `${startLabel} – ${endLabel}`;
}

function statusColor(status: string) {
  if (status === 'Approved') return { color: '#1f6b3a' };
  if (status === 'Rejected') return { color: '#b3261e' };
  return { color: '#8a5a12' };
}

export default function AvailabilityScreen() {
  const { session } = useAuth();
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

  const weekStart = useMemo(() => addDays(getMonday(new Date()), weekOffset * 7), [weekOffset]);
  const weekStartStr = useMemo(() => toDateOnlyString(weekStart), [weekStart]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const dayStrs = useMemo(() => days.map(toDateOnlyString), [days]);

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
    const existingRow = rowsByKey[key];
    if (existingRow?.status === 'Approved') return; // locked once approved
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
      const ops: Promise<any>[] = [];

      dayStrs.forEach((dayStr) => {
        SLOTS.forEach((slot) => {
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
      <View style={styles.weekNav}>
        <Pressable style={styles.weekNavBtn} onPress={() => setWeekOffset((w) => w - 1)}>
          <Text style={styles.weekNavText}>{'‹'}</Text>
        </Pressable>
        <Text style={styles.weekLabel}>{formatWeekLabel(weekStart)}</Text>
        <Pressable style={styles.weekNavBtn} onPress={() => setWeekOffset((w) => w + 1)}>
          <Text style={styles.weekNavText}>{'›'}</Text>
        </Pressable>
      </View>

      {staff ? (
        <View>
          <Text style={styles.sectionTitle}>Volunteer availability</Text>
          <Text style={styles.helperText}>Review and approve submissions for this week.</Text>

          {days.map((day, dayIndex) => {
            const dayStr = dayStrs[dayIndex];
            const dayRows = allSlots.filter((row) => row.day_date === dayStr);
            if (dayRows.length === 0) return null;
            return (
              <View key={dayStr} style={styles.dayGroup}>
                <Text style={styles.dayHeading}>{formatDayLabel(day)}</Text>
                {dayRows.map((row) => (
                  <View key={row.id} style={styles.reviewRow}>
                    <View style={styles.reviewInfo}>
                      <Text style={styles.reviewName}>
                        {volunteerNames[row.volunteer_id] ?? 'Volunteer'} · {row.slot}
                      </Text>
                      <Text style={[styles.reviewStatus, statusColor(row.status)]}>{row.status}</Text>
                    </View>
                    {row.status === 'Pending' ? (
                      <View style={styles.reviewActions}>
                        <Pressable
                          style={styles.approveBtn}
                          onPress={() => handleReview(row.id, 'Approved')}
                          disabled={actingId === row.id}
                        >
                          <Text style={styles.approveBtnText}>Approve</Text>
                        </Pressable>
                        <Pressable
                          style={styles.rejectBtn}
                          onPress={() => handleReview(row.id, 'Rejected')}
                          disabled={actingId === row.id}
                        >
                          <Text style={styles.rejectBtnText}>Reject</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            );
          })}

          {allSlots.length === 0 ? (
            <Text style={styles.emptyText}>No availability submitted for this week yet.</Text>
          ) : null}
        </View>
      ) : (
        <View>
          <Text style={styles.sectionTitle}>Your availability</Text>
          <Text style={styles.helperText}>
            Tap the times you're free this week, then submit. Approved slots are locked in.
          </Text>

          {days.map((day, dayIndex) => {
            const dayStr = dayStrs[dayIndex];
            return (
              <View key={dayStr} style={styles.dayRow}>
                <Text style={styles.dayRowLabel}>{formatDayLabel(day)}</Text>
                <View style={styles.slotChipsRow}>
                  {SLOTS.map((slot) => {
                    const key = `${dayStr}_${slot}`;
                    const existingRow = rowsByKey[key];
                    const isSelected = selectedKeys.has(key);
                    const isApproved = existingRow?.status === 'Approved';
                    const isRejectedAndUnselected = existingRow?.status === 'Rejected' && !isSelected;

                    return (
                      <Pressable
                        key={slot}
                        onPress={() => toggleSlot(key)}
                        style={[
                          styles.slotChip,
                          isSelected && styles.slotChipSelected,
                          isApproved && styles.slotChipApproved,
                        ]}
                      >
                        <Text
                          style={[
                            styles.slotChipText,
                            (isSelected || isApproved) && styles.slotChipTextSelected,
                          ]}
                        >
                          {slot}
                        </Text>
                        {isApproved ? <Text style={styles.slotChipTag}>Approved</Text> : null}
                        {isRejectedAndUnselected ? <Text style={styles.slotChipTagRejected}>Rejected</Text> : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}

          <Pressable
            style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit availability</Text>}
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  container: { padding: 20, paddingBottom: 60 },
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  weekNavBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#eef2ee', alignItems: 'center', justifyContent: 'center' },
  weekNavText: { fontSize: 18, color: GREEN, fontWeight: '700' },
  weekLabel: { fontSize: 15, fontWeight: '700', color: GREEN },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: GREEN, marginBottom: 4 },
  helperText: { fontSize: 12, color: '#6b7a70', marginBottom: 16 },
  dayRow: { marginBottom: 16 },
  dayRowLabel: { fontSize: 13, fontWeight: '600', color: GREEN, marginBottom: 8 },
  slotChipsRow: { flexDirection: 'row', gap: 8 },
  slotChip: { flex: 1, borderWidth: 1, borderColor: '#d9e0d9', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  slotChipSelected: { backgroundColor: GREEN, borderColor: GREEN },
  slotChipApproved: { backgroundColor: '#1f6b3a', borderColor: '#1f6b3a' },
  slotChipText: { fontSize: 12, fontWeight: '600', color: GREEN },
  slotChipTextSelected: { color: '#fff' },
  slotChipTag: { fontSize: 9, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  slotChipTagRejected: { fontSize: 9, color: '#b3261e', marginTop: 2 },
  submitBtn: { backgroundColor: GOLD, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  dayGroup: { marginBottom: 20 },
  dayHeading: { fontSize: 13, fontWeight: '700', color: '#6b7a70', marginBottom: 8, textTransform: 'uppercase' },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f0f2f0', paddingVertical: 10 },
  reviewInfo: { flex: 1 },
  reviewName: { fontSize: 13, fontWeight: '600', color: GREEN },
  reviewStatus: { fontSize: 11, marginTop: 2, fontWeight: '600' },
  reviewActions: { flexDirection: 'row', gap: 8 },
  approveBtn: { backgroundColor: '#1f6b3a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  approveBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  rejectBtn: { borderWidth: 1, borderColor: '#b3261e', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  rejectBtnText: { color: '#b3261e', fontSize: 11, fontWeight: '700' },
  emptyText: { fontSize: 13, color: '#8a9a8f', marginTop: 12, textAlign: 'center' },
});