import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { EstimationStackParamList } from './types';
import { EstimationHomeScreen } from '@/features/estimation/EstimationHomeScreen';
import { EstimationFormScreen } from '@/features/estimation/EstimationFormScreen';
import { EstimationResultScreen } from '@/features/estimation/EstimationResultScreen';
import { EstimationHistoryScreen } from '@/features/estimation/EstimationHistoryScreen';
import { EstimationDetailScreen } from '@/features/estimation/EstimationDetailScreen';
import { appHeaderOptions } from './headerStyles';

const Stack = createNativeStackNavigator<EstimationStackParamList>();

export function EstimationNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        ...appHeaderOptions,
      }}
    >
      <Stack.Screen
        name="EstimationHome"
        component={EstimationHomeScreen}
        options={{ title: 'Orchards', headerBackVisible: false, headerLeft: () => null }}
      />
      <Stack.Screen
        name="EstimationForm"
        component={EstimationFormScreen}
        options={{ title: 'New estimation' }}
      />
      <Stack.Screen
        name="EstimationResult"
        component={EstimationResultScreen}
        options={{ title: 'Results' }}
      />
      <Stack.Screen
        name="EstimationHistory"
        component={EstimationHistoryScreen}
        options={{ title: 'History' }}
      />
      <Stack.Screen
        name="EstimationDetail"
        component={EstimationDetailScreen}
        options={{ title: 'Estimation' }}
      />
    </Stack.Navigator>
  );
}
