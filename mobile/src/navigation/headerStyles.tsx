import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { colors } from '@/theme';

function HeaderBackground() {
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={StyleSheet.absoluteFill} />
    </View>
  );
}

export const appHeaderOptions: NativeStackNavigationOptions = {
  headerBackTitleVisible: false,
  headerShadowVisible: false,
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '800', color: '#fff' },
  headerBackground: HeaderBackground,
  headerStyle: { backgroundColor: colors.primary },
};
