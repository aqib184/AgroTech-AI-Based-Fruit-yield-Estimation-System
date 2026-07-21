import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SettingsStackParamList } from '@/navigation/types';
import { useOrchardsQuery } from '@/api/agroApi';
import type { OrchardListItem } from '@/api/types';
import { EmptyState } from '@/components/EmptyState';
import { colors, spacing, typography } from '@/theme';

type Props = NativeStackScreenProps<SettingsStackParamList, 'OrchardList'>;

export function OrchardListScreen({ navigation }: Props) {
  const { data, refetch, isFetching } = useOrchardsQuery();

  return (
    <View style={styles.flex}>
      <Pressable style={styles.add} onPress={() => navigation.navigate('OrchardForm', { mode: 'create' })}>
        <Text style={styles.addText}>＋ Add orchard</Text>
      </Pressable>
      <FlatList
        data={data ?? []}
        keyExtractor={(o) => String(o.id)}
        refreshing={isFetching}
        onRefresh={refetch}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80 }}
        ListEmptyComponent={<EmptyState title="No orchards" subtitle="Track blocks for history & tasks." />}
        renderItem={({ item }: { item: OrchardListItem }) => (
          <Pressable style={styles.card} onPress={() => navigation.navigate('OrchardDetail', { id: item.id })}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>
              {item.variety} · {item.total_trees} trees · {item.area_hectares} ha
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  add: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: colors.primaryDark,
    paddingVertical: spacing.md,
    borderRadius: 999,
    alignItems: 'center',
  },
  addText: { ...typography.caption, color: '#fff', fontWeight: '700' },
  card: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  name: { ...typography.bodyMedium, color: colors.text },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
});
