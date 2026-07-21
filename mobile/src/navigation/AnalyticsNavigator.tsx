import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AnalyticsStackParamList } from './types';
import { AnalyticsScreen } from '@/features/analytics/AnalyticsScreen';
import { OrchardAnalyticsScreen } from '@/features/analytics/OrchardAnalyticsScreen';
import { appHeaderOptions } from './headerStyles';

const Stack = createNativeStackNavigator<AnalyticsStackParamList>();

export function AnalyticsNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        ...appHeaderOptions,
      }}
    >
      <Stack.Screen
        name="AnalyticsMain"
        component={AnalyticsScreen}
        options={{ title: 'Analytics', headerBackVisible: false, headerLeft: () => null }}
      />
      <Stack.Screen
        name="OrchardAnalytics"
        component={OrchardAnalyticsScreen}
        options={({ route }) => ({ title: route.params.name })}
      />
    </Stack.Navigator>
  );
}
