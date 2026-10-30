// New lot screen (Hùng): what went into the tủ, where it sits, and until when to use it.
// The food is tapped from the group's catalog (rules 5 and 6). The spec asks for the
// storage place in the fridge, so it is tapped from the places a fridge actually has —
// the words of the real world (rule 2), not a typed string. The date stays typed in
// YYYY-MM-DD: a date widget needs a native dependency and a new development build, so it
// is the next iteration, and until then the field says its own shape and refuses a value
// that cannot be read.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { failure, makeNote, request, type Note } from '../src/api/client';
import { useSession } from '../src/session';
import { namesOf } from '../src/features/screens';
import { Bar, Button, ChipGroup, Field, Notice, Screen, styles } from '../src/features/ui';

const PLACES = ['ngăn đá', 'ngăn mát', 'ngăn rau', 'cửa tủ'];

export default function FridgeAddRoute() {
  const session = useSession();
  const [foods, setFoods] = useState<Record<string, string>>({});
  const [foodId, setFoodId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [location, setLocation] = useState('');
  const [useUntil, setUseUntil] = useState('');
  const [note, setNote] = useState<Note>(makeNote('', false));

  useEffect(() => {
    if (!session.token) return;
    request('/food/', { token: session.token }).then((out) => setFoods(namesOf(out, 'foods')));
  }, [session.token, session.base]);

  async function save() {
    if (!foodId) {
      setNote(makeNote('Chưa chọn thực phẩm nào', true));
      return;
    }
    const count = Number(quantity);
    if (!Number.isFinite(count) || count <= 0) {
      setNote(makeNote('Số lượng phải là một số lớn hơn 0', true));
      return;
    }
    if (!location) {
      setNote(makeNote('Chưa chọn nơi để trong tủ', true));
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(useUntil)) {
      setNote(makeNote('Ngày dùng đến phải viết dạng YYYY-MM-DD', true));
      return;
    }
    const out = await request('/fridge/', { method: 'post', body: { foodId, quantity: count, location, useUntil }, token: session.token });
    setNote(failure(out));
    if (out.code === '00202') router.push('/fridge');
  }

  const options = Object.entries(foods).map(([id, name]) => ({ id, name }));
  const places = PLACES.map((place) => ({ id: place, name: place }));

  return (
    <View style={styles.shell}>
      <Bar title="Thêm vào tủ" sub="thực phẩm đã mua" />
      <Screen>
        <Notice note={note} />
        <ChipGroup label="Thực phẩm" options={options} value={foodId} onChange={setFoodId} />
        <ChipGroup label="Để ở đâu trong tủ" options={places} value={location} onChange={setLocation} />
        <Field label="Số lượng" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" />
        <Field label="Ngày dùng đến" value={useUntil} onChangeText={setUseUntil} placeholder="YYYY-MM-DD" />
        <Button label="Lưu vào tủ" onPress={save} />
        <Button label="Về tủ" onPress={() => router.push('/fridge')} outline />
      </Screen>
    </View>
  );
}
