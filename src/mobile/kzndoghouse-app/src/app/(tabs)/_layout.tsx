import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotifications } from '@/context/NotificationsContext';
import { colors } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function makeTabIcon(name: IconName) {
  function TabBarIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} size={size} color={color as string} />;
  }
  return TabBarIcon;
}

const HomeIcon = makeTabIcon('home-outline');
const DogsIcon = makeTabIcon('paw-outline');
const CalendarIcon = makeTabIcon('calendar-outline');
const AlertsIcon = makeTabIcon('notifications-outline');
const ProfileIcon = makeTabIcon('person-outline');

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { unreadCount } = useNotifications();
  const bottom = Math.max(insets.bottom, 0);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.header,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.75)',
        tabBarActiveBackgroundColor: colors.gold,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
        tabBarItemStyle: { paddingVertical: 8 },
        tabBarStyle: {
          backgroundColor: colors.header,
          borderTopWidth: 0,
          height: 68 + bottom,
          paddingTop: 0,
          paddingBottom: bottom,
          elevation: 0,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: HomeIcon }} />
      <Tabs.Screen name="dogs" options={{ title: 'Dogs', tabBarIcon: DogsIcon }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar', tabBarIcon: CalendarIcon }} />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarIcon: AlertsIcon,
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.danger, fontSize: 10 },
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ProfileIcon }} />
    </Tabs>
  );
}