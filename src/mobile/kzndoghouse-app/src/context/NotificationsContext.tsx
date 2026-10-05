import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { Notifications } from '@/lib/notificationsSafe';
import { supabase } from '@/lib/supabase';
import { getCurrentProfileId } from '@/lib/profile';
import { registerForPushNotifications } from '@/lib/pushNotifications';
import { useAuth } from '@/context/AuthContext';
import type { AppNotification } from '@/types/models';

type NotificationsContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  refresh: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearAll: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

const SELECT_COLUMNS = 'id, recipient_id, category, title, body, data, is_read, cleared_at, created_at';

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  
  useEffect(() => {
    let cancelled = false;
    if (!session) {
      setProfileId(null);
      setNotifications([]);
      return;
    }
    getCurrentProfileId().then((id) => {
      if (!cancelled) setProfileId(id);
    });
    return () => {
      cancelled = true;
    };
  }, [session?.id]);

  const refresh = useCallback(async () => {
    if (!profileId) return;
    const { data, error } = await supabase
      .from('notifications')
      .select(SELECT_COLUMNS)
      .eq('recipient_id', profileId)
      .is('cleared_at', null)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      console.warn('[notifications] load failed:', error);
      return;
    }
    setNotifications((data ?? []) as AppNotification[]);
  }, [profileId]);

  
  useEffect(() => {
    if (!profileId) return;

    setIsLoading(true);
    refresh().finally(() => setIsLoading(false));

    const channel = supabase
      .channel(`notifications-${profileId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${profileId}` },
        (payload) => {
          const row = payload.new as AppNotification;
          setNotifications((prev) => (prev.some((n) => n.id === row.id) ? prev : [row, ...prev]));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${profileId}` },
        (payload) => {
          const row = payload.new as AppNotification;
          setNotifications((prev) =>
            row.cleared_at ? prev.filter((n) => n.id !== row.id) : prev.map((n) => (n.id === row.id ? row : n))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, refresh]);


  useEffect(() => {
    if (!profileId) return;
    registerForPushNotifications().catch((err) => console.warn('[push] registration failed:', err));
  }, [profileId]);


    useEffect(() => {
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    const receivedSub = Notifications?.addNotificationReceivedListener(() => {
      refresh();
    });
    return () => {
      appStateSub.remove();
      receivedSub?.remove();
    };
  }, [refresh]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.is_read).length, [notifications]);


    useEffect(() => {
    Notifications?.setBadgeCountAsync(unreadCount).catch(() => {});
  }, [unreadCount]);

  const markAsRead = useCallback(
    async (id: string) => {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      if (error) {
        console.warn('[notifications] mark read failed:', error);
        refresh();
      }
    },
    [refresh]
  );

  const markAllAsRead = useCallback(async () => {
    if (!profileId) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', profileId)
      .eq('is_read', false);
    if (error) {
      console.warn('[notifications] mark all read failed:', error);
      refresh();
    }
  }, [profileId, refresh]);


  const clearAll = useCallback(async () => {
    if (!profileId) return;
    setNotifications([]);
    const { error } = await supabase
      .from('notifications')
      .update({ cleared_at: new Date().toISOString(), is_read: true })
      .eq('recipient_id', profileId)
      .is('cleared_at', null);
    if (error) {
      console.warn('[notifications] clear failed:', error);
      refresh();
    }
  }, [profileId, refresh]);

  return (
    <NotificationsContext.Provider
      value={{ notifications, unreadCount, isLoading, refresh, markAsRead, markAllAsRead, clearAll }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationsProvider');
  return ctx;
}