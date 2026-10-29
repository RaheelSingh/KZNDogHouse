import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/theme';
import { PillButton } from '@/components/ui';

export default function PendingApprovalScreen() {
  const { session, refreshProfile, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [isChecking, setIsChecking] = useState(false);
  const [checkedOnce, setCheckedOnce] = useState(false);

  const firstName = session?.name?.split(' ')[0] ?? '';

  const handleCheckAgain = async () => {
    setIsChecking(true);
    try {
      await refreshProfile(); // if approved, the root layout switches to the app automatically
      setCheckedOnce(true);
    } catch (err) {
      console.warn('[pending] refresh failed:', err);
      Alert.alert('Could not check', 'Please check your connection and try again.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.warn('[pending] sign out failed:', err);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      <StatusBar style="light" />
      <LinearGradient colors={[colors.header, colors.primary]} style={StyleSheet.absoluteFill} />
      <Ionicons name="paw" size={420} color="rgba(255,255,255,0.045)" style={styles.paw} />

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="hourglass-outline" size={38} color={colors.gold} />
        </View>
        <Text style={styles.title}>Thanks{firstName ? `, ${firstName}` : ''}!</Text>
        <Text style={styles.body}>
          Your volunteer application is with our coordinators. Once you're approved you'll have full access to the
          calendar, dogs and alerts. This usually takes 3–5 days.
        </Text>
        {checkedOnce ? <Text style={styles.hint}>Still pending - check back a little later.</Text> : null}
      </View>

      <View>
        <PillButton label="Check again" loading={isChecking} onPress={handleCheckAgain} />
        <PillButton label="Sign out" variant="outline" onPress={handleSignOut} style={{ marginTop: 12 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page, paddingHorizontal: 24, justifyContent: 'space-between' },
  paw: { position: 'absolute', right: -110, bottom: 40 },
  content: { flex: 1, justifyContent: 'center' },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: { color: '#fff', fontSize: 34, fontWeight: '800' },
  body: { color: colors.fgMuted, fontSize: 15, lineHeight: 22, marginTop: 12 },
  hint: { color: colors.gold, fontSize: 13, fontWeight: '700', marginTop: 16 },
});