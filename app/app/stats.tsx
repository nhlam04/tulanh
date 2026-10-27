// Statistics screen (Hùng): what the group bought, and why the tủ emptied.
// The report arrives keyed by name, so the screen reads the keys it was given.
import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { router } from 'expo-router';
import { messageFor } from '../src/api/client';
import { useSession } from '../src/session';
import { loadConsumption, loadStats } from '../src/features/screens';
import { Button, styles } from '../src/features/ui';

type Group = { name: string; rows: unknown[] };

export default function StatsRoute() {
  const session = useSession();
  const [bought, setBought] = useState<Group[]>([]);
  const [used, setUsed] = useState<Group[]>([]);
  const [message, setMessage] = useState('Tủ lành của bạn');

  async function reload() {
    const purchases = await loadStats({ token: session.token, offline: false, dispatch: (rows) => setBought(rows as Group[]) });
    const consumption = await loadConsumption({ token: session.token, offline: false, dispatch: (rows) => setUsed(rows as Group[]) });
    setMessage(`${purchases.code} — ${purchases.message || messageFor(purchases.code)} · ${consumption.code}`);
  }

  useEffect(() => {
    if (session.token) reload();
  }, [session.token, session.base]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ gap: 10 }}>
      <Text style={styles.title}>Thống kê</Text>
      <Text>{message}</Text>
      <Text style={styles.muted}>đã mua theo nhóm thực phẩm</Text>
      {bought.map((group) => (
        <Text key={`b-${group.name}`}>{group.name}: {group.rows.length}</Text>
      ))}
      <Text style={styles.muted}>đã dùng theo lý do</Text>
      {used.map((group) => (
        <Text key={`u-${group.name}`}>{group.name}: {group.rows.length}</Text>
      ))}
      <Button label="Đọc lại" onPress={reload} />
      <Button label="Thông báo" onPress={() => router.push('/push')} />
    </ScrollView>
  );
}
