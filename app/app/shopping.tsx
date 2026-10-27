// Shopping screen (Hùng): the group's list for today and the one action each row owns —
// take a task, or mark it bought. Adding a task is its own screen.
// The claim and the bought mark travel through the queue when the device cannot reach the
// server, so the bought path still runs once when the queue is replayed (D21, D38).
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { notice, request, type Note } from '../src/api/client';
import { useSession } from '../src/session';
import { writeOrQueue } from '../src/offline/write';
import { ShoppingScreen, loadFoods, loadLists, loadTasks, namesOf } from '../src/features/screens';
import { Bar, Button, Field, Notice, Screen, TabBar, styles } from '../src/features/ui';

export default function ShoppingRoute() {
  const session = useSession();
  const [lists, setLists] = useState<Record<string, unknown>[]>([]);
  const [tasks, setTasks] = useState<Record<string, unknown>[]>([]);
  const [foodNames, setFoodNames] = useState<Record<string, string>>({});
  const [listName, setListName] = useState('');
  const [note, setNote] = useState<Note>({ text: '', bad: false });

  const listId = lists.length ? String(lists[0]._id) : '';
  const userId = session.user ? String(session.user.id || '') : '';
  const role = session.user ? String(session.user.group_leader_id === userId ? 'group_leader' : session.user.role || 'user') : 'user';

  async function reload() {
    const [foods, listsOut] = await Promise.all([
      request('/food/', { token: session.token }),
      loadLists({ token: session.token, offline: false, dispatch: (rows) => setLists(rows as Record<string, unknown>[]) }),
    ]);
    setFoodNames(namesOf(foods, 'foods'));
    setNote(notice(listsOut));
  }

  useEffect(() => {
    if (session.token) reload();
  }, [session.token, session.base]);

  useEffect(() => {
    if (!listId) {
      setTasks([]);
      return;
    }
    loadTasks({ token: session.token, offline: false, dispatch: (rows) => setTasks(rows as Record<string, unknown>[]) }, listId);
  }, [listId, session.token, session.base]);

  async function createList() {
    const out = await request('/shopping/', { method: 'post', body: { name: listName }, token: session.token });
    setNote(notice(out));
    if (out.code === '00249') reload();
  }

  async function claim(taskId: string) {
    const out = await request('/shopping/claim/', { method: 'post', body: { taskId }, token: session.token });
    setNote(notice(out));
    if (out.code === '00389') loadTasks({ token: session.token, offline: false, dispatch: (rows) => setTasks(rows as Record<string, unknown>[]) }, listId);
  }

  async function bought(taskId: string) {
    const out = await writeOrQueue(session, '/shopping/bought/', { taskId }, { type: 'task_bought', payload: { taskId } });
    setNote(out.queued ? { text: 'Đã xếp vào hàng đợi để gửi sau', bad: false } : notice(out));
    if (out.code === '00390') loadTasks({ token: session.token, offline: false, dispatch: (rows) => setTasks(rows as Record<string, unknown>[]) }, listId);
  }

  const listLabel = lists.length ? String(lists[0].name || 'danh sách hiện có') : 'chưa có danh sách';

  return (
    <View style={styles.shell}>
      <Bar title="Đi chợ" sub={listLabel} />
      <Screen>
        <Notice note={note} />
        <ShoppingScreen items={tasks} names={foodNames} userId={userId} role={role} onClaim={claim} onBought={bought} />
        <Field label="Tên danh sách mới" value={listName} onChangeText={setListName} placeholder="ví dụ: chợ hôm nay" />
        <Button label="Tạo danh sách" onPress={createList} />
        <Button label="Thêm món vào danh sách" onPress={() => router.push('/shopping-add')} outline />
        <Button label="Đọc lại" onPress={reload} outline />
      </Screen>
      <TabBar current="/shopping" go={(path) => router.push(path)} />
    </View>
  );
}
