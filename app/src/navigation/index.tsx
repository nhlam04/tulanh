// App shell (Minh): navigation and the entry. Screens live in the feature scope.
// The layout owns the session, the notice handler and the one tap target (D36).
import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { SessionProvider } from '../session';
import { screenFor, watchTap } from '../features/push';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export default function Layout() {
  const router = useRouter();

  useEffect(() => watchTap((path) => router.push(path)), [router]);

  // A tap that starts the app is read once at start, so the same rule covers both cases.
  const started = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const path = screenFor(started?.notification.request.content.data as Record<string, unknown> | undefined);
    if (path) router.push(path);
  }, [started, router]);

  return (
    <SessionProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SessionProvider>
  );
}
