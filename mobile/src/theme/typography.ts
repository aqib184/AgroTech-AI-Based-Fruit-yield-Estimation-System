import { TextStyle } from 'react-native';

export const typography = {
  hero: { fontSize: 28, fontWeight: '700' as TextStyle['fontWeight'], letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '700' as TextStyle['fontWeight'] },
  section: { fontSize: 18, fontWeight: '700' as TextStyle['fontWeight'] },
  body: { fontSize: 16, fontWeight: '400' as TextStyle['fontWeight'] },
  bodyMedium: { fontSize: 16, fontWeight: '600' as TextStyle['fontWeight'] },
  caption: { fontSize: 13, fontWeight: '500' as TextStyle['fontWeight'] },
  micro: { fontSize: 11, fontWeight: '600' as TextStyle['fontWeight'], letterSpacing: 0.3 },
};
