// Fridge screen (Hùng): what is in the tủ lành and what is due. The tap target of the
// notice is this screen (D36), so it is the screen the app opens first.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { notice, request, type Note } from '../src/api/client';
import { useSession } from '../src/session';
import { pendingOps } from '../src/offline/queue';
import { sendQueue } from '../src/offline/send';
import { writeOrQueue } from '../src/offline/write';
import { FridgeScreen, loadFoods, loadFridge, namesOf } from '../src/features/screens';
import { Bar, Button, Notice, Screen, TabBar, styles } from '../src/features/ui';

export default function FridgeRoute() {
  const session = useSession();
  const [lots, setLots] = useState<Record<string, unknown>[]>([]);
  const [foodNames, setFoodNames] = useState<Record<string, string>>({});
  const [unitNames, setUnitNames] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Note>({ text: '', bad: false });

  async function reload() {
    const [foods, units, fridge] = await Promise.all([
      loadFoods({ token: session.token, offline: false, dispatch: () => {} }),
      request('/food/unit/', { token: session.token }),
      loadFridge({ token: session.token, offline: false, dispatch: () => {} }),
    ]);
    setFoodNames(namesOf(foods, 'foods'));
    setUnitNames(namesOf(units, 'units'));
    setLots((fridge.data as { lots: Record<string, unknown>[] })?.lots || []);
    setNote(notice(fridge));
  }

  useEffect(() => {
    if (session.token) reload();
  }, [session.token, session.base]);

  async function useOne(lotId: string) {
    const out = await writeOrQueue(session, '/consumption/', { lotId, quantity: 1, reason: 'cook' }, {
      type: 'consumption', payload: { lotId, quantity: 1, reason: 'cook' },
    });
    setNote(out.queued ? { text: 'Đã xếp vào hàng đợi để gửi sau', bad: false } : notice(out));
    if (out.code === '00387') reload();
  }

  async function flush() {
    const out = await sendQueue(session.db, session.token, new Date().toISOString());
    setNote({ text: out.sent ? `Đã gửi ${out.sent} lượt viết` : 'Hàng đợi chưa có gì để gửi', bad: false });
    reload();
  }

  const queued = pendingOps(session.db).length;

  return (
    <View style={styles.shell}>
      <Bar title="Tủ lành" sub={`${session.offline ? 'ngoại tuyến' : 'trực tuyến'} · hàng đợi ${queued}`} />
      <Screen>
        <Notice note={note} />
        <FridgeScreen items={lots} names={foodNames} units={unitNames} onUse={session.token ? useOne : undefined} />
        <Button label="Thêm vào tủ" onPress={() => router.push('/fridge-add')} />
        <Button label="Đồng bộ lại" onPress={reload} outline />
        {queued ? <Button label="Gửi hàng đợi" onPress={flush} outline /> : null}
        <Button label={session.offline ? 'Bật mạng' : 'Tắt mạng'} onPress={() => session.setOffline(!session.offline)} outline />
      </Screen>
      <TabBar current="/fridge" go={(path) => router.push(path)} />
    </View>
  );
}
