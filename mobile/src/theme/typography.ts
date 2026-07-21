import { TextStyle } from 'react-native';

export const typography = {
  hero: { fontSize: 30, fontWeight: '800' as TextStyle['fontWeight'], letterSpacing: -0.6 },
  title: { fontSize: 24, fontWeight: '800' as TextStyle['fontWeight'], letterSpacing: -0.3 },
  section: { fontSize: 19, fontWeight: '700' as TextStyle['fontWeight'] },
  body: { fontSize: 16, fontWeight: '400' as TextStyle['fontWeight'], lineHeight: 23 },
  bodyMedium: { fontSize: 16, fontWeight: '600' as TextStyle['fontWeight'], lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '500' as TextStyle['fontWeight'], lineHeight: 18 },
  micro: { fontSize: 11, fontWeight: '700' as TextStyle['fontWeight'], letterSpacing: 0.45 },
};
