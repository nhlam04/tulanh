// Shared parts (Hùng, feature side): one kit for every screen, so the same thing reads
// and looks the same everywhere. Each part answers one rule of the course material:
//   Bar     rule 1 — the screen names itself and leaves the system status line unbroken.
//   Notice  rule 9 — a sentence about what happened, never a code (D108); rule 2 — red
//           only when the call did not work.
//   ListRow the ListTile shape of the course mockups (Bài tập 05): a leading mark, the
//           name, one quiet line, one action.
//   Chip    rules 5 and 6 — a choice is tapped from the list the server sent, not typed
//           out of memory.
//   Empty   a list with nothing in it says so, and says what to do next.
// Touch targets keep 44dp of height, the size the touch rules ask for.
import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type Note = { text: string; bad?: boolean };

const brand = '#3f7d5b';
const ink = '#1c1c1c';
const quiet = '#5f6b63';
const hair = '#e4e4e4';
const bad = '#b3402f';
const paper = '#f7f6f3';

export const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: paper },
  screen: { flex: 1, backgroundColor: paper },
  bar: { backgroundColor: brand, paddingHorizontal: 16, paddingBottom: 12 },
  barTitle: { color: '#ffffff', fontSize: 17, fontWeight: '600' },
  barSub: { color: '#e6efe9', fontSize: 12, marginTop: 3 },
  body: { padding: 16, gap: 12 },
  notice: { fontSize: 13, color: quiet, borderLeftWidth: 3, borderLeftColor: hair, paddingLeft: 8 },
  noticeBad: { color: bad, borderLeftColor: bad },
  list: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: '#ffffff', borderWidth: 1, borderColor: hair, borderRadius: 10 },
  rowPressed: { backgroundColor: '#eaf1ec' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: brand },
  dotBad: { backgroundColor: bad },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: ink },
  rowSub: { fontSize: 13, color: quiet },
  rowAction: { fontSize: 13, fontWeight: '600', color: brand },
  rowActionBad: { color: bad },
  muted: { color: quiet, fontSize: 13 },
  button: { minHeight: 46, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, borderRadius: 10, backgroundColor: brand },
  buttonOutline: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: brand },
  buttonText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  buttonTextOutline: { color: brand },
  buttonPressed: { opacity: 0.75 },
  buttonRow: { flexDirection: 'row', gap: 8 },
  fieldLabel: { fontSize: 12, color: quiet, marginBottom: 4 },
  field: { borderWidth: 1, borderColor: '#c9c9c9', borderRadius: 8, padding: 10, minHeight: 44, backgroundColor: '#ffffff', fontSize: 15, color: ink },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: brand, backgroundColor: '#ffffff' },
  chipOn: { backgroundColor: brand },
  chipText: { fontSize: 13, color: brand },
  chipTextOn: { color: '#ffffff', fontWeight: '600' },
  empty: { padding: 14, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: hair, backgroundColor: '#ffffff', gap: 3 },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: ink },
  emptyHint: { fontSize: 13, color: quiet },
  tabBar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: hair, backgroundColor: '#ffffff' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabText: { fontSize: 13, color: quiet },
  tabTextOn: { color: brand, fontWeight: '600' },
});

export function Bar({ title, sub }: { title: string; sub?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 10 }]}>
      <Text style={styles.barTitle}>{title}</Text>
      {sub ? <Text style={styles.barSub}>{sub}</Text> : null}
    </View>
  );
}

export function Screen({ children }: { children: ReactNode }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
      {children}
    </ScrollView>
  );
}

export function Notice({ note }: { note: Note }) {
  if (!note.text) return null;
  return <Text style={[styles.notice, note.bad ? styles.noticeBad : null]}>{note.text}</Text>;
}

export function Button({ label, onPress, disabled, outline }: { label: string; onPress: () => void; disabled?: boolean; outline?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, outline ? styles.buttonOutline : null, pressed ? styles.buttonPressed : null, disabled ? { opacity: 0.4 } : null]}
    >
      <Text style={[styles.buttonText, outline ? styles.buttonTextOutline : null]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, value, onChangeText, keyboardType, placeholder }: { label: string; value: string; onChangeText: (next: string) => void; keyboardType?: 'default' | 'number-pad'; placeholder?: string }) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.field}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType || 'default'}
        placeholder={placeholder}
        placeholderTextColor={quiet}
        autoCapitalize="none"
      />
    </View>
  );
}

export function ChipGroup({ label, options, value, onChange }: { label: string; options: { id: string; name: string }[]; value: string; onChange: (next: string) => void }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((option) => {
          const on = option.id === value;
          return (
            <Pressable key={option.id} onPress={() => onChange(on ? '' : option.id)} style={[styles.chip, on ? styles.chipOn : null]}>
              <Text style={[styles.chipText, on ? styles.chipTextOn : null]}>{option.name}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ListRow({ title, sub, warn, action, onPress, disabled }: { title: string; sub?: string; warn?: boolean; action?: string; onPress?: () => void; disabled?: boolean }) {
  const body = (
    <>
      <View style={[styles.dot, warn ? styles.dotBad : null]} />
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle}>{title}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      {action ? <Text style={[styles.rowAction, warn ? styles.rowActionBad : null]}>{action}</Text> : null}
    </>
  );
  if (!onPress) {
    return <View style={styles.row}>{body}</View>;
  }
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null, disabled ? { opacity: 0.5 } : null]}>
      {body}
    </Pressable>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {hint ? <Text style={styles.emptyHint}>{hint}</Text> : null}
    </View>
  );
}

export function List({ children }: { children: ReactNode }) {
  return <View style={styles.list}>{children}</View>;
}

// The five places the app goes, named the same way on every screen (rule 4), so a jump
// never depends on which screen the reader happened to be on.
export function TabBar({ current, go }: { current: string; go: (path: string) => void }) {
  const tabs = [
    { path: '/fridge', label: 'Tủ' },
    { path: '/food', label: 'Thực phẩm' },
    { path: '/meal', label: 'Bữa ăn' },
    { path: '/shopping', label: 'Đi chợ' },
    { path: '/stats', label: 'Thống kê' },
  ];
  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => (
        <Pressable key={tab.path} onPress={() => go(tab.path)} style={({ pressed }) => [styles.tab, pressed ? styles.buttonPressed : null]}>
          <Text style={[styles.tabText, tab.path === current ? styles.tabTextOn : null]}>{tab.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
