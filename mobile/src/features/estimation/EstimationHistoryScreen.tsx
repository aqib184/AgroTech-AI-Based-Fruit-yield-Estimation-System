import { Alert, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { EstimationStackParamList } from '@/navigation/types';
import { useDeleteEstimationMutation, useEstimationsQuery } from '@/api/agroApi';
import type { EstimationListItem } from '@/api/types';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/Skeleton';
import { colors, spacing, typography } from '@/theme';
import { formatDate, formatKg, formatPct } from '@/utils/format';

type Props = NativeStackScreenProps<EstimationStackParamList, 'EstimationHistory'>;

export function EstimationHistoryScreen({ navigation }: Props) {
  const { data, isLoading, isError, refetch } = useEstimationsQuery({ page: 1, days: 90 });
  const [remove] = useDeleteEstimationMutation();

  const onDelete = async (id: number) => {
    try {
      await remove(id).unwrap();
      refetch();
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e && 'data' in e ? JSON.stringify((e as { data: unknown }).data) : String(e);
      Alert.alert('Delete failed', msg.slice(0, 300));
    }
  };

  const renderItem = ({ item }: { item: EstimationListItem }) => (
    <View style={styles.row}>
      <Pressable style={{ flex: 1 }} onPress={() => navigation.navigate('EstimationDetail', { id: item.id })}>
        <Text style={styles.title}>{item.orchard_name}</Text>
        <Text style={styles.meta}>{formatDate(item.estimation_date)}</Text>
      </Pressable>
      <View style={{ alignItems: 'flex-end', marginLeft: spacing.md }}>
        <Text style={styles.yield}>{formatKg(item.orchard_yield_kg, 1)}</Text>
        <Text style={styles.meta}>{formatPct(item.ripe_percentage)} ripe</Text>
        <Text style={styles.meta}>Canopy {formatPct(item.canopy_completeness_score)}</Text>
        <Text style={styles.meta}>VVI {item.rgb_vvi_score.toFixed(2)}</Text>
        <Text style={styles.meta}>±{formatKg(item.yield_uncertainty_kg, 0)}</Text>
        <Pressable
          onPress={() => {
            if (Platform.OS === 'web') {
              const ok = typeof globalThis.confirm === 'function' ? globalThis.confirm('Delete this estimation?') : true;
              if (ok) {
                void onDelete(item.id);
              }
              return;
            }
            Alert.alert('Delete estimation?', 'This will remove it from history.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => void onDelete(item.id) },
            ]);
          }}
          style={styles.deleteBtn}
        >
          <Text style={styles.deleteText}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );

  if (isLoading && !data) {
    return (
      <View style={styles.pad}>
        <Skeleton height={64} style={{ marginBottom: spacing.sm }} />
        <Skeleton height={64} style={{ marginBottom: spacing.sm }} />
        <Skeleton height={64} />
      </View>
    );
  }
  if (isError) return <ErrorState message="Could not load estimations." onRetry={refetch} />;

  const list = data?.results ?? [];

  return (
    <FlatList
      data={list}
      keyExtractor={(i) => String(i.id)}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80 }}
      refreshing={isLoading}
      onRefresh={refetch}
      ListEmptyComponent={<EmptyState title="No estimations yet" subtitle="Run your first yield prediction." />}
      renderItem={renderItem}
    />
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg, backgroundColor: colors.bg, flex: 1 },
  row: {
    flexDirection: 'row',
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { ...typography.bodyMedium, color: colors.text },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  yield: { ...typography.bodyMedium, color: colors.primaryDark },
  deleteBtn: { marginTop: spacing.sm, paddingVertical: 2 },
  deleteText: { ...typography.caption, color: colors.error, fontWeight: '700' },
});
