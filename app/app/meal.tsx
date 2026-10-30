// Meal screen (Hùng): the meals the tủ lành can cook now, and the list for a planned date.
// The planned day is tapped from the calendar the system draws (rules 5 and 6) and reads
// DD-MM-YYYY; the request keeps the shape the server reads.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { failure, makeNote, request, type Note } from '../src/api/client';
import { useSession } from '../src/session';
import { isoOfDay } from '../src/features/days';
import { MealScreen, loadMeals, namesOf } from '../src/features/screens';
import { Bar, Button, DateField, Notice, Screen, TabBar, styles } from '../src/features/ui';

export default function MealRoute() {
  const session = useSession();
  const [meals, setMeals] = useState<Record<string, unknown>[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [date, setDate] = useState(isoOfDay(new Date()));
  const [note, setNote] = useState<Note>(makeNote('', false));

  async function reload() {
    const [foods, out] = await Promise.all([
      request('/food/', { token: session.token }),
      loadMeals({ token: session.token, offline: session.offline, dispatch: (rows) => setMeals(rows as Record<string, unknown>[]) }),
    ]);
    setNames(namesOf(foods, 'foods'));
    setNote(failure(out));
  }

  useEffect(() => {
    if (session.token) reload();
  }, [session.token, session.base]);

  async function generate() {
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
        <DateField label="Ngày dự kiến" value={date} onChange={setDate} />
        <Button label="Lập danh sách mua" onPress={generate} />
        {/* Scheduling is the spec's "Lên lịch bữa ăn", one job per screen (rule 8), so it
            gets its own screen reached from here, like the fridge reaches its add screen. */}
        <Button label="Kế hoạch bữa ăn" onPress={() => router.push('/meal-plan')} outline />
        {/* Recipes feed the suggestions above, so their home is one tap away on the same tab. */}
        <Button label="Công thức" onPress={() => router.push('/recipe')} outline />
        <Button label="Đọc lại gợi ý" onPress={reload} outline />
      </Screen>
      <TabBar current="/meal" go={(path) => router.push(path)} />
    </View>
  );
}
