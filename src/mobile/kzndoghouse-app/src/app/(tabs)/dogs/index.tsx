import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { isStaff } from '@/lib/roles';
import { getStatusColor } from '@/lib/dogStatus';
import { colors, radius } from '@/theme';
import { IconBtn, ImageCard, PageHeader, SectionTitle, Tag, UnderlineTabs } from '@/components/ui';
import type { Dog } from '@/types/models';

type FilterKey = 'All' | 'In Care' | 'Fostered' | 'Under Treatment';
type SortKey = 'recent' | 'name';

const TABS: { key: FilterKey; label: string }[] = [
  { key: 'All', label: 'All' },
  { key: 'In Care', label: 'In care' },
  { key: 'Fostered', label: 'Fostered' },
  { key: 'Under Treatment', label: 'Medical hold' },
];

const DAY_MS = 86_400_000;

export default function DogsScreen() {
  const { session } = useAuth();
  const staff = isStaff(session?.role);

  const [dogs, setDogs] = useState<Dog[]>([]);
  const [medsDueIds, setMedsDueIds] = useState<Set<string>>(new Set());
  const [nowMs, setNowMs] = useState(0); // captured when data loads, so render stays pure
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('All');
  const [sort, setSort] = useState<SortKey>('recent');

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

    if (dogsRes.error) throw dogsRes.error;

    setNowMs(Date.now());
    setDogs((dogsRes.data as Dog[]) ?? []);
    setMedsDueIds(new Set(((medsRes.data as { dog_id: string }[] | null) ?? []).map((r) => r.dog_id)));
  }, []);

  // Reload whenever the tab comes into view (e.g. after adding a dog).
  useFocusEffect(
    useCallback(() => {
      load()
        .catch((err) => console.warn('[dogs] failed to load:', err))
        .finally(() => setIsLoading(false));
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await load();
    } catch (err) {
      console.warn('[dogs] refresh failed:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [load]);

  const filtered = useMemo(() => {
    const list = dogs.filter((dog) => {
      if (filter !== 'All' && dog.status !== filter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const haystack = `${dog.name} ${dog.breed ?? ''} ${dog.kennel_location ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    return sort === 'name' ? [...list].sort((a, b) => a.name.localeCompare(b.name)) : list;
  }, [dogs, filter, search, sort]);

  const attention = useMemo(
    () => (filter === 'All' && !search.trim() ? dogs.filter((d) => medsDueIds.has(d.id)) : []),
    [dogs, medsDueIds, filter, search]
  );

  const isNewIntake = (dog: Dog) =>
    nowMs > 0 && (nowMs - new Date(dog.intake_date).getTime()) / DAY_MS <= 7;

  const tagFor = (dog: Dog): { label: string; bg: string; fg: string } | null => {
    if (medsDueIds.has(dog.id)) return { label: 'MEDS DUE', bg: '#f4d3cf', fg: '#b3261e' };
    if (isNewIntake(dog)) return { label: 'NEW INTAKE', bg: '#f3e1c2', fg: '#8a5a12' };
    if (dog.status !== 'Available' && dog.status !== 'In Care') {
      const c = getStatusColor(dog.status);
      return { label: dog.status === 'Under Treatment' ? 'MED HOLD' : dog.status.toUpperCase(), bg: c.bg, fg: c.text };
    }
    return null;
  };

  const meta = (dog: Dog) =>
    [dog.breed, dog.estimated_age_years ? `${dog.estimated_age_years} yrs` : null].filter(Boolean).join(' · ');

  return (
    <View style={styles.root}>
      <PageHeader
        title="Our dogs"
        subtitle={`${dogs.length} dogs in our care`}
        right={
          <>
            <IconBtn icon="swap-vertical" onPress={() => setSort((x) => (x === 'recent' ? 'name' : 'recent'))} />
            {staff ? (
              <IconBtn icon="add-circle-outline" color={colors.gold} onPress={() => router.push('/(tabs)/dogs/add')} />
            ) : null}
          </>
        }
      >
        <UnderlineTabs tabs={TABS} active={filter} onChange={setFilter} />
      </PageHeader>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columns}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#fff" />}
          ListHeaderComponent={
            <View>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color={colors.fgFaint} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by name, breed, kennel..."
                  placeholderTextColor={colors.fgFaint}
                  value={search}
                  onChangeText={setSearch}
                  accessibilityLabel="Search dogs"
                />
              </View>

              {attention.length > 0 ? (
                <View>
                  <SectionTitle title="Needs attention" />
                  <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={attention}
                    keyExtractor={(d) => `att-${d.id}`}
                    contentContainerStyle={{ gap: 12 }}
                    renderItem={({ item }) => (
                      <ImageCard
                        style={{ width: 230, height: 250 }}
                        uri={item.photo_url}
                        letter={item.name.charAt(0).toUpperCase()}
                        eyebrow="Meds due"
                        actionLabel="View"
                        title={item.name}
                        meta={meta(item)}
                        onPress={() => router.push(`/(tabs)/dogs/${item.id}`)}
                      />
                    )}
                  />
                </View>
              ) : null}

              <SectionTitle title={filter === 'All' ? 'All dogs' : (TABS.find((t) => t.key === filter)?.label ?? 'Dogs')} />
            </View>
          }
          ListEmptyComponent={<Text style={styles.emptyText}>No dogs match your search or filter yet.</Text>}
          renderItem={({ item }) => {
            const tag = tagFor(item);
            return (
              <ImageCard
                style={styles.gridCard}
                uri={item.photo_url}
                letter={item.name.charAt(0).toUpperCase()}
                badge={tag ? <Tag label={tag.label} bg={tag.bg} fg={tag.fg} /> : undefined}
                title={item.name}
                meta={meta(item)}
                onPress={() => router.push(`/(tabs)/dogs/${item.id}`)}
              />
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
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  columns: { justifyContent: 'space-between' },
  gridCard: { width: '48.5%', height: 200, marginBottom: 14 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    marginTop: 18,
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 14, paddingVertical: 13 },
  emptyText: { textAlign: 'center', color: colors.fgMuted, marginTop: 40, fontSize: 14 },
});