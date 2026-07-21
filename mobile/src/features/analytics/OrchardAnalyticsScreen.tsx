import { useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AnalyticsStackParamList } from '@/navigation/types';
import { useOrchardAnalyticsQuery } from '@/api/agroApi';
import { AppCard } from '@/components/AppCard';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/Skeleton';
import { colors, spacing, typography } from '@/theme';
import { formatKg, formatPct } from '@/utils/format';

type Props = NativeStackScreenProps<AnalyticsStackParamList, 'OrchardAnalytics'>;

const W = Dimensions.get('window').width - 32;

export function OrchardAnalyticsScreen({ route }: Props) {
  const [days, setDays] = useState(30);
  const { data, isLoading, isError, refetch } = useOrchardAnalyticsQuery({ id: route.params.id, days });

  if (isLoading && !data) {
    return (
      <View style={styles.pad}>
        <Skeleton height={220} />
      </View>
    );
  }
  if (isError || !data) return <ErrorState message="Orchard analytics not found." onRetry={refetch} />;

  const trend = data.estimations_trend;
  const labels = trend.map((t) => String(t.date).slice(5));
  const yYield = trend.map((t) => Math.round(t.yield_kg));
  const yRipe = trend.map((t) => Math.round(t.ripe_pct));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 100 }}>
      <Text style={styles.head}>{data.orchard_name}</Text>
      <Text style={styles.sub}>{data.variety}</Text>

      <View style={styles.toggleRow}>
        <Pressable style={[styles.toggle, days === 7 && styles.toggleOn]} onPress={() => setDays(7)}>
          <Text style={[styles.toggleText, days === 7 && { color: '#fff' }]}>7d</Text>
        </Pressable>
        <Pressable style={[styles.toggle, days === 30 && styles.toggleOn]} onPress={() => setDays(30)}>
          <Text style={[styles.toggleText, days === 30 && { color: '#fff' }]}>30d</Text>
        </Pressable>
      </View>

      <AppCard style={{ marginBottom: spacing.md }}>
        <Text style={styles.section}>Summary</Text>
        <Text style={styles.line}>Estimations: {data.summary.estimations}</Text>
        <Text style={styles.line}>Avg yield: {formatKg(data.summary.avg_yield_kg ?? 0, 1)}</Text>
        <Text style={styles.line}>Ripeness avg: {formatPct(data.summary.avg_ripeness_pct ?? 0)}</Text>
        <Text style={styles.line}>Canopy avg: {(data.summary.avg_canopy_score ?? 0).toFixed(2)}</Text>
        <Text style={styles.line}>VVI avg: {(data.summary.avg_vvi_score ?? 0).toFixed(2)}</Text>
      </AppCard>

      <AppCard style={{ marginBottom: spacing.md }}>
        <Text style={styles.section}>Yield trend</Text>
        {labels.length ? (
          <LineChart
            data={{ labels, datasets: [{ data: yYield.length ? yYield : [0] }] }}
            width={W}
            height={190}
            chartConfig={{
              backgroundGradientFrom: colors.surface,
              backgroundGradientTo: colors.surface,
              color: () => colors.primary,
              labelColor: () => colors.textSecondary,
            }}
            bezier
            style={{ marginTop: spacing.sm, borderRadius: 12 }}
          />
        ) : (
          <Text style={styles.muted}>No trend data.</Text>
        )}
      </AppCard>

      <AppCard style={{ marginBottom: spacing.md }}>
        <Text style={styles.section}>Ripeness trend</Text>
        {labels.length ? (
          <LineChart
            data={{ labels, datasets: [{ data: yRipe.length ? yRipe : [0] }] }}
            width={W}
            height={190}
            chartConfig={{
              backgroundGradientFrom: colors.surface,
              backgroundGradientTo: colors.surface,
              color: () => colors.accent,
              labelColor: () => colors.textSecondary,
            }}
            bezier
            style={{ marginTop: spacing.sm, borderRadius: 12 }}
          />
        ) : null}
      </AppCard>

      <AppCard>
        <Text style={styles.section}>Average yield factors</Text>
        {Object.entries(data.yield_factors_avg).map(([k, v]) => (
          <Text key={k} style={styles.line}>
            {k}: {typeof v === 'number' ? v.toFixed(3) : String(v)}
          </Text>
        ))}
      </AppCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg, flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  head: { ...typography.title, color: colors.primaryDark },
  sub: { ...typography.caption, color: colors.textSecondary },
  toggleRow: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.md },
  toggle: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  toggleOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleText: { ...typography.caption, color: colors.text, fontWeight: '600' },
  section: { ...typography.section, color: colors.primaryDark, marginBottom: spacing.sm },
  line: { ...typography.body, color: colors.text, marginBottom: 4 },
  muted: { ...typography.caption, color: colors.textSecondary },
});
