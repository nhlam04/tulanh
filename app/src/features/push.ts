// Push rule (Hùng, feature side): the client registers the Expo push token and shows
// what arrives. One notice per lot comes from the server rule in D35, not from the client.
// The token is read for the project, so the value comes from the app config, not from a
// string typed in code.
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

export function projectId() {
  return (Constants?.expoConfig?.extra?.eas?.projectId) ?? (Constants?.easConfig?.projectId) ?? null;
}

// The two failure answers are client-side states with no entry in the shared table, so they
// carry their own marker instead of borrowing a server code: the server never sees them.
export async function registerPushToken() {
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return { code: 'push:denied', message: 'Chưa cho phép thông báo trên máy này', token: null };
  const project = projectId();
  if (!project) return { code: 'push:no_project', message: 'App config chưa có project id', token: null };
  const token = await Notifications.getExpoPushTokenAsync({ projectId: project });
  return { code: '00383', message: 'ok', token: token.data || token };
}

export function renderNotification(event: { title?: string; body?: string }) {
  return `${event.title || 'Tủ lành của bạn'}: ${event.body || ''}`;
}

// Tap rule (D36): one notice type and one target. The payload carries `screen: 'fridge'`,
// and the client opens that screen and nothing else.
export function screenFor(data: Record<string, unknown> | undefined): string | null {
  return data && data.screen === 'fridge' ? '/fridge' : null;
}

// A tap while the app is open arrives here; a tap that opens the app from cold start is read
// by useLastNotificationResponse in the layout. Both go through screenFor, so one rule holds.
export function watchTap(open: (path: string) => void): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const path = screenFor(response.notification.request.content.data as Record<string, unknown> | undefined);
    if (path) open(path);
  });
  return () => subscription.remove();
}
