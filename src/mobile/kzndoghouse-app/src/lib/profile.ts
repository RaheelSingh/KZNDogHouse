import { supabase } from './supabase';

export async function getCurrentProfileId(): Promise<string | null> {
  const { data, error } = await supabase.rpc('current_profile_id');
  if (error) {
    console.warn('[profile] Could not resolve current_profile_id:', error);
    return null;
  }
  return (data as string) ?? null;
}