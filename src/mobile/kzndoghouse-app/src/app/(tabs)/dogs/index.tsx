import { StyleSheet, Text, View } from 'react-native';

export default function DogsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Dogs list — built in the next step.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  text: { fontSize: 14, color: '#6b7a70', textAlign: 'center' },
});