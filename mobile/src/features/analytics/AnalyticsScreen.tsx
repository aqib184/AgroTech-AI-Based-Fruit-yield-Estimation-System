import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AnalyticsStackParamList } from '@/navigation/types';
import { useDashboardQuery, useOrchardAnalyticsQuery, useOrchardsQuery } from '@/api/agroApi';
import { AppCard } from '@/components/AppCard';
import { StatTile } from '@/components/StatTile';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/Skeleton';
import { colors, spacing, typography } from '@/theme';
import { formatKg, formatPct } from '@/utils/format';

type Props = NativeStackScreenProps<AnalyticsStackParamList, 'AnalyticsMain'>;

export function AnalyticsScreen({ navigation }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  // Screen padding (16 * 2) + card padding (16 * 2) => content width available for charts
  const chartWidth = Math.max(220, screenWidth - 64);
  const halfChartWidth = Math.max(150, Math.floor((chartWidth - spacing.sm) / 2));
  const stackedCanopyVigorCharts = screenWidth < 420;

  const [days, setDays] = useState<7 | 30>(30);
  const { data, isLoading, isError, refetch } = useDashboardQuery({ days });
  const orchardsQ = useOrchardsQuery();
  const [selectedOrchardId, setSelectedOrchardId] = useState<number | null>(null);

  useEffect(() => {
    if (selectedOrchardId == null && orchardsQ.data?.length) {
      setSelectedOrchardId(Number(orchardsQ.data[0].id));
    }
  }, [selectedOrchardId, orchardsQ.data]);

  const orchardAnalyticsQ = useOrchardAnalyticsQuery(
    { id: Number(selectedOrchardId), days },
    { skip: selectedOrchardId == null }
  );

  if (isLoading && !data) {
    return (
      <View style={styles.pad}>
        <Skeleton height={220} />
      </View>
    );
  }
  if (isError || !data) return <ErrorState message="Analytics unavailable." onRetry={refetch} />;

  const labels = data.time_series.map((p) => p.date.slice(5));
  const yields = data.time_series.map((p) => Math.round(p.total_yield_kg));

  const orchardTrendLabels = useMemo(
    () => (orchardAnalyticsQ.data?.estimations_trend ?? []).map((p) => String(p.date).slice(5)),
    [orchardAnalyticsQ.data]
  );
  const orchardYield = useMemo(
    () => (orchardAnalyticsQ.data?.estimations_trend ?? []).map((p) => Math.round(p.yield_kg ?? 0)),
    [orchardAnalyticsQ.data]
  );
  const orchardRipeness = useMemo(
    () => (orchardAnalyticsQ.data?.estimations_trend ?? []).map((p) => Math.round(p.ripe_pct ?? 0)),
    [orchardAnalyticsQ.data]
  );
  const orchardCanopy = useMemo(
    () => (orchardAnalyticsQ.data?.estimations_trend ?? []).map((p) => Number((p.canopy_score ?? 0).toFixed(3))),
    [orchardAnalyticsQ.data]
  );
  const orchardVigor = useMemo(
    () => (orchardAnalyticsQ.data?.estimations_trend ?? []).map((p) => Number((p.vigor_score ?? 0).toFixed(3))),
    [orchardAnalyticsQ.data]
  );

  const orchardCanopyPct = useMemo(() => orchardCanopy.map((v) => Math.round(v * 100)), [orchardCanopy]);
  const orchardVigorPct = useMemo(() => orchardVigor.map((v) => Math.round(v * 100)), [orchardVigor]);

  const renderGauge = (
    label: string,
    value: number,
    maxValue: number,
    tone: string,
    formatter?: (v: number) => string
  ) => {
    const safe = Math.max(0, Math.min(maxValue, Number(value ?? 0)));
    const ratio = maxValue > 0 ? safe / maxValue : 0;
    return (
      <View style={styles.gaugeCard}>
        <View style={styles.gaugeHead}>
          <Text style={styles.gaugeLabel}>{label}</Text>
          <Text style={[styles.gaugeValue, { color: tone }]}>{formatter ? formatter(safe) : `${safe.toFixed(2)} / ${maxValue.toFixed(2)}`}</Text>
        </View>
        <View style={styles.gaugeTrack}>
          <View style={[styles.gaugeFill, { width: `${ratio * 100}%`, backgroundColor: tone }]} />
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={styles.toggleRow}>
        <Pressable style={[styles.toggle, days === 7 && styles.toggleOn]} onPress={() => setDays(7)}>
          <Text style={[styles.toggleText, days === 7 && { color: '#fff' }]}>7 days</Text>
        </Pressable>
        <Pressable style={[styles.toggle, days === 30 && styles.toggleOn]} onPress={() => setDays(30)}>
          <Text style={[styles.toggleText, days === 30 && { color: '#fff' }]}>30 days</Text>
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <StatTile label="Runs" value={String(data.summary.total_estimations)} />
        <StatTile label="Total kg" value={formatKg(data.summary.total_estimations_kg, 0)} />
        <StatTile label="Avg / run" value={formatKg(data.summary.avg_yield_per_estimation_kg, 1)} />
      </View>

      <View style={styles.statsRow}>
        <StatTile label="Canopy" value={(data.summary.avg_canopy_pct ?? 0).toFixed(2)} />
        <StatTile label="Vigor" value={(data.summary.avg_vigor_pct ?? 0).toFixed(2)} />
        <StatTile label="Ripeness" value={formatPct(data.summary.ripe_average_pct)} />
      </View>

      <AppCard style={{ marginTop: spacing.md }}>
        <Text style={styles.section}>Farm health snapshot</Text>
        {renderGauge('Ripeness', data.summary.ripe_average_pct, 100, colors.primary, (v) => formatPct(v))}
        <View style={{ height: spacing.sm }} />
        {renderGauge('Canopy', data.summary.avg_canopy_pct, 1, colors.accent, (v) => `${v.toFixed(2)} / 1.00`)}
        <View style={{ height: spacing.sm }} />
        {renderGauge('Vigor', data.summary.avg_vigor_pct, 1, colors.warning, (v) => `${v.toFixed(2)} / 1.00`)}
      </AppCard>

      <AppCard style={{ marginTop: spacing.md }}>
        <Text style={styles.section}>Yield trend (kg / day)</Text>
        {labels.length ? (
          <LineChart
            data={{
              labels,
              datasets: [{ data: yields.length ? yields : [0] }],
            }}
            width={chartWidth}
            height={200}
            chartConfig={{
              backgroundGradientFrom: colors.surface,
              backgroundGradientTo: colors.surface,
              color: () => colors.primary,
              labelColor: () => colors.textSecondary,
              propsForDots: { r: '3' },
            }}
            bezier
            style={{ marginTop: spacing.sm, borderRadius: 12 }}
          />
        ) : (
          <Text style={styles.muted}>Not enough points in this window.</Text>
        )}
      </AppCard>

      <Text style={styles.sectionOut}>By variety</Text>
      {data.by_variety.map((row) => (
        <AppCard key={row.variety} style={{ marginBottom: spacing.sm }}>
          <Text style={styles.variety}>{row.variety}</Text>
          <Text style={styles.muted}>
            {row.estimations} runs · avg {formatKg(row.avg_yield_kg, 1)} · max {formatKg(row.max_yield_kg, 1)}
          </Text>
        </AppCard>
      ))}

      <Text style={styles.sectionOut}>Task pulse</Text>
      <AppCard>
        <Text style={styles.muted}>
          Pending {data.task_summary.pending} · In progress {data.task_summary.in_progress} · Done{' '}
          {data.task_summary.completed} · Overdue {data.task_summary.overdue}
        </Text>
      </AppCard>

      <Text style={styles.sectionOut}>Orchard analytics</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
        {(orchardsQ.data ?? []).map((o) => (
          <Pressable
            key={o.id}
            onPress={() => setSelectedOrchardId(Number(o.id))}
            style={[
              styles.orchardChip,
              selectedOrchardId === Number(o.id) && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
          >
            <Text style={[styles.orchardChipText, selectedOrchardId === Number(o.id) && { color: '#fff' }]}>
              {o.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {orchardAnalyticsQ.data ? (
        <>
          <View style={styles.statsRow}>
            <StatTile label="Canopy" value={(orchardAnalyticsQ.data.summary.avg_canopy_score ?? 0).toFixed(2)} />
            <StatTile label="Vigor" value={(orchardAnalyticsQ.data.summary.avg_vvi_score ?? 0).toFixed(2)} />
            <StatTile label="Ripeness" value={formatPct(orchardAnalyticsQ.data.summary.avg_ripeness_pct ?? 0)} />
          </View>

          <View style={styles.statsRow}>
            <StatTile label="Uncertainty" value={formatKg(orchardAnalyticsQ.data.summary.avg_uncertainty_kg ?? 0, 1)} />
            <StatTile label="Overlap" value={(orchardAnalyticsQ.data.summary.avg_overlap_ratio ?? 0).toFixed(2)} />
          </View>

          <AppCard style={{ marginTop: spacing.md }}>
            <Text style={styles.section}>Selected orchard yield trend</Text>
            {orchardTrendLabels.length ? (
              <LineChart
                data={{ labels: orchardTrendLabels, datasets: [{ data: orchardYield.length ? orchardYield : [0] }] }}
                width={chartWidth}
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
              <Text style={styles.muted}>No orchard trend yet.</Text>
            )}
          </AppCard>

          <AppCard style={{ marginTop: spacing.md }}>
            <Text style={styles.section}>Selected orchard canopy and vigor trend</Text>
            {orchardTrendLabels.length ? (
              <LineChart
                data={{
                  labels: orchardTrendLabels,
                  legend: ['Canopy', 'Vigor'],
                  datasets: [
                    { data: orchardCanopyPct.length ? orchardCanopyPct : [0], color: () => colors.accent },
                    { data: orchardVigorPct.length ? orchardVigorPct : [0], color: () => colors.warning },
                  ],
                }}
                width={chartWidth}
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
              <Text style={styles.muted}>No orchard canopy or vigor trend yet.</Text>
            )}
          </AppCard>

          <AppCard style={{ marginTop: spacing.md }}>
            <Text style={styles.section}>Canopy and vigor profile</Text>
            <View style={styles.dualChartsRow}>
              <View style={[styles.pieChartBox, { width: stackedCanopyVigorCharts ? chartWidth : halfChartWidth }]}>
                <PieChart
                  data={[
                    {
                      name: 'Canopy',
                      population: Math.round((orchardAnalyticsQ.data.summary.avg_canopy_score ?? 0) * 100),
                      color: colors.accent,
                      legendFontColor: colors.text,
                      legendFontSize: 10,
                    },
                    {
                      name: 'Gap',
                      population: Math.max(0, 100 - Math.round((orchardAnalyticsQ.data.summary.avg_canopy_score ?? 0) * 100)),
                      color: colors.border,
                      legendFontColor: colors.text,
                      legendFontSize: 10,
                    },
                  ]}
                  width={stackedCanopyVigorCharts ? chartWidth : halfChartWidth}
                  height={150}
                  accessor="population"
                  backgroundColor="transparent"
                  chartConfig={{ color: () => colors.text }}
                  paddingLeft="2"
                  style={styles.centeredPie}
                />
              </View>
              <View style={[styles.pieChartBox, { width: stackedCanopyVigorCharts ? chartWidth : halfChartWidth }]}>
                <PieChart
                  data={[
                    {
                      name: 'Vigor',
                      population: Math.round((orchardAnalyticsQ.data.summary.avg_vvi_score ?? 0) * 100),
                      color: colors.warning,
                      legendFontColor: colors.text,
                      legendFontSize: 10,
                    },
                    {
                      name: 'Stress',
                      population: Math.max(0, 100 - Math.round((orchardAnalyticsQ.data.summary.avg_vvi_score ?? 0) * 100)),
                      color: colors.border,
                      legendFontColor: colors.text,
                      legendFontSize: 10,
                    },
                  ]}
                  width={stackedCanopyVigorCharts ? chartWidth : halfChartWidth}
                  height={150}
                  accessor="population"
                  backgroundColor="transparent"
                  chartConfig={{ color: () => colors.text }}
                  paddingLeft="2"
                  style={styles.centeredPie}
                />
              </View>
            </View>
            {orchardTrendLabels.length ? (
              <BarChart
                data={{
                  labels: orchardTrendLabels.slice(-6),
                  datasets: [
                    {
                      data: orchardCanopyPct.slice(-6),
                    },
                  ],
                }}
                width={chartWidth}
                height={190}
                fromZero
                yAxisLabel=""
                yAxisSuffix="%"
                chartConfig={{
                  backgroundGradientFrom: colors.surface,
                  backgroundGradientTo: colors.surface,
                  color: () => colors.accent,
                  labelColor: () => colors.textSecondary,
                  barPercentage: 0.6,
                }}
                style={{ marginTop: spacing.sm, borderRadius: 12 }}
              />
            ) : null}
            {orchardTrendLabels.length ? (
              <BarChart
                data={{
                  labels: orchardTrendLabels.slice(-6),
                  datasets: [
                    {
                      data: orchardVigorPct.slice(-6),
                    },
                  ],
                }}
                width={chartWidth}
                height={190}
                fromZero
                yAxisLabel=""
                yAxisSuffix="%"
                chartConfig={{
                  backgroundGradientFrom: colors.surface,
                  backgroundGradientTo: colors.surface,
                  color: () => colors.warning,
                  labelColor: () => colors.textSecondary,
                  barPercentage: 0.6,
                }}
                style={{ marginTop: spacing.sm, borderRadius: 12 }}
              />
            ) : null}
          </AppCard>

          <AppCard style={{ marginTop: spacing.md }}>
            <Text style={styles.section}>Selected orchard ripeness trend</Text>
            {orchardTrendLabels.length ? (
              <LineChart
                data={{ labels: orchardTrendLabels, datasets: [{ data: orchardRipeness.length ? orchardRipeness : [0] }] }}
                width={chartWidth}
                height={190}
                chartConfig={{
                  backgroundGradientFrom: colors.surface,
                  backgroundGradientTo: colors.surface,
                  color: () => colors.primaryDark,
                  labelColor: () => colors.textSecondary,
                }}
                bezier
                style={{ marginTop: spacing.sm, borderRadius: 12 }}
              />
            ) : (
              <Text style={styles.muted}>No orchard ripeness trend yet.</Text>
            )}
          </AppCard>
        </>
      ) : (
        <AppCard>
          <Text style={styles.muted}>Pick an orchard to view canopy, vigor, ripeness, and trend analytics here.</Text>
        </AppCard>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg, flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  toggleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
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
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  section: { ...typography.section, color: colors.primaryDark, marginBottom: spacing.sm },
  sectionOut: { ...typography.section, color: colors.primaryDark, marginTop: spacing.lg, marginBottom: spacing.sm },
  big: { ...typography.hero, color: colors.primaryDark },
  variety: { ...typography.bodyMedium, color: colors.text },
  muted: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  orchardChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
  },
  orchardChipText: { ...typography.caption, color: colors.text },
  gaugeCard: {
    paddingVertical: spacing.xs,
  },
  gaugeHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  gaugeLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  gaugeValue: { ...typography.bodyMedium, fontWeight: '800' },
  gaugeTrack: {
    height: 10,
    backgroundColor: colors.border,
    borderRadius: 999,
    overflow: 'hidden',
  },
  gaugeFill: { height: '100%', borderRadius: 999 },
  dualChartsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pieChartBox: { alignItems: 'center' },
  centeredPie: { alignSelf: 'center' },
});
