// Register screen (Minh, app shell): one account, then the code that proves the email.
// The code field appears only after the code has been sent, so the screen never asks for
// something nobody has sent yet (rule 5 and rule 8).
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { makeNote, notice, request, type Note } from '../src/api/client';
import { useSession } from '../src/session';
import { Bar, Button, Field, Notice, Screen } from '../src/features/ui';

export default function RegisterScreen() {
  const session = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [note, setNote] = useState<Note>(makeNote('Đăng ký để mở tủ lành của bạn', false));

  async function register() {
    if (!email || !password) {
      setNote(makeNote('Cần email và mật khẩu để đăng ký', true));
      return;
    }
    const created = await request('/user/', { method: 'post', body: { email, password, name, username } });
    setNote(notice(created));
    if (created.code !== '00035') return;
    const sentOut = await request('/user/send-verification-code/', { method: 'post', body: { email } });
    setSent(true);
    setNote(notice(sentOut));
  }

  async function verify() {
    const out = await request('/user/verify-email/', { method: 'post', body: { email, code } });
    setNote(notice(out));
    if (out.code !== '00058') return;
    const login = await request('/user/login/', { method: 'post', body: { email, password } });
    if (login.code !== '00047') {
      setNote(notice(login));
      return;
    }
    const pair = login.data as { accessToken: string; refreshToken: string };
    await session.signIn(pair.accessToken, pair.refreshToken);
    const profile = await request('/user/', { token: pair.accessToken });
    router.replace((profile.data as { user?: { group_id?: string } })?.user?.group_id ? '/fridge' : '/group');
  }

  return (
    <View style={{ flex: 1 }}>
      <Bar title="Đăng ký" sub="email của bạn là chìa khóa" />
      <Screen>
        <Notice note={note} />
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="ví dụ: bạn@email.com" />
        <Field label="Mật khẩu" value={password} onChangeText={setPassword} secureTextEntry />
        {/* The example is a name long enough for the server rule, so the screen does not
            invite the person to type something the server will refuse. */}
        <Field label="Tên hiển thị" value={name} onChangeText={setName} placeholder="ví dụ: Hoa Nguyễn" />
        <Field label="Tên đăng nhập" value={username} onChangeText={setUsername} placeholder="ví dụ: hoa" />
        <Button label="Đăng ký" onPress={register} />
        {sent ? <Field label="Mã xác nhận" value={code} onChangeText={setCode} keyboardType="number-pad" placeholder="6 chữ số trong email" /> : null}
        {sent ? <Button label="Xác nhận email" onPress={verify} outline /> : null}
        <Button label="Về đăng nhập" onPress={() => router.navigate('/')} outline />
      </Screen>
    </View>
  );
}
