import { useEffect } from 'react';
import { CommonActions } from '@react-navigation/native';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useLazyHealthQuery } from '@/api/agroApi';
import { useAppDispatch } from '@/store/hooks';
import { setBootstrapped, setCredentials } from '@/store/authSlice';
import { loadTokens } from '@/utils/secureTokens';
import { isOnboardingDone } from '@/utils/onboarding';
import { colors, spacing, typography } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Boot'>;

export function BootScreen({ navigation }: Props) {
  const dispatch = useAppDispatch();
  const [pingHealth] = useLazyHealthQuery();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const tokens = await loadTokens();
      const onboardingDone = await isOnboardingDone();
      if (cancelled) return;
      if (tokens) {
        dispatch(setCredentials(tokens));
      }
      try {
        await pingHealth().unwrap();
      } catch {
        /* backend optional at boot */
      }
      dispatch(setBootstrapped(true));
      if (cancelled) return;
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: tokens ? (onboardingDone ? 'Main' : 'Onboarding') : 'Auth' }],
        })
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch, navigation, pingHealth]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.logo}>AgroYield</Text>
      <Text style={styles.tag}>Fruit yield intelligence</Text>
      <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  logo: { ...typography.hero, color: colors.primaryDark },
  tag: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
});
