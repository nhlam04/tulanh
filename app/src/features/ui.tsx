// Shared parts (Hùng, feature side): one row, one button, one field, one message line.
// The message line prints what the server returned, so the words on the screen are the
// words in the code table.
import { TextInput, View, Text, Pressable, StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, gap: 10 },
  title: { fontSize: 18, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#e4e4e4' },
  muted: { color: '#5b5b5b' },
  button: { paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#3f7d5b', borderRadius: 8, alignSelf: 'flex-start' },
  buttonText: { color: '#fff', fontWeight: '600' },
  field: { borderWidth: 1, borderColor: '#c9c9c9', borderRadius: 8, padding: 10 },
});

export function Button({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.button, disabled ? { opacity: 0.4 } : null]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, value, onChangeText }: { label: string; value: string; onChangeText: (next: string) => void }) {
  return (
    <View>
      <Text style={styles.muted}>{label}</Text>
      <TextInput style={styles.field} value={value} onChangeText={onChangeText} autoCapitalize="none" />
    </View>
  );
}

export function Row({ left, right }: { left: string; right: string }) {
  return (
    <View style={styles.row}>
      <Text>{left}</Text>
      <Text style={styles.muted}>{right}</Text>
    </View>
  );
}
