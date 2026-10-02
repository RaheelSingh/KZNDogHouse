import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

/** Must match `defaultChannel` in app.json and `channel_id` in the send-push Edge Function. */
export const DEFAULT_CHANNEL_ID = 'default';

/** How notifications behave while the app is OPEN. Without this they are silently dropped. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

let currentToken: string | null = null;
let tokenSubscription: ReturnType<typeof Notifications.addPushTokenListener> | null = null;

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  // Android 13+: a channel must exist before the permission prompt can appear.
  await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
    name: 'KZN Doghouse alerts',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#16302a',
  });
}

async function saveToken(token: string): Promise<void> {
  const { error } = await supabase.rpc('register_device', {
    p_token: token,
    p_platform: Platform.OS,
  });
  if (error) throw error;
  currentToken = token;
}

/** Asks permission, gets the native FCM token and stores it. Safe to call on every sign-in. */
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS !== 'android') {
    // iOS remote push needs a paid Apple Developer account. In-app alerts still update live.
    console.log('[push] Remote push is Android-only for now.');
    return null;
  }

  await ensureAndroidChannel();

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') {
    console.warn('[push] Notification permission not granted.');
    return null;
  }

  // On Android this IS the Firebase Cloud Messaging registration token.
  const { data } = await Notifications.getDevicePushTokenAsync();
  const token = String(data);
  await saveToken(token);

  // FCM can rotate the token - keep the database in sync.
  tokenSubscription?.remove();
  tokenSubscription = Notifications.addPushTokenListener(({ data: newToken }) => {
    saveToken(String(newToken)).catch((err) => console.warn('[push] token refresh failed:', err));
  });

  if (__DEV__) console.log('[push] FCM token:', token);
  return token;
}

/** Call BEFORE supabase.auth.signOut() (the RPC needs the session). */
export async function unregisterPushNotifications(): Promise<void> {
  tokenSubscription?.remove();
  tokenSubscription = null;
  if (!currentToken) return;

  const { error } = await supabase.rpc('deactivate_device', { p_token: currentToken });
  if (error) console.warn('[push] could not deactivate device:', error);
  currentToken = null;
}