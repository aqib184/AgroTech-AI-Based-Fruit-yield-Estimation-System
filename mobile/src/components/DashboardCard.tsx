import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ImageSourcePropType } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

type Props = {
  title: string;
  subtitle: string;
  imageSource: ImageSourcePropType;
  imageResizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  onPress: () => void;
};

export function DashboardCard({ title, subtitle, imageSource, imageResizeMode = 'cover', onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={styles.wrap}>
      <ImageBackground
        source={imageSource}
        style={styles.bg}
        imageStyle={[styles.bgImage, { resizeMode: imageResizeMode }]}
      >
        <View style={styles.overlay} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          <View style={styles.iconWrap}>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </View>
        </View>
      </ImageBackground>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  bg: { minHeight: 170, justifyContent: 'flex-end' },
  bgImage: { borderRadius: radius.xl },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11,43,14,0.40)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.xl },
  title: { ...typography.title, color: '#fff' },
  subtitle: { ...typography.caption, color: 'rgba(255,255,255,0.92)', marginTop: spacing.xs },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
});
