import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';

export default function PlaceholderHome() {
  const { session, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Signed in ✅</Text>
      <Text style={styles.line}>Name: {session?.name}</Text>
      <Text style={styles.line}>Email: {session?.email}</Text>
      <Text style={styles.line}>Role: {session?.role}</Text>

      <Pressable style={styles.button} onPress={() => signOut()}>
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  line: { fontSize: 14, color: '#333' },
  button: { marginTop: 24, backgroundColor: '#16302a', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  buttonText: { color: '#fff', fontWeight: '700' },
});