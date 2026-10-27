// Statistics screen (Hùng): what the group bought, and why the tủ emptied.
// The report arrives keyed by name, so the screen reads the keys it was given.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { notice, type Note } from '../src/api/client';
import { useSession } from '../src/session';
import { ReportScreen, loadConsumption, loadStats, type ReportGroup } from '../src/features/screens';
import { Bar, Button, Notice, Screen, TabBar, styles } from '../src/features/ui';

export default function StatsRoute() {
  const session = useSession();
  const [bought, setBought] = useState<ReportGroup[]>([]);
  const [used, setUsed] = useState<ReportGroup[]>([]);
  const [note, setNote] = useState<Note>({ text: '', bad: false });

  async function reload() {
    const [purchases, consumption] = await Promise.all([
      loadStats({ token: session.token, offline: false, dispatch: (rows) => setBought(rows as ReportGroup[]) }),
      loadConsumption({ token: session.token, offline: false, dispatch: (rows) => setUsed(rows as ReportGroup[]) }),
    ]);
    const failed = [purchases, consumption].find((out) => out.status === 0 || out.status >= 400);
    setNote(notice(failed || purchases));
  }

  useEffect(() => {
    if (session.token) reload();
  }, [session.token, session.base]);

  return (
    <View style={styles.shell}>
      <Bar title="Thống kê" sub="mua và dùng trong nhóm" />
      <Screen>
        <Notice note={note} />
        <ReportScreen groups={bought} label="Đã mua" />
        <ReportScreen groups={used} label="Đã dùng" />
        <Button label="Đọc lại" onPress={reload} outline />
        <Button label="Thông báo" onPress={() => router.push('/push')} outline />
      </Screen>
      <TabBar current="/stats" go={(path) => router.push(path)} />
    </View>
  );
}
