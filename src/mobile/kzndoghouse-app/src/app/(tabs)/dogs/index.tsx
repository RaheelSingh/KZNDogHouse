import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { isStaff } from '@/lib/roles';
import { getStatusColor } from '@/lib/dogStatus';
import type { Dog } from '@/types/models';

const GREEN = '#16302a';
const GREEN_DARK = '#0f231e';

type FilterKey = 'All' | 'In Care' | 'Fostered' | 'Under Treatment';
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'All', label: 'All' },
  { key: 'In Care', label: 'In care' },
  { key: 'Fostered', label: 'Fostered' },
  { key: 'Under Treatment', label: 'Medical hold' },
];

export default function DogsScreen() {
  const { session } = useAuth();
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [medsDueIds, setMedsDueIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('All');

  const load = useCallback(async () => {
    const todayDateOnly = new Date().toISOString().slice(0, 10);

    const [dogsRes, medsRes] = await Promise.all([
      supabase
        .from('dogs')
        .select(
          'id, name, breed, date_of_birth, estimated_age_years, gender, size, weight_kg, eye_colour, temperament, about, kennel_location, intake_date, intake_type, status, is_vaccinated, photo_url, created_by, created_at, updated_at'
        )
        .neq('status', 'Adopted')
        .order('created_at', { ascending: false }),
      supabase
        .from('dog_medical_records')
        .select('dog_id')
        .eq('status', 'Active')
        .lte('next_action_date', todayDateOnly),
    ]);

    setDogs((dogsRes.data as Dog[]) ?? []);
    setMedsDueIds(new Set(((medsRes.data as { dog_id: string }[]) ?? []).map((r) => r.dog_id)));
  }, []);

  useEffect(() => {
    setIsLoading(true);
    load()
      .catch((err) => console.warn('[dogs] failed to load:', err))
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

  const filtered = useMemo(() => {
    return dogs.filter((dog) => {
      if (filter !== 'All' && dog.status !== filter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const haystack = `${dog.name} ${dog.breed ?? ''} ${dog.kennel_location ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [dogs, filter, search]);

  const isNewIntake = (dog: Dog) => {
    const days = (Date.now() - new Date(dog.intake_date).getTime()) / (1000 * 60 * 60 * 24);
    return days <= 7;
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={GREEN} size="large" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.flex}
      contentContainerStyle={styles.listContent}
      data={filtered}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperStyle={styles.row}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View>
          <Text style={styles.title}>{dogs.length} dogs in our care</Text>
          <TextInput
            style={styles.search}
            placeholder="Search by name, breed, kennel..."
            placeholderTextColor="#8a9a8f"
            value={search}
            onChangeText={setSearch}
          />
          <View style={styles.filterRow}>
            {FILTERS.map((f) => (
              <Pressable
                key={f.key}
                style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
                onPress={() => setFilter(f.key)}
              >
                <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.resultCount}>
            Showing {filtered.length} of {dogs.length}
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable style={styles.card} onPress={() => router.push(`/(tabs)/dogs/${item.id}`)}>
          <View style={[styles.avatar, { backgroundColor: GREEN }]}>
            <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
          </View>
          {medsDueIds.has(item.id) ? (
            <View style={[styles.badge, { backgroundColor: '#f4d3cf' }]}>
              <Text style={[styles.badgeText, { color: '#b3261e' }]}>MEDS DUE</Text>
            </View>
          ) : isNewIntake(item) ? (
            <View style={[styles.badge, { backgroundColor: '#f3e1c2' }]}>
              <Text style={[styles.badgeText, { color: '#8a5a12' }]}>NEW INTAKE</Text>
            </View>
          ) : item.status !== 'Available' && item.status !== 'In Care' ? (
            <View style={[styles.badge, { backgroundColor: getStatusColor(item.status).bg }]}>
              <Text style={[styles.badgeText, { color: getStatusColor(item.status).text }]}>
                {item.status.toUpperCase()}
              </Text>
            </View>
          ) : null}
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={styles.cardSubtitle}>
            {[item.breed, item.estimated_age_years ? `${item.estimated_age_years} yrs` : null]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </Pressable>
      )}
      ListEmptyComponent={<Text style={styles.emptyText}>No dogs match your search or filter yet.</Text>}
      ListFooterComponent={
        isStaff(session?.role) ? (
          <Pressable style={styles.addButton} onPress={() => router.push('/(tabs)/dogs/add')}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addButtonText}>Add a dog</Text>
          </Pressable>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  listContent: { padding: 16, paddingTop: 56, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: GREEN, marginBottom: 12 },
  search: {
    borderWidth: 1,
    borderColor: '#d9e0d9',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: GREEN,
    marginBottom: 12,
  },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  filterChip: { borderWidth: 1, borderColor: '#d9e0d9', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  filterChipActive: { backgroundColor: GREEN, borderColor: GREEN },
  filterText: { color: GREEN, fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  resultCount: { fontSize: 12, color: '#6b7a70', marginBottom: 12 },

  row: { justifyContent: 'space-between' },
  card: { width: '48%', backgroundColor: GREEN_DARK, borderRadius: 16, padding: 14, marginBottom: 14 },
  avatar: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  badge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8 },
  badgeText: { fontSize: 9, fontWeight: '700' },
  cardName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cardSubtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 },

  emptyText: { textAlign: 'center', color: '#6b7a70', marginTop: 40, fontSize: 13 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 10,
  },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});