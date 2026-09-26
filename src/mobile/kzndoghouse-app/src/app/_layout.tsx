import { Stack } from 'expo-router';
import { AuthProvider, useAuth } from '@/context/AuthContext';

function RootNavigator() {
  const { session, isLoading } = useAuth();

  if (isLoading) return null; 

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
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
      <RootNavigator />
    </AuthProvider>
  );
}