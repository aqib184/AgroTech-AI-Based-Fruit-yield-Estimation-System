import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { cacheKeys } from '@/utils/cache';
import { saveManualCoords } from '@/hooks/useAppWeather';
import { AppCard } from '@/components/AppCard';
import { colors, radius, spacing, typography } from '@/theme';

export function ManualWeatherSection() {
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(cacheKeys.manualLocation);
      if (!raw) return;
      try {
        const j = JSON.parse(raw) as { lat: number; lon: number };
        setLat(String(j.lat));
        setLon(String(j.lon));
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const onSave = async () => {
    const la = Number(lat);
    const lo = Number(lon);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) {
      setMsg('Enter valid numbers');
      return;
    }
    await saveManualCoords(la, lo);
    setMsg('Saved. Used when profile coords & GPS are unavailable.');
  };

  const onClear = async () => {
    await AsyncStorage.removeItem(cacheKeys.manualLocation);
    setLat('');
    setLon('');
    setMsg('Cleared manual override.');
  };

  return (
    <AppCard style={{ marginTop: spacing.lg }}>
      <Text style={styles.title}>Manual weather location</Text>
      <Text style={styles.sub}>
        Third-priority fallback after farm latitude/longitude and device GPS (see weather hook).
      </Text>
      <Text style={styles.label}>Latitude</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        placeholder="e.g. 45.52"
        placeholderTextColor={colors.textMuted}
        value={lat}
        onChangeText={setLat}
      />
      <Text style={styles.label}>Longitude</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        placeholder="e.g. -122.67"
        placeholderTextColor={colors.textMuted}
        value={lon}
        onChangeText={setLon}
      />
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      <View style={styles.row}>
        <Pressable style={styles.primary} onPress={onSave}>
          <Text style={styles.primaryText}>Save</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={onClear}>
          <Text style={styles.secondaryText}>Clear</Text>
        </Pressable>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.section, color: colors.primaryDark },
  sub: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.md },
  label: { ...typography.micro, color: colors.textMuted, marginTop: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: 4,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  msg: { ...typography.caption, color: colors.primary, marginTop: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  primary: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 999,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  secondary: {
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
  },
  secondaryText: { ...typography.caption, color: colors.textSecondary },
});
