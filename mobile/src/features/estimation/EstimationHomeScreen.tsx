import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { EstimationStackParamList } from '@/navigation/types';
import { useDeleteOrchardMutation, useEstimationsQuery, useOrchardsQuery } from '@/api/agroApi';
import { AppCard } from '@/components/AppCard';
import { colors, spacing, typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import { formatDate, formatKg, formatPct } from '@/utils/format';
import type { EstimationListItem } from '@/api/types';

type Props = NativeStackScreenProps<EstimationStackParamList, 'EstimationHome'>;

export function EstimationHomeScreen({ navigation }: Props) {
  const { data: orchards, refetch: refetchOrchards } = useOrchardsQuery();
  const { data: estimations } = useEstimationsQuery({ page: 1, days: 90 });
  const [deleteOrchard, { isLoading: deletingOrchard }] = useDeleteOrchardMutation();

  const goToCreateOrchardForm = () => {
    navigation.getParent()?.navigate('SettingsTab', { screen: 'OrchardForm', params: { mode: 'create' } });
  };

  const onDeleteOrchard = async (id: number) => {
    if (deletingOrchard) return;
    try {
      await deleteOrchard(id).unwrap();
      refetchOrchards();
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e && 'data' in e ? JSON.stringify((e as { data: unknown }).data) : String(e);
      Alert.alert('Delete failed', msg.slice(0, 300));
    }
  };

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
      <Text style={styles.lead}>Select an orchard to start estimation, or create one first.</Text>

      <AppCard style={styles.ctaCard}>
        <View style={styles.ctaRow}>
          <View style={styles.iconCircle}>
            <Ionicons name="leaf" size={26} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.ctaTitle}>Orchard-first workflow</Text>
            <Text style={styles.ctaSub}>Pick an existing orchard, then upload tree photos.</Text>
          </View>
          <Pressable style={styles.smallBtn} onPress={goToCreateOrchardForm}>
            <Text style={styles.smallBtnText}>Add orchard</Text>
          </Pressable>
        </View>
      </AppCard>
      {(orchards ?? []).map((o) => (
        <AppCard key={o.id} style={styles.orchardCard}>
          <View style={styles.ctaRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="leaf-outline" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ctaTitle}>{o.name}</Text>
              <Text style={styles.ctaSub}>{o.variety} · {o.total_trees} trees</Text>
            </View>
            <View style={styles.orchardActions}>
              <Pressable
                style={styles.actionEstimateBtn}
                onPress={() => navigation.navigate('EstimationForm', { orchardId: o.id })}
              >
                <Text style={styles.actionEstimateText}>Estimate</Text>
              </Pressable>
              <Pressable
                style={styles.actionDeleteBtn}
                onPress={() => {
                  if (Platform.OS === 'web') {
                    const ok =
                      typeof globalThis.confirm === 'function'
                        ? globalThis.confirm('Delete this orchard and all linked history/tasks?')
                        : true;
                    if (ok) {
                      void onDeleteOrchard(o.id);
                    }
                    return;
                  }
                  Alert.alert('Delete orchard?', 'This removes linked history and tasks.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: deletingOrchard ? 'Deleting…' : 'Delete', style: 'destructive', onPress: () => void onDeleteOrchard(o.id) },
                  ]);
                }}
              >
                <Text style={styles.actionDeleteText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </AppCard>
      ))}

      <Text style={styles.historyTitle}>Estimation history</Text>
      {(estimations?.results ?? []).length ? (
        (estimations?.results ?? []).map((item: EstimationListItem) => (
          <AppCard key={item.id} style={styles.historyCard} onPress={() => navigation.navigate('EstimationDetail', { id: item.id })}>
            <View style={styles.historyRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyName}>{item.orchard_name}</Text>
                <Text style={styles.historyMeta}>{formatDate(item.estimation_date)} · {item.num_images} images</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.historyYield}>{formatKg(item.orchard_yield_kg, 1)}</Text>
                <Text style={styles.historyMeta}>{formatPct(item.ripe_percentage)} ripe</Text>
              </View>
            </View>
          </AppCard>
        ))
      ) : (
        <Text style={styles.emptyHistory}>No estimations yet.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  lead: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.lg },
  ctaCard: { paddingVertical: spacing.lg },
  orchardCard: { marginTop: spacing.sm, paddingVertical: spacing.md },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTitle: { ...typography.bodyMedium, color: colors.text },
  ctaSub: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  orchardActions: { alignItems: 'flex-end', gap: spacing.xs },
  actionEstimateBtn: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  actionEstimateText: { ...typography.micro, color: '#fff', fontWeight: '700' },
  actionDeleteBtn: {
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  actionDeleteText: { ...typography.micro, color: colors.error, fontWeight: '700' },
  smallBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
  },
  smallBtnText: { ...typography.caption, color: '#fff', fontWeight: '700' },
  secondary: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
  },
  secondaryText: { ...typography.bodyMedium, color: colors.primary },
  historyTitle: { ...typography.section, color: colors.primaryDark, marginTop: spacing.lg, marginBottom: spacing.sm },
  historyCard: { marginBottom: spacing.sm },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  historyName: { ...typography.bodyMedium, color: colors.text },
  historyMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  historyYield: { ...typography.bodyMedium, color: colors.primaryDark },
  emptyHistory: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
});
