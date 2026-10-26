// App shell (Minh): navigation and the entry. Screens live in the feature scope.
import { Stack } from 'expo-router';

export default function Layout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
