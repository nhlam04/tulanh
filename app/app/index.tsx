// Sign-in screen (Minh, app shell): the one job of getting back to your tủ (rule 8).
// Registering and opening a first group are their own screens, reached from here.
// The words on the screen are sentences (D108): the server's own message, read from the
// shared table when the server sends none.
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { notice, request, type Note } from '../src/api/client';
import { useSession } from '../src/session';
import { Bar, Button, Field, Notice, Screen } from '../src/features/ui';

export default function SignInScreen() {
  const session = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [base, setBaseUrl] = useState(session.base);
  const [note, setNote] = useState<Note>({ text: 'Chào mừng bạn về tủ lành', bad: false });

  // A restored token opens the tủ, not the form again: the app keeps the sign-in across a
  // restart, so a restart is not a second login (rule 1 — the screen shows the real state
  // of the session). An account without a group goes to the screen that opens one.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || !session.token) return;
    opened.current = true;
    router.replace(session.user?.group_id ? '/fridge' : '/group');
  }, [session.token, session.user]);

  async function signIn() {
    const out = await request('/user/login/', { method: 'post', body: { email, password } });
    setNote(notice(out));
    if (out.code !== '00047') return;
    const token = (out.data as { accessToken: string }).accessToken;
    await session.signIn(token);
    opened.current = true;
    // The profile read is the answer to "does this account already have a tủ", asked now
    // rather than read from a screen that has not re-rendered yet.
    const profile = await request('/user/', { token });
    router.replace((profile.data as { user?: { group_id?: string } })?.user?.group_id ? '/fridge' : '/group');
  }

  return (
    <View style={{ flex: 1 }}>
      <Bar title="Tủ Lành" sub="đăng nhập" />
      <Screen>
        <Notice note={note} />
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="ví dụ: bạn@email.com" />
        <Field label="Mật khẩu" value={password} onChangeText={setPassword} secureTextEntry />
        <Button label="Đăng nhập" onPress={signIn} />
        <Button label="Chưa có tài khoản" onPress={() => router.push('/register')} outline />
        <Field
          label="Địa chỉ server"
          value={base}
          onChangeText={(next) => {
            setBaseUrl(next);
            session.setBase(next);
          }}
        />
      </Screen>
    </View>
  );
}
