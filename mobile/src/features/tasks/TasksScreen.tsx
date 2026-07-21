import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TasksStackParamList } from '@/navigation/types';
import { useProfileQuery, useTaskSummaryQuery, useTasksQuery } from '@/api/agroApi';
import { useAppSelector } from '@/store/hooks';
import { useAppWeather } from '@/hooks/useAppWeather';
import type { TaskListItem } from '@/api/types';
import { TaskRow } from '@/components/TaskRow';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/Skeleton';
import { colors, spacing, typography } from '@/theme';
import dayjs from 'dayjs';

type Props = NativeStackScreenProps<TasksStackParamList, 'TaskList'>;

const STATUS_OPTS = ['', 'pending', 'in_progress', 'completed', 'cancelled'] as const;
const PRIORITY_OPTS = ['', 'low', 'medium', 'high'] as const;

export function TasksScreen({ navigation }: Props) {
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const { data: profile } = useProfileQuery(undefined, { skip: !accessToken });
  const weather = useAppWeather(profile);

  const [status, setStatus] = useState<string>('');
  const [priority, setPriority] = useState<string>('');
  const [overdueOnly, setOverdueOnly] = useState(false);

  const dueBefore = overdueOnly ? dayjs().format('YYYY-MM-DD') : undefined;

  const queryArgs = useMemo(
    () => ({
      page: 1,
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(dueBefore ? { due_date_before: dueBefore } : {}),
    }),
    [status, priority, dueBefore]
  );

  const { data, isLoading, isError, refetch } = useTasksQuery(queryArgs);
  const summaryQ = useTaskSummaryQuery();

  const list = data?.results ?? [];
  const totalOpen = (summaryQ.data?.pending ?? 0) + (summaryQ.data?.in_progress ?? 0);
  const done = summaryQ.data?.completed ?? 0;
  const frac = totalOpen + done > 0 ? done / (totalOpen + done) : 0;
  const R = 36;
  const C = 2 * Math.PI * R;

  const renderItem = ({ item }: { item: TaskListItem }) => (
    <TaskRow task={item} onPress={() => navigation.navigate('TaskDetail', { id: item.id })} />
  );

  if (isLoading && !data) {
    return (
      <View style={styles.pad}>
        <Skeleton height={120} style={{ marginBottom: spacing.md }} />
        <Skeleton height={72} />
      </View>
    );
  }
  if (isError) return <ErrorState message="Tasks could not be loaded." onRetry={refetch} />;

  return (
    <View style={styles.flex}>
      {weather.data ? (
        <View
          style={[
            styles.weatherBadge,
            weather.data.sprayHint.tone === 'good' && { backgroundColor: colors.chipBg },
            weather.data.sprayHint.tone === 'caution' && { backgroundColor: 'rgba(233,196,106,0.35)' },
            weather.data.sprayHint.tone === 'bad' && { backgroundColor: 'rgba(231,111,81,0.25)' },
          ]}
        >
          <Text style={styles.weatherBadgeText}>{weather.data.sprayHint.label}</Text>
          <Text style={styles.weatherBadgeMeta}>Rain chance up to {weather.data.rainChancePct}%</Text>
        </View>
      ) : null}

      <View style={styles.progressCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.progressTitle}>Progress</Text>
          <Text style={styles.progressSub}>
            {done} completed · {totalOpen} remaining
          </Text>
          {summaryQ.data ? (
            <Text style={styles.overdue}>{summaryQ.data.overdue} overdue</Text>
          ) : null}
        </View>
        <View style={styles.ring}>
          <Svg width={88} height={88} viewBox="0 0 88 88">
            <Circle
              cx={44}
              cy={44}
              r={R}
              stroke={colors.border}
              strokeWidth={10}
              fill="none"
              transform="rotate(-90 44 44)"
            />
            <Circle
              cx={44}
              cy={44}
              r={R}
              stroke={colors.primary}
              strokeWidth={10}
              fill="none"
              strokeDasharray={`${C}`}
              strokeDashoffset={C * (1 - frac)}
              strokeLinecap="round"
              transform="rotate(-90 44 44)"
            />
          </Svg>
          <Text style={styles.ringLabel}>{Math.round(frac * 100)}%</Text>
        </View>
      </View>

      <View style={styles.filters}>
        <View style={styles.filtersRow}>
          <FilterChip label="Overdue" active={overdueOnly} onPress={() => setOverdueOnly((o) => !o)} />
          {STATUS_OPTS.map((s) => (
            <FilterChip
              key={s || 'all'}
              label={s ? s.replace('_', ' ') : 'All status'}
              active={status === s}
              onPress={() => setStatus(s)}
            />
          ))}
        </View>
        <View style={styles.filtersRow}>
          {PRIORITY_OPTS.map((p) => (
            <FilterChip
              key={p || 'allp'}
              label={p || 'All priority'}
              active={priority === p}
              onPress={() => setPriority(p)}
            />
          ))}
        </View>
      </View>

      <FlatList
        data={list}
        keyExtractor={(t) => String(t.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
        refreshing={isLoading}
        onRefresh={refetch}
        ListEmptyComponent={<EmptyState title="No tasks match filters" />}
      />

      <Pressable style={styles.fab} onPress={() => navigation.navigate('CreateTask')}>
        <Text style={styles.fabText}>＋</Text>
      </Pressable>
    </View>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
    >
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  weatherBadge: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  weatherBadgeText: { ...typography.caption, color: colors.primaryDark, fontWeight: '700' },
  weatherBadgeMeta: { ...typography.micro, color: colors.textSecondary, marginTop: 4 },
  pad: { padding: spacing.lg, flex: 1, backgroundColor: colors.bg },
  progressCard: {
    margin: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressTitle: { ...typography.section, color: colors.primaryDark },
  progressSub: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  overdue: { ...typography.caption, color: colors.warning, marginTop: 4 },
  ring: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center' },
  ringLabel: { position: 'absolute', ...typography.bodyMedium, color: colors.primaryDark },
  filters: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  filtersRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.xs },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    marginRight: spacing.sm,
    marginBottom: spacing.xs,
    backgroundColor: colors.surface,
  },
  chipText: { ...typography.caption, color: colors.text, textTransform: 'capitalize' },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  fabText: { color: '#fff', fontSize: 28, marginTop: -2 },
});
