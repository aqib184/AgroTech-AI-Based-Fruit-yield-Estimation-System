import { ScrollView, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfileQuery, useTasksQuery } from '@/api/agroApi';
import { AppCard } from '@/components/AppCard';
import { EmptyState } from '@/components/EmptyState';
import { SectionTitle } from '@/components/SectionTitle';
import { TaskRow } from '@/components/TaskRow';
import { WeatherHeader } from '@/components/WeatherHeader';
import { useAppWeather } from '@/hooks/useAppWeather';
import { useAppSelector } from '@/store/hooks';
import { colors, spacing, typography } from '@/theme';

type TaskLite = {
  id: number;
  orchard_id: number | null;
  orchard_name: string | null;
  title: string;
  priority: string;
  status: string;
  due_date: string | null;
  triggered_by_rule_id: number | null;
  triggered_by_rule_name?: string | null;
  triggered_by_estimation_id: number | null;
  created_at: string;
};

export function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const accessToken = useAppSelector((s) => s.auth.accessToken);

  const { data: profile } = useProfileQuery(undefined, { skip: !accessToken });
  const weather = useAppWeather(profile);
  const tasksQ = useTasksQuery({ page: 1 }, { skip: !accessToken });

  const autoTasks: TaskLite[] = (tasksQ.data?.results ?? []).filter((t) => t.triggered_by_rule_id != null);
  const hasWeatherAlert =
    !!weather.data &&
    (weather.data.sprayHint.tone !== 'good' || weather.data.rainChancePct >= 45 || weather.data.windMps >= 6);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.xxxl }}
    >
      <Text style={styles.lead}>Auto-generated tasks and weather alerts in one place.</Text>

      <SectionTitle title="Weather alerts" />
      {weather.data ? (
        <WeatherHeader loading={weather.loading} error={weather.error} data={weather.data} compact />
      ) : (
        <AppCard>
          <Text style={styles.meta}>Weather data is unavailable right now.</Text>
        </AppCard>
      )}

      <AppCard style={{ marginBottom: spacing.md }}>
        <Text style={styles.alertLabel}>{hasWeatherAlert ? 'Action needed' : 'No urgent alert'}</Text>
        <Text style={styles.meta}>
          {hasWeatherAlert
            ? weather.data?.sprayHint.label
            : 'Conditions look stable right now. Continue with planned orchard tasks.'}
        </Text>
      </AppCard>

      <SectionTitle title="New auto-generated tasks" />
      {autoTasks.length ? (
        autoTasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onPress={() =>
              navigation.getParent()?.navigate('TasksTab', {
                screen: 'TaskDetail',
                params: { id: task.id },
              })
            }
          />
        ))
      ) : (
        <EmptyState
          title="No auto-generated tasks"
          subtitle="New rule-triggered tasks will appear here after estimations."
          icon="notifications-outline"
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg },
  lead: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md },
  alertLabel: { ...typography.bodyMedium, color: colors.primaryDark },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
});
