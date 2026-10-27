// First group screen (Minh, app shell): an account with no tủ yet opens one here. One field,
// one button — the screen has nothing else to do (rule 8).
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { notice, request, type Note } from '../src/api/client';
import { useSession } from '../src/session';
import { Bar, Button, Field, Notice, Screen } from '../src/features/ui';

export default function GroupScreen() {
  const session = useSession();
  const [groupName, setGroupName] = useState('');
  const [note, setNote] = useState<Note>({ text: 'Đặt tên cho tủ chung của nhóm', bad: false });

  // Someone who already has a tủ has no business on this screen.
  const moved = useRef(false);
  useEffect(() => {
    if (moved.current || !session.token || !session.user?.group_id) return;
    moved.current = true;
    router.replace('/fridge');
  }, [session.token, session.user]);

  async function createGroup() {
    if (!groupName.trim()) {
      setNote({ text: 'Nhóm cần một tên để gọi', bad: true });
      return;
    }
    const out = await request('/user/group/', { method: 'post', body: { name: groupName }, token: session.token });
    setNote(notice(out));
    if (out.code !== '00095') return;
    await session.reload();
    router.replace('/fridge');
  }

  return (
    <View style={{ flex: 1 }}>
      <Bar title="Nhóm mới" sub="những người cùng tủ" />
      <Screen>
        <Notice note={note} />
        <Field label="Tên nhóm" value={groupName} onChangeText={setGroupName} placeholder="ví dụ: Nhà mình" />
        <Button label="Tạo nhóm" onPress={createGroup} />
      </Screen>
    </View>
  );
}
