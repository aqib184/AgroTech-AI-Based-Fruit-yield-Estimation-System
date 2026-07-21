import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { SettingsStackParamList } from './types';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { ProfileEditScreen } from '@/features/settings/ProfileEditScreen';
import { OrchardListScreen } from '@/features/orchards/OrchardListScreen';
import { OrchardDetailScreen } from '@/features/orchards/OrchardDetailScreen';
import { OrchardFormScreen } from '@/features/orchards/OrchardFormScreen';
import { TaskRulesScreen } from '@/features/settings/TaskRulesScreen';
import { appHeaderOptions } from './headerStyles';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export function SettingsNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        ...appHeaderOptions,
      }}
    >
      <Stack.Screen
        name="SettingsMain"
        component={SettingsScreen}
        options={{ title: 'Settings', headerBackVisible: false, headerLeft: () => null }}
      />
      <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} options={{ title: 'Farm profile' }} />
      <Stack.Screen name="OrchardList" component={OrchardListScreen} options={{ title: 'Orchards' }} />
      <Stack.Screen name="OrchardDetail" component={OrchardDetailScreen} options={{ title: 'Orchard' }} />
      <Stack.Screen
        name="OrchardForm"
        component={OrchardFormScreen}
        options={({ route }) => ({
          title: route.params.mode === 'create' ? 'Add orchard' : 'Edit orchard',
        })}
      />
      <Stack.Screen name="TaskRules" component={TaskRulesScreen} options={{ title: 'Task rules' }} />
    </Stack.Navigator>
  );
}
