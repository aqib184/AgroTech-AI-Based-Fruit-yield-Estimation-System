import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { TasksStackParamList } from './types';
import { TasksScreen } from '@/features/tasks/TasksScreen';
import { TaskDetailScreen } from '@/features/tasks/TaskDetailScreen';
import { CreateTaskScreen } from '@/features/tasks/CreateTaskScreen';
import { appHeaderOptions } from './headerStyles';

const Stack = createNativeStackNavigator<TasksStackParamList>();

export function TasksNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        ...appHeaderOptions,
      }}
    >
      <Stack.Screen
        name="TaskList"
        component={TasksScreen}
        options={{ title: 'Tasks', headerBackVisible: false, headerLeft: () => null }}
      />
      <Stack.Screen name="TaskDetail" component={TaskDetailScreen} options={{ title: 'Task' }} />
      <Stack.Screen name="CreateTask" component={CreateTaskScreen} options={{ title: 'New task' }} />
    </Stack.Navigator>
  );
}
