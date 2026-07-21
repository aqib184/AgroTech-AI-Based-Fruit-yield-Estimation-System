import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SettingsStackParamList } from '@/navigation/types';
import { useProfileQuery, useUpdateProfileMutation } from '@/api/agroApi';
import { AppCard } from '@/components/AppCard';
import { colors, radius, spacing, typography } from '@/theme';

const schema = z.object({
  farm_name: z.string().optional(),
  region: z.string().optional(),
  total_area_hectares: z.string().optional(),
  address: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  preferred_unit: z.enum(['kg', 'tonnes']),
});

type Form = z.infer<typeof schema>;

type Props = NativeStackScreenProps<SettingsStackParamList, 'ProfileEdit'>;

export function ProfileEditScreen() {
  const { data, refetch } = useProfileQuery();
  const [save, { isLoading }] = useUpdateProfileMutation();

  const { control, handleSubmit, reset } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      farm_name: '',
      region: '',
      total_area_hectares: '',
      address: '',
      latitude: '',
      longitude: '',
      preferred_unit: 'kg',
    },
  });

  useEffect(() => {
    if (!data) return;
    reset({
      farm_name: data.farm_name ?? '',
      region: data.region ?? '',
      total_area_hectares: data.total_area_hectares != null ? String(data.total_area_hectares) : '',
      address: data.address ?? '',
      latitude: data.latitude != null ? String(data.latitude) : '',
      longitude: data.longitude != null ? String(data.longitude) : '',
      preferred_unit: data.preferred_unit,
    });
  }, [data, reset]);

  const onSubmit = handleSubmit(async (v) => {
    try {
      await save({
        farm_name: v.farm_name,
        region: v.region || null,
        total_area_hectares: v.total_area_hectares ? Number(v.total_area_hectares) : null,
        address: v.address,
        latitude: v.latitude ? Number(v.latitude) : null,
        longitude: v.longitude ? Number(v.longitude) : null,
        preferred_unit: v.preferred_unit,
      }).unwrap();
      Alert.alert('Saved');
      refetch();
    } catch (e) {
      Alert.alert('Error', JSON.stringify(e).slice(0, 400));
    }
  });

  if (!data) return null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 80 }}>
      <AppCard>
        <Text style={styles.label}>Preferred units</Text>
        <Controller
          control={control}
          name="preferred_unit"
          render={({ field }) => (
            <View style={styles.row}>
              {(['kg', 'tonnes'] as const).map((u) => (
                <Pressable
                  key={u}
                  onPress={() => field.onChange(u)}
                  style={[styles.chip, field.value === u && styles.chipOn]}
                >
                  <Text style={[styles.chipText, field.value === u && { color: '#fff' }]}>{u}</Text>
                </Pressable>
              ))}
            </View>
          )}
        />
        <Field label="Farm name" control={control} name="farm_name" />
        <Field label="Region" control={control} name="region" />
        <Field label="Total area (hectares)" control={control} name="total_area_hectares" keyboard="decimal-pad" />
        <Field label="Address" control={control} name="address" multiline />
        <Field label="Latitude" control={control} name="latitude" keyboard="decimal-pad" />
        <Field label="Longitude" control={control} name="longitude" keyboard="decimal-pad" />
        <Text style={styles.hint}>Weather uses these coordinates first when set.</Text>
      </AppCard>
      <Pressable style={[styles.cta, isLoading && { opacity: 0.7 }]} onPress={onSubmit} disabled={isLoading}>
        <Text style={styles.ctaText}>{isLoading ? 'Saving…' : 'Save profile'}</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={() => reset()}>
        <Text style={styles.secondaryText}>Reset form</Text>
      </Pressable>
    </ScrollView>
  );
}

function Field({
  label,
  control,
  name,
  multiline,
  keyboard,
}: {
  label: string;
  control: any;
  name: keyof Form;
  multiline?: boolean;
  keyboard?: 'decimal-pad';
}) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <TextInput
            style={[styles.input, multiline && { minHeight: 80 }]}
            multiline={multiline}
            keyboardType={keyboard}
            placeholderTextColor={colors.textMuted}
            onChangeText={field.onChange}
            value={field.value as string}
          />
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.text, textTransform: 'capitalize' },
  label: { ...typography.micro, color: colors.textMuted, marginTop: spacing.md, textTransform: 'uppercase' },
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
  hint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.md },
  cta: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  ctaText: { ...typography.bodyMedium, color: '#fff' },
  secondary: { marginTop: spacing.lg, alignItems: 'center' },
  secondaryText: { color: colors.primary, fontWeight: '600' },
});
