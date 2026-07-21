import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing, typography } from '@/theme';
import type { ForecastChip, WeatherBundle } from '@/hooks/useAppWeather';

type Props = {
  loading: boolean;
  error: string | null;
  data: WeatherBundle | null;
  compact?: boolean;
};

function Chip({ f }: { f: ForecastChip }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipDay}>{f.label}</Text>
      <Image source={{ uri: f.iconUrl }} style={styles.chipIcon} />
      <Text style={styles.chipTemp}>{f.temp}°</Text>
      <Text style={styles.chipPop}>{f.pop}%</Text>
    </View>
  );
}

export function WeatherHeader({ loading, error, data, compact }: Props) {
  if (error && !data) {
    return (
      <View style={styles.errorBox}>
        <Text style={styles.errorTitle}>Weather</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (loading && !data) {
    return (
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.hero}>
        <Text style={styles.heroMuted}>Loading weather…</Text>
      </LinearGradient>
    );
  }

  if (!data) return null;

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.hero}>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.source}>
            {data.source === 'farm'
              ? 'Farm location'
              : data.source === 'device'
                ? 'Device location'
                : 'Saved location'}
          </Text>
          <Text style={styles.temp}>{data.currentTemp}°</Text>
          <Text style={styles.desc}>{data.description}</Text>
        </View>
        <Image source={{ uri: data.iconUrl }} style={styles.bigIcon} />
      </View>
      <View style={styles.metricsRow}>
        <Metric label="Rain chance" value={`${data.rainChancePct}%`} />
        <Metric label="Humidity" value={`${data.humidity}%`} />
        <Metric label="Wind" value={`${data.windMps.toFixed(1)} m/s`} />
      </View>
      {!compact ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip}>
          {data.forecast.map((f) => (
            <Chip key={f.id} f={f} />
          ))}
        </ScrollView>
      ) : null}
      <View
        style={[
          styles.hintPill,
          data.sprayHint.tone === 'good' && { backgroundColor: 'rgba(42,157,143,0.25)' },
          data.sprayHint.tone === 'caution' && { backgroundColor: 'rgba(233,196,106,0.35)' },
          data.sprayHint.tone === 'bad' && { backgroundColor: 'rgba(231,111,81,0.3)' },
        ]}
      >
        <Text style={styles.hintText}>{data.sprayHint.label}</Text>
      </View>
    </LinearGradient>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.md,
  },
  heroMuted: { ...typography.body, color: 'rgba(255,255,255,0.85)' },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  source: { ...typography.micro, color: 'rgba(255,255,255,0.75)', marginBottom: spacing.xs },
  temp: { fontSize: 44, fontWeight: '800', color: '#fff' },
  desc: { ...typography.body, color: 'rgba(255,255,255,0.9)', textTransform: 'capitalize' },
  bigIcon: { width: 88, height: 88 },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  metric: { flex: 1 },
  metricLabel: { ...typography.micro, color: 'rgba(255,255,255,0.7)' },
  metricValue: { ...typography.bodyMedium, color: '#fff', marginTop: 2 },
  strip: { marginTop: spacing.lg },
  chip: {
    width: 72,
    marginRight: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  chipDay: { ...typography.micro, color: '#fff' },
  chipIcon: { width: 36, height: 36 },
  chipTemp: { ...typography.bodyMedium, color: '#fff' },
  chipPop: { ...typography.caption, color: 'rgba(255,255,255,0.85)' },
  hintPill: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  hintText: { ...typography.caption, color: '#fff', fontWeight: '600' },
  errorBox: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorTitle: { ...typography.section, color: colors.primaryDark },
  errorText: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
});
