// Push rule (Hùng, feature side): the client registers the Expo push token and shows
// what arrives. One notice per lot comes from the server rule in D35, not from the client.
import * as Notifications from 'expo-notifications';

export async function registerPushToken() {
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return { code: '00017', message: 'notifications not allowed', token: null };
  const token = await Notifications.getExpoPushTokenAsync();
  return { code: '00383', message: 'ok', token: token };
}

export function renderNotification(event: { title?: string; body?: string }) {
  return `${event.title || 'Fridge alert'}: ${event.body || ''}`;
}
