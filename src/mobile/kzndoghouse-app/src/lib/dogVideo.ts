import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';

const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

export type PickedVideo = { uri: string; name: string; mimeType: 'video/mp4' | 'video/webm'; size?: number };

/** Uses the existing Expo image-picker native module; no extra packages needed. */
export async function pickDogVideo(): Promise<PickedVideo | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    allowsEditing: false,
    quality: 1,
  });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  const name = asset.fileName || 'dog-video.mp4';
  const mimeType = asset.mimeType === 'video/webm' ? 'video/webm' : 'video/mp4';
  if (asset.mimeType && asset.mimeType !== 'video/mp4' && asset.mimeType !== 'video/webm') {
    throw new Error('Please select an MP4 or WebM video.');
  }
  if (asset.fileSize != null && asset.fileSize > MAX_VIDEO_BYTES) throw new Error('Video must be 25 MB or smaller.');
  return { uri: asset.uri, name, mimeType, size: asset.fileSize };
}

/** The website's existing video service performs server-side validation and stores in dog-videos. */
export async function uploadDogVideo(dogId: string, video: PickedVideo): Promise<void> {
  const base = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '');
  if (!base?.startsWith('https://')) throw new Error('The secure website API URL is not configured.');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error('Please sign in again before uploading the video.');

  const body = new FormData();
  body.append('video', { uri: video.uri, name: video.name, type: video.mimeType } as any);
  const response = await fetch(`${base}/api/mobile/dogs/${encodeURIComponent(dogId)}/videos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${data.session.access_token}` },
    body,
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) throw new Error(result?.message || 'Video upload failed.');
}
