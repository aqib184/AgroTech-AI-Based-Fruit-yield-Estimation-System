import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { ImageSourcePropType } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

type Props = {
  greeting: string;
  title: string;
  imageSource: ImageSourcePropType;
  onRightPress?: () => void;
  rightIcon?: keyof typeof Ionicons.glyphMap;
};

export function AppHeader({ greeting, title, imageSource, onRightPress, rightIcon = 'notifications-outline' }: Props) {
  return (
    <ImageBackground source={imageSource} style={styles.wrap} imageStyle={styles.bgImage}>
      <LinearGradient colors={['rgba(27,94,32,0.88)', 'rgba(76,175,80,0.74)']} style={StyleSheet.absoluteFill} />
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
        <Pressable onPress={onRightPress} style={styles.iconBtn}>
          <Ionicons name={rightIcon} size={20} color="#fff" />
        </Pressable>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 132,
    borderRadius: radius.xl,
    overflow: 'hidden',
    justifyContent: 'center',
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  bgImage: { borderRadius: radius.xl },
  row: { flexDirection: 'row', alignItems: 'center' },
  greeting: { ...typography.caption, color: 'rgba(255,255,255,0.9)' },
  title: { ...typography.hero, color: '#fff', marginTop: spacing.xs },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
