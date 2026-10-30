// Meal plan screen (Hùng): what the group will eat on one day, slot by slot. The spec
// asks for planning sáng, trưa, tối by day (Chức năng chính: "Lên lịch bữa ăn"), and the
// server keeps one food per slot. The slot is picked by tapping its row (rule 5: no free
// text), the dish from the catalog chips (rules 5 and 6), and a save that already has a
// dish changes it instead of adding a second plan for the same slot. The day is tapped from the
// calendar the system draws (rules 5 and 6) and reads DD-MM-YYYY, and the plans come back with it.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { failure, makeNote, request, type Note } from '../src/api/client';
import { useSession } from '../src/session';
import { isoOfDay } from '../src/features/days';
import { loadPlans, namesOf } from '../src/features/screens';
import { Bar, Button, ChipGroup, DateField, List, ListRow, Notice, Screen, styles } from '../src/features/ui';

const SLOTS = [
  { id: 'sáng', label: 'Sáng' },
  { id: 'trưa', label: 'Trưa' },
  { id: 'tối', label: 'Tối' },
];

export default function MealPlanRoute() {
  const session = useSession();
  const [date, setDate] = useState(isoOfDay(new Date()));
  const [plans, setPlans] = useState<Record<string, unknown>[]>([]);
  const [foods, setFoods] = useState<Record<string, string>>({});
  const [slot, setSlot] = useState('');
  const [foodId, setFoodId] = useState('');
  const [note, setNote] = useState<Note>(makeNote('', false));

  async function reload() {
    const [foodsOut] = await Promise.all([
      request('/food/', { token: session.token }),
      loadPlans({ token: session.token, offline: session.offline, dispatch: (rows) => setPlans(rows as Record<string, unknown>[]) }, date),
    ]);
    setFoods(namesOf(foodsOut, 'foods'));
  }

  // The day is the only way in; when it changes, the day's plans come back with it.
  useEffect(() => {
    if (session.token) reload();
  }, [session.token, session.base, date]);

  // Picking a slot also preselects the dish it already plans, so a change is one tap away.
  function pickSlot(slotId: string) {
    setSlot(slotId);
    const plan = plans.find((row) => row.meal === slotId);
    const fid = plan ? String(plan.food_id) : '';
    setFoodId(fid && foods[fid] ? fid : '');
  }

  function planFor(slotId: string) {
    return plans.find((row) => row.meal === slotId);
  }

  async function save() {
    if (!slot) {
      setNote(makeNote('Chạm vào bữa cần đặt trước', true));
      return;
    }
    if (!foodId) {
      setNote(makeNote('Chưa chọn món nào cho bữa này', true));
      return;
    }
    const existing = planFor(slot);
    const out = existing
      ? await request('/meal/', { method: 'put', body: { planId: existing._id, newFoodName: foods[foodId] }, token: session.token })
      : await request('/meal/', { method: 'post', body: { foodName: foods[foodId], timestamp: date, name: slot }, token: session.token });
    setNote(failure(out));
    if (out.code === '00322' || out.code === '00344') await reload();
  }

  async function remove() {
    const existing = slot ? planFor(slot) : undefined;
    if (!existing) return;
    const out = await request('/meal/', { method: 'delete', body: { planId: existing._id }, token: session.token });
    setNote(failure(out));
    if (out.code === '00330') {
      setSlot('');
      setFoodId('');
      await reload();
    }
  }

  const options = Object.entries(foods).map(([id, name]) => ({ id, name }));
  const selectedPlan = slot ? planFor(slot) : undefined;

  return (
    <View style={styles.shell}>
      <Bar title="Kế hoạch bữa ăn" sub="đặt món cho một ngày" />
      <Screen>
        <Notice note={note} />
        <DateField label="Ngày" value={date} onChange={setDate} />
        <List>
          {SLOTS.map((row) => {
            const plan = planFor(row.id);
            const fid = plan ? String(plan.food_id) : '';
            const name = plan && foods[fid] ? foods[fid] : 'chưa đặt';
            return (
              <ListRow
                key={row.id}
                title={row.label}
                sub={name}
                action={plan ? 'Đổi' : 'Đặt'}
                onPress={() => pickSlot(row.id)}
              />
            );
          })}
        </List>
        {slot ? <ChipGroup label="Món cho bữa đã chọn" options={options} value={foodId} onChange={setFoodId} /> : null}
        <Button label="Lưu vào kế hoạch" onPress={save} />
        {selectedPlan ? <Button label="Xóa bữa này" onPress={remove} outline /> : null}
        <Button label="Về bữa ăn" onPress={() => router.push('/meal')} outline />
      </Screen>
    </View>
  );
}
