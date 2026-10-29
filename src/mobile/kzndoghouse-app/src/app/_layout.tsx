import { useEffect, useRef } from 'react';
import { Stack, router, type Href } from 'expo-router';
import { Notifications, useLastNotificationResponse } from '@/lib/notificationsSafe';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { NotificationsProvider, useNotifications } from '@/context/NotificationsContext';

/** Opens the right screen when the user taps a push notification. */
function useNotificationTapNavigation(enabled: boolean) {
  const { markAsRead } = useNotifications();

  const lastResponse = useLastNotificationResponse();
  const handled = useRef(new Set<string>());

  useEffect(() => {
    if (!Notifications || !enabled || !lastResponse) return;
    if (lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;

    const key = lastResponse.notification.request.identifier;
    if (handled.current.has(key)) return;
    handled.current.add(key);

    const data = (lastResponse.notification.request.content.data ?? {}) as Record<string, unknown>;
    if (typeof data.notificationId === 'string') markAsRead(data.notificationId);

    const route = typeof data.route === 'string' && data.route.length > 0 ? data.route : '/alerts';
    setTimeout(() => router.push(route as Href), 0);
  }, [enabled, lastResponse, markAsRead]);
}

function RootNavigator() {
  const { session, isLoading } = useAuth();
  const isApproved = !!session && session.role !== 'pending';
  const isPending = !!session && session.role === 'pending';

  useNotificationTapNavigation(!isLoading && isApproved);

  if (isLoading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isApproved}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={isPending}>
        <Stack.Screen name="pending" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <RootNavigator />
      </NotificationsProvider>
    </AuthProvider>
  );
}