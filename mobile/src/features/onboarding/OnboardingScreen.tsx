import { useRef, useState } from 'react';
import { FlatList, ImageBackground, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/theme';
import { PLACEHOLDER_ORCHARD_HERO } from '@/constants/media';
import { markOnboardingDone } from '@/utils/onboarding';
import { resetToMain } from '@/navigation/navigationRef';

type Slide = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
};

const SLIDES: Slide[] = [
  {
    id: '1',
    icon: 'leaf-outline',
    title: 'Precision Agriculture',
    subtitle: 'AI-Powered Fruit Yield Estimation',
  },
  {
    id: '2',
    icon: 'camera-outline',
    title: 'Capture With Confidence',
    subtitle: 'Take orchard images and get instant insights',
  },
  {
    id: '3',
    icon: 'analytics-outline',
    title: 'Actionable Decisions',
    subtitle: 'Track ripeness, canopy health, and yield trends',
  },
];

export function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);

  const onNext = () => {
    const next = index + 1;
    if (next < SLIDES.length) {
      listRef.current?.scrollToIndex({ index: next, animated: true });
      setIndex(next);
      return;
    }
    void onDone();
  };

  const onDone = async () => {
    await markOnboardingDone();
    resetToMain();
  };

  return (
    <View style={styles.screen}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width));
          setIndex(i);
        }}
        renderItem={({ item }) => (
          <ImageBackground source={PLACEHOLDER_ORCHARD_HERO} style={[styles.slide, { width }]} imageStyle={styles.slideImage}>
            <LinearGradient colors={['rgba(27,94,32,0.82)', 'rgba(27,94,32,0.55)']} style={StyleSheet.absoluteFill} />
            <View style={styles.centerContent}>
              <View style={styles.iconWrap}>
                <Ionicons name={item.icon} size={56} color="#fff" />
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.subtitle}</Text>
            </View>
          </ImageBackground>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dotsRow}>
          {SLIDES.map((s, i) => (
            <View key={s.id} style={[styles.dot, i === index && styles.dotOn]} />
          ))}
        </View>

        <Pressable style={styles.cta} onPress={onNext}>
          <LinearGradient colors={[colors.ctaGradientStart, colors.ctaGradientEnd]} style={styles.ctaInner}>
            <Text style={styles.ctaText}>{index === SLIDES.length - 1 ? 'Get Started' : 'Next'}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  slide: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  slideImage: { resizeMode: 'cover' },
  centerContent: { alignItems: 'center', paddingHorizontal: spacing.xxl },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    marginBottom: spacing.xl,
  },
  title: { ...typography.hero, color: '#fff', textAlign: 'center' },
  subtitle: { ...typography.body, color: 'rgba(255,255,255,0.92)', textAlign: 'center', marginTop: spacing.md },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: spacing.xxl,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  dotsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 5,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  dotOn: { width: 22, backgroundColor: '#fff' },
  cta: { width: '100%' },
  ctaInner: {
    borderRadius: 18,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { ...typography.bodyMedium, color: '#fff' },
});
