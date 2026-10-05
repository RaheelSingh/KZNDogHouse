import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { getCurrentProfileId } from '@/lib/profile';
import { promptForImage, uploadDogImage, type PickedImage } from '@/lib/storage';
import { colors, radius } from '@/theme';
import { PillButton } from '@/components/ui';
import { ChipGroup, ErrorText, Field, FieldLabel, FormScreen } from '@/components/form';

const GENDERS = ['Male', 'Female', 'Unknown'] as const;
const SIZES = ['Not set', 'Small', 'Medium', 'Large'] as const;

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
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const choosePhoto = async () => {
    const picked = await promptForImage();
    if (picked) setPhoto(picked);
  };

  const handleSubmit = async () => {
    setFormError(null);
    if (!name.trim()) {
      setFormError('Name is required.');
      return;
    }

    let age: number | null = null;
    if (ageYears.trim()) {
      age = Math.round(Number(ageYears));
      if (Number.isNaN(age) || age < 0 || age > 30) {
        setFormError('Age must be a number between 0 and 30.');
        return;
      }
    }

    let weight: number | null = null;
    if (weightKg.trim()) {
      weight = Number(weightKg);
      if (Number.isNaN(weight) || weight < 0) {
        setFormError('Weight must be a positive number.');
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

      if (photo) {
        try {
          await uploadDogImage(data.id, photo, { makePrimary: true, altText: `Photo of ${name.trim()}` });
        } catch (uploadErr: any) {
          Alert.alert(
            'Dog saved, photo not uploaded',
            `${uploadErr?.message ?? 'Unknown error'}\n\nYou can add the photo again from the dog's page.`
          );
        }
      }

      router.replace(`/(tabs)/dogs/${data.id}`);
    } catch (err: any) {
      setFormError(err?.message ?? 'Could not add this dog. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormScreen title="New arrival" subtitle="Create a digital profile for a new dog." onBack={() => router.back()}>
      <Pressable style={styles.photoBox} onPress={choosePhoto} disabled={isSubmitting}>
        {photo ? (
          <>
            <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <View style={styles.photoBadge}>
              <Ionicons name="camera" size={14} color={colors.header} />
              <Text style={styles.photoBadgeText}>Change photo</Text>
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
      {photo ? (
        <Pressable onPress={() => setPhoto(null)} disabled={isSubmitting}>
          <Text style={styles.removePhoto}>Remove photo</Text>
        </Pressable>
      ) : null}

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
        label={photo ? 'Save dog & upload photo' : 'Save dog'}
        loading={isSubmitting}
        onPress={handleSubmit}
        style={{ marginTop: 24 }}
      />
      {isSubmitting && photo ? (
        <View style={styles.uploadingRow}>
          <ActivityIndicator color={colors.gold} size="small" />
          <Text style={styles.uploadingText}>Saving and uploading photo…</Text>
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