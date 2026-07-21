import { Alert, Dimensions, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { EstimationStackParamList } from '@/navigation/types';
import { useDeleteEstimationMutation, useEstimationQuery } from '@/api/agroApi';
import { AppCard } from '@/components/AppCard';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/Skeleton';
import { colors, spacing, typography } from '@/theme';
import { formatDate, formatKg, formatPct } from '@/utils/format';

type Props = NativeStackScreenProps<EstimationStackParamList, 'EstimationDetail'>;
const CHART_W = Dimensions.get('window').width - 64;

export function EstimationDetailScreen({ route, navigation }: Props) {
  const { data, isLoading, isError, refetch } = useEstimationQuery(route.params.id);
  const [remove] = useDeleteEstimationMutation();

  const onDelete = async () => {
    if (!data) return;
    try {
      await remove(data.id).unwrap();
      navigation.navigate('EstimationHistory');
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e && 'data' in e ? JSON.stringify((e as { data: unknown }).data) : String(e);
      Alert.alert('Delete failed', msg.slice(0, 300));
    }
  };

  if (isLoading && !data) {
    return (
      <View style={styles.pad}>
        <Skeleton height={200} />
      </View>
    );
  }
  if (isError || !data) return <ErrorState message="Estimation not found." onRetry={refetch} />;

  const visualizations = data.visualizations ?? [];
  const featureEntries = Object.entries(data.feature_vector ?? {}).slice(0, 8);

  const toImageUri = (value: string) => {
    if (!value) return '';
    return value.startsWith('data:') ? value : `data:image/png;base64,${value}`;
  };

  const ripenessChart = [
    {
      name: 'Ripe',
      population: Math.max(0, data.ripeness.ripe_pct ?? 0),
      color: colors.success,
      legendFontColor: colors.text,
      legendFontSize: 11,
    },
    {
      name: 'Mid',
      population: Math.max(0, data.ripeness.midripe_pct ?? 0),
      color: colors.warning,
      legendFontColor: colors.text,
      legendFontSize: 11,
    },
    {
      name: 'Unripe',
      population: Math.max(0, data.ripeness.unripe_pct ?? 0),
      color: colors.accent,
      legendFontColor: colors.text,
      legendFontSize: 11,
    },
  ];

  const renderScoreBar = (label: string, value: number | null | undefined, maxValue: number, tone: string, formatter?: (v: number) => string) => {
    const safe = Math.max(0, Math.min(maxValue, Number(value ?? 0)));
    const ratio = maxValue > 0 ? safe / maxValue : 0;
    return (
      <View style={styles.metricBarBlock}>
        <View style={styles.metricBarHead}>
          <Text style={styles.metricBarLabel}>{label}</Text>
          <Text style={[styles.metricBarValue, { color: tone }]}>{formatter ? formatter(safe) : safe.toFixed(2)}</Text>
        </View>
        <View style={styles.metricBarTrack}>
          <View style={[styles.metricBarFill, { width: `${ratio * 100}%`, backgroundColor: tone }]} />
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 80 }}>
      <Text style={styles.head}>{data.orchard.name}</Text>
      <Text style={styles.sub}>{formatDate(data.estimation_date)}</Text>

      <AppCard style={{ marginTop: spacing.lg }}>
        <Text style={styles.section}>Fruit</Text>
        <Text style={styles.line}>Raw: {data.raw_fruit_count}</Text>
        <Text style={styles.line}>Adjusted: {data.adjusted_fruit_count}</Text>
        <Text style={styles.line}>Overlap: {data.overlap_ratio}</Text>
      </AppCard>

      <AppCard style={{ marginTop: spacing.md }}>
        <Text style={styles.section}>Ripeness</Text>
        <PieChart
          data={ripenessChart}
          width={CHART_W}
          height={170}
          accessor="population"
          backgroundColor="transparent"
          chartConfig={{
            color: () => colors.text,
          }}
          paddingLeft="10"
          absolute
        />
        <Text style={styles.line}>Flower filtered: {data.ripeness.flower_filtered}</Text>
      </AppCard>

      <AppCard style={{ marginTop: spacing.md }}>
        <Text style={styles.section}>Canopy</Text>
        {renderScoreBar('Density', data.canopy.canopy_density, 1, colors.accent, (v) => `${v.toFixed(2)} / 1.00`)}
        {renderScoreBar('Completeness', data.canopy.canopy_completeness, 1, colors.primary, (v) => `${v.toFixed(2)} / 1.00`)}
      </AppCard>

      <AppCard style={{ marginTop: spacing.md }}>
        <Text style={styles.section}>Vegetation vigor</Text>
        {renderScoreBar('RGB VVI', data.vegetation_vigor.rgb_vvi_score, 1, colors.warning, (v) => `${v.toFixed(2)} / 1.00`)}
        {renderScoreBar('Reliability', data.vegetation_vigor.vvi_reliability, 1, colors.primaryDark, (v) => `${v.toFixed(2)} / 1.00`)}
      </AppCard>

      <AppCard style={{ marginTop: spacing.md }}>
        <Text style={styles.section}>Yield</Text>
        <Text style={styles.big}>{formatKg(data.yield_estimate.orchard_yield_kg, 1)}</Text>
        <Text style={styles.line}>Uncertainty: ±{formatKg(data.yield_estimate.yield_uncertainty_kg, 0)}</Text>
        {data.harvest_recommendation ? <Text style={styles.recommendation}>{data.harvest_recommendation}</Text> : null}
      </AppCard>

      {featureEntries.length ? (
        <AppCard style={{ marginTop: spacing.md }}>
          <Text style={styles.section}>Saved feature snapshot</Text>
          <View style={styles.featureWrap}>
            {featureEntries.map(([key, value]) => (
              <View key={key} style={styles.featureChip}>
                <Text style={styles.featureKey}>{key}</Text>
                <Text style={styles.featureValue}>{String(value)}</Text>
              </View>
            ))}
          </View>
        </AppCard>
      ) : null}

      {visualizations.length ? (
        <AppCard style={{ marginTop: spacing.md }}>
          <Text style={styles.section}>Saved visuals</Text>
          {visualizations.map((item, index) => {
            const overlay = toImageUri(item.bbox_overlay_base64);
            const leaf = toImageUri(item.leaf_overlay_base64);
            return (
              <View key={`${item.image_index}-${index}`} style={styles.visualBlock}>
                <Text style={styles.visualTitle}>Tree image {item.image_index + 1}</Text>
                <Text style={styles.line}>Detected count: {item.detected_count}</Text>
                <Text style={styles.line}>Leaf method: {item.leaf_method}</Text>
                {overlay ? <Image source={{ uri: overlay }} style={styles.visualImage} /> : null}
                {leaf ? <Image source={{ uri: leaf }} style={styles.visualImage} /> : null}
              </View>
            );
          })}
        </AppCard>
      ) : (
        <AppCard style={{ marginTop: spacing.md }}>
          <Text style={styles.section}>Saved visuals</Text>
          <Text style={styles.body}>No saved overlays found for this historical run. New estimations now persist visualizations.</Text>
        </AppCard>
      )}

      {data.notes ? (
        <AppCard style={{ marginTop: spacing.md }}>
          <Text style={styles.section}>Notes</Text>
          <Text style={styles.body}>{data.notes}</Text>
        </AppCard>
      ) : null}

      <Pressable
        style={styles.deleteBtn}
        onPress={() => {
          if (Platform.OS === 'web') {
            const ok = typeof globalThis.confirm === 'function' ? globalThis.confirm('Delete this estimation from history?') : true;
            if (ok) {
              void onDelete();
            }
            return;
          }
          Alert.alert('Delete estimation?', 'This will remove it from history.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => void onDelete() },
          ]);
        }}
      >
        <Text style={styles.deleteText}>Delete estimation</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg, flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  head: { ...typography.title, color: colors.primaryDark },
  sub: { ...typography.caption, color: colors.textSecondary },
  section: { ...typography.section, color: colors.primaryDark, marginBottom: spacing.sm },
  line: { ...typography.body, color: colors.text, marginBottom: 4 },
  big: { ...typography.hero, color: colors.primaryDark },
  body: { ...typography.body, color: colors.text },
  recommendation: { ...typography.bodyMedium, color: colors.primaryDark, marginTop: spacing.sm },
  featureWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  featureChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 120,
    flexGrow: 1,
  },
  featureKey: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  featureValue: { ...typography.bodyMedium, color: colors.text, marginTop: 4 },
  visualBlock: {
    marginBottom: spacing.md,
  },
  visualTitle: { ...typography.bodyMedium, color: colors.text, marginBottom: spacing.xs },
  visualImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginTop: spacing.sm,
    backgroundColor: colors.border,
  },
  metricBarBlock: { marginBottom: spacing.sm },
  metricBarHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  metricBarLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  metricBarValue: { ...typography.bodyMedium, fontWeight: '800' },
  metricBarTrack: { height: 10, borderRadius: 999, backgroundColor: colors.border, overflow: 'hidden' },
  metricBarFill: { height: '100%', borderRadius: 999 },
  deleteBtn: { marginTop: spacing.xl, alignItems: 'center', paddingVertical: spacing.md },
  deleteText: { ...typography.bodyMedium, color: colors.error },
});
