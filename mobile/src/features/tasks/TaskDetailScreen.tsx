import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TasksStackParamList } from '@/navigation/types';
import { useDeleteTaskMutation, useTaskQuery, useUpdateTaskMutation } from '@/api/agroApi';
import { AppCard } from '@/components/AppCard';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/Skeleton';
import { colors, spacing, typography } from '@/theme';
import { formatDate } from '@/utils/format';

type Props = NativeStackScreenProps<TasksStackParamList, 'TaskDetail'>;

const NEXT: Record<string, string[]> = {
  pending: ['in_progress', 'completed', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function TaskDetailScreen({ route, navigation }: Props) {
  const { data, isLoading, isError, refetch } = useTaskQuery(route.params.id);
  const [update, { isLoading: saving }] = useUpdateTaskMutation();
  const [remove] = useDeleteTaskMutation();

  if (isLoading && !data) {
    return (
      <View style={styles.pad}>
        <Skeleton height={160} />
      </View>
    );
  }
  if (isError || !data) return <ErrorState message="Task not found." onRetry={refetch} />;

  const options = NEXT[data.status] ?? [];

  const change = async (status: string) => {
    try {
      await update({ id: data.id, status }).unwrap();
      refetch();
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e && 'data' in e ? JSON.stringify((e as { data: unknown }).data) : String(e);
      Alert.alert('Update failed', msg.slice(0, 300));
    }
  };

  const onDelete = () => {
    const performDelete = async () => {
      try {
        await remove(data.id).unwrap();
        navigation.navigate('TaskList');
      } catch (e: unknown) {
        const msg =
          typeof e === 'object' && e && 'data' in e ? JSON.stringify((e as { data: unknown }).data) : String(e);
        Alert.alert('Delete failed', msg.slice(0, 300));
      }
    };

    if (Platform.OS === 'web') {
      const ok = typeof globalThis.confirm === 'function' ? globalThis.confirm('Delete task? This cannot be undone.') : true;
      if (ok) {
        void performDelete();
      }
      return;
    }

    Alert.alert('Delete task?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void performDelete();
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <AppCard>
        <Text style={styles.title}>{data.title}</Text>
        <Text style={styles.meta}>Priority: {data.priority}</Text>
        <Text style={styles.meta}>Status: {data.status}</Text>
        {data.due_date ? <Text style={styles.meta}>Due {formatDate(data.due_date)}</Text> : null}
        <Text style={styles.body}>{data.description || 'No description.'}</Text>
      </AppCard>

      <Text style={styles.section}>Move status</Text>
      <View style={styles.row}>
        {options.map((s) => (
          <Pressable
            key={s}
            style={[styles.btn, saving && { opacity: 0.6 }]}
            disabled={saving}
            onPress={() => change(s)}
          >
            <Text style={styles.btnText}>{s.replace('_', ' ')}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.danger} onPress={onDelete}>
        <Text style={styles.dangerText}>Delete task</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg, flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  title: { ...typography.title, color: colors.primaryDark },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  body: { ...typography.body, color: colors.text, marginTop: spacing.md },
  section: { ...typography.section, color: colors.primaryDark, marginTop: spacing.xl },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  btn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  btnText: { ...typography.caption, color: '#fff', fontWeight: '700', textTransform: 'capitalize' },
  danger: { marginTop: spacing.xxl, alignItems: 'center' },
  dangerText: { color: colors.error, fontWeight: '700' },
});
