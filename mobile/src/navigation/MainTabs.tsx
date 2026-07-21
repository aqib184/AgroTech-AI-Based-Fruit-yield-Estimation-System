import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { CommonActions } from '@react-navigation/native';
import type { MainTabParamList } from './types';
import { colors, typography } from '@/theme';
import { HomeNavigator } from './HomeNavigator';
import { EstimationNavigator } from './EstimationNavigator';
import { TasksNavigator } from './TasksNavigator';
import { AnalyticsNavigator } from './AnalyticsNavigator';
import { SettingsNavigator } from './SettingsNavigator';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  const rootScreenByTab: Record<keyof MainTabParamList, string> = {
    HomeTab: 'HomeMain',
    EstimationTab: 'EstimationHome',
    TasksTab: 'TaskList',
    AnalyticsTab: 'AnalyticsMain',
    SettingsTab: 'SettingsMain',
  };

  const makeResetListener =
    (tabName: keyof MainTabParamList) =>
    ({ navigation, route }: { navigation: any; route: any }) => ({
      tabPress: (e: any) => {
        e.preventDefault();
        navigation.navigate(route.name, { screen: rootScreenByTab[tabName] });
      },
    });

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { ...typography.micro, fontSize: 11 },
        tabBarStyle: {
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarIcon: ({ color, size }) => {
          const map: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
            HomeTab: 'home',
            EstimationTab: 'leaf',
            TasksTab: 'list',
            AnalyticsTab: 'stats-chart',
            SettingsTab: 'settings',
          };
          const name = map[route.name as keyof MainTabParamList];
          return <Ionicons name={name} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeNavigator}
        options={{ title: 'Home' }}
        listeners={makeResetListener('HomeTab')}
      />
      <Tab.Screen
        name="EstimationTab"
        component={EstimationNavigator}
        options={{ title: 'Orchards' }}
        listeners={makeResetListener('EstimationTab')}
      />
      <Tab.Screen
        name="TasksTab"
        component={TasksNavigator}
        options={{ title: 'Tasks' }}
        listeners={makeResetListener('TasksTab')}
      />
      <Tab.Screen
        name="AnalyticsTab"
        component={AnalyticsNavigator}
        options={{ title: 'Analytics' }}
        listeners={makeResetListener('AnalyticsTab')}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsNavigator}
        options={{ title: 'Settings' }}
        listeners={makeResetListener('SettingsTab')}
      />
    </Tab.Navigator>
  );
}
