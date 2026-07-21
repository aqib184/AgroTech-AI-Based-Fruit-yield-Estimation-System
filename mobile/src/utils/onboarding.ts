import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_DONE_KEY = '@agroyield/onboarding_done';

export async function isOnboardingDone(): Promise<boolean> {
  try {
    const flag = await AsyncStorage.getItem(ONBOARDING_DONE_KEY);
    return flag === '1';
  } catch {
    return false;
  }
}

export async function markOnboardingDone(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_DONE_KEY, '1');
  } catch {
    // Non-blocking: UI should still proceed even if storage fails.
  }
}
