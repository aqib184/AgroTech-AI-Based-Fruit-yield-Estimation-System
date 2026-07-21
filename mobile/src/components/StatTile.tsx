import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

type Props = {
  label: string;
  value: string;
  hint?: string;
};

export function StatTile({ label, value, hint }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minWidth: 100,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { ...typography.micro, color: colors.textMuted, textTransform: 'uppercase' },
  value: { ...typography.title, color: colors.primaryDark, marginTop: spacing.xs },
  hint: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});
