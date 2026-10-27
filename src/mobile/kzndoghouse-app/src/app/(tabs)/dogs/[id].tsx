import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { getCurrentProfileId } from '@/lib/profile';
import { isStaff } from '@/lib/roles';
import { getStatusColor } from '@/lib/dogStatus';
import {
  deleteDogImage,
  fetchDogImages,
  promptForImage,
  setPrimaryDogImage,
  uploadDogImage,
} from '@/lib/storage';
import { colors, radius } from '@/theme';
import { HeroHeader, IconBtn, PillButton, SectionTitle, Tag, UnderlineTabs } from '@/components/ui';
import { ChipGroup, Field, FieldLabel } from '@/components/form';
import type {
  Dog,
  DogImage,
  DogMedicalRecord,
  DogNote,
  DogStatus,
  FosteringRecord,
  MedicalRecordType,
} from '@/types/models';

const STATUS_OPTIONS: readonly DogStatus[] = ['Available', 'In Care', 'Under Treatment', 'Fostered', 'Reserved', 'Adopted'];
const RECORD_TYPES: readonly MedicalRecordType[] = ['Vaccination', 'Condition', 'Medication', 'Treatment note'];

type Tab = 'About' | 'Medical' | 'Fostering';
const TABS: { key: Tab; label: string }[] = [
  { key: 'About', label: 'About' },
  { key: 'Medical', label: 'Medical' },
  { key: 'Fostering', label: 'Fostering' },
];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

function MedicalCard({ record }: { record: DogMedicalRecord }) {
  const active = record.status === 'Active';
  const sub = [record.record_type, record.details, record.next_action_date ? `Next: ${formatDate(record.next_action_date)}` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: active ? colors.dangerSoft : colors.gold }]}>
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle}>{record.title}</Text>
        <Tag label={record.status.toUpperCase()} bg={active ? '#f4d3cf' : '#dcecdd'} fg={active ? '#b3261e' : '#1f6b3a'} />
      </View>
      <Text style={styles.cardSub}>{sub}</Text>
    </View>
  );
}

function FosterCard({ record }: { record: FosteringRecord }) {
  const name = record.foster_name ?? 'Foster carer';
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <View style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials || '?'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{name}</Text>
        <Text style={styles.cardSub}>
          {formatDate(record.start_date)} — {record.end_date ? formatDate(record.end_date) : 'ongoing'}
          {record.feedback ? ` · ${record.feedback}` : ''}
        </Text>
      </View>
    </View>
  );
}

export default function DogDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const staff = isStaff(session?.role);

  const [dog, setDog] = useState<Dog | null>(null);
  const [medicalRecords, setMedicalRecords] = useState<DogMedicalRecord[]>([]);
  const [fosteringRecords, setFosteringRecords] = useState<FosteringRecord[]>([]);
  const [notes, setNotes] = useState<DogNote[]>([]);
  const [images, setImages] = useState<DogImage[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [tab, setTab] = useState<Tab>('About');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [showNoteForm, setShowNoteForm] = useState(false);
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
    const [dogRes, medsRes, fosterRes, notesRes, imagesList] = await Promise.all([
      supabase.from('dogs').select('*').eq('id', id).single(),
      supabase.from('dog_medical_records').select('*').eq('dog_id', id).order('created_at', { ascending: false }),
      supabase.from('fostering_records').select('*').eq('dog_id', id).order('start_date', { ascending: false }),
      supabase.from('dog_notes').select('*').eq('dog_id', id).order('created_at', { ascending: false }),
      fetchDogImages(id).catch((err) => {
        console.warn('[dog-detail] could not load photos:', err);
        return [] as DogImage[];
      }),
    ]);

    const dogData = dogRes.data as Dog | null;
    setDog(dogData);
    setMedicalRecords((medsRes.data as DogMedicalRecord[]) ?? []);
    setFosteringRecords((fosterRes.data as FosteringRecord[]) ?? []);
    setNotes((notesRes.data as DogNote[]) ?? []);
    setImages(imagesList);

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

  const handleAddPhoto = async (asMain: boolean) => {
    if (!dog || isUploadingPhoto) return;
    const picked = await promptForImage();
    if (!picked) return;

    setIsUploadingPhoto(true);
    try {
      await uploadDogImage(dog.id, picked, { makePrimary: asMain, altText: `Photo of ${dog.name}` });
      await load();
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Could not upload the photo. Please try again.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handlePhotoPress = (image: DogImage) => {
    if (!staff || !dog) return;
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];

    if (!image.is_primary) {
      buttons.push({
        text: 'Make main photo',
        onPress: async () => {
          try {
            await setPrimaryDogImage(dog.id, image);
            await load();
          } catch (err: any) {
            Alert.alert('Could not update', err?.message ?? 'Please try again.');
          }
        },
      });
    }

    buttons.push({
      text: 'Delete photo',
      style: 'destructive',
      onPress: async () => {
        try {
          await deleteDogImage(dog.id, image);
          await load();
        } catch (err: any) {
          Alert.alert('Could not delete', err?.message ?? 'Please try again.');
        }
      },
    });
    buttons.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert('Photo options', undefined, buttons);
  };

  const handleAddNote = async () => {
    if (!dog || !noteText.trim()) return;
    setIsSavingNote(true);
    try {
      const profileId = await getCurrentProfileId();
      const { error } = await supabase.from('dog_notes').insert({ dog_id: dog.id, author_id: profileId, note: noteText.trim() });
      if (error) throw error;
      setNoteText('');
      setShowNoteForm(false);
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
      <View style={styles.center}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  if (!dog) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>This dog could not be found.</Text>
      </View>
    );
  }

  const statusColor = getStatusColor(dog.status);
  const todayStr = new Date().toISOString().slice(0, 10);
  const medsDueToday = medicalRecords.some(
    (r) => r.status === 'Active' && r.next_action_date && r.next_action_date <= todayStr
  );
  const activeFlags = medicalRecords.filter((r) => r.status === 'Active');
  const subtitle = [dog.breed, dog.estimated_age_years ? `${dog.estimated_age_years} years` : null, dog.gender]
    .filter(Boolean)
    .join(' · ');

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#fff" />}
    >
      <HeroHeader
        uri={dog.photo_url}
        letter={dog.name.charAt(0).toUpperCase()}
        title={dog.name}
        subtitle={subtitle}
        onBack={() => router.back()}
        right={
          staff ? (
            isUploadingPhoto ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <IconBtn icon="camera-outline" color={colors.gold} onPress={() => handleAddPhoto(true)} />
            )
          ) : undefined
        }
      >
        <View style={styles.tagRow}>
          <Tag label={dog.status.toUpperCase()} bg={statusColor.bg} fg={statusColor.text} />
          {medsDueToday ? <Tag label="MEDS DUE TODAY" bg="#f4d3cf" fg="#b3261e" /> : null}
        </View>
      </HeroHeader>

      <View style={styles.body}>
        <View style={styles.idCard}>
          <Text style={styles.idEyebrow}>ID TAG</Text>
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
            <Text style={styles.factValue}>{dog.weight_kg != null ? `${dog.weight_kg}kg` : '—'}</Text>
            <Text style={styles.factLabel}>Weight</Text>
          </View>
          <View style={styles.factTile}>
            <Text style={styles.factValue} numberOfLines={1}>
              {dog.temperament ?? '—'}
            </Text>
            <Text style={styles.factLabel}>Temperament</Text>
          </View>
          <View style={styles.factTile}>
            <Text style={styles.factValue}>{dog.is_vaccinated ? '✓' : '—'}</Text>
            <Text style={styles.factLabel}>Vaccinated</Text>
          </View>
        </View>

        <UnderlineTabs tabs={TABS} active={tab} onChange={setTab} style={{ marginTop: 22 }} />

        {tab === 'About' ? (
          <View>
            {isEditing ? (
              <View>
                <FieldLabel>Status</FieldLabel>
                <ChipGroup options={STATUS_OPTIONS} value={editStatus} onChange={setEditStatus} />
                <Field label="Weight (kg)" value={editWeight} onChangeText={setEditWeight} keyboardType="numeric" />
                <Field label="Temperament" value={editTemperament} onChangeText={setEditTemperament} />
                <Field label="About" value={editAbout} onChangeText={setEditAbout} multiline numberOfLines={4} />
                <View style={styles.buttonRow}>
                  <PillButton label="Cancel" variant="outline" style={styles.flex1} onPress={() => setIsEditing(false)} />
                  <PillButton label="Save" style={styles.flex1} loading={isSavingEdit} onPress={handleSaveEdit} />
                </View>
              </View>
            ) : (
              <View>
                <SectionTitle title={`About ${dog.name}`} />
                <Text style={styles.bodyText}>{dog.about || 'No background notes yet.'}</Text>
              </View>
            )}

            {staff || images.length > 0 ? (
              <View>
                <SectionTitle title="Photos" />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
                  {images.map((image) => (
                    <Pressable
                      key={image.id}
                      style={styles.thumb}
                      onPress={() => handlePhotoPress(image)}
                      disabled={!staff}
                    >
                      <Image source={{ uri: image.public_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                      {image.is_primary ? (
                        <View style={styles.mainBadge}>
                          <Text style={styles.mainBadgeText}>MAIN</Text>
                        </View>
                      ) : null}
                    </Pressable>
                  ))}
                  {staff ? (
                    <Pressable style={[styles.thumb, styles.addThumb]} onPress={() => handleAddPhoto(false)} disabled={isUploadingPhoto}>
                      {isUploadingPhoto ? (
                        <ActivityIndicator color={colors.gold} />
                      ) : (
                        <>
                          <Text style={styles.addThumbPlus}>+</Text>
                          <Text style={styles.addThumbText}>Add photo</Text>
                        </>
                      )}
                    </Pressable>
                  ) : null}
                </ScrollView>
                {staff && images.length > 0 ? <Text style={styles.photoHint}>Tap a photo to make it the main photo or delete it.</Text> : null}
                {!staff && images.length === 0 ? <Text style={styles.empty}>No photos yet.</Text> : null}
              </View>
            ) : null}

            <SectionTitle title="Medical flags" />
            {activeFlags.length === 0 ? (
              <Text style={styles.empty}>No active medical flags.</Text>
            ) : (
              activeFlags.map((r) => <MedicalCard key={r.id} record={r} />)
            )}

            <SectionTitle title="Fostering history" />
            {fosteringRecords.length === 0 ? (
              <Text style={styles.empty}>No fostering history yet.</Text>
            ) : (
              fosteringRecords.slice(0, 2).map((r) => <FosterCard key={r.id} record={r} />)
            )}

            <SectionTitle title="Notes" />
            {notes.length === 0 ? (
              <Text style={styles.empty}>No notes logged yet.</Text>
            ) : (
              notes.map((n) => (
                <View key={n.id} style={styles.card}>
                  <Text style={styles.cardNote}>{n.note}</Text>
                  <Text style={styles.cardSub}>{formatDate(n.created_at)}</Text>
                </View>
              ))
            )}

            {staff && showNoteForm ? (
              <View>
                <Field
                  label="Log a note"
                  value={noteText}
                  onChangeText={setNoteText}
                  placeholder="Log a note about this dog..."
                  multiline
                />
                <View style={styles.buttonRow}>
                  <PillButton label="Cancel" variant="outline" style={styles.flex1} onPress={() => setShowNoteForm(false)} />
                  <PillButton label="Save note" style={styles.flex1} loading={isSavingNote} onPress={handleAddNote} />
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {tab === 'Medical' ? (
          <View style={{ marginTop: 18 }}>
            {medicalRecords.length === 0 ? (
              <Text style={styles.empty}>No medical records yet.</Text>
            ) : (
              medicalRecords.map((r) => <MedicalCard key={r.id} record={r} />)
            )}

            {staff ? (
              showRecordForm ? (
                <View>
                  <FieldLabel>Type</FieldLabel>
                  <ChipGroup options={RECORD_TYPES} value={recordType} onChange={setRecordType} />
                  <Field label="Title" value={recordTitle} onChangeText={setRecordTitle} placeholder="Ear infection treatment" />
                  <Field
                    label="Details"
                    value={recordDetails}
                    onChangeText={setRecordDetails}
                    multiline
                    numberOfLines={3}
                    placeholder="Dosage, vet name, anything relevant"
                  />
                  <Field
                    label="Next action date (optional, YYYY-MM-DD)"
                    value={recordNextAction}
                    onChangeText={setRecordNextAction}
                    placeholder="2026-08-05"
                  />
                  <View style={styles.buttonRow}>
                    <PillButton label="Cancel" variant="outline" style={styles.flex1} onPress={() => setShowRecordForm(false)} />
                    <PillButton label="Save record" style={styles.flex1} loading={isSavingRecord} onPress={handleAddRecord} />
                  </View>
                </View>
              ) : (
                <Pressable style={styles.addLink} onPress={() => setShowRecordForm(true)}>
                  <Text style={styles.addLinkText}>+ Add medical record</Text>
                </Pressable>
              )
            ) : null}
          </View>
        ) : null}

        {tab === 'Fostering' ? (
          <View style={{ marginTop: 18 }}>
            {fosteringRecords.length === 0 ? (
              <Text style={styles.empty}>No fostering history yet.</Text>
            ) : (
              fosteringRecords.map((r) => <FosterCard key={r.id} record={r} />)
            )}
          </View>
        ) : null}

        {staff && !isEditing && !showNoteForm ? (
          <View style={[styles.buttonRow, { marginTop: 28 }]}>
            <PillButton
              label="Log a note"
              variant="outline"
              style={styles.flex1}
              onPress={() => {
                setTab('About');
                setShowNoteForm(true);
              }}
            />
            <PillButton
              label="Update record"
              style={styles.flex1}
              onPress={() => {
                setTab('About');
                setIsEditing(true);
              }}
            />
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.page },
  body: { paddingHorizontal: 20 },
  flex1: { flex: 1 },
  tagRow: { flexDirection: 'row', gap: 8, marginTop: 12 },

  idCard: { backgroundColor: colors.raised, borderRadius: radius.lg, padding: 18, marginTop: 18 },
  idEyebrow: { color: colors.gold, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
  idLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  idValue: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 2 },
  idRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },

  factsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  factTile: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 6, alignItems: 'center' },
  factValue: { color: '#fff', fontSize: 15, fontWeight: '800' },
  factLabel: { color: colors.fgMuted, fontSize: 11, marginTop: 3 },

  bodyText: { color: colors.fgMuted, fontSize: 14, lineHeight: 21 },
  empty: { color: colors.fgMuted, fontSize: 14 },

  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '800', flexShrink: 1 },
  cardSub: { color: colors.fgMuted, fontSize: 12, marginTop: 4, lineHeight: 17 },
  cardNote: { color: '#fff', fontSize: 14, lineHeight: 20 },

  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 18 },
  photoRow: { gap: 10, paddingRight: 4 },
  thumb: {
    width: 120,
    height: 120,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  mainBadge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  mainBadgeText: { color: colors.header, fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  addThumb: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.line,
  },
  addThumbPlus: { color: colors.gold, fontSize: 30, fontWeight: '300', lineHeight: 34 },
  addThumbText: { color: colors.fgMuted, fontSize: 12, fontWeight: '700' },
  photoHint: { color: colors.fgFaint, fontSize: 12, marginTop: 8 },
  addLink: { marginTop: 16, alignItems: 'center' },
  addLinkText: { color: colors.gold, fontWeight: '800', fontSize: 15 },
});