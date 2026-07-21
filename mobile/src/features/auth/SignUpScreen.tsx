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
import { useRegisterMutation } from '@/api/agroApi';
import { RoundedTextInput } from '@/components/RoundedTextInput';
import { GradientButton } from '@/components/GradientButton';
import { SIGNUP_HERO_IMAGE } from '@/constants/media';
import { colors, radius, spacing, typography } from '@/theme';

const schema = z
  .object({
    username: z.string().min(3),
    email: z.union([z.literal(''), z.string().email()]),
    password: z.string().min(8, 'At least 8 characters'),
    password2: z.string(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
  })
  .refine((d) => d.password === d.password2, { message: 'Passwords must match', path: ['password2'] });

type Form = z.infer<typeof schema>;

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export function SignUpScreen({ navigation }: Props) {
  const [register, { isLoading }] = useRegisterMutation();
  const [apiErr, setApiErr] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);

  const { control, handleSubmit } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      password2: '',
      first_name: '',
      last_name: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setApiErr(null);
    try {
      await register({
        username: values.username,
        email: values.email || undefined,
        password: values.password,
        password2: values.password2,
        first_name: values.first_name,
        last_name: values.last_name,
      }).unwrap();
      navigation.navigate('SignIn');
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e && 'data' in e
          ? JSON.stringify((e as { data: unknown }).data)
          : 'Registration failed';
      setApiErr(msg);
    }
  });

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ImageBackground source={SIGNUP_HERO_IMAGE} style={styles.hero} imageStyle={styles.heroImage}>
          <LinearGradient colors={['rgba(11,45,16,0.74)', 'rgba(11,45,16,0.35)']} style={StyleSheet.absoluteFill} />
          <View style={styles.logoCircle}>
            <Ionicons name="sparkles-outline" size={34} color="#fff" />
          </View>
        </ImageBackground>

        <View style={styles.formCard}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.sub}>Set up your farm workspace</Text>

          <Controller
            control={control}
            name="username"
            render={({ field, fieldState }) => (
              <RoundedTextInput
                label="Username"
                value={field.value as string}
                onChangeText={field.onChange}
                autoCapitalize="none"
                icon="person-outline"
                errorText={fieldState.error?.message as string | undefined}
              />
            )}
          />

          <Controller
            control={control}
            name="email"
            render={({ field, fieldState }) => (
              <RoundedTextInput
                label="Email"
                value={field.value as string}
                onChangeText={field.onChange}
                keyboardType="email-address"
                autoCapitalize="none"
                icon="mail-outline"
                errorText={fieldState.error?.message as string | undefined}
              />
            )}
          />

          <Controller
            control={control}
            name="first_name"
            render={({ field }) => (
              <RoundedTextInput label="First name" value={field.value as string} onChangeText={field.onChange} icon="person-circle-outline" />
            )}
          />

          <Controller
            control={control}
            name="last_name"
            render={({ field }) => (
              <RoundedTextInput label="Last name" value={field.value as string} onChangeText={field.onChange} icon="person-circle-outline" />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field, fieldState }) => (
              <RoundedTextInput
                label="Password"
                value={field.value as string}
                onChangeText={field.onChange}
                secureTextEntry={!showPassword}
                icon="lock-closed-outline"
                rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                onRightIconPress={() => setShowPassword((v) => !v)}
                errorText={fieldState.error?.message as string | undefined}
              />
            )}
          />

          <Controller
            control={control}
            name="password2"
            render={({ field, fieldState }) => (
              <RoundedTextInput
                label="Confirm password"
                value={field.value as string}
                onChangeText={field.onChange}
                secureTextEntry={!showPassword2}
                icon="shield-checkmark-outline"
                rightIcon={showPassword2 ? 'eye-off-outline' : 'eye-outline'}
                onRightIconPress={() => setShowPassword2((v) => !v)}
                errorText={fieldState.error?.message as string | undefined}
              />
            )}
          />

          {apiErr ? <Text style={styles.err}>{apiErr}</Text> : null}

          <GradientButton
            style={{ marginTop: spacing.xl }}
            onPress={onSubmit}
            disabled={isLoading}
            label={isLoading ? 'Creating...' : 'Register'}
          />
        </View>

        <Pressable style={styles.link} onPress={() => navigation.goBack()}>
          <Text style={styles.linkText}>Already have an account? Sign in</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: spacing.xxxl },
  hero: {
    height: 248,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImage: { borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  logoCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  formCard: {
    marginTop: -20,
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
  err: { ...typography.caption, color: colors.error, marginTop: spacing.sm },
  link: { marginTop: spacing.lg, alignItems: 'center' },
  linkText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
});
