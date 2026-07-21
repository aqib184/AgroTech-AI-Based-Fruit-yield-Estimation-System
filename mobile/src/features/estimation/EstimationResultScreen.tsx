import { useMemo } from 'react';
import { Dimensions, Image, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { EstimationStackParamList } from '@/navigation/types';
import { useAppSelector } from '@/store/hooks';
import { AppCard } from '@/components/AppCard';
import { EmptyState } from '@/components/EmptyState';
import { colors, radius, spacing, typography } from '@/theme';
import { formatKg, formatPct } from '@/utils/format';

type Props = NativeStackScreenProps<EstimationStackParamList, 'EstimationResult'>;

const W = Dimensions.get('window').width - 32;

export function EstimationResultScreen({ navigation }: Props) {
  const result = useAppSelector((s) => s.prediction.lastResult);

  const summaryText = useMemo(() => {
    if (!result) return '';
    const y = result.yield_estimate;
    return [
      `Adjusted fruit: ${result.fruit_count.adjusted_count}`,
      `Yield: ${y.orchard_yield_kg} kg (${y.orchard_yield_tonnes} t)`,
      `CI: ${y.confidence_interval.lower_kg}–${y.confidence_interval.upper_kg} kg`,
      result.harvest_recommendation,
    ].join('\n');
  }, [result]);

  const onShare = async () => {
    if (!result) return;
    try {
      await Share.share({ message: summaryText, title: 'Yield estimation' });
    } catch {
      /* ignore */
    }
  };

  if (!result) {
    return (
      <View style={styles.wrap}>
        <EmptyState title="No results" subtitle="Run an estimation first." />
        <Pressable style={styles.btn} onPress={() => navigation.navigate('EstimationForm')}>
          <Text style={styles.btnText}>Go to form</Text>
        </Pressable>
      </View>
    );
  }

  const vis = result.visualizations ?? [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={styles.actions}>
        <Pressable style={styles.secondary} onPress={() => navigation.navigate('EstimationHistory')}>
          <Text style={styles.secondaryText}>View history</Text>
        </Pressable>
        <Pressable style={styles.primary} onPress={onShare}>
          <Text style={styles.primaryText}>Share summary</Text>
        </Pressable>
      </View>

      <AppCard style={{ marginBottom: spacing.md }}>
        <Text style={styles.section}>Fruit count</Text>
        <Text style={styles.line}>Raw: {result.fruit_count.raw_count}</Text>
        <Text style={styles.line}>Adjusted: {result.fruit_count.adjusted_count}</Text>
        <Text style={styles.line}>Overlap ratio: {result.fruit_count.overlap_ratio}</Text>
      </AppCard>

      <AppCard style={{ marginBottom: spacing.md }}>
        <Text style={styles.section}>Ripeness</Text>
        <Text style={styles.line}>Ripe: {formatPct(result.ripeness.ripe_percentage)}</Text>
        <Text style={styles.line}>Mid-ripe: {formatPct(result.ripeness.midripe_percentage)}</Text>
        <Text style={styles.line}>Unripe: {formatPct(result.ripeness.unripe_percentage)}</Text>
        <Text style={styles.line}>Flowers ignored: {result.ripeness.flower_count_ignored}</Text>
      </AppCard>

      <AppCard style={{ marginBottom: spacing.md }}>
        <Text style={styles.section}>Yield</Text>
        <Text style={styles.big}>{formatKg(result.yield_estimate.orchard_yield_kg, 1)}</Text>
        <Text style={styles.line}>
          Confidence: {formatKg(result.yield_estimate.confidence_interval.lower_kg, 0)} –{' '}
          {formatKg(result.yield_estimate.confidence_interval.upper_kg, 0)}
        </Text>
        <Text style={styles.line}>Uncertainty ratio: {result.yield_estimate.uncertainty_ratio}</Text>
      </AppCard>

      <AppCard style={{ marginBottom: spacing.md }}>
        <Text style={styles.section}>Harvest</Text>
        <Text style={styles.body}>{result.harvest_recommendation}</Text>
      </AppCard>

      {result.history ? (
        <AppCard style={{ marginBottom: spacing.md }}>
          <Text style={styles.section}>Saved to farm</Text>
          <Text style={styles.line}>saved: {String(result.history.saved)}</Text>
          {result.history.estimation_id != null ? (
            <Text style={styles.line}>estimation_id: {result.history.estimation_id}</Text>
          ) : null}
          {result.history.error ? <Text style={styles.err}>{result.history.error}</Text> : null}
        </AppCard>
      ) : null}

      {vis.length ? (
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={styles.section}>Visual overlays</Text>
          {Platform.OS === 'web' ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={{ width: W, marginTop: spacing.sm }}
            >
              {vis.map((v) => (
                <View key={v.image_index} style={{ width: W, padding: spacing.sm }}>
                  <Text style={styles.caption}>Image {v.image_index + 1} · detections {v.detected_count}</Text>
                  <Image
                    source={{ uri: `data:image/png;base64,${v.bbox_overlay_base64}` }}
                    style={{ width: W - 16, height: 260, borderRadius: 12 }}
                    resizeMode="cover"
                  />
                </View>
              ))}
            </ScrollView>
          ) : (
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ width: W, marginTop: spacing.sm }}>
              {vis.map((v) => (
                <View key={v.image_index} style={{ width: W, padding: spacing.sm }}>
                  <Text style={styles.caption}>Image {v.image_index + 1} · detections {v.detected_count}</Text>
                  <Image
                    source={{ uri: `data:image/png;base64,${v.bbox_overlay_base64}` }}
                    style={{ width: W - 16, height: 260, borderRadius: 12 }}
                    resizeMode="cover"
                  />
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, justifyContent: 'center' },
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md, gap: spacing.sm },
  primary: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  primaryText: { ...typography.caption, color: '#fff', fontWeight: '700' },
  secondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  secondaryText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  btn: { marginTop: spacing.lg, alignSelf: 'center', padding: spacing.md },
  btnText: { color: colors.primary, fontWeight: '700' },
  section: { ...typography.section, color: colors.primaryDark, marginBottom: spacing.sm },
  line: { ...typography.body, color: colors.text, marginBottom: 4 },
  big: { ...typography.hero, color: colors.primaryDark },
  body: { ...typography.body, color: colors.text },
  caption: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs },
  err: { ...typography.caption, color: colors.error, marginTop: spacing.sm },
});
