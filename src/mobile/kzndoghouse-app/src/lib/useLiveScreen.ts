import { useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';

/** Refresh a focused screen on Supabase changes and periodically as fallback.
 * Realtime depends on table publication + RLS in the connected Supabase project.
 * Never refresh a background screen; clean all listeners when focus moves away.
 */
export function useLiveScreen(load: () => Promise<unknown> | void, tables: readonly string[], periodMs = 30000) {
  const loadRef = useRef(load);
  loadRef.current = load;
  const key = tables.join('|');
  useFocusEffect(useCallback(() => {
    let disposed = false;
    let running = false;
    const refresh = async () => {
      if (disposed || running || AppState.currentState === 'background' || AppState.currentState === 'inactive') return;
      running = true;
      try { await loadRef.current(); }
      catch (err) { console.warn('[live] refresh failed:', err); }
      finally { running = false; }
    };
    void refresh();
    const interval = setInterval(() => { void refresh(); }, periodMs);
    const foreground = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh();
    });
    const channel = supabase.channel(`screen-${tables.join('-')}-${Date.now()}`);
    for (const table of tables) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => { void refresh(); });
    }
    channel.subscribe();
    return () => {
      disposed = true;
      clearInterval(interval);
      foreground.remove();
      void supabase.removeChannel(channel);
    };
  }, [key, periodMs]));
}
