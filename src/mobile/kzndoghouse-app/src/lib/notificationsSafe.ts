import Constants, { ExecutionEnvironment } from 'expo-constants';

export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export const Notifications: typeof import('expo-notifications') | null = isExpoGo
  ? null
  : require('expo-notifications');

export const useLastNotificationResponse: () => import('expo-notifications').NotificationResponse | null | undefined =
  Notifications ? Notifications.useLastNotificationResponse : () => null;