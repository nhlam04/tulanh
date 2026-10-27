// Auth screen (Minh, app shell): register, the code, login, and the first group.
// Every line printed here is the message the server answered, read from the shared table.
import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { router } from 'expo-router';
import { request, messageFor } from '../src/api/client';
import { useSession } from '../src/session';
import { Button, Field, styles } from '../src/features/ui';

export default function AuthScreen() {
  const session = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [groupName, setGroupName] = useState('');
  const [base, setBaseUrl] = useState(session.base);
  const [message, setMessage] = useState('Đăng ký hoặc đăng nhập');

  function show(out: { code: string; message?: string }) {
    setMessage(`${out.code} — ${out.message || messageFor(out.code)}`);
  }

  async function register() {
    const created = await request('/user/', { method: 'post', body: { email, password, name, username } });
    show(created);
    if (created.code !== '00035') return;
    const sent = await request('/user/send-verification-code/', { method: 'post', body: { email } });
    show(sent);
  }

  async function verify() {
    const out = await request('/user/verify-email/', { method: 'post', body: { email, code } });
    show(out);
    if (out.code === '00058') await login();
  }

  async function login() {
    const out = await request('/user/login/', { method: 'post', body: { email, password } });
    show(out);
    if (out.code !== '00047') return;
    const token = (out.data as { accessToken: string }).accessToken;
    await session.signIn(token);
    router.replace('/fridge');
  }

  async function createGroup() {
    const out = await request('/user/group/', { method: 'post', body: { name: groupName }, token: session.token });
    show(out);
    await session.reload();
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ gap: 10 }}>
      <Text style={styles.title}>Tủ lành của bạn</Text>
      <Text>{message}</Text>
      <Field label="Địa chỉ server" value={base} onChangeText={(next) => { setBaseUrl(next); session.setBase(next); }} />
      <Text style={styles.muted}>Máy giữ địa chỉ này cho những lần mở sau.</Text>
      <Field label="Email" value={email} onChangeText={setEmail} />
      <Field label="Mật khẩu" value={password} onChangeText={setPassword} />
      <Field label="Tên hiển thị" value={name} onChangeText={setName} />
      <Field label="Tên đăng nhập" value={username} onChangeText={setUsername} />
      <Button label="Đăng ký" onPress={register} />
      <Field label="Mã xác nhận" value={code} onChangeText={setCode} />
      <Button label="Xác nhận email" onPress={verify} />
      <Button label="Đăng nhập" onPress={login} />
      {session.token && !session.user?.group_id ? (
        <>
          <Field label="Tên nhóm" value={groupName} onChangeText={setGroupName} />
          <Button label="Tạo nhóm" onPress={createGroup} />
        </>
      ) : null}
    </ScrollView>
  );
}
