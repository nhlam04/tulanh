// Auth screen (Minh, app shell): register, the code, login, and the first group.
// The words on the screen are sentences (D108): the server's own message, read from the
// shared table when the server sends none.
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { notice, request, type Note } from '../src/api/client';
import { useSession } from '../src/session';
import { Bar, Button, Field, Notice, Screen } from '../src/features/ui';

export default function AuthScreen() {
  const session = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [groupName, setGroupName] = useState('');
  const [base, setBaseUrl] = useState(session.base);
  const [note, setNote] = useState<Note>({ text: 'Đăng ký hoặc đăng nhập', bad: false });

  async function register() {
    const created = await request('/user/', { method: 'post', body: { email, password, name, username } });
    setNote(notice(created));
    if (created.code !== '00035') return;
    const sent = await request('/user/send-verification-code/', { method: 'post', body: { email } });
    setNote(notice(sent));
  }

  async function verify() {
    const out = await request('/user/verify-email/', { method: 'post', body: { email, code } });
    setNote(notice(out));
    if (out.code === '00058') await login();
  }

  async function login() {
    const out = await request('/user/login/', { method: 'post', body: { email, password } });
    setNote(notice(out));
    if (out.code !== '00047') return;
    const token = (out.data as { accessToken: string }).accessToken;
    await session.signIn(token);
    router.replace('/fridge');
  }

  async function createGroup() {
    const out = await request('/user/group/', { method: 'post', body: { name: groupName }, token: session.token });
    setNote(notice(out));
    await session.reload();
    if (out.code === '00095') router.replace('/fridge');
  }

  return (
    <View style={{ flex: 1 }}>
      <Bar title="Tủ Lành" sub="đăng ký hoặc đăng nhập" />
      <Screen>
        <Notice note={note} />
        <Field label="Địa chỉ server" value={base} onChangeText={(next) => { setBaseUrl(next); session.setBase(next); }} />
        <Field label="Email" value={email} onChangeText={setEmail} />
        <Field label="Mật khẩu" value={password} onChangeText={setPassword} />
        <Field label="Tên hiển thị" value={name} onChangeText={setName} />
        <Field label="Tên đăng nhập" value={username} onChangeText={setUsername} />
        <Button label="Đăng ký" onPress={register} />
        <Field label="Mã xác nhận" value={code} onChangeText={setCode} keyboardType="number-pad" />
        <Button label="Xác nhận email" onPress={verify} outline />
        <Button label="Đăng nhập" onPress={login} />
        {session.token && !session.user?.group_id ? (
          <>
            <Field label="Tên nhóm" value={groupName} onChangeText={setGroupName} placeholder="ví dụ: Nhà mình" />
            <Button label="Tạo nhóm" onPress={createGroup} />
          </>
        ) : null}
      </Screen>
    </View>
  );
}
