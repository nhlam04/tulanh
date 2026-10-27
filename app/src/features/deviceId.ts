// Device id rule (D66, client side): the value the server stores on the user_devices row.
// Android reads ANDROID_ID, which is unique per combination of signing key, user and device, and
// changes after a factory reset or a signing key change. iOS reads the vendor id, which changes
// when every app from the same vendor is uninstalled. Both cases mean a reinstall writes a new
// value through the same call, which is why the row is per device and not a field on the user.
import * as Application from 'expo-application';
import { Platform } from 'react-native';

export async function deviceId(): Promise<string | null> {
  if (Platform.OS === 'android') return Application.getAndroidId();
  if (Platform.OS === 'ios') return await Application.getIosIdForVendorAsync();
  return null;
}

export function platform(): string {
  return Platform.OS;
}
