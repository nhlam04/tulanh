// Fridge screen (Hùng): what is in the tủ lành, what goes in, what went out.
// The tap target of the notice is this screen (D36), so it is the screen the app opens first.
import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { router } from 'expo-router';
import { request, messageFor } from '../src/api/client';
import { useSession } from '../src/session';
import { pendingOps } from '../src/offline/queue';
import { sendQueue } from '../src/offline/send';
import { writeOrQueue } from '../src/offline/write';
import { FridgeScreen, loadFoods, loadFridge } from '../src/features/screens';
import { Button, Field, styles } from '../src/features/ui';

export default function FridgeRoute() {
  const session = useSession();
  const [lots, setLots] = useState<Record<string, unknown>[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [foodName, setFoodName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [useUntil, setUseUntil] = useState('');
  const [message, setMessage] = useState('Tủ lành của bạn');

  async function reload() {
    const foods = await loadFoods({ token: session.token, offline: false, dispatch: () => {} });
    const rows = (foods.data as { foods: Record<string, unknown>[] })?.foods || [];
    setNames(Object.fromEntries(rows.map((row) => [String(row._id), String(row.name)])));
    const fridge = await loadFridge({ token: session.token, offline: false, dispatch: () => {} });
    setLots((fridge.data as { lots: Record<string, unknown>[] })?.lots || []);
    setMessage(`${fridge.code} — ${fridge.message}`);
  }

  useEffect(() => {
    if (session.token) reload();
  }, [session.token, session.base]);

  function show(out: { code: string; message?: string }) {
    setMessage(`${out.code} — ${out.message || messageFor(out.code)}`);
  }

  async function addLot() {
    const food = Object.entries(names).find(([, name]) => name === foodName);
    if (!food) {
      setMessage('Không có thực phẩm này trong nhóm');
      return;
    }
    const out = await request('/fridge/', {
      method: 'post',
      body: { foodId: food[0], quantity: Number(quantity), useUntil },
      token: session.token,
    });
    show(out);
    if (out.code === '00202') reload();
  }

  async function useOne(lotId: string) {
    const out = await writeOrQueue(session, '/consumption/', { lotId, quantity: 1, reason: 'cook' }, {
      type: 'consumption', payload: { lotId, quantity: 1, reason: 'cook' },
    });
    setMessage(out.queued ? 'Đã xếp vào hàng đợi để gửi sau' : `${out.code} — ${out.message}`);
    if (out.code === '00387') reload();
  }

  async function flush() {
    const out = await sendQueue(session.db, session.token, new Date().toISOString());
    setMessage(out.sent ? `Đã gửi ${out.sent} lượt viết` : 'Hàng đợi chưa có gì để gửi');
    reload();
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ gap: 10 }}>
      <Text style={styles.title}>Tủ lành của bạn</Text>
      <Text>{message}</Text>
      <Text style={styles.muted}>
        {session.offline ? 'đang ngoại tuyến' : 'đang trực tuyến'} · hàng đợi {pendingOps(session.db).length}
      </Text>
      <FridgeScreen items={lots} names={names} message="" onUse={useOne} />
      <Button label={session.offline ? 'Bật mạng' : 'Tắt mạng'} onPress={() => session.setOffline(!session.offline)} />
      <Button label="Gửi hàng đợi" onPress={flush} />
      <Button label="Đồng bộ lại" onPress={reload} />
      <Field label="Tên thực phẩm" value={foodName} onChangeText={setFoodName} />
      <Field label="Số lượng" value={quantity} onChangeText={setQuantity} />
      <Field label="Ngày dùng đến (YYYY-MM-DD)" value={useUntil} onChangeText={setUseUntil} />
      <Button label="Thêm vào tủ" onPress={addLot} />
      <Button label="Màn hình thực phẩm" onPress={() => router.push('/food')} />
    </ScrollView>
  );
}
