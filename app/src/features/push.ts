// Push rule (Hùng, feature side): the client registers the Expo push token and shows
// what arrives. One notice per lot comes from the server rule in D35, not from the client.
// The token is read for the project, so the value comes from the app config, not from a
// string typed in code.
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

export function projectId() {
  return (Constants?.expoConfig?.extra?.eas?.projectId) ?? (Constants?.easConfig?.projectId) ?? null;
}

export async function registerPushToken() {
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return { code: '00017', message: 'notifications not allowed', token: null };
  const project = projectId();
  if (!project) return { code: '00025', message: 'the project id is not set in the app config', token: null };
  const token = await Notifications.getExpoPushTokenAsync({ projectId: project });
  return { code: '00383', message: 'ok', token: token.data || token };
}

export function renderNotification(event: { title?: string; body?: string }) {
  return `${event.title || 'Fridge alert'}: ${event.body || ''}`;
}
