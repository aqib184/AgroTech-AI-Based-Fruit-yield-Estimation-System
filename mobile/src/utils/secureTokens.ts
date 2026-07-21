import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS = 'access_token';
const REFRESH = 'refresh_token';

function webGet(key: string): string | null {
  if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
    return null;
  }
  try {
    return globalThis.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function webSet(key: string, value: string) {
  if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
    return;
  }
  try {
    globalThis.localStorage.setItem(key, value);
  } catch {
    // no-op for environments where storage is blocked
  }
}

function webRemove(key: string) {
  if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
    return;
  }
  try {
    globalThis.localStorage.removeItem(key);
  } catch {
    // no-op for environments where storage is blocked
  }
}

export async function getToken(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return webGet(key);
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setToken(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    webSet(key, value);
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // ignore storage failures to avoid blocking app flow
  }
}

export async function deleteToken(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    webRemove(key);
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // ignore storage failures to avoid blocking app flow
  }
}

export async function loadTokens(): Promise<{ access: string; refresh: string } | null> {
  const access = await getToken(ACCESS);
  const refresh = await getToken(REFRESH);
  if (access && refresh) return { access, refresh };
  return null;
}

export async function saveTokens(access: string, refresh: string) {
  await setToken(ACCESS, access);
  await setToken(REFRESH, refresh);
}

export async function clearTokens() {
  await deleteToken(ACCESS);
  await deleteToken(REFRESH);
}
