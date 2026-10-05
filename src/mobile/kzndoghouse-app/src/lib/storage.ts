import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { getCurrentProfileId } from '@/lib/profile';
import type { DogImage } from '@/types/models';


export const PUBLIC_BUCKET = 'public-media';
const MAX_BYTES = 5 * 1024 * 1024; // the bucket limit is 5 MB
export const MAX_IMAGES_PER_DOG = 10; // same limit as the website

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export type PickedImage = {
  uri: string; // local file, used for the preview
  base64: string; // file contents, used for the upload
  mimeType: string;
};



const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';


function base64ToArrayBuffer(input: string): ArrayBuffer {
  const clean = input.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64.indexOf(clean[i]);
    const b = B64.indexOf(clean[i + 1]);
    const c = i + 2 < clean.length ? B64.indexOf(clean[i + 2]) : -1;
    const d = i + 3 < clean.length ? B64.indexOf(clean[i + 3]) : -1;
    bytes[p++] = (a << 2) | (b >> 4);
    if (c >= 0) bytes[p++] = ((b & 15) << 4) | (c >> 2);
    if (d >= 0) bytes[p++] = ((c & 3) << 6) | d;
  }
  return bytes.buffer as ArrayBuffer;
}

function randomId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}



export async function pickImage(source: 'camera' | 'library'): Promise<PickedImage | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera permission needed', 'Allow camera access in your phone settings to take a photo.');
      return null;
    }
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.7,
    base64: true,
  };

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled || !result.assets || result.assets.length === 0) return null;

  const asset = result.assets[0];
  if (!asset.base64) throw new Error('Could not read that image. Please try a different one.');

  const mimeType = asset.mimeType && EXTENSIONS[asset.mimeType] ? asset.mimeType : 'image/jpeg';
  return { uri: asset.uri, base64: asset.base64, mimeType };
}


export function promptForImage(): Promise<PickedImage | null> {
  return new Promise((resolve) => {
    const run = async (source: 'camera' | 'library') => {
      try {
        resolve(await pickImage(source));
      } catch (err: any) {
        Alert.alert('Photo problem', err?.message ?? 'Could not open the photo picker.');
        resolve(null);
      }
    };

    Alert.alert(
      'Dog photo',
      'Where should the photo come from?',
      [
        { text: 'Take photo', onPress: () => run('camera') },
        { text: 'Choose from gallery', onPress: () => run('library') },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) }
    );
  });
}



export async function fetchDogImages(dogId: string): Promise<DogImage[]> {
  const { data, error } = await supabase
    .from('dog_images')
    .select('*')
    .eq('dog_id', dogId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as DogImage[]) ?? [];
}


export async function uploadDogImage(
  dogId: string,
  image: PickedImage,
  options: { makePrimary?: boolean; altText?: string } = {}
): Promise<DogImage> {
  const bytes = base64ToArrayBuffer(image.base64);
  if (bytes.byteLength > MAX_BYTES) throw new Error('Photos must be 5 MB or smaller.');

  const profileId = await getCurrentProfileId();

  const { data: existingData, error: existingError } = await supabase
    .from('dog_images')
    .select('id, sort_order, is_primary')
    .eq('dog_id', dogId);
  if (existingError) throw existingError;
  const existing = (existingData as Pick<DogImage, 'id' | 'sort_order' | 'is_primary'>[]) ?? [];

  if (existing.length >= MAX_IMAGES_PER_DOG) {
    throw new Error(`A dog can have up to ${MAX_IMAGES_PER_DOG} photos. Delete one first.`);
  }

  const hasPrimary = existing.some((row) => row.is_primary);
  const makePrimary = options.makePrimary === true || !hasPrimary;

  const storagePath = `dogs/${dogId.replace(/-/g, '')}/${randomId()}.${EXTENSIONS[image.mimeType]}`;

  const { error: uploadError } = await supabase.storage.from(PUBLIC_BUCKET).upload(storagePath, bytes, {
    contentType: image.mimeType,
    cacheControl: '3600',
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(storagePath);
  const publicUrl = urlData.publicUrl;

  try {
    if (makePrimary && hasPrimary) {
      const { error } = await supabase.from('dog_images').update({ is_primary: false }).eq('dog_id', dogId).eq('is_primary', true);
      if (error) throw error;
    }

    const nextSort = existing.length === 0 ? 0 : Math.max(...existing.map((row) => row.sort_order)) + 1;
    const { data: inserted, error: insertError } = await supabase
      .from('dog_images')
      .insert({
        dog_id: dogId,
        storage_path: storagePath,
        public_url: publicUrl,
        is_primary: makePrimary,
        sort_order: nextSort,
        alt_text: options.altText ?? null,
        created_by: profileId,
      })
      .select('*')
      .single();
    if (insertError) throw insertError;

    if (makePrimary) {
      const { error } = await supabase
        .from('dogs')
        .update({ photo_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', dogId);
      if (error) throw error;
    }

    return inserted as DogImage;
  } catch (err) {
    
    await supabase.storage.from(PUBLIC_BUCKET).remove([storagePath]);
    throw err;
  }
}



export async function setPrimaryDogImage(dogId: string, image: DogImage): Promise<void> {
  const { error: clearError } = await supabase
    .from('dog_images')
    .update({ is_primary: false })
    .eq('dog_id', dogId)
    .eq('is_primary', true);
  if (clearError) throw clearError;

  const { error: setError } = await supabase.from('dog_images').update({ is_primary: true }).eq('id', image.id);
  if (setError) throw setError;

  const { error: dogError } = await supabase
    .from('dogs')
    .update({ photo_url: image.public_url, updated_at: new Date().toISOString() })
    .eq('id', dogId);
  if (dogError) throw dogError;
}

export async function deleteDogImage(dogId: string, image: DogImage): Promise<void> {
  const { error } = await supabase.from('dog_images').delete().eq('id', image.id);
  if (error) throw error;

  await supabase.storage.from(PUBLIC_BUCKET).remove([image.storage_path]);

  if (image.is_primary) {
    const remaining = await fetchDogImages(dogId);
    if (remaining.length > 0) {
      await setPrimaryDogImage(dogId, remaining[0]);
    } else {
      await supabase.from('dogs').update({ photo_url: null, updated_at: new Date().toISOString() }).eq('id', dogId);
    }
  }
}