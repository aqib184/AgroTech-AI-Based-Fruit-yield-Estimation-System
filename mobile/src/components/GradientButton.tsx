import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing, typography } from '@/theme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
};

export function GradientButton({ label, onPress, disabled, style }: Props) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[style, disabled && { opacity: 0.7 }]}>
      <LinearGradient colors={[colors.ctaGradientStart, colors.ctaGradientEnd]} style={styles.btn}>
        <Text style={styles.label}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 54,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  label: { ...typography.bodyMedium, color: '#fff' },
});
