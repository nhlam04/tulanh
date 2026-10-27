// Food screen (Hùng): what the group keeps in its catalog, and the search over it.
// One job (rule 8), so the new-food form lives on its own screen.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { notice, request, type Note } from '../src/api/client';
import { useSession } from '../src/session';
import { FoodScreen, loadFoods, namesOf, searchFoods } from '../src/features/screens';
import { Bar, Button, Empty, Field, Notice, Screen, TabBar, styles } from '../src/features/ui';

export default function FoodRoute() {
  const session = useSession();
  const [foods, setFoods] = useState<Record<string, unknown>[]>([]);
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [units, setUnits] = useState<Record<string, string>>({});
  const [keyword, setKeyword] = useState('');
  const [note, setNote] = useState<Note>({ text: '', bad: false });

  async function reload() {
    const [foodsOut, cats, un] = await Promise.all([
      loadFoods({ token: session.token, offline: false, dispatch: (rows) => setFoods(rows as Record<string, unknown>[]) }),
      request('/food/category/', { token: session.token }),
      request('/food/unit/', { token: session.token }),
    ]);
    setCategories(namesOf(cats, 'categories'));
    setUnits(namesOf(un, 'units'));
    setNote(notice(foodsOut));
  }

  useEffect(() => {
    if (session.token) reload();
  }, [session.token, session.base]);

  async function search() {
    const out = await searchFoods({ token: session.token, offline: false, dispatch: (rows) => setFoods(rows as Record<string, unknown>[]) }, keyword);
    setNote(notice(out));
  }

  const noGroup = Boolean(session.token) && !session.user?.group_id;

  return (
    <View style={styles.shell}>
      <Bar title="Thực phẩm" sub={foods.length ? `${foods.length} thực phẩm của nhóm` : 'danh mục của nhóm'} />
      <Screen>
        <Notice note={note} />
        {noGroup ? (
          <>
            <Empty title="Nhóm chưa có thực phẩm nào" hint="Tạo nhóm gia đình trước, rồi thêm thực phẩm vào danh mục." />
            <Button label="Tạo nhóm gia đình" onPress={() => router.push('/')} />
          </>
        ) : (
          <FoodScreen items={foods} categories={categories} units={units} />
        )}
        <Field label="Từ khóa tìm" value={keyword} onChangeText={setKeyword} placeholder="ví dụ: thịt bò" />
        <Button label="Tìm" onPress={search} />
        <Button label="Hiện tất cả" onPress={reload} outline />
        <Button label="Thêm thực phẩm" onPress={() => router.push('/food-add')} outline />
      </Screen>
      <TabBar current="/food" go={(path) => router.push(path)} />
    </View>
  );
}
