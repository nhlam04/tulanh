// Push route (Hung): the Route A proof kept as a screen. It asks for permission, reads the
// Expo push token, posts the device so the server can notify this phone, and lists every
// notice that arrives. The token stays off the screen: what a person reads here is whether
// this phone is listening, not the string that makes it listen (rule 9).
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { failure, request, type Note } from '../src/api/client';
import { useSession } from '../src/session';
import { deviceId } from '../src/features/deviceId';
import { registerPushToken, renderNotification } from '../src/features/push';
import { Bar, Button, Empty, List, ListRow, Notice, Screen, styles } from '../src/features/ui';

export default function PushRoute() {
  const session = useSession();
  const [note, setNote] = useState<Note>({ text: 'đang mở tủ lành…', bad: false });
  const [listening, setListening] = useState(false);
  const [notices, setNotices] = useState<string[]>([]);

  async function readToken() {
    await Notifications.requestPermissionsAsync();
    const result = await registerPushToken();
    setListening(Boolean(result.token));
    setNote(result.token ? { text: '', bad: false } : { text: result.message || 'chưa mở được thông báo', bad: true });
    if (!result.token || !session.token) return;
    const device = await request('/user/devices/', {
      method: 'post',
      body: { deviceId: await deviceId(), platform: 'android', pushToken: String(result.token) },
      token: session.token,
    });
    setNote(failure(device));
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
        <List>
          <ListRow
            title={listening ? 'Máy này đang chờ nhắc từ tủ' : 'Máy này chưa chờ được nhắc'}
            sub={listening ? 'nhắc khi một phần gần hết hạn' : 'thử lại, hoặc bật thông báo trong Cài đặt'}
            warn={!listening}
          />
        </List>
        {notices.length ? (
          <List>{notices.map((line, index) => <ListRow key={index} title={line} />)}</List>
        ) : (
          <Empty title="Chưa có nhắc nào" hint="Tủ sẽ nhắc khi một phần gần hết hạn." />
        )}
        <Button label="Ghi nhận máy lại" onPress={readToken} />
        <Button label="Về thống kê" onPress={() => router.push('/stats')} outline />
      </Screen>
    </View>
  );
}
