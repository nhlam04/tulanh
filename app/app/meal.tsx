// Meal screen (Hùng): the meals the tủ lành can cook now, and the list for a planned date.
import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { router } from 'expo-router';
import { request, messageFor } from '../src/api/client';
import { useSession } from '../src/session';
import { loadMeals } from '../src/features/screens';
import { Button, Field, styles } from '../src/features/ui';

export default function MealRoute() {
  const session = useSession();
  const [meals, setMeals] = useState<Record<string, unknown>[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [message, setMessage] = useState('Tủ lành của bạn');

  async function reload() {
    const foods = await request('/food/', { token: session.token });
    const rows = (foods.data as { foods: Record<string, unknown>[] })?.foods || [];
    setNames(Object.fromEntries(rows.map((row) => [String(row._id), String(row.name)])));
    const out = await loadMeals({ token: session.token, offline: false, dispatch: (rows) => setMeals(rows as Record<string, unknown>[]) });
    setMessage(`${out.code} — ${out.message || messageFor(out.code)}`);
  }

  useEffect(() => {
    if (session.token) reload();
  }, [session.token, session.base]);

  async function generate() {
    const out = await request('/meal/generate-list/', { method: 'post', body: { date }, token: session.token });
    setMessage(`${out.code} — ${out.message || messageFor(out.code)}`);
    if (out.code === '00393') router.push('/shopping');
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ gap: 10 }}>
      <Text style={styles.title}>Bữa ăn từ tủ lành</Text>
      <Text>{message}</Text>
      {meals.map((meal) => (
        <Text key={String(meal.recipe_id)}>
          {String(meal.name)} — {(meal.ingredients as string[])?.map((id) => names[id] || id).join(', ')}
        </Text>
      ))}
      <Field label="Ngày dự kiến (YYYY-MM-DD)" value={date} onChangeText={setDate} />
      <Button label="Lập danh sách mua" onPress={generate} />
      <Button label="Xem thống kê" onPress={() => router.push('/stats')} />
    </ScrollView>
  );
}
