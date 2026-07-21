import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ImageSourcePropType } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

type Props = {
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  imageSource: ImageSourcePropType;
  imageResizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  onPress: () => void;
};

export function QuickAccessCard({
  label,
  description,
  icon,
  imageSource,
  imageResizeMode = 'cover',
  onPress,
}: Props) {
  return (
    <Pressable onPress={onPress} style={styles.wrap}>
      <ImageBackground
        source={imageSource}
        style={styles.bg}
        imageStyle={[styles.bgImage, { resizeMode: imageResizeMode }]}
      >
        <View style={styles.overlay} />
        <View style={styles.content}>
          <Ionicons name={icon} size={20} color="#fff" />
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
      </ImageBackground>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 190,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginRight: spacing.sm,
  },
  bg: { height: 140, justifyContent: 'flex-end' },
  bgImage: { borderRadius: radius.lg },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,30,12,0.45)' },
  content: { padding: spacing.md },
  label: { ...typography.caption, color: '#fff', marginTop: spacing.xs, fontWeight: '700' },
  description: { ...typography.micro, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
});
