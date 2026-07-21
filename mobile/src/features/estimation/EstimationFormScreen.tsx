import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { EstimationStackParamList } from '@/navigation/types';
import { useOrchardsQuery, usePredictYieldMutation } from '@/api/agroApi';
import { useAppDispatch } from '@/store/hooks';
import { setLastYieldResult } from '@/store/predictionSlice';
import { AppCard } from '@/components/AppCard';
import { colors, radius, spacing, typography } from '@/theme';

const varietyEnum = z.enum([
  'golden_delicious',
  'fuji',
  'gala',
  'granny_smith',
  'honeycrisp',
  'other',
]);

const schema = z
  .object({
    variety: varietyEnum,
    tree_maturity: z.enum(['young', 'mature', 'old']),
    planting_density: z.enum(['traditional', 'semi_dwarf', 'high_density']),
    total_trees: z.string().optional(),
    orchard_area: z.string().optional(),
    area_unit: z.enum(['acres', 'hectares']),
    orchard_id: z.string().optional(),
    include_visuals: z.boolean(),
  })
  .superRefine((val, ctx) => {
    const tt = val.total_trees?.trim();
    const oa = val.orchard_area?.trim();
    const hasTrees = tt && Number(tt) > 0;
    const hasArea = oa && Number(oa) > 0;
    if (!hasTrees && !hasArea) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter total trees or orchard area.',
        path: ['total_trees'],
      });
    }
  });

type Form = z.infer<typeof schema>;

type Props = NativeStackScreenProps<EstimationStackParamList, 'EstimationForm'>;

export function EstimationFormScreen({ navigation, route }: Props) {
  const dispatch = useAppDispatch();
  const { data: orchards } = useOrchardsQuery();
  const [predict, { isLoading }] = usePredictYieldMutation();
  type SlotKey =
    | 'tree1_front'
    | 'tree1_back'
    | 'tree2_front'
    | 'tree2_back'
    | 'tree3_front'
    | 'tree3_back';
  const [imagesBySlot, setImagesBySlot] = useState<
    Record<SlotKey, { uri: string; name: string; type: string; file?: File | Blob } | null>
  >({
    tree1_front: null,
    tree1_back: null,
    tree2_front: null,
    tree2_back: null,
    tree3_front: null,
    tree3_back: null,
  });

  const { control, handleSubmit, watch, setValue } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      variety: 'gala',
      tree_maturity: 'mature',
      planting_density: 'semi_dwarf',
      total_trees: '',
      orchard_area: '',
      area_unit: 'acres',
      orchard_id: '',
      include_visuals: true,
    },
  });

  useEffect(() => {
    const oid = route.params?.orchardId;
    if (oid != null) setValue('orchard_id', String(oid));
  }, [route.params?.orchardId, setValue]);

  const includeVisuals = watch('include_visuals');

  const orchardOptions = (orchards ?? []).map((o) => ({ label: o.name, value: String(o.id) }));

  const pickGallery = async (slot: SlotKey) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to attach images.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.85,
      selectionLimit: 1,
    });
    if (res.canceled) return;
    const a = res.assets[0];
    setImagesBySlot((prev) => ({
      ...prev,
      [slot]: {
        uri: a.uri,
        name: a.fileName ?? `${slot}.jpg`,
        type: a.mimeType ?? 'image/jpeg',
        file: (a as unknown as { file?: File | Blob }).file,
      },
    }));
  };

  const pickCamera = async (slot: SlotKey) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow camera access to capture images.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (res.canceled) return;
    const a = res.assets[0];
    setImagesBySlot((prev) => ({
      ...prev,
      [slot]: {
        uri: a.uri,
        name: a.fileName ?? `${slot}.jpg`,
        type: a.mimeType ?? 'image/jpeg',
        file: (a as unknown as { file?: File | Blob }).file,
      },
    }));
  };

  const onSubmit = handleSubmit(async (values) => {
    const images = Object.values(imagesBySlot).filter((v): v is { uri: string; name: string; type: string; file?: File | Blob } => Boolean(v));
    if (!images.length) {
      Alert.alert('Photos required', 'Add at least one orchard image.');
      return;
    }
    const totalTrees = values.total_trees?.trim() ? Number(values.total_trees) : null;
    const orchardArea = values.orchard_area?.trim() ? Number(values.orchard_area) : null;
    const orchardId = values.orchard_id?.trim() ? Number(values.orchard_id) : null;
    try {
      const result = await predict({
        variety: values.variety,
        tree_maturity: values.tree_maturity,
        planting_density: values.planting_density,
        total_trees: totalTrees && totalTrees > 0 ? totalTrees : null,
        orchard_area: orchardArea && orchardArea > 0 ? orchardArea : null,
        area_unit: values.area_unit,
        orchard_id: orchardId && orchardId > 0 ? orchardId : null,
        include_visuals: values.include_visuals,
        images,
      }).unwrap();
      dispatch(setLastYieldResult(result));
      navigation.navigate('EstimationResult');
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e && 'data' in e ? JSON.stringify((e as { data: unknown }).data) : String(e);
      Alert.alert('Estimation failed', msg.slice(0, 400));
    }
  });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 120 }}>
      <Text style={styles.hint}>
        Fields match `YieldEstimateSerializer`: variety, tree_maturity, planting_density, optional orchard_id,
        include_visuals, images[], and either total_trees or orchard_area + area_unit.
      </Text>

      <AppCard style={{ marginBottom: spacing.md }}>
        <Text style={styles.label}>Tree image capture</Text>
        <Text style={styles.microMuted}>Tree 1 front/back shown first. Tree 2 and 3 are optional for better confidence.</Text>
        {[
          ['Tree 1', 'tree1_front', 'tree1_back'],
          ['Tree 2 (optional)', 'tree2_front', 'tree2_back'],
          ['Tree 3 (optional)', 'tree3_front', 'tree3_back'],
        ].map(([title, frontKey, backKey]) => (
          <View key={String(title)} style={styles.treeBlock}>
            <Text style={styles.treeTitle}>{title}</Text>
            <View style={styles.row}>
              {([
                ['Front', frontKey as SlotKey],
                ['Back', backKey as SlotKey],
              ] as [string, SlotKey][]).map(([side, key]) => (
                <View key={key} style={styles.slotCard}>
                  <Text style={styles.slotTitle}>{side}</Text>
                  {imagesBySlot[key]?.uri ? (
                    <Image source={{ uri: imagesBySlot[key]!.uri }} style={styles.thumb} />
                  ) : (
                    <View style={styles.thumbPlaceholder}>
                      <Text style={styles.microMuted}>No image</Text>
                    </View>
                  )}
                  <View style={styles.row}>
                    <Pressable style={styles.pickBtn} onPress={() => pickGallery(key)}>
                      <Text style={styles.pickText}>Gallery</Text>
                    </Pressable>
                    <Pressable style={styles.pickBtn} onPress={() => pickCamera(key)}>
                      <Text style={styles.pickText}>Camera</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}
        <Text style={styles.microMuted}>
          Total selected images: {Object.values(imagesBySlot).filter(Boolean).length}
        </Text>
      </AppCard>

      <AppCard>
        <SelectField label="Variety" control={control} name="variety" options={VARIETY_OPTS} />
        <SelectField label="Tree maturity" control={control} name="tree_maturity" options={MATURITY_OPTS} />
        <SelectField label="Planting density" control={control} name="planting_density" options={DENSITY_OPTS} />
        <Text style={[styles.label, { marginTop: spacing.md }]}>Total trees (optional)</Text>
        <Controller
          control={control}
          name="total_trees"
          render={({ field, fieldState }) => (
            <>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                placeholder="e.g. 625"
                placeholderTextColor={colors.textMuted}
                onChangeText={field.onChange}
                value={field.value}
              />
              {fieldState.error ? <Text style={styles.err}>{fieldState.error.message}</Text> : null}
            </>
          )}
        />
        <Text style={[styles.label, { marginTop: spacing.md }]}>Orchard area (optional)</Text>
        <Controller
          control={control}
          name="orchard_area"
          render={({ field }) => (
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="e.g. 2.5"
              placeholderTextColor={colors.textMuted}
              onChangeText={field.onChange}
              value={field.value}
            />
          )}
        />
        <SelectField label="Area unit" control={control} name="area_unit" options={AREA_OPTS} />
        <Text style={[styles.label, { marginTop: spacing.md }]}>Link orchard (optional)</Text>
        <ScrollView horizontal style={{ marginVertical: spacing.sm }}>
          <Chip label="None" active={!watch('orchard_id')} onPress={() => setValue('orchard_id', '')} />
          {orchardOptions.map((o) => (
            <Chip
              key={o.value}
              label={o.label}
              active={watch('orchard_id') === o.value}
              onPress={() => setValue('orchard_id', o.value)}
            />
          ))}
        </ScrollView>
        <View style={styles.switchRow}>
          <Text style={styles.label}>Include detection overlays</Text>
          <Controller
            control={control}
            name="include_visuals"
            render={({ field }) => (
              <Switch value={field.value} onValueChange={field.onChange} trackColor={{ true: colors.primaryMuted }} />
            )}
          />
        </View>
        <Text style={styles.microMuted}>include_visuals: {includeVisuals ? 'true' : 'false'}</Text>
      </AppCard>

      <Pressable style={[styles.submit, isLoading && { opacity: 0.7 }]} onPress={onSubmit} disabled={isLoading}>
        <Text style={styles.submitText}>{isLoading ? 'Uploading…' : 'Run estimation'}</Text>
      </Pressable>
    </ScrollView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        active && { backgroundColor: colors.primary, borderColor: colors.primary },
      ]}
    >
      <Text style={[styles.chipText, active && { color: '#fff' }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function SelectField({
  label,
  control,
  name,
  options,
}: {
  label: string;
  control: any;
  name: keyof Form;
  options: { label: string; value: string }[];
}) {
  return (
    <>
      <Text style={[styles.label, { marginTop: spacing.md }]}>{label}</Text>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {options.map((o) => (
              <Chip
                key={o.value}
                label={o.label}
                active={field.value === o.value}
                onPress={() => field.onChange(o.value)}
              />
            ))}
          </ScrollView>
        )}
      />
    </>
  );
}

const VARIETY_OPTS = [
  { label: 'Golden', value: 'golden_delicious' },
  { label: 'Fuji', value: 'fuji' },
  { label: 'Gala', value: 'gala' },
  { label: 'Granny', value: 'granny_smith' },
  { label: 'Honeycrisp', value: 'honeycrisp' },
  { label: 'Other', value: 'other' },
];
const MATURITY_OPTS = [
  { label: 'Young', value: 'young' },
  { label: 'Mature', value: 'mature' },
  { label: 'Old', value: 'old' },
];
const DENSITY_OPTS = [
  { label: 'Traditional', value: 'traditional' },
  { label: 'Semi-dwarf', value: 'semi_dwarf' },
  { label: 'High density', value: 'high_density' },
];
const AREA_OPTS = [
  { label: 'Acres', value: 'acres' },
  { label: 'Hectares', value: 'hectares' },
];

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  hint: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md },
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
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  treeBlock: { marginTop: spacing.md },
  treeTitle: { ...typography.caption, color: colors.primaryDark, fontWeight: '700' },
  slotCard: {
    flex: 1,
    minWidth: 220,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: colors.surface,
  },
  slotTitle: { ...typography.caption, color: colors.text },
  thumb: { width: '100%', height: 120, borderRadius: radius.sm, marginTop: spacing.xs },
  thumbPlaceholder: {
    width: '100%',
    height: 120,
    borderRadius: radius.sm,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgDeep,
  },
  pickBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  pickText: { ...typography.caption, color: '#fff', fontWeight: '700' },
  clear: { paddingHorizontal: spacing.md, justifyContent: 'center' },
  clearText: { ...typography.caption, color: colors.warning, fontWeight: '600' },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    marginRight: spacing.sm,
    marginTop: spacing.xs,
    maxWidth: 200,
    backgroundColor: colors.surface,
  },
  chipText: { ...typography.caption, color: colors.text },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  microMuted: { ...typography.micro, color: colors.textMuted, marginTop: spacing.xs },
  submit: {
    marginTop: spacing.xl,
    backgroundColor: colors.primaryDark,
    paddingVertical: spacing.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  submitText: { ...typography.bodyMedium, color: '#fff' },
});
