import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
};

export type HomeStackParamList = {
  HomeMain: undefined;
  Notifications: undefined;
};

export type EstimationStackParamList = {
  EstimationHome: undefined;
  EstimationForm: { orchardId?: number } | undefined;
  EstimationResult: undefined;
  EstimationHistory: undefined;
  EstimationDetail: { id: number };
};

export type TasksStackParamList = {
  TaskList: undefined;
  TaskDetail: { id: number };
  CreateTask: undefined;
};

export type AnalyticsStackParamList = {
  AnalyticsMain: undefined;
  OrchardAnalytics: { id: number; name: string };
};

export type SettingsStackParamList = {
  SettingsMain: undefined;
  ProfileEdit: undefined;
  OrchardList: undefined;
  OrchardDetail: { id: number };
  OrchardForm: { mode: 'create' } | { mode: 'edit'; id: number };
  TaskRules: undefined;
};

export type MainTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  EstimationTab: NavigatorScreenParams<EstimationStackParamList>;
  TasksTab: NavigatorScreenParams<TasksStackParamList>;
  AnalyticsTab: NavigatorScreenParams<AnalyticsStackParamList>;
  SettingsTab: NavigatorScreenParams<SettingsStackParamList>;
};

export type RootStackParamList = {
  Boot: undefined;
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Onboarding: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
};
