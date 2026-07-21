import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TasksStackParamList } from '@/navigation/types';
import { useCreateTaskMutation, useOrchardsQuery } from '@/api/agroApi';
import { AppCard } from '@/components/AppCard';
import { colors, radius, spacing, typography } from '@/theme';

const schema = z.object({
  orchard_id: z.string().min(1, 'Pick an orchard'),
  title: z.string().min(2),
  priority: z.enum(['low', 'medium', 'high']),
  due_date: z.string().optional(),
});

type Form = z.infer<typeof schema>;

type Props = NativeStackScreenProps<TasksStackParamList, 'CreateTask'>;

export function CreateTaskScreen({ navigation }: Props) {
  const { data: orchards } = useOrchardsQuery();
  const [create, { isLoading }] = useCreateTaskMutation();

  const { control, handleSubmit, setValue, watch } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { orchard_id: '', title: '', priority: 'medium', due_date: '' },
  });

  const selectedOrchard = watch('orchard_id');

  const onSubmit = handleSubmit(async (v) => {
    try {
      await create({
        orchard_id: Number(v.orchard_id),
        title: v.title,
        priority: v.priority,
        ...(v.due_date?.trim() ? { due_date: v.due_date.trim() } : {}),
      }).unwrap();
      navigation.goBack();
    } catch (e: unknown) {
      Alert.alert('Could not create', JSON.stringify(e).slice(0, 400));
    }
  });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 80 }}>
      <AppCard>
        <Text style={styles.label}>Orchard</Text>
        <ScrollView horizontal style={{ marginTop: spacing.sm }}>
          {(orchards ?? []).map((o) => (
            <Pressable
              key={o.id}
              onPress={() => setValue('orchard_id', String(o.id), { shouldValidate: true })}
              style={[styles.chip, selectedOrchard === String(o.id) && styles.chipOn]}
            >
              <Text style={[styles.chipText, selectedOrchard === String(o.id) && { color: '#fff' }]}>
                {o.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <Controller
          control={control}
          name="orchard_id"
          render={({ fieldState }) => (
            <>
              {fieldState.error ? <Text style={styles.err}>{fieldState.error.message}</Text> : null}
            </>
          )}
        />

        <Text style={[styles.label, { marginTop: spacing.md }]}>Title</Text>
        <Controller
          control={control}
          name="title"
          render={({ field, fieldState }) => (
            <>
              <TextInput
                style={styles.input}
                placeholder="e.g. Scout codling moth"
                placeholderTextColor={colors.textMuted}
                onChangeText={field.onChange}
                value={field.value}
              />
              {fieldState.error ? <Text style={styles.err}>{fieldState.error.message}</Text> : null}
            </>
          )}
        />

        <Text style={[styles.label, { marginTop: spacing.md }]}>Priority</Text>
        <Controller
          control={control}
          name="priority"
          render={({ field }) => (
            <View style={styles.row}>
              {(['low', 'medium', 'high'] as const).map((p) => (
                <Pressable
                  key={p}
                  onPress={() => field.onChange(p)}
                  style={[styles.chip, field.value === p && styles.chipOn]}
                >
                  <Text style={[styles.chipText, field.value === p && { color: '#fff' }]}>{p}</Text>
                </Pressable>
              ))}
            </View>
          )}
        />

        <Text style={[styles.label, { marginTop: spacing.md }]}>Due date (YYYY-MM-DD)</Text>
        <Controller
          control={control}
          name="due_date"
          render={({ field }) => (
            <TextInput
              style={styles.input}
              placeholder="2026-04-20"
              placeholderTextColor={colors.textMuted}
              onChangeText={field.onChange}
              value={field.value}
            />
          )}
        />
      </AppCard>

      <Pressable style={[styles.cta, isLoading && { opacity: 0.7 }]} onPress={onSubmit} disabled={isLoading}>
        <Text style={styles.ctaText}>{isLoading ? 'Saving…' : 'Create task'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  label: { ...typography.micro, color: colors.textMuted, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  err: { ...typography.caption, color: colors.error, marginTop: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.text, textTransform: 'capitalize' },
  cta: {
    marginTop: spacing.xl,
    backgroundColor: colors.primaryDark,
    paddingVertical: spacing.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  ctaText: { ...typography.bodyMedium, color: '#fff' },
});
