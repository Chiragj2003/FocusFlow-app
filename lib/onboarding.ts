import AsyncStorage from '@react-native-async-storage/async-storage';

/** Per-device flag: has the 3-screen intro been shown? */
const ONBOARDED_KEY = '@focusflow_onboarded_v1';

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDED_KEY)) === 'true';
  } catch {
    return true; // never block the app on a storage error
  }
}

export async function markOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDED_KEY, 'true');
  } catch {
    // Not critical: worst case the intro shows again next launch
  }
}
