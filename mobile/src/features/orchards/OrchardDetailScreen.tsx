import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SettingsStackParamList } from '@/navigation/types';
import { useDeleteOrchardMutation, useOrchardQuery } from '@/api/agroApi';
import { AppCard } from '@/components/AppCard';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/Skeleton';
import { colors, spacing, typography } from '@/theme';
import { formatDate, formatKg, formatPct } from '@/utils/format';

type Props = NativeStackScreenProps<SettingsStackParamList, 'OrchardDetail'>;

export function OrchardDetailScreen({ route, navigation }: Props) {
  const { data, isLoading, isError, refetch } = useOrchardQuery(route.params.id);
  const [removeOrchard, { isLoading: deleting }] = useDeleteOrchardMutation();

  if (isLoading && !data) {
    return (
      <View style={styles.pad}>
        <Skeleton height={200} />
      </View>
    );
  }
  if (isError || !data) return <ErrorState message="Orchard not found." onRetry={refetch} />;

  const tabNav = navigation.getParent();

  const onDelete = async () => {
    if (!data || deleting) return;
    try {
      await removeOrchard(data.id).unwrap();
      navigation.navigate('OrchardList');
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e && 'data' in e ? JSON.stringify((e as { data: unknown }).data) : String(e);
      Alert.alert('Delete failed', msg.slice(0, 300));
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 100 }}>
      <Text style={styles.title}>{data.name}</Text>
      <Text style={styles.meta}>
        {data.variety} · {data.tree_maturity} · {data.planting_density}
      </Text>

      <View style={styles.row}>
        <Pressable
          style={styles.primaryBtn}
          onPress={() =>
            tabNav?.navigate('EstimationTab', {
              screen: 'EstimationForm',
              params: { orchardId: data.id },
            })
          }
        >
          <Text style={styles.primaryBtnText}>New estimation</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryBtn}
          onPress={() => navigation.navigate('OrchardForm', { mode: 'edit', id: data.id })}
        >
          <Text style={styles.secondaryBtnText}>Edit</Text>
        </Pressable>
      </View>

      <AppCard style={{ marginTop: spacing.lg }}>
        <Text style={styles.section}>Specs</Text>
        <Text style={styles.line}>Area: {data.area_hectares} ha</Text>
        <Text style={styles.line}>Trees: {data.total_trees}</Text>
        <Text style={styles.line}>Density (trees/ha): {data.trees_per_hectare.toFixed(1)}</Text>
        <Text style={styles.line}>Section: {data.section || '—'}</Text>
      </AppCard>

      <AppCard style={{ marginTop: spacing.md }}>
        <Text style={styles.section}>Performance</Text>
        <Text style={styles.line}>Estimations: {data.estimation_count}</Text>
        <Text style={styles.line}>Avg yield: {data.avg_yield_kg != null ? formatKg(data.avg_yield_kg, 1) : '—'}</Text>
      </AppCard>

      {data.latest_estimation ? (
        <AppCard style={{ marginTop: spacing.md }}>
          <Text style={styles.section}>Latest run</Text>
          <Text style={styles.line}>{formatDate(data.latest_estimation.estimation_date)}</Text>
          <Text style={styles.line}>{formatKg(data.latest_estimation.orchard_yield_kg, 1)}</Text>
          <Text style={styles.line}>Ripe {formatPct(data.latest_estimation.ripe_percentage)}</Text>
        </AppCard>
      ) : null}

      <Pressable
        style={styles.deleteBtn}
        onPress={() => {
          if (Platform.OS === 'web') {
            const ok =
              typeof globalThis.confirm === 'function'
                ? globalThis.confirm('Delete this orchard? This also removes its estimation history and related tasks.')
                : true;
            if (ok) {
              void onDelete();
            }
            return;
          }

          Alert.alert(
            'Delete orchard?',
            'This also removes its estimation history and related tasks.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: deleting ? 'Deleting…' : 'Delete', style: 'destructive', onPress: () => void onDelete() },
            ]
          );
        }}
      >
        <Text style={styles.deleteBtnText}>{deleting ? 'Deleting orchard…' : 'Delete orchard'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg, flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  title: { ...typography.hero, color: colors.primaryDark },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 999,
    alignItems: 'center',
  },
  primaryBtnText: { ...typography.caption, color: '#fff', fontWeight: '700' },
  secondaryBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  secondaryBtnText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  section: { ...typography.section, color: colors.primaryDark, marginBottom: spacing.sm },
  line: { ...typography.body, color: colors.text, marginBottom: 4 },
  deleteBtn: { marginTop: spacing.xl, alignItems: 'center', paddingVertical: spacing.md },
  deleteBtnText: { ...typography.bodyMedium, color: colors.error },
});
