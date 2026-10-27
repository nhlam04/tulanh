// Food screen (Hùng): the group's list of foods, the search, and the new food.
// Category and unit are typed as the names the server reads, so a wrong name answers the
// server's own message instead of a guess made here.
import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { router } from 'expo-router';
import { request, messageFor } from '../src/api/client';
import { useSession } from '../src/session';
import { FoodScreen, loadFoods, searchFoods } from '../src/features/screens';
import { Button, Field, styles } from '../src/features/ui';

export default function FoodRoute() {
  const session = useSession();
  const [foods, setFoods] = useState<Record<string, unknown>[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [units, setUnits] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [unitName, setUnitName] = useState('');
  const [keyword, setKeyword] = useState('');
  const [message, setMessage] = useState('Tủ lành của bạn');

  async function reload() {
    await loadFoods({ token: session.token, offline: false, dispatch: (rows) => setFoods(rows as Record<string, unknown>[]) });
    const cats = await request('/food/category/', { token: session.token });
    setCategories(((cats.data as { categories: Record<string, unknown>[] })?.categories || []).map((row) => String(row.name)));
    const un = await request('/food/unit/', { token: session.token });
    setUnits(((un.data as { units: Record<string, unknown>[] })?.units || []).map((row) => String(row.name)));
    setMessage(`${cats.code} — ${cats.message}`);
  }

  useEffect(() => {
    if (session.token) reload();
  }, [session.token, session.base]);

  async function create() {
    const out = await request('/food/', { method: 'post', body: { name, categoryName, unitName }, token: session.token });
    setMessage(`${out.code} — ${out.message || messageFor(out.code)}`);
    if (out.code === '00160') reload();
  }

  async function search() {
    const out = await searchFoods({ token: session.token, offline: false, dispatch: (rows) => setFoods(rows as Record<string, unknown>[]) }, keyword);
    setMessage(`${out.code} — ${out.message || messageFor(out.code)}`);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ gap: 10 }}>
      <Text style={styles.title}>Thực phẩm của nhóm</Text>
      <Text>{message}</Text>
      <Text style={styles.muted}>nhóm dùng: {categories.join(', ')} · {units.join(', ')}</Text>
      <FoodScreen items={foods} message="" />
      <Field label="Từ khóa tìm" value={keyword} onChangeText={setKeyword} />
      <Button label="Tìm" onPress={search} />
      <Button label="Hiện tất cả" onPress={reload} />
      <Field label="Tên thực phẩm" value={name} onChangeText={setName} />
      <Field label="Nhóm thực phẩm" value={categoryName} onChangeText={setCategoryName} />
      <Field label="Đơn vị" value={unitName} onChangeText={setUnitName} />
      <Button label="Thêm thực phẩm" onPress={create} />
      <Button label="Đi đến danh sách mua" onPress={() => router.push('/shopping')} />
    </ScrollView>
  );
}
