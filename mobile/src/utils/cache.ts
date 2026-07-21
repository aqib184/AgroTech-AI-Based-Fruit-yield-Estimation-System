import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = '@agroyield/';

export async function setJsonCache<T>(key: string, value: T, ttlMs: number) {
  const payload = JSON.stringify({ v: value, exp: Date.now() + ttlMs });
  await AsyncStorage.setItem(PREFIX + key, payload);
}

export async function getJsonCache<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(PREFIX + key);
  if (!raw) return null;
  try {
    const { v, exp } = JSON.parse(raw) as { v: T; exp: number };
    if (Date.now() > exp) {
      await AsyncStorage.removeItem(PREFIX + key);
      return null;
    }
    return v;
  } catch {
    return null;
  }
}

export const cacheKeys = {
  homeSnapshot: 'home_snapshot',
  weather: (lat: number, lon: number) => `weather_${lat.toFixed(2)}_${lon.toFixed(2)}`,
  manualLocation: 'manual_location',
};
