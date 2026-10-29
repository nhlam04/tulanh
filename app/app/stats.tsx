// Statistics screen (Hùng): what the group bought, and why the tủ emptied.
// The report arrives keyed by name, so the screen reads the keys it was given.
// The spec reads a report over a period, so the two day fields bound the answer;
// an empty field leaves that end open (rule 2: the screen says what it is counting).
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { failure, type Note } from '../src/api/client';
import { useSession } from '../src/session';
import { ReportScreen, loadConsumption, loadStats, type ReportGroup } from '../src/features/screens';
import { Bar, Button, Field, Notice, Screen, TabBar, styles } from '../src/features/ui';

export default function StatsRoute() {
  const session = useSession();
  const [bought, setBought] = useState<ReportGroup[]>([]);
  const [used, setUsed] = useState<ReportGroup[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [note, setNote] = useState<Note>({ text: '', bad: false });

  async function reload() {
    const [purchases, consumption] = await Promise.all([
      loadStats({ token: session.token, offline: false, dispatch: (rows) => setBought(rows as ReportGroup[]) }, from, to),
      loadConsumption({ token: session.token, offline: false, dispatch: (rows) => setUsed(rows as ReportGroup[]) }, from, to),
    ]);
    const failed = [purchases, consumption].find((out) => out.status === 0 || out.status >= 400);
    setNote(failure(failed || purchases));
  }

  useEffect(() => {
    if (session.token) reload();
  }, [session.token, session.base, from, to]);

  return (
    <View style={styles.shell}>
      <Bar title="Thống kê" sub="mua và dùng trong nhóm" />
      <Screen>
        <Notice note={note} />
        <Field label="Từ ngày" value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD, để trống là đầu" />
        <Field label="Đến ngày" value={to} onChangeText={setTo} placeholder="YYYY-MM-DD, để trống là đến nay" />
        <ReportScreen groups={bought} label="Đã mua" />
        <ReportScreen groups={used} label="Đã dùng" />
        <Button label="Đọc lại" onPress={reload} outline />
        <Button label="Thông báo" onPress={() => router.push('/push')} outline />
        {/* One way out of the account, on the screen that holds the group's numbers rather
            than on the tủ you use every day (rule 2: the person can leave at will). */}
        <Button
          label="Thoát đăng nhập"
          onPress={async () => {
            await session.signOut();
            router.replace('/');
          }}
          outline
        />
      </Screen>
      <TabBar current="/stats" go={(path) => router.push(path)} />
    </View>
  );
}
