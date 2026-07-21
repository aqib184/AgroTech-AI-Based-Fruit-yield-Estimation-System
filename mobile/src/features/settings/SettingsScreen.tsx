import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SettingsStackParamList } from '@/navigation/types';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setCredentials } from '@/store/authSlice';
import { clearTokens } from '@/utils/secureTokens';
import { resetToAuth } from '@/navigation/navigationRef';
import { AppCard } from '@/components/AppCard';
import { ManualWeatherSection } from './ManualWeatherSection';
import { useProfileQuery } from '@/api/agroApi';
import { colors, spacing, typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';

type Props = NativeStackScreenProps<SettingsStackParamList, 'SettingsMain'>;

export function SettingsScreen({ navigation }: Props) {
  const dispatch = useAppDispatch();
  const access = useAppSelector((s) => s.auth.accessToken);
  const { data: profile } = useProfileQuery(undefined, { skip: !access });

  const logout = async () => {
    await clearTokens();
    dispatch(setCredentials(null));
    resetToAuth();
  };

  const Row = ({
    icon,
    label,
    onPress,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
  }) => (
    <Pressable style={styles.row} onPress={onPress}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <Text style={styles.rowText}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
      <AppCard style={{ marginBottom: spacing.lg }}>
        <Text style={styles.farm}>{profile?.farm_name || 'Your farm'}</Text>
        <Text style={styles.meta}>{profile?.user_name}</Text>
        <Text style={styles.meta}>{profile?.email}</Text>
      </AppCard>

      <AppCard>
        <Row icon="person-outline" label="Farm profile & coordinates" onPress={() => navigation.navigate('ProfileEdit')} />
        <View style={styles.sep} />
        <Row icon="leaf-outline" label="Orchards" onPress={() => navigation.navigate('OrchardList')} />
        <View style={styles.sep} />
        <Row icon="flash-outline" label="Task automation rules" onPress={() => navigation.navigate('TaskRules')} />
      </AppCard>

      <ManualWeatherSection />

      <AppCard style={{ marginTop: spacing.md }}>
        <Text style={styles.infoTitle}>What are task automation rules?</Text>
        <Text style={styles.infoText}>
          These rules auto-create farm tasks after each estimation. Example: when ripeness is high, auto-create a
          harvest task.
        </Text>
      </AppCard>

      <Pressable
        style={styles.logout}
        onPress={() =>
          Alert.alert('Sign out?', undefined, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: logout },
          ])
        }
      >
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  farm: { ...typography.title, color: colors.primaryDark },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.md },
  rowText: { flex: 1, ...typography.body, color: colors.text },
  sep: { height: 1, backgroundColor: colors.border },
  infoTitle: { ...typography.bodyMedium, color: colors.primaryDark },
  infoText: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  logout: { marginTop: spacing.xxl, alignItems: 'center', padding: spacing.lg },
  logoutText: { ...typography.bodyMedium, color: colors.error },
});
