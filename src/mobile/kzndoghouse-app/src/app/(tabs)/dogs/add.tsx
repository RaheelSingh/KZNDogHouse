import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { getCurrentProfileId } from '@/lib/profile';
import { promptForImage, uploadDogImage, MAX_IMAGES_PER_DOG, type PickedImage } from '@/lib/storage';
import DateField from '@/components/DateField';
import { pickDogVideo, uploadDogVideo, type PickedVideo } from '@/lib/dogVideo';
import { colors, radius } from '@/theme';
import { PillButton } from '@/components/ui';
import { ChipGroup, ErrorText, Field, FieldLabel, FormScreen } from '@/components/form';

const GENDERS = ['Male', 'Female', 'Unknown'] as const;
const SIZES = ['Not set', 'Small', 'Medium', 'Large'] as const;
const INTAKE_TYPES = ['Not recorded', 'Stray', 'Rescued', 'Owner surrender', 'Transferred', 'Born at shelter', 'Other'] as const;
const STATUS_OPTIONS = ['Available', 'In Care', 'Under Treatment', 'Fostered', 'Reserved', 'Adopted'] as const;
const VACCINATION_OPTIONS = ['Not vaccinated', 'Vaccinated'] as const;
const STERILISATION_OPTIONS = ['Not recorded', 'Yes', 'No'] as const;
function todayDate(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function dateFromLocal(value: string): Date { const [y,m,d] = value.split('-').map(Number); return new Date(y,m-1,d); }

export default function AddDogScreen() {
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [gender, setGender] = useState<(typeof GENDERS)[number]>('Unknown');
  const [ageYears, setAgeYears] = useState('');
  const [size, setSize] = useState<(typeof SIZES)[number]>('Not set');
  const [weightKg, setWeightKg] = useState('');
  const [eyeColour, setEyeColour] = useState('');
  const [kennelLocation, setKennelLocation] = useState('');
  const [about, setAbout] = useState('');
  const [photos, setPhotos] = useState<PickedImage[]>([]);
  const [video, setVideo] = useState<PickedVideo | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState<string | null>(null);
  const [intakeDate, setIntakeDate] = useState<string | null>(todayDate());
  const [intakeType, setIntakeType] = useState<(typeof INTAKE_TYPES)[number]>('Not recorded');
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>('In Care');
  const [temperament, setTemperament] = useState('');
  const [vaccination, setVaccination] = useState<(typeof VACCINATION_OPTIONS)[number]>('Not vaccinated');
  const [sterilised, setSterilised] = useState<(typeof STERILISATION_OPTIONS)[number]>('Not recorded');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const choosePhoto = async () => {
    const picked = await promptForImage();
    if (picked) setPhotos((previous) => previous.length < MAX_IMAGES_PER_DOG ? [...previous, picked] : previous);
  };

  const chooseVideo = async () => {
    try { const chosen = await pickDogVideo(); if (chosen) setVideo(chosen); }
    catch (err: any) { Alert.alert('Video problem', err?.message ?? 'Could not select the video.'); }
  };

  const handleSubmit = async () => {
    setFormError(null);
    if (!name.trim()) {
      setFormError('Name is required.');
      return;
    }

    if (!intakeDate) return setFormError('Intake date is required.');
    const today = todayDate();
    if (intakeDate > today) return setFormError('Intake date cannot be in the future.');
    if (dateOfBirth && dateOfBirth > today) return setFormError('Date of birth cannot be in the future.');
    if (dateOfBirth && dateOfBirth > intakeDate) return setFormError('Date of birth cannot be after intake date.');
    if (name.trim().length > 100 || breed.trim().length > 100 || kennelLocation.trim().length > 100 || temperament.trim().length > 300 || about.trim().length > 2000) {
      return setFormError('One or more fields exceed the website character limits.');
    }
    let age: number | null = null;
    if (ageYears.trim()) {
      age = Math.round(Number(ageYears));
      if (!Number.isInteger(Number(ageYears)) || Number.isNaN(age) || age < 0 || age > 30) {
        setFormError('Age must be a number between 0 and 30.');
        return;
      }
    }

    if (age !== null && dateOfBirth) {
      const estimate = (dateFromLocal(today).getTime() - dateFromLocal(dateOfBirth).getTime()) / (365.2425 * 86400000);
      if (Math.abs(estimate - age) > 1.25) return setFormError('Estimated age does not match the date of birth.');
    }

    let weight: number | null = null;
    if (weightKg.trim()) {
      weight = Number(weightKg);
      if (Number.isNaN(weight) || !Number.isFinite(weight) || weight < 0 || weight > 120) {
        setFormError('Weight must be between 0 and 120 kg.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const profileId = await getCurrentProfileId();
      const { data, error } = await supabase
        .from('dogs')
        .insert({
          name: name.trim(),
          breed: breed.trim() || null,
          gender,
          estimated_age_years: age,
          date_of_birth: dateOfBirth,
          intake_date: intakeDate,
          intake_type: intakeType === 'Not recorded' ? null : intakeType,
          status,
          temperament: temperament.trim() || null,
          is_vaccinated: vaccination === 'Vaccinated',
          is_spayed_neutered: sterilised === 'Not recorded' ? null : sterilised === 'Yes',
          size: size === 'Not set' ? null : size,
          weight_kg: weight,
          eye_colour: eyeColour.trim() || null,
          kennel_location: kennelLocation.trim() || null,
          about: about.trim() || null,
          created_by: profileId,
        })
        .select('id')
        .single();

      if (error) throw error;

      const warnings: string[] = [];
      for (const [index, image] of photos.entries()) {
        try { await uploadDogImage(data.id, image, { makePrimary: index === 0, altText: `Photo of ${name.trim()}` }); }
        catch (uploadErr: any) { warnings.push(`Photo ${index + 1}: ${uploadErr?.message ?? 'Upload failed'}`); }
      }
      if (video) {
        try { await uploadDogVideo(data.id, video); }
        catch (uploadErr: any) { warnings.push(`Video: ${uploadErr?.message ?? 'Upload failed'}`); }
      }
      if (warnings.length) Alert.alert('Dog saved with upload warnings', warnings.join('\n')); 

      router.replace(`/(tabs)/dogs/${data.id}`);
    } catch (err: any) {
      setFormError(err?.message ?? 'Could not add this dog. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormScreen title="New arrival" subtitle="Create a digital profile for a new dog." onBack={() => router.back()}>
      <Pressable style={styles.photoBox} onPress={choosePhoto} disabled={isSubmitting || photos.length >= MAX_IMAGES_PER_DOG}>
        {photos.length > 0 ? (
          <>
            <Image source={{ uri: photos[0].uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <View style={styles.photoBadge}>
              <Ionicons name="camera" size={14} color={colors.header} />
              <Text style={styles.photoBadgeText}>Add photo ({photos.length}/{MAX_IMAGES_PER_DOG})</Text>
            </View>
          </>
        ) : (
          <View style={styles.photoEmpty}>
            <Ionicons name="camera-outline" size={34} color={colors.gold} />
            <Text style={styles.photoTitle}>Add a photo</Text>
            <Text style={styles.photoHint}>Take one now or pick one from your gallery</Text>
          </View>
        )}
      </Pressable>
      {photos.length > 0 ? (
        <View>
          <Text style={styles.photoHint}>First photo is the profile image. Up to 10 photos (5 MB each).</Text>
          <Pressable onPress={() => setPhotos((previous) => previous.slice(0, -1))} disabled={isSubmitting}>
            <Text style={styles.removePhoto}>Remove last photo</Text>
          </Pressable>
        </View>
      ) : null}
      <Pressable onPress={chooseVideo} disabled={isSubmitting} style={{ paddingVertical: 12 }}>
        <Text style={styles.removePhoto}>{video ? `Video: ${video.name} (tap to change)` : '+ Add optional video (MP4/WebM, up to 25 MB)'}</Text>
      </Pressable>
      {video ? <Pressable onPress={() => setVideo(null)} disabled={isSubmitting}><Text style={styles.removePhoto}>Remove video</Text></Pressable> : null}

      <Field label="Name" value={name} onChangeText={setName} placeholder="Rosie" />
      <Field label="Breed" value={breed} onChangeText={setBreed} placeholder="Mixed breed" />

      <FieldLabel>Gender</FieldLabel>
      <ChipGroup options={GENDERS} value={gender} onChange={setGender} />

      <FieldLabel>Size</FieldLabel>
      <ChipGroup options={SIZES} value={size} onChange={setSize} />

      <View style={styles.row}>
        <View style={styles.half}>
          <Field label="Age (years)" value={ageYears} onChangeText={setAgeYears} placeholder="3" keyboardType="numeric" />
        </View>
        <View style={styles.half}>
          <Field label="Weight (kg)" value={weightKg} onChangeText={setWeightKg} placeholder="18" keyboardType="numeric" />
        </View>
      </View>

      <DateField label="Date of birth (optional)" value={dateOfBirth} onChange={setDateOfBirth} maximumDate={new Date()} />
      <DateField label="Intake date (required)" value={intakeDate} onChange={setIntakeDate} maximumDate={new Date()} />
      <FieldLabel>Intake type</FieldLabel>
      <ChipGroup options={INTAKE_TYPES} value={intakeType} onChange={setIntakeType} />
      <FieldLabel>Status</FieldLabel>
      <ChipGroup options={STATUS_OPTIONS} value={status} onChange={setStatus} />
      <FieldLabel>Vaccination status</FieldLabel>
      <ChipGroup options={VACCINATION_OPTIONS} value={vaccination} onChange={setVaccination} />
      <FieldLabel>Spayed / neutered</FieldLabel>
      <ChipGroup options={STERILISATION_OPTIONS} value={sterilised} onChange={setSterilised} />
      <Field label="Temperament" value={temperament} onChangeText={setTemperament} placeholder="Calm, playful, good with dogs" maxLength={300} />
      <Field label="Eye colour" value={eyeColour} onChangeText={setEyeColour} placeholder="Brown" />
      <Field label="Kennel location" value={kennelLocation} onChangeText={setKennelLocation} placeholder="Block B · Run 4" />
      <Field
        label="About"
        value={about}
        onChangeText={setAbout}
        placeholder="Temperament, background, anything staff should know..."
        multiline
        numberOfLines={4}
      />

      <ErrorText text={formError} />

      <PillButton
        label={photos.length || video ? 'Save dog & upload media' : 'Save dog'}
        loading={isSubmitting}
        onPress={handleSubmit}
        style={{ marginTop: 24 }}
      />
      {isSubmitting && (photos.length > 0 || !!video) ? (
        <View style={styles.uploadingRow}>
          <ActivityIndicator color={colors.gold} size="small" />
          <Text style={styles.uploadingText}>Saving and uploading media…</Text>
        </View>
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },

  photoBox: {
    height: 200,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderStyle: 'dashed',
    overflow: 'hidden',
    marginTop: 8,
  },
  photoEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  photoTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 6 },
  photoHint: { color: colors.fgMuted, fontSize: 12 },
  photoBadge: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  photoBadgeText: { color: colors.header, fontSize: 12, fontWeight: '800' },
  removePhoto: { color: colors.dangerSoft, fontSize: 12, fontWeight: '700', marginTop: 8 },

  uploadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14 },
  uploadingText: { color: colors.fgMuted, fontSize: 13 },
});
