import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import type { FarmProfile } from '@/api/types';
import { cacheKeys, getJsonCache, setJsonCache } from '@/utils/cache';
import { sprayingHintFromForecast, type SprayHint } from '@/utils/weatherHints';

const TTL_MS = 18 * 60 * 1000;

type Coords = { lat: number; lon: number };

export type ForecastChip = {
  id: string;
  label: string;
  temp: number;
  pop: number;
  iconUrl: string;
};

export type WeatherBundle = {
  coords: Coords;
  source: 'farm' | 'device' | 'manual';
  currentTemp: number;
  feelsLike: number;
  description: string;
  iconUrl: string;
  humidity: number;
  windMps: number;
  rainChancePct: number;
  forecast: ForecastChip[];
  sprayHint: SprayHint;
};

function iconUrl(code: string) {
  return `https://openweathermap.org/img/wn/${code}@2x.png`;
}

async function readManualCoords(): Promise<Coords | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKeys.manualLocation);
    if (!raw) return null;
    const j = JSON.parse(raw) as { lat: number; lon: number };
    if (typeof j.lat === 'number' && typeof j.lon === 'number') return { lat: j.lat, lon: j.lon };
  } catch {
    /* ignore */
  }
  return null;
}

export async function saveManualCoords(lat: number, lon: number) {
  await AsyncStorage.setItem(cacheKeys.manualLocation, JSON.stringify({ lat, lon }));
}

function buildOneCallUrl(baseUrl: string) {
  const u = baseUrl.replace(/\/$/, '');
  if (u.endsWith('/onecall')) {
    return u;
  }
  return `${u}/onecall`;
}

async function fetchOpenWeather(coords: Coords, apiKey: string, baseUrl: string): Promise<WeatherBundle> {
  const oneCallUrl = buildOneCallUrl(baseUrl);
  const qs = `lat=${coords.lat}&lon=${coords.lon}&exclude=minutely,alerts&units=metric&appid=${apiKey}`;
  const res = await fetch(`${oneCallUrl}?${qs}`);
  if (res.ok) {
    const payload = (await res.json()) as {
      current: {
        temp: number;
        feels_like: number;
        humidity: number;
        wind_speed: number;
        weather: { description: string; icon: string }[];
      };
      daily?: {
        dt: number;
        pop?: number;
        temp?: { day?: number };
        weather?: { icon: string }[];
      }[];
    };

    const daily = (payload.daily ?? []).slice(0, 5);
    const pops = daily.map((d) => d.pop ?? 0);
    const maxPop = Math.max(0, ...pops, 0);
    const rainChancePct = Math.round(maxPop * 100);

    const forecast: ForecastChip[] = daily.map((d, idx) => ({
      id: String(d.dt + idx),
      label: new Date(d.dt * 1000).toLocaleDateString(undefined, { weekday: 'short' }),
      temp: Math.round(d.temp?.day ?? payload.current.temp),
      pop: Math.round((d.pop ?? 0) * 100),
      iconUrl: iconUrl(d.weather?.[0]?.icon ?? '02d'),
    }));

    const sprayHint = sprayingHintFromForecast(maxPop, payload.current.wind_speed ?? 0, payload.current.humidity ?? 0);

    return {
      coords,
      source: 'device',
      currentTemp: Math.round(payload.current.temp),
      feelsLike: Math.round(payload.current.feels_like),
      description: payload.current.weather?.[0]?.description ?? '',
      iconUrl: iconUrl(payload.current.weather?.[0]?.icon ?? '02d'),
      humidity: payload.current.humidity ?? 0,
      windMps: payload.current.wind_speed ?? 0,
      rainChancePct,
      forecast,
      sprayHint,
    };
  }

  // Fallback for keys without One Call 3.0 access: use 2.5 weather + forecast.
  const fallbackBase = 'https://api.openweathermap.org/data/2.5';
  const common = `lat=${coords.lat}&lon=${coords.lon}&units=metric&appid=${apiKey}`;
  const [curRes, fcRes] = await Promise.all([
    fetch(`${fallbackBase}/weather?${common}`),
    fetch(`${fallbackBase}/forecast?${common}`),
  ]);

  if (!curRes.ok || !fcRes.ok) {
    const oneCallErr = await res.text();
    const weatherErr = !curRes.ok ? await curRes.text() : '';
    const forecastErr = !fcRes.ok ? await fcRes.text() : '';
    throw new Error(oneCallErr || weatherErr || forecastErr || `Weather HTTP ${res.status}`);
  }

  const cur = (await curRes.json()) as {
    main: { temp: number; feels_like: number; humidity: number };
    weather: { description: string; icon: string }[];
    wind: { speed: number };
  };
  const fc = (await fcRes.json()) as {
    list: { dt: number; pop: number; main: { temp: number }; weather: { icon: string }[] }[];
  };

  const picks = [0, 8, 16, 24, 32]
    .map((i) => fc.list[i])
    .filter(Boolean);
  const pops = picks.map((x) => x.pop ?? 0);
  const maxPop = Math.max(0, ...pops, 0);

  const forecast: ForecastChip[] = picks.map((slot, idx) => ({
    id: String(slot.dt + idx),
    label: new Date(slot.dt * 1000).toLocaleDateString(undefined, { weekday: 'short' }),
    temp: Math.round(slot.main.temp),
    pop: Math.round((slot.pop ?? 0) * 100),
    iconUrl: iconUrl(slot.weather?.[0]?.icon ?? '02d'),
  }));

  return {
    coords,
    source: 'device',
    currentTemp: Math.round(cur.main.temp),
    feelsLike: Math.round(cur.main.feels_like),
    description: cur.weather?.[0]?.description ?? '',
    iconUrl: iconUrl(cur.weather?.[0]?.icon ?? '02d'),
    humidity: cur.main.humidity ?? 0,
    windMps: cur.wind?.speed ?? 0,
    rainChancePct: Math.round(maxPop * 100),
    forecast,
    sprayHint: sprayingHintFromForecast(maxPop, cur.wind?.speed ?? 0, cur.main.humidity ?? 0),
  };
}

export function useAppWeather(profile: FarmProfile | undefined) {
  const extra = Constants.expoConfig?.extra as {
    weatherApiKey?: string;
    openWeatherBaseUrl?: string;
  } | null;
  const apiKey = extra?.weatherApiKey ?? '';
  const baseUrl = extra?.openWeatherBaseUrl ?? 'https://api.openweathermap.org/data/3.0';

  const [data, setData] = useState<WeatherBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const resolveCoords = useCallback(async (): Promise<{ coords: Coords; source: WeatherBundle['source'] }> => {
    if (profile?.latitude != null && profile?.longitude != null) {
      return { coords: { lat: profile.latitude, lon: profile.longitude }, source: 'farm' };
    }
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status === 'granted') {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return {
        coords: { lat: pos.coords.latitude, lon: pos.coords.longitude },
        source: 'device',
      };
    }
    const manual = await readManualCoords();
    if (manual) return { coords: manual, source: 'manual' };
    throw new Error(
      'Enable location, set farm latitude/longitude on your profile, or add a manual location in Settings.'
    );
  }, [profile?.latitude, profile?.longitude]);

  const refresh = useCallback(async () => {
    if (!apiKey) {
      setError('Add EXPO_PUBLIC_WEATHER_API_KEY for live weather.');
      setLoading(false);
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { coords, source } = await resolveCoords();
      const ck = cacheKeys.weather(coords.lat, coords.lon);
      const cached = await getJsonCache<WeatherBundle>(ck);
      if (cached) {
        setData({ ...cached, source });
        setLoading(false);
      }
      const live = await fetchOpenWeather(coords, apiKey, baseUrl);
      const merged = { ...live, source };
      setData(merged);
      await setJsonCache(ck, merged, TTL_MS);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Weather unavailable';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [apiKey, baseUrl, resolveCoords]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const memo = useMemo(() => ({ data, loading, error, refresh }), [data, loading, error, refresh]);
  return memo;
}
