// New task screen (Hùng): one item onto the group's list. The food is tapped from the
// catalog; the buyer stays a username, because the member list is not on this device yet
// and an empty value means the writer takes the task themselves.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { notice, request, type Note } from '../src/api/client';
import { useSession } from '../src/session';
import { writeOrQueue } from '../src/offline/write';
import { loadLists, namesOf } from '../src/features/screens';
import { Bar, Button, ChipGroup, Field, Notice, Screen, styles } from '../src/features/ui';

export default function ShoppingAddRoute() {
  const session = useSession();
  const [foods, setFoods] = useState<Record<string, string>>({});
  const [listId, setListId] = useState('');
  const [foodId, setFoodId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [assignTo, setAssignTo] = useState('');
  const [note, setNote] = useState<Note>({ text: '', bad: false });

  useEffect(() => {
    if (!session.token) return;
    (async () => {
      const [foodOut, listsOut] = await Promise.all([request('/food/', { token: session.token }), request('/shopping/', { token: session.token })]);
      setFoods(namesOf(foodOut, 'foods'));
      const lists = (listsOut.data as { lists: Record<string, unknown>[] } | null)?.lists || [];
      setListId(lists.length ? String(lists[0]._id) : '');
    })();
  }, [session.token, session.base]);

  async function save() {
    if (!listId) {
      setNote({ text: 'Nhóm chưa có danh sách nào để thêm vào', bad: true });
      return;
    }
    if (!foodId) {
      setNote({ text: 'Chưa chọn thực phẩm nào', bad: true });
      return;
    }
    const count = Number(quantity);
    if (!Number.isFinite(count) || count <= 0) {
      setNote({ text: 'Số lượng phải là một số lớn hơn 0', bad: true });
      return;
    }
    const userId = session.user ? String(session.user.id || '') : '';
    const out = await writeOrQueue(session, '/shopping/task/', {
      listId,
      tasks: [{ foodId, quantity: count, buyerUsername: assignTo || userId }],
    }, { type: 'task_add', payload: { listId, foodId, quantity: count, buyerUsername: assignTo || userId } });
    setNote(out.queued ? { text: 'Đã xếp vào hàng đợi để gửi sau', bad: false } : notice(out));
    if (out.code === '00287') router.push('/shopping');
  }

  const options = Object.entries(foods).map(([id, name]) => ({ id, name }));

  return (
    <View style={styles.shell}>
      <Bar title="Thêm món vào danh sách" sub={listId ? 'danh sách hiện có' : 'chưa có danh sách'} />
      <Screen>
        <Notice note={note} />
        <ChipGroup label="Thực phẩm" options={options} value={foodId} onChange={setFoodId} />
        <Field label="Số lượng" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" />
        <Field label="Người mua (tên đăng nhập)" value={assignTo} onChangeText={setAssignTo} placeholder="để trống là bạn nhận" />
        <Button label="Lưu vào danh sách" onPress={save} />
        <Button label="Về danh sách mua" onPress={() => router.push('/shopping')} outline />
      </Screen>
    </View>
  );
}
