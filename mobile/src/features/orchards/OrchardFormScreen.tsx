import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SettingsStackParamList } from '@/navigation/types';
import { useCreateOrchardMutation, useOrchardQuery, useUpdateOrchardMutation } from '@/api/agroApi';
import { AppCard } from '@/components/AppCard';
import { colors, radius, spacing, typography } from '@/theme';

const createSchema = z.object({
  name: z.string().min(2),
  variety: z.enum(['gala', 'fuji', 'granny_smith', 'honeycrisp', 'pink_lady', 'other']),
  area_hectares: z.string().min(1),
  total_trees: z.string().min(1),
  planting_density: z.enum(['dwarf', 'semi_dwarf', 'standard']),
  tree_maturity: z.enum(['young', 'mature', 'old']),
  section: z.string().optional(),
});

const editSchema = z.object({
  name: z.string().min(2),
  section: z.string().optional(),
});

type CreateForm = z.infer<typeof createSchema>;
type EditForm = z.infer<typeof editSchema>;

type Props = NativeStackScreenProps<SettingsStackParamList, 'OrchardForm'>;

export function OrchardFormScreen({ navigation, route }: Props) {
  const mode = route.params.mode;
  const [create, { isLoading: creating }] = useCreateOrchardMutation();
  const [update, { isLoading: saving }] = useUpdateOrchardMutation();
  const detail = useOrchardQuery(route.params.mode === 'edit' ? route.params.id : 0, {
    skip: route.params.mode !== 'edit',
  });

  const createForm = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: '',
      variety: 'gala',
      area_hectares: '',
      total_trees: '',
      planting_density: 'semi_dwarf',
      tree_maturity: 'mature',
      section: '',
    },
  });

  const editForm = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: '', section: '' },
  });

  useEffect(() => {
    if (mode === 'edit' && detail.data) {
      editForm.reset({ name: detail.data.name, section: detail.data.section ?? '' });
    }
  }, [mode, detail.data, editForm]);

  const submitCreate = createForm.handleSubmit(async (v) => {
    try {
      await create({
        name: v.name,
        variety: v.variety,
        area_hectares: Number(v.area_hectares),
        total_trees: Number(v.total_trees),
        planting_density: v.planting_density,
        tree_maturity: v.tree_maturity,
        section: v.section,
      }).unwrap();
      navigation.goBack();
    } catch (e) {
      Alert.alert('Could not create orchard', JSON.stringify(e).slice(0, 500));
    }
  });

  const submitEdit = editForm.handleSubmit(async (v) => {
    if (mode !== 'edit') return;
    try {
      await update({
        id: route.params.id,
        body: { name: v.name, section: v.section },
      }).unwrap();
      navigation.goBack();
    } catch (e) {
      Alert.alert('Could not update', JSON.stringify(e).slice(0, 500));
    }
  });

  if (mode === 'edit' && detail.isLoading && !detail.data) {
    return (
      <View style={styles.pad}>
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  if (mode === 'create') {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 100 }}>
        <AppCard>
          <Text style={styles.label}>Name</Text>
          <Controller
            control={createForm.control}
            name="name"
            render={({ field }) => (
              <TextInput style={styles.input} onChangeText={field.onChange} value={field.value} />
            )}
          />
          <ChipRow label="Variety" control={createForm.control} name="variety" options={VARS} />
          <Text style={styles.label}>Area (hectares)</Text>
          <Controller
            control={createForm.control}
            name="area_hectares"
            render={({ field }) => (
              <TextInput style={styles.input} keyboardType="decimal-pad" onChangeText={field.onChange} value={field.value} />
            )}
          />
          <Text style={styles.label}>Total trees</Text>
          <Controller
            control={createForm.control}
            name="total_trees"
            render={({ field }) => (
              <TextInput style={styles.input} keyboardType="number-pad" onChangeText={field.onChange} value={field.value} />
            )}
          />
          <ChipRow label="Density" control={createForm.control} name="planting_density" options={DENS} />
          <ChipRow label="Maturity" control={createForm.control} name="tree_maturity" options={MAT} />
          <Text style={styles.label}>Section (optional)</Text>
          <Controller
            control={createForm.control}
            name="section"
            render={({ field }) => (
              <TextInput style={styles.input} onChangeText={field.onChange} value={field.value} />
            )}
          />
        </AppCard>
        <Pressable style={[styles.cta, creating && { opacity: 0.7 }]} onPress={submitCreate} disabled={creating}>
          <Text style={styles.ctaText}>{creating ? 'Saving…' : 'Create orchard'}</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 100 }}>
      <AppCard>
        <Text style={styles.hint}>Updates send PATCH with name and section per API contract.</Text>
        <Text style={styles.label}>Name</Text>
        <Controller
          control={editForm.control}
          name="name"
          render={({ field }) => <TextInput style={styles.input} onChangeText={field.onChange} value={field.value} />}
        />
        <Text style={styles.label}>Section</Text>
        <Controller
          control={editForm.control}
          name="section"
          render={({ field }) => <TextInput style={styles.input} onChangeText={field.onChange} value={field.value} />}
        />
      </AppCard>
      <Pressable style={[styles.cta, saving && { opacity: 0.7 }]} onPress={submitEdit} disabled={saving}>
        <Text style={styles.ctaText}>{saving ? 'Saving…' : 'Save changes'}</Text>
      </Pressable>
    </ScrollView>
  );
}

function ChipRow({
  label,
  control,
  name,
  options,
}: {
  label: string;
  control: any;
  name: string;
  options: { label: string; value: string }[];
}) {
  return (
    <>
      <Text style={[styles.label, { marginTop: spacing.md }]}>{label}</Text>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <View style={styles.row}>
            {options.map((o) => (
              <Pressable
                key={o.value}
                onPress={() => field.onChange(o.value)}
                style={[styles.chip, field.value === o.value && styles.chipOn]}
              >
                <Text style={[styles.chipText, field.value === o.value && { color: '#fff' }]}>{o.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      />
    </>
  );
}

const VARS = [
  { label: 'Gala', value: 'gala' },
  { label: 'Fuji', value: 'fuji' },
  { label: 'Granny', value: 'granny_smith' },
  { label: 'Honeycrisp', value: 'honeycrisp' },
  { label: 'Pink Lady', value: 'pink_lady' },
  { label: 'Other', value: 'other' },
];
const DENS = [
  { label: 'Dwarf', value: 'dwarf' },
  { label: 'Semi-dwarf', value: 'semi_dwarf' },
  { label: 'Standard', value: 'standard' },
];
const MAT = [
  { label: 'Young', value: 'young' },
  { label: 'Mature', value: 'mature' },
  { label: 'Old', value: 'old' },
];

const styles = StyleSheet.create({
  pad: { flex: 1, padding: spacing.lg, backgroundColor: colors.bg },
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  label: { ...typography.micro, color: colors.textMuted, marginTop: spacing.sm, textTransform: 'uppercase' },
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
  chipText: { ...typography.caption, color: colors.text },
  cta: {
    marginTop: spacing.xl,
    backgroundColor: colors.primaryDark,
    paddingVertical: spacing.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  ctaText: { ...typography.bodyMedium, color: '#fff' },
  hint: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md },
  muted: { ...typography.body, color: colors.textSecondary },
});
