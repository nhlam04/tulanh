// Shopping screen (Hùng): the lists, the tasks, the claim, the bought mark.
// The claim and the bought mark travel through the queue when the device cannot reach the
// server, so the bought path still runs once when the queue is replayed (D21, D38).
import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { router } from 'expo-router';
import { request, messageFor } from '../src/api/client';
import { useSession } from '../src/session';
import { writeOrQueue } from '../src/offline/write';
import { canEdit } from '../src/features/permission';
import { ShoppingScreen, loadLists, loadTasks } from '../src/features/screens';
import { Button, Field, styles } from '../src/features/ui';

export default function ShoppingRoute() {
  const session = useSession();
  const [lists, setLists] = useState<Record<string, unknown>[]>([]);
  const [tasks, setTasks] = useState<Record<string, unknown>[]>([]);
  const [listName, setListName] = useState('');
  const [assignTo, setAssignTo] = useState('');
  const [foodName, setFoodName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [message, setMessage] = useState('Tủ lành của bạn');

  const listId = lists.length ? String(lists[0]._id) : '';
  const userId = session.user ? String(session.user.id || '') : '';
  const role = session.user ? String(session.user.group_leader_id === userId ? 'group_leader' : session.user.role || 'user') : 'user';

  async function reload() {
    await loadLists({ token: session.token, offline: false, dispatch: (rows) => setLists(rows as Record<string, unknown>[]) });
    if (listId) await loadTasks({ token: session.token, offline: false, dispatch: (rows) => setTasks(rows as Record<string, unknown>[]) }, listId);
    setMessage(listId ? 'Danh sách hiện có' : 'Nhóm chưa có danh sách mua');
  }

  useEffect(() => {
    if (session.token) reload();
  }, [session.token, session.base, lists.length]);

  function show(out: { code: string; message?: string }) {
    setMessage(`${out.code} — ${out.message || messageFor(out.code)}`);
  }

  async function createList() {
    const out = await request('/shopping/', { method: 'post', body: { name: listName, assignToUsername: assignTo }, token: session.token });
    show(out);
    if (out.code === '00249') reload();
  }

  async function addTask() {
    const foods = await request('/food/', { token: session.token });
    const rows = (foods.data as { foods: Record<string, unknown>[] })?.foods || [];
    const food = rows.find((row) => String(row.name) === foodName);
    if (!food) {
      setMessage('Không có thực phẩm này trong nhóm');
      return;
    }
    const out = await writeOrQueue(session, '/shopping/task/', { listId, tasks: [{ foodId: String(food._id), quantity: Number(quantity), buyerUsername: assignTo || userId }] }, {
      type: 'task_add', payload: { listId, foodId: String(food._id), quantity: Number(quantity), buyerUsername: assignTo || userId },
    });
    setMessage(out.queued ? 'Đã xếp vào hàng đợi để gửi sau' : `${out.code} — ${out.message}`);
    if (out.code === '00287') reload();
  }

  async function claim(taskId: string) {
    const out = await request('/shopping/claim/', { method: 'post', body: { taskId }, token: session.token });
    show(out);
    if (out.code === '00389') reload();
  }

  async function bought(taskId: string) {
    const out = await writeOrQueue(session, '/shopping/bought/', { taskId }, { type: 'task_bought', payload: { taskId } });
    setMessage(out.queued ? 'Đã xếp vào hàng đợi để gửi sau' : `${out.code} — ${out.message}`);
    if (out.code === '00390') reload();
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ gap: 10 }}>
      <Text style={styles.title}>Danh sách mua</Text>
      <Text>{message}</Text>
      <ShoppingScreen items={tasks} userId={userId} role={role} message="" />
      {tasks.map((task) => (
        <Button key={`b-${String(task._id)}`} label="Đã mua" disabled={!canEdit(task, userId, role)} onPress={() => bought(String(task._id))} />
      ))}
      {tasks.map((task) => (
        <Button key={`c-${String(task._id)}`} label="Nhận phần này" onPress={() => claim(String(task._id))} />
      ))}
      <Field label="Tên danh sách" value={listName} onChangeText={setListName} />
      <Field label="Người mua (username)" value={assignTo} onChangeText={setAssignTo} />
      <Button label="Tạo danh sách" onPress={createList} />
      <Field label="Thực phẩm" value={foodName} onChangeText={setFoodName} />
      <Field label="Số lượng" value={quantity} onChangeText={setQuantity} />
      <Button label="Thêm vào danh sách" onPress={addTask} />
      <Button label="Bật/tắt mạng" onPress={() => session.setOffline(!session.offline)} />
      <Button label="Đi đến bữa ăn" onPress={() => router.push('/meal')} />
    </ScrollView>
  );
}
