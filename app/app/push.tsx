// Push route (Hùng): the Route A proof kept as a screen. It asks for permission, reads the
// Expo push token, posts the device so the server can notify this phone, and lists every
// notice that arrives. A proof surface, so it is reached from Thống kê, not from the tabs.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { notice, request, type Note } from '../src/api/client';
import { useSession } from '../src/session';
import { deviceId } from '../src/features/deviceId';
import { registerPushToken, renderNotification } from '../src/features/push';
import { Bar, Button, List, ListRow, Notice, Screen, styles } from '../src/features/ui';

export default function PushRoute() {
  const session = useSession();
  const [note, setNote] = useState<Note>({ text: 'đang mở tủ lành…', bad: false });
  const [token, setToken] = useState('—');
  const [notices, setNotices] = useState<string[]>([]);

  async function readToken() {
    await Notifications.requestPermissionsAsync();
    const result = await registerPushToken();
    setNote(result.token ? { text: 'tủ lành của bạn đã mở', bad: false } : { text: result.message || 'chưa mở được thông báo', bad: true });
    setToken(result.token ? String(result.token) : '—');
    if (!result.token || !session.token) return;
    const device = await request('/user/devices/', {
      method: 'post',
      body: { deviceId: await deviceId(), platform: 'android', pushToken: String(result.token) },
      token: session.token,
    });
    setNote(notice(device));
  }

  useEffect(() => {
    const received = Notifications.addNotificationReceivedListener((notification) => {
      const content = notification.request.content;
      setNotices((previous) => [renderNotification({ title: content.title ?? undefined, body: content.body ?? undefined }), ...previous]);
    });
    readToken();
    return () => received.remove();
  }, [session.token]);

  return (
    <View style={styles.shell}>
      <Bar title="Thông báo" sub="đường dây nhắc hết hạn" />
      <Screen>
        <Notice note={note} />
        <ListRow title="Token của máy" sub={token} />
        {notices.length ? (
          <List>{notices.map((line, index) => <ListRow key={index} title={line} />)}</List>
        ) : null}
        <Button label="Đọc lại token" onPress={readToken} />
        <Button label="Về thống kê" onPress={() => router.push('/stats')} outline />
      </Screen>
    </View>
  );
}
