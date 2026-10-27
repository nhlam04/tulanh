// Meal screen (Hùng): the meals the tủ lành can cook now, and the list for a planned date.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { failure, request, type Note } from '../src/api/client';
import { useSession } from '../src/session';
import { MealScreen, loadMeals, namesOf } from '../src/features/screens';
import { Bar, Button, Field, Notice, Screen, TabBar, styles } from '../src/features/ui';

export default function MealRoute() {
  const session = useSession();
  const [meals, setMeals] = useState<Record<string, unknown>[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState<Note>({ text: '', bad: false });

  async function reload() {
    const [foods, out] = await Promise.all([
      request('/food/', { token: session.token }),
      loadMeals({ token: session.token, offline: false, dispatch: (rows) => setMeals(rows as Record<string, unknown>[]) }),
    ]);
    setNames(namesOf(foods, 'foods'));
    setNote(failure(out));
  }

  useEffect(() => {
    if (session.token) reload();
  }, [session.token, session.base]);

  async function generate() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setNote({ text: 'Ngày dự kiến phải viết dạng YYYY-MM-DD', bad: true });
      return;
    }
    const out = await request('/meal/generate-list/', { method: 'post', body: { date }, token: session.token });
    setNote(failure(out));
    if (out.code === '00393') router.push('/shopping');
  }

  return (
    <View style={styles.shell}>
      <Bar title="Bữa ăn" sub="gợi ý từ gì đang có trong tủ" />
      <Screen>
        <Notice note={note} />
        <MealScreen items={meals} names={names} />
        <Field label="Ngày dự kiến" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
        <Button label="Lập danh sách mua" onPress={generate} />
        <Button label="Đọc lại gợi ý" onPress={reload} outline />
      </Screen>
      <TabBar current="/meal" go={(path) => router.push(path)} />
    </View>
  );
}
