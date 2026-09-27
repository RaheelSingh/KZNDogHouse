import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { getCurrentProfileId } from '@/lib/profile';
import { isStaff } from '@/lib/roles';
import { getStatusColor } from '@/lib/dogStatus';
import type { Dog, DogMedicalRecord, DogNote, FosteringRecord, DogStatus, MedicalRecordType } from '@/types/models';

const GREEN = '#16302a';
const GREEN_DARK = '#0f231e';

const STATUS_OPTIONS: DogStatus[] = ['Available', 'In Care', 'Under Treatment', 'Fostered', 'Reserved', 'Adopted'];
const RECORD_TYPES: MedicalRecordType[] = ['Vaccination', 'Condition', 'Medication', 'Treatment note'];

type Tab = 'About' | 'Medical' | 'Fostering';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function DogDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const staff = isStaff(session?.role);

  const [dog, setDog] = useState<Dog | null>(null);
  const [medicalRecords, setMedicalRecords] = useState<DogMedicalRecord[]>([]);
  const [fosteringRecords, setFosteringRecords] = useState<FosteringRecord[]>([]);
  const [notes, setNotes] = useState<DogNote[]>([]);
  const [tab, setTab] = useState<Tab>('About');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [noteText, setNoteText] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editStatus, setEditStatus] = useState<DogStatus>('Available');
  const [editWeight, setEditWeight] = useState('');
  const [editTemperament, setEditTemperament] = useState('');
  const [editAbout, setEditAbout] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [showRecordForm, setShowRecordForm] = useState(false);
  const [recordType, setRecordType] = useState<MedicalRecordType>('Treatment note');
  const [recordTitle, setRecordTitle] = useState('');
  const [recordDetails, setRecordDetails] = useState('');
  const [recordNextAction, setRecordNextAction] = useState('');
  const [isSavingRecord, setIsSavingRecord] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [dogRes, medsRes, fosterRes, notesRes] = await Promise.all([
      supabase.from('dogs').select('*').eq('id', id).single(),
      supabase.from('dog_medical_records').select('*').eq('dog_id', id).order('created_at', { ascending: false }),
      supabase.from('fostering_records').select('*').eq('dog_id', id).order('start_date', { ascending: false }),
      supabase.from('dog_notes').select('*').eq('dog_id', id).order('created_at', { ascending: false }),
    ]);

    const dogData = dogRes.data as Dog | null;
    setDog(dogData);
    setMedicalRecords((medsRes.data as DogMedicalRecord[]) ?? []);
    setFosteringRecords((fosterRes.data as FosteringRecord[]) ?? []);
    setNotes((notesRes.data as DogNote[]) ?? []);

    if (dogData) {
      setEditStatus(dogData.status);
      setEditWeight(dogData.weight_kg != null ? String(dogData.weight_kg) : '');
      setEditTemperament(dogData.temperament ?? '');
      setEditAbout(dogData.about ?? '');
    }
  }, [id]);

  useEffect(() => {
    setIsLoading(true);
    load()
      .catch((err) => console.warn('[dog-detail] failed to load:', err))
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

  const handleSaveEdit = async () => {
    if (!dog) return;
    setIsSavingEdit(true);
    try {
      const { error } = await supabase
        .from('dogs')
        .update({
          status: editStatus,
          weight_kg: editWeight ? Number(editWeight) : null,
          temperament: editTemperament.trim() || null,
          about: editAbout.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', dog.id);
      if (error) throw error;
      setIsEditing(false);
      await load();
    } catch (err) {
      console.warn('[dog-detail] update failed:', err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleAddNote = async () => {
    if (!dog || !noteText.trim()) return;
    setIsSavingNote(true);
    try {
      const profileId = await getCurrentProfileId();
      const { error } = await supabase.from('dog_notes').insert({ dog_id: dog.id, author_id: profileId, note: noteText.trim() });
      if (error) throw error;
      setNoteText('');
      await load();
    } catch (err) {
      console.warn('[dog-detail] add note failed:', err);
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleAddRecord = async () => {
    if (!dog || !recordTitle.trim()) return;
    setIsSavingRecord(true);
    try {
      const profileId = await getCurrentProfileId();
      const { error } = await supabase.from('dog_medical_records').insert({
        dog_id: dog.id,
        record_type: recordType,
        title: recordTitle.trim(),
        details: recordDetails.trim() || null,
        next_action_date: recordNextAction.trim() || null,
        created_by: profileId,
      });
      if (error) throw error;
      setRecordTitle('');
      setRecordDetails('');
      setRecordNextAction('');
      setShowRecordForm(false);
      await load();
    } catch (err) {
      console.warn('[dog-detail] add medical record failed:', err);
    } finally {
      setIsSavingRecord(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={GREEN} size="large" />
      </View>
    );
  }

  if (!dog) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.emptyText}>This dog could not be found.</Text>
      </View>
    );
  }

  const statusColor = getStatusColor(dog.status);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
    >
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>{'←'}</Text>
      </Pressable>

      <Text style={styles.name}>{dog.name}</Text>
      <Text style={styles.subtitle}>
        {[dog.breed, dog.estimated_age_years ? `${dog.estimated_age_years} years` : null, dog.gender].filter(Boolean).join(' · ')}
      </Text>

      <View style={styles.badgeRow}>
        <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
          <Text style={[styles.statusBadgeText, { color: statusColor.text }]}>{dog.status}</Text>
        </View>
      </View>

      <View style={styles.idCard}>
        <Text style={styles.idLabel}>KENNEL</Text>
        <Text style={styles.idValue}>{dog.kennel_location ?? 'Not assigned'}</Text>
        <View style={styles.idRow}>
          <View>
            <Text style={styles.idLabel}>INTAKE DATE</Text>
            <Text style={styles.idValue}>{formatDate(dog.intake_date)}</Text>
          </View>
          <View>
            <Text style={styles.idLabel}>INTAKE TYPE</Text>
            <Text style={styles.idValue}>{dog.intake_type ?? '—'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.factsRow}>
        <View style={styles.factTile}>
          <Text style={styles.factValue}>{dog.weight_kg ?? '—'}{dog.weight_kg ? 'kg' : ''}</Text>
          <Text style={styles.factLabel}>Weight</Text>
        </View>
        <View style={styles.factTile}>
          <Text style={styles.factValue}>{dog.temperament ?? '—'}</Text>
          <Text style={styles.factLabel}>Temperament</Text>
        </View>
        <View style={styles.factTile}>
          <Text style={styles.factValue}>{dog.is_vaccinated ? '✓' : '—'}</Text>
          <Text style={styles.factLabel}>Vaccinated</Text>
        </View>
      </View>

      <View style={styles.tabRow}>
        {(['About', 'Medical', 'Fostering'] as Tab[]).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={styles.tabBtn}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
            {tab === t ? <View style={styles.tabUnderline} /> : null}
          </Pressable>
        ))}
      </View>

      {tab === 'About' ? (
        <View>
          {isEditing ? (
            <View style={styles.editCard}>
              <Text style={styles.label}>Status</Text>
              <View style={styles.chipsWrap}>
                {STATUS_OPTIONS.map((s) => (
                  <Pressable key={s} onPress={() => setEditStatus(s)} style={[styles.chip, editStatus === s && styles.chipSelected]}>
                    <Text style={[styles.chipText, editStatus === s && styles.chipTextSelected]}>{s}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.label}>Weight (kg)</Text>
              <TextInput style={styles.input} value={editWeight} onChangeText={setEditWeight} keyboardType="numeric" />
              <Text style={styles.label}>Temperament</Text>
              <TextInput style={styles.input} value={editTemperament} onChangeText={setEditTemperament} />
              <Text style={styles.label}>About</Text>
              <TextInput style={[styles.input, styles.textArea]} value={editAbout} onChangeText={setEditAbout} multiline numberOfLines={4} />
              <View style={styles.editButtonsRow}>
                <Pressable style={styles.cancelBtn} onPress={() => setIsEditing(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.saveBtn} onPress={handleSaveEdit} disabled={isSavingEdit}>
                  {isSavingEdit ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save</Text>}
                </Pressable>
              </View>
            </View>
          ) : (
            <View>
              <Text style={styles.sectionTitle}>About {dog.name}</Text>
              <Text style={styles.bodyText}>{dog.about || 'No background notes yet.'}</Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>Notes</Text>
          {notes.length === 0 ? (
            <Text style={styles.emptyText}>No notes logged yet.</Text>
          ) : (
            notes.map((note) => (
              <View key={note.id} style={styles.noteRow}>
                <Text style={styles.noteText}>{note.note}</Text>
                <Text style={styles.noteDate}>{formatDate(note.created_at)}</Text>
              </View>
            ))
          )}
          {staff ? (
            <View style={styles.noteComposer}>
              <TextInput
                style={styles.input}
                placeholder="Log a note about this dog..."
                placeholderTextColor="#8a9a8f"
                value={noteText}
                onChangeText={setNoteText}
                multiline
              />
              <Pressable style={styles.smallSaveBtn} onPress={handleAddNote} disabled={isSavingNote}>
                {isSavingNote ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.smallSaveText}>Log a note</Text>}
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      {tab === 'Medical' ? (
        <View>
          {medicalRecords.length === 0 ? (
            <Text style={styles.emptyText}>No medical records yet.</Text>
          ) : (
            medicalRecords.map((record) => (
              <View key={record.id} style={styles.recordRow}>
                <View style={styles.recordHeaderRow}>
                  <Text style={styles.recordTitle}>{record.title}</Text>
                  <View style={[styles.recordStatusBadge, { backgroundColor: record.status === 'Active' ? '#f4d3cf' : '#dcecdd' }]}>
                    <Text style={[styles.recordStatusText, { color: record.status === 'Active' ? '#b3261e' : '#1f6b3a' }]}>
                      {record.status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.recordMeta}>{record.record_type}</Text>
                {record.details ? <Text style={styles.bodyText}>{record.details}</Text> : null}
                {record.next_action_date ? <Text style={styles.recordMeta}>Next action: {formatDate(record.next_action_date)}</Text> : null}
              </View>
            ))
          )}

          {staff ? (
            showRecordForm ? (
              <View style={styles.editCard}>
                <Text style={styles.label}>Type</Text>
                <View style={styles.chipsWrap}>
                  {RECORD_TYPES.map((t) => (
                    <Pressable key={t} onPress={() => setRecordType(t)} style={[styles.chip, recordType === t && styles.chipSelected]}>
                      <Text style={[styles.chipText, recordType === t && styles.chipTextSelected]}>{t}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.label}>Title</Text>
                <TextInput style={styles.input} value={recordTitle} onChangeText={setRecordTitle} placeholder="Ear infection treatment" placeholderTextColor="#8a9a8f" />
                <Text style={styles.label}>Details</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={recordDetails}
                  onChangeText={setRecordDetails}
                  multiline
                  numberOfLines={3}
                  placeholder="Dosage, vet name, anything relevant"
                  placeholderTextColor="#8a9a8f"
                />
                <Text style={styles.label}>Next action date (optional, YYYY-MM-DD)</Text>
                <TextInput style={styles.input} value={recordNextAction} onChangeText={setRecordNextAction} placeholder="2026-08-05" placeholderTextColor="#8a9a8f" />
                <View style={styles.editButtonsRow}>
                  <Pressable style={styles.cancelBtn} onPress={() => setShowRecordForm(false)}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable style={styles.saveBtn} onPress={handleAddRecord} disabled={isSavingRecord}>
                    {isSavingRecord ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save record</Text>}
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable style={styles.addLinkBtn} onPress={() => setShowRecordForm(true)}>
                <Text style={styles.addLinkText}>+ Add medical record</Text>
              </Pressable>
            )
          ) : null}
        </View>
      ) : null}

      {tab === 'Fostering' ? (
        <View>
          {fosteringRecords.length === 0 ? (
            <Text style={styles.emptyText}>No fostering history yet.</Text>
          ) : (
            fosteringRecords.map((record) => (
              <View key={record.id} style={styles.recordRow}>
                <Text style={styles.recordTitle}>{record.foster_name ?? 'Foster carer'}</Text>
                <Text style={styles.recordMeta}>
                  {formatDate(record.start_date)} — {record.end_date ? formatDate(record.end_date) : 'ongoing'}
                </Text>
                {record.feedback ? <Text style={styles.bodyText}>{record.feedback}</Text> : null}
              </View>
            ))
          )}
        </View>
      ) : null}

      {staff && !isEditing ? (
        <Pressable style={styles.updateBtn} onPress={() => setIsEditing(true)}>
          <Text style={styles.updateBtnText}>Update record</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  container: { padding: 20, paddingTop: 56, paddingBottom: 60 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#eef2ee', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  backText: { color: GREEN, fontSize: 18 },
  name: { fontSize: 26, fontWeight: '700', color: GREEN },
  subtitle: { fontSize: 13, color: '#6b7a70', marginTop: 4 },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },

  idCard: { backgroundColor: GREEN_DARK, borderRadius: 16, padding: 16, marginTop: 16 },
  idLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  idValue: { color: '#fff', fontSize: 15, fontWeight: '600', marginTop: 2 },
  idRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },

  factsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  factTile: { flex: 1, backgroundColor: '#f3f6f3', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  factValue: { fontSize: 14, fontWeight: '700', color: GREEN },
  factLabel: { fontSize: 10, color: '#6b7a70', marginTop: 2 },

  tabRow: { flexDirection: 'row', gap: 20, marginTop: 22, borderBottomWidth: 1, borderBottomColor: '#eef2ee' },
  tabBtn: { paddingBottom: 10 },
  tabText: { fontSize: 13, color: '#6b7a70', fontWeight: '600' },
  tabTextActive: { color: GREEN },
  tabUnderline: { height: 2, backgroundColor: GREEN, marginTop: 8, borderRadius: 1 },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: GREEN, marginTop: 20, marginBottom: 8 },
  bodyText: { fontSize: 13, color: '#3d4a41', lineHeight: 19 },
  emptyText: { fontSize: 13, color: '#8a9a8f', marginTop: 4 },

  noteRow: { borderBottomWidth: 1, borderBottomColor: '#f0f2f0', paddingVertical: 10 },
  noteText: { fontSize: 13, color: '#3d4a41' },
  noteDate: { fontSize: 10, color: '#8a9a8f', marginTop: 4 },
  noteComposer: { marginTop: 14 },
  smallSaveBtn: { backgroundColor: GREEN, borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 8 },
  smallSaveText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  recordRow: { borderBottomWidth: 1, borderBottomColor: '#f0f2f0', paddingVertical: 12 },
  recordHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recordTitle: { fontSize: 14, fontWeight: '700', color: GREEN },
  recordMeta: { fontSize: 11, color: '#8a9a8f', marginTop: 2 },
  recordStatusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  recordStatusText: { fontSize: 10, fontWeight: '700' },

  addLinkBtn: { marginTop: 14, alignItems: 'center' },
  addLinkText: { color: GREEN, fontWeight: '700', fontSize: 13 },

  editCard: { backgroundColor: '#f8faf8', borderRadius: 14, padding: 16, marginTop: 12 },
  label: { fontSize: 12, fontWeight: '600', color: GREEN, marginBottom: 6, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#d9e0d9', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: GREEN, backgroundColor: '#fff' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#d9e0d9', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  chipSelected: { backgroundColor: GREEN, borderColor: GREEN },
  chipText: { color: GREEN, fontSize: 12 },
  chipTextSelected: { color: '#fff' },
  editButtonsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: '#d9e0d9', paddingVertical: 11, alignItems: 'center' },
  cancelText: { color: GREEN, fontWeight: '600', fontSize: 13 },
  saveBtn: { flex: 1, borderRadius: 10, backgroundColor: GREEN, paddingVertical: 11, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  updateBtn: { marginTop: 28, borderRadius: 12, backgroundColor: GREEN, paddingVertical: 14, alignItems: 'center' },
  updateBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});