import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TaskListItem } from '@/api/types';
import { AppCard } from './AppCard';
import { colors, radius, spacing, typography } from '@/theme';
import { formatDate } from '@/utils/format';

type Props = {
  task: TaskListItem;
  onPress: () => void;
};

const statusColor: Record<string, string> = {
  pending: colors.warning,
  in_progress: colors.accent,
  completed: colors.success,
  cancelled: colors.textMuted,
};

export function TaskRow({ task, onPress }: Props) {
  const sc = statusColor[task.status] ?? colors.textMuted;
  return (
    <AppCard onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.avatar, { borderColor: sc }]}>
          <Ionicons name="checkbox-outline" size={20} color={sc} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={2}>
            {task.title}
          </Text>
          {task.orchard_name ? (
            <View style={styles.tag}>
              <Ionicons name="location-outline" size={12} color={colors.primary} />
              <Text style={styles.tagText}>{task.orchard_name}</Text>
            </View>
          ) : null}
          <View style={styles.footer}>
            <View style={[styles.chip, { borderColor: sc }]}>
              <Text style={[styles.chipText, { color: sc }]}>{task.status.replace('_', ' ')}</Text>
            </View>
            {task.due_date ? (
              <Text style={styles.due}>Due {formatDate(task.due_date)}</Text>
            ) : (
              <Text style={styles.due}>No due date</Text>
            )}
          </View>
        </View>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm, paddingVertical: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.chipBg,
  },
  title: { ...typography.bodyMedium, color: colors.text },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: colors.chipBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  tagText: { ...typography.micro, color: colors.primary },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  chip: {
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  chipText: { ...typography.micro, textTransform: 'capitalize' },
  due: { ...typography.caption, color: colors.textSecondary },
});
