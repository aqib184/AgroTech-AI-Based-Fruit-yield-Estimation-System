import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { OrchardListItem } from '@/api/types';
import { AppCard } from './AppCard';
import { colors, spacing, typography } from '@/theme';
import { formatDate, formatKg } from '@/utils/format';

type Props = {
  orchard: OrchardListItem;
  onPress: () => void;
};

export function OrchardCard({ orchard, onPress }: Props) {
  return (
    <AppCard onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Ionicons name="leaf" size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{orchard.name}</Text>
          <Text style={styles.meta}>
            {orchard.variety} · {orchard.total_trees.toLocaleString()} trees
          </Text>
          <Text style={styles.yield}>
            Last:{' '}
            {orchard.last_estimation_yield_kg != null
              ? formatKg(orchard.last_estimation_yield_kg, 1)
              : 'No runs yet'}
          </Text>
          {orchard.last_estimation_date ? (
            <Text style={styles.date}>{formatDate(orchard.last_estimation_date)}</Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm, paddingVertical: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { ...typography.bodyMedium, color: colors.text },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  yield: { ...typography.caption, color: colors.primaryDark, marginTop: spacing.xs },
  date: { ...typography.micro, color: colors.textMuted, marginTop: 2 },
});
