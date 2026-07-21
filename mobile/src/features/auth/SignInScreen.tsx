import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/navigation/types';
import { useLoginMutation } from '@/api/agroApi';
import { useAppDispatch } from '@/store/hooks';
import { setCredentials } from '@/store/authSlice';
import { saveTokens } from '@/utils/secureTokens';
import { isOnboardingDone } from '@/utils/onboarding';
import { resetToMain } from '@/navigation/navigationRef';
import { RoundedTextInput } from '@/components/RoundedTextInput';
import { GradientButton } from '@/components/GradientButton';
import { LOGIN_HERO_IMAGE } from '@/constants/media';
import { colors, radius, spacing, typography } from '@/theme';

const schema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

type Form = z.infer<typeof schema>;

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

export function SignInScreen({ navigation }: Props) {
  const dispatch = useAppDispatch();
  const [login, { isLoading }] = useLoginMutation();
  const [apiErr, setApiErr] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const { control, handleSubmit } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { username: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setApiErr(null);
    try {
      const tokens = await login(values).unwrap();
      await saveTokens(tokens.access, tokens.refresh);
      dispatch(setCredentials(tokens));
      const done = await isOnboardingDone();
      if (done) {
        resetToMain();
      } else {
        navigation.getParent()?.navigate('Onboarding');
      }
    } catch {
      setApiErr('Could not sign in. Check username and password.');
    }
  });

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ImageBackground source={LOGIN_HERO_IMAGE} style={styles.hero} imageStyle={styles.heroImage}>
          <LinearGradient colors={['rgba(11,45,16,0.72)', 'rgba(11,45,16,0.35)']} style={StyleSheet.absoluteFill} />
          <View style={styles.logoCircle}>
            <Ionicons name="leaf" size={36} color="#fff" />
          </View>
        </ImageBackground>

        <View style={styles.formCard}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.sub}>Sign in to continue</Text>

          <Controller
            control={control}
            name="username"
            render={({ field, fieldState }) => (
              <RoundedTextInput
                label="Username"
                value={field.value}
                onChangeText={field.onChange}
                autoCapitalize="none"
                placeholder="farmer01"
                icon="person-outline"
                errorText={fieldState.error?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field, fieldState }) => (
              <RoundedTextInput
                label="Password"
                value={field.value}
                onChangeText={field.onChange}
                placeholder="••••••••"
                secureTextEntry={!showPassword}
                icon="lock-closed-outline"
                rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                onRightIconPress={() => setShowPassword((v) => !v)}
                errorText={fieldState.error?.message}
              />
            )}
          />

          {apiErr ? <Text style={styles.err}>{apiErr}</Text> : null}

          <GradientButton
            style={{ marginTop: spacing.xl }}
            onPress={onSubmit}
            disabled={isLoading}
            label={isLoading ? 'Signing in...' : 'Sign In'}
          />

          <Pressable style={styles.link} onPress={() => navigation.navigate('SignUp')}>
            <Text style={styles.linkText}>New here? Create an account</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: spacing.xxxl },
  hero: {
    height: 280,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImage: { borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCard: {
    marginTop: -22,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing.xl,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  title: { ...typography.title, color: colors.primaryDark },
  sub: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  err: { ...typography.caption, color: colors.error, marginTop: spacing.md },
  link: { marginTop: spacing.lg, alignItems: 'center' },
  linkText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
});
