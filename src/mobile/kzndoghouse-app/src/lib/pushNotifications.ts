import { Platform } from 'react-native';
import { supabase } from './supabase';
import { Notifications } from './notificationsSafe';


export const DEFAULT_CHANNEL_ID = 'default';


if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

let currentToken: string | null = null;
let tokenSubscription: { remove: () => void } | null = null;

async function ensureAndroidChannel(): Promise<void> {
  if (!Notifications || Platform.OS !== 'android') return;
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


export async function registerForPushNotifications(): Promise<string | null> {
  if (!Notifications) {
    console.log('[push] Skipped: running in Expo Go. Use a development build for push.');
    return null;
  }

  if (Platform.OS !== 'android') {
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

  const { data } = await Notifications.getDevicePushTokenAsync();
  const token = String(data);
  await saveToken(token);

  tokenSubscription?.remove();
  tokenSubscription = Notifications.addPushTokenListener(({ data: newToken }) => {
    saveToken(String(newToken)).catch((err) => console.warn('[push] token refresh failed:', err));
  });

  if (__DEV__) console.log('[push] FCM token:', token);
  return token;
}


export async function unregisterPushNotifications(): Promise<void> {
  tokenSubscription?.remove();
  tokenSubscription = null;
  if (!currentToken) return;

  const { error } = await supabase.rpc('deactivate_device', { p_token: currentToken });
  if (error) console.warn('[push] could not deactivate device:', error);
  currentToken = null;
}