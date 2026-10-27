// Push route (Hùng): the Route A proof kept as a screen. It asks for permission, reads the
// Expo push token, posts the device so the server can notify this phone, and prints every
// notice that arrives. Replacing the old entry file, which held no feature rule.
import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import * as Notifications from 'expo-notifications';
import { request, messageFor } from '../src/api/client';
import { useSession } from '../src/session';
import { deviceId } from '../src/features/deviceId';
import { registerPushToken, renderNotification } from '../src/features/push';
import { Button, styles } from '../src/features/ui';

export default function PushRoute() {
  const session = useSession();
  const [status, setStatus] = useState('đang mở tủ lành…');
  const [token, setToken] = useState('—');
  const [notices, setNotices] = useState<string[]>([]);

  async function readToken() {
    await Notifications.requestPermissionsAsync();
    const result = await registerPushToken();
    setStatus(result.code === '00383' ? 'tủ lành của bạn đã mở' : `${result.code} — ${result.message || messageFor(result.code)}`);
    setToken(result.token ? String(result.token) : '—');
    if (!result.token || !session.token) return;
    const device = await request('/user/devices/', {
      method: 'post',
      body: { deviceId: await deviceId(), platform: 'android', pushToken: String(result.token) },
      token: session.token,
    });
    setStatus(`${device.code} — ${device.message || messageFor(device.code)}`);
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
    <ScrollView style={styles.screen} contentContainerStyle={{ gap: 10 }}>
      <Text style={styles.title}>Thông báo</Text>
      <Text>{status}</Text>
      <Text selectable>{token}</Text>
      <Button label="Đọc lại token" onPress={readToken} />
      {notices.map((line, index) => (
        <Text key={index}>{line}</Text>
      ))}
    </ScrollView>
  );
}
