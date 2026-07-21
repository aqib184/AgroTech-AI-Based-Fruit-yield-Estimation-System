import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  useCreateTaskRuleMutation,
  useDeleteTaskRuleMutation,
  useTaskRulesQuery,
} from '@/api/agroApi';
import type { TaskRuleListItem } from '@/api/types';
import { AppCard } from '@/components/AppCard';
import { EmptyState } from '@/components/EmptyState';
import { colors, radius, spacing, typography } from '@/theme';

const schema = z.object({
  name: z.string().min(2),
  trigger_type: z.enum(['ripeness_high', 'ripeness_low', 'canopy_weak', 'vvi_low', 'routine']),
  ripeness_threshold: z.string().optional(),
  canopy_completeness_threshold: z.string().optional(),
  vvi_threshold: z.string().optional(),
  task_title: z.string().min(2),
  task_description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']),
});

type Form = z.infer<typeof schema>;

export function TaskRulesScreen() {
  const { data, refetch, isFetching } = useTaskRulesQuery();
  const [create, { isLoading }] = useCreateTaskRuleMutation();
  const [remove] = useDeleteTaskRuleMutation();
  const [open, setOpen] = useState(false);

  const { control, handleSubmit, reset } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      trigger_type: 'routine',
      task_title: 'Routine orchard check',
      task_description: '',
      priority: 'medium',
    },
  });

  const onSubmit = handleSubmit(async (v) => {
    const safeDescription = (v.task_description ?? '').trim() || `Auto-generated task for rule: ${v.name}`;
    const body: Record<string, unknown> = {
      name: v.name,
      trigger_type: v.trigger_type,
      task_title: v.task_title,
      task_description: safeDescription,
      priority: v.priority,
      is_active: true,
    };
    if (v.ripeness_threshold?.trim()) body.ripeness_threshold = Number(v.ripeness_threshold);
    if (v.canopy_completeness_threshold?.trim()) {
      body.canopy_completeness_threshold = Number(v.canopy_completeness_threshold);
    }
    if (v.vvi_threshold?.trim()) body.vvi_threshold = Number(v.vvi_threshold);
    try {
      await create(body).unwrap();
      reset();
      setOpen(false);
      refetch();
      Alert.alert('Rule saved', 'Task automation rule is now active.');
    } catch (e) {
      Alert.alert('Could not create rule', JSON.stringify(e).slice(0, 400));
    }
  });

  const list = (data ?? []) as TaskRuleListItem[];

  return (
    <View style={styles.flex}>
      <FlatList
        data={list}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 240 }}
        ListEmptyComponent={<EmptyState title="No rules" subtitle="Automate tasks after each estimation." />}
        refreshing={isFetching}
        onRefresh={refetch}
        renderItem={({ item }) => (
          <AppCard style={{ marginBottom: spacing.sm }}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>
              {item.trigger_type} · {item.priority}
            </Text>
            <Text style={styles.meta}>{item.task_title}</Text>
            <Pressable
              style={{ marginTop: spacing.sm }}
              onPress={() =>
                Alert.alert('Delete rule?', undefined, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      await remove(item.id).unwrap();
                      refetch();
                    },
                  },
                ])
              }
            >
              <Text style={styles.danger}>Delete</Text>
            </Pressable>
          </AppCard>
        )}
      />

      {open ? (
        <AppCard style={styles.form}>
          <ScrollView showsVerticalScrollIndicator contentContainerStyle={{ paddingBottom: spacing.sm }}>
            <Text style={styles.formTitle}>New rule</Text>
            <Text style={styles.label}>Name</Text>
            <Controller
              control={control}
              name="name"
              render={({ field, fieldState }) => (
                <>
                  <TextInput style={styles.input} onChangeText={field.onChange} value={field.value} />
                  {fieldState.error ? <Text style={styles.err}>{fieldState.error.message}</Text> : null}
                </>
              )}
            />
            <Text style={styles.label}>Trigger</Text>
            <Controller
              control={control}
              name="trigger_type"
              render={({ field }) => (
                <View style={styles.triggerRow}>
                  {TRIGGERS.map((t) => (
                    <Pressable
                      key={t.value}
                      onPress={() => field.onChange(t.value)}
                      style={[styles.triggerChip, field.value === t.value && styles.triggerChipOn]}
                    >
                      <Text style={[styles.triggerText, field.value === t.value && { color: '#fff' }]}>{t.label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            />
            <Text style={styles.label}>Task title</Text>
            <Controller
              control={control}
              name="task_title"
              render={({ field, fieldState }) => (
                <>
                  <TextInput style={styles.input} onChangeText={field.onChange} value={field.value} />
                  {fieldState.error ? <Text style={styles.err}>{fieldState.error.message}</Text> : null}
                </>
              )}
            />
            <Text style={styles.label}>Task description (optional)</Text>
            <Controller
              control={control}
              name="task_description"
              render={({ field }) => (
                <TextInput
                  style={[styles.input, { minHeight: 64 }]}
                  multiline
                  onChangeText={field.onChange}
                  value={field.value}
                />
              )}
            />
            <Text style={styles.label}>Ripeness threshold (optional)</Text>
            <Controller
              control={control}
              name="ripeness_threshold"
              render={({ field }) => (
                <TextInput
                  style={styles.input}
                  keyboardType="decimal-pad"
                  onChangeText={field.onChange}
                  value={field.value}
                />
              )}
            />
            <View style={styles.row}>
              <Pressable style={styles.cta} onPress={onSubmit} disabled={isLoading}>
                <Text style={styles.ctaText}>{isLoading ? 'Saving…' : 'Save'}</Text>
              </Pressable>
              <Pressable style={styles.cancel} onPress={() => setOpen(false)}>
                <Text>Cancel</Text>
              </Pressable>
            </View>
          </ScrollView>
        </AppCard>
      ) : null}

      <Pressable style={styles.fab} onPress={() => setOpen(true)}>
        <Text style={styles.fabText}>＋</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  name: { ...typography.bodyMedium, color: colors.text },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  danger: { color: colors.error, fontWeight: '700' },
  form: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    maxHeight: 460,
  },
  formTitle: { ...typography.section, marginBottom: spacing.sm },
  label: { ...typography.micro, color: colors.textMuted, marginTop: spacing.sm },
  err: { ...typography.caption, color: colors.error, marginTop: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: 4,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  triggerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  triggerChip: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  triggerChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  triggerText: { ...typography.caption, color: colors.text },
  row: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md, alignItems: 'center' },
  cta: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 999,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', fontWeight: '700' },
  cancel: { padding: spacing.md },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabText: { color: '#fff', fontSize: 26 },
});

const TRIGGERS = [
  { label: 'Routine', value: 'routine' },
  { label: 'Ripeness high', value: 'ripeness_high' },
  { label: 'Ripeness low', value: 'ripeness_low' },
  { label: 'Canopy weak', value: 'canopy_weak' },
  { label: 'VVI low', value: 'vvi_low' },
] as const;
