// Edit task screen (Hùng): the spec says the list must be easy to edit, and the row's
// quantity is the field that changes between shopping trips. The row offers one action —
// pick it for editing (rule 8) — and the action only shows on the row the caller may change:
// the person who added the task, or the group leader (rule C). The save is still a PUT the
// server checks, so the hidden action is a display rule, not safety, and the refusal stays a
// sentence, not a guess the client made (D28, rule 9).
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { failure, request, type Note } from '../src/api/client';
import { useSession } from '../src/session';
import { namesOf } from '../src/features/screens';
import { canEdit } from '../src/features/permission';
import { Bar, Button, Empty, Field, List, ListRow, Notice, Screen, styles } from '../src/features/ui';

export default function ShoppingEditRoute() {
  const session = useSession();
  const [tasks, setTasks] = useState<Record<string, unknown>[]>([]);
  const [foods, setFoods] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState<Note>({ text: '', bad: false });
  const userId = session.user ? String(session.user.id || '') : '';
  const role = session.user ? String(session.user.role || '') : '';

  useEffect(() => {
    if (!session.token) return;
    (async () => {
      const [foodOut, listsOut] = await Promise.all([
        request('/food/', { token: session.token }),
        request('/shopping/', { token: session.token }),
      ]);
      setFoods(namesOf(foodOut, 'foods'));
      const listId = (listsOut.data as { lists?: Record<string, unknown>[] } | null)?.lists?.[0]?._id;
      if (!listId) {
        setTasks([]);
        return;
      }
      const out = await request(`/shopping/task/?listId=${encodeURIComponent(String(listId))}`, { token: session.token });
      setTasks((out.data as { tasks?: Record<string, unknown>[] })?.tasks || []);
    })();
  }, [session.token, session.base]);

  function pick(taskId: string) {
    const task = tasks.find((row) => String(row._id) === taskId);
    setSelectedId(taskId);
    setQuantity(task ? String(task.quantity) : '');
  }

  async function save() {
    if (!selectedId) {
      setNote({ text: 'Chạm vào món cần sửa trước', bad: true });
      return;
    }
    const count = Number(quantity);
    if (!Number.isFinite(count) || count <= 0) {
      setNote({ text: 'Số lượng phải là một số lớn hơn 0', bad: true });
      return;
    }
    const out = await request('/shopping/task/', { method: 'put', body: { taskId: selectedId, newQuantity: count }, token: session.token });
    setNote(failure(out));
    if (out.code === '00312') {
      setSelectedId('');
      setQuantity('');
      router.push('/shopping');
    }
  }

  return (
    <View style={styles.shell}>
      <Bar title="Sửa món trong danh sách" sub="đổi số lượng trước khi đi chợ" />
      <Screen>
        <Notice note={note} />
        {tasks.length ? (
          <List>
            {tasks.map((task) => {
              const id = String(task._id);
              const allowed = canEdit(task, userId, role);
              return (
                <ListRow
                  key={id}
                  title={foods[String(task.food_id)] || 'món trong danh sách'}
                  sub={`số lượng ${String(task.quantity)}${task.bought_at ? ' · đã mua' : ''}${allowed ? '' : ' · do người thêm món sửa'}`}
                  action={id === selectedId ? 'đang sửa' : allowed ? 'Sửa' : undefined}
                  onPress={!allowed || task.bought_at ? undefined : () => pick(id)}
                  disabled={!allowed || Boolean(task.bought_at)}
                />
              );
            })}
          </List>
        ) : (
          <Empty title="Danh sách chưa có món nào" hint="Thêm món vào danh sách trước, rồi quay lại sửa." />
        )}
        {selectedId ? (
          <>
            <Field label="Số lượng mới" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" />
            <Button label="Lưu thay đổi" onPress={save} />
          </>
        ) : null}
        <Button label="Về danh sách mua" onPress={() => router.push('/shopping')} outline />
      </Screen>
    </View>
  );
}
