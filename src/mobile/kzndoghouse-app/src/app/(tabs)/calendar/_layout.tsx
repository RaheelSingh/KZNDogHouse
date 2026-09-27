import { Stack } from 'expo-router';

export default function CalendarStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="add" options={{ presentation: 'modal' }} />
    </Stack>
  );
}