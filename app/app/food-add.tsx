// New food screen (Hùng): the one write the catalog owns. The group and the unit are
// tapped from the catalog the server sent (rules 5 and 6), so the screen cannot offer a
// name the server would refuse.
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { failure, makeNote, request, type Note } from '../src/api/client';
import { useSession } from '../src/session';
import { namesOf } from '../src/features/screens';
import { Bar, Button, ChipGroup, Field, Notice, Screen } from '../src/features/ui';

type Option = { id: string; name: string };

function options(map: Record<string, string>): Option[] {
  return Object.entries(map).map(([id, name]) => ({ id, name }));
}

export default function FoodAddRoute() {
  const session = useSession();
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [units, setUnits] = useState<Record<string, string>>({});
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [note, setNote] = useState<Note>(makeNote('', false));

  useEffect(() => {
    if (!session.token) return;
    (async () => {
      const [cats, un] = await Promise.all([request('/food/category/', { token: session.token }), request('/food/unit/', { token: session.token })]);
      setCategories(namesOf(cats, 'categories'));
      setUnits(namesOf(un, 'units'));
    })();
  }, [session.token, session.base]);

  async function save() {
    const out = await request('/food/', {
      method: 'post',
      body: { name, categoryName: categories[categoryId] || '', unitName: units[unitId] || '' },
      token: session.token,
    });
    setNote(failure(out));
    if (out.code === '00160') router.push('/food');
  }

  return (
    <>
      <Bar title="Thêm thực phẩm" sub="thuộc danh mục của nhóm" />
      <Screen>
        <Notice note={note} />
        <Field label="Tên thực phẩm" value={name} onChangeText={setName} placeholder="ví dụ: cà chua" />
        <ChipGroup label="Nhóm thực phẩm" options={options(categories)} value={categoryId} onChange={setCategoryId} />
        <ChipGroup label="Đơn vị" options={options(units)} value={unitId} onChange={setUnitId} />
        <Button label="Lưu thực phẩm" onPress={save} />
        <Button label="Về danh sách thực phẩm" onPress={() => router.push('/food')} outline />
      </Screen>
    </>
  );
}
