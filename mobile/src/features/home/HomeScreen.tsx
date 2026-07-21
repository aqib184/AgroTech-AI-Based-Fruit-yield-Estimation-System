import { useCallback, useEffect, useMemo } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  useDashboardQuery,
  useEstimationsQuery,
  useOrchardsQuery,
  useProfileQuery,
  useTaskSummaryQuery,
  useTasksQuery,
} from '@/api/agroApi';
import { useAppSelector } from '@/store/hooks';
import { useAppWeather } from '@/hooks/useAppWeather';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { DashboardCard } from '@/components/DashboardCard';
import { QuickAccessCard } from '@/components/QuickAccessCard';
import { OrchardCard } from '@/components/OrchardCard';
import { SectionTitle } from '@/components/SectionTitle';
import { StatCard } from '@/components/StatCard';
import { TaskRow } from '@/components/TaskRow';
import { WeatherHeader } from '@/components/WeatherHeader';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/Skeleton';
import { colors, spacing, typography } from '@/theme';
import {
  HOME_ESTIMATION_CARD_IMAGE,
  HOME_HEADER_IMAGE,
  QUICK_GLANCE_ADVISORY_IMAGE,
  QUICK_GLANCE_CANOPY_IMAGE,
  QUICK_GLANCE_WEATHER_IMAGE,
} from '@/constants/media';
import { formatKg } from '@/utils/format';
import { setJsonCache } from '@/utils/cache';
import { cacheKeys } from '@/utils/cache';

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const skip = !accessToken;

  const profileQ = useProfileQuery(undefined, { skip });
  const orchardsQ = useOrchardsQuery(undefined, { skip });
  const estQ = useEstimationsQuery({ page: 1, days: 30 }, { skip });
  const tasksQ = useTasksQuery({ page: 1 }, { skip });
  const dashQ = useDashboardQuery({ days: 30 }, { skip });
  const summaryQ = useTaskSummaryQuery(undefined, { skip });
  const weather = useAppWeather(profileQ.data);

  const refreshing =
    profileQ.isFetching ||
    orchardsQ.isFetching ||
    estQ.isFetching ||
    tasksQ.isFetching ||
    dashQ.isFetching;

  const onRefresh = useCallback(() => {
    profileQ.refetch();
    orchardsQ.refetch();
    estQ.refetch();
    tasksQ.refetch();
    dashQ.refetch();
    summaryQ.refetch();
    weather.refresh();
  }, [profileQ, orchardsQ, estQ, tasksQ, dashQ, summaryQ, weather]);

  const greeting = profileQ.data?.user_name?.trim() || profileQ.data?.farm_name || 'Grower';

  const overview = useMemo(() => {
    const s = dashQ.data?.summary;
    const estItems = estQ.data?.results ?? [];
    const listAvgYield = estItems.length
      ? estItems.reduce((sum, item) => sum + (item.orchard_yield_kg ?? 0), 0) / estItems.length
      : 0;
    const estCount = s?.total_estimations ?? estQ.data?.count ?? 0;
    const avgYield = s?.avg_yield_per_estimation_kg ?? listAvgYield;
    const orchardsActive = s?.orchards_with_estimations ?? orchardsQ.data?.length ?? 0;
    return {
      estCount,
      avgYield,
      orchardsActive,
      ripe: s?.ripe_average_pct ?? 0,
    };
  }, [dashQ.data, estQ.data, orchardsQ.data]);

  useEffect(() => {
    if (dashQ.data && profileQ.data) {
      void setJsonCache(cacheKeys.homeSnapshot, { dashboard: dashQ.data, profile: profileQ.data }, 10 * 60 * 1000);
    }
  }, [dashQ.data, profileQ.data]);

  const previewTasks = tasksQ.data?.results?.slice(0, 3) ?? [];

  const goEstimation = () => {
    navigation.getParent()?.navigate('EstimationTab', { screen: 'EstimationHome' });
  };
  const goTasks = () => navigation.getParent()?.navigate('TasksTab', { screen: 'TaskList' });
  const goOrchard = (id: number) => {
    navigation.getParent()?.navigate('SettingsTab', { screen: 'OrchardDetail', params: { id } });
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 100 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <AppHeader
        greeting="Good Morning"
        title={greeting}
        imageSource={HOME_HEADER_IMAGE}
        onRightPress={() => navigation.navigate('Notifications')}
      />

      <View style={styles.weatherGap}>
        <WeatherHeader loading={weather.loading} error={weather.error} data={weather.data} />
      </View>

      {dashQ.isLoading && !dashQ.data ? (
        <Skeleton height={120} style={{ marginBottom: spacing.md }} />
      ) : null}

      <DashboardCard
        title="Start New Estimation"
        subtitle="Capture a tree image to estimate yield"
        imageSource={HOME_ESTIMATION_CARD_IMAGE}
        imageResizeMode="contain"
        onPress={goEstimation}
      />

      <SectionTitle title="Quick Glance" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickRow}>
        <QuickAccessCard
          label="Weather Impact"
          description="See rain, wind, and spray-risk impact for this week"
          icon="partly-sunny"
          imageSource={QUICK_GLANCE_WEATHER_IMAGE}
          imageResizeMode="cover"
          onPress={() => navigation.getParent()?.navigate('AnalyticsTab', { screen: 'AnalyticsMain' })}
        />
        <QuickAccessCard
          label="Canopy Hint"
          description="Review canopy and vigor cues before the next run"
          icon="scan"
          imageSource={QUICK_GLANCE_CANOPY_IMAGE}
          onPress={goEstimation}
        />
        <QuickAccessCard
          label="Advisory"
          description="Open automation rules and recommended task actions"
          icon="notifications"
          imageSource={QUICK_GLANCE_ADVISORY_IMAGE}
          onPress={() => navigation.getParent()?.navigate('SettingsTab', { screen: 'TaskRules' })}
        />
      </ScrollView>

      <View style={styles.statsRow}>
        <StatCard label="Estimations" value={String(overview.estCount)} hint="Last 30 days" />
        <StatCard label="Avg yield" value={formatKg(overview.avgYield, 1)} hint="Per run" />
        <StatCard label="Active blocks" value={String(overview.orchardsActive)} hint="With data" />
      </View>

      <SectionTitle
        title="My orchards"
        actionLabel="Manage"
        onAction={() => navigation.getParent()?.navigate('SettingsTab', { screen: 'OrchardList' })}
      />
      {orchardsQ.isLoading ? (
        <Skeleton height={88} />
      ) : orchardsQ.data?.length ? (
        orchardsQ.data.slice(0, 4).map((o) => <OrchardCard key={o.id} orchard={o} onPress={() => goOrchard(o.id)} />)
      ) : (
        <EmptyState title="No orchards yet" subtitle="Add a block in Settings to link yield runs." />
      )}

      <SectionTitle title="Today's tasks" actionLabel="View all" onAction={goTasks} />
      {summaryQ.data ? (
        <AppCard style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.summaryLabel}>Inbox</Text>
              <Text style={styles.summaryBig}>
                {summaryQ.data.pending + summaryQ.data.in_progress} open
              </Text>
              <Text style={styles.summaryMuted}>{summaryQ.data.overdue} overdue</Text>
            </View>
            <View style={styles.ringWrap}>
              <Text style={styles.ringText}>
                {summaryQ.data.completed} done
              </Text>
            </View>
          </View>
        </AppCard>
      ) : null}
      {tasksQ.isLoading ? (
        <Skeleton height={72} style={{ marginTop: spacing.sm }} />
      ) : previewTasks.length ? (
        previewTasks.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            onPress={() =>
              navigation.getParent()?.navigate('TasksTab', { screen: 'TaskDetail', params: { id: t.id } })
            }
          />
        ))
      ) : (
        <EmptyState title="No tasks" subtitle="Complete an estimation or add a manual task." icon="checkbox-outline" />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg },
  weatherGap: { marginTop: spacing.sm },
  quickRow: { marginBottom: spacing.lg },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  summaryCard: { marginBottom: spacing.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { ...typography.micro, color: colors.textMuted, textTransform: 'uppercase' },
  summaryBig: { ...typography.title, color: colors.primaryDark },
  summaryMuted: { ...typography.caption, color: colors.warning, marginTop: 2 },
  ringWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 6,
    borderColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringText: { ...typography.micro, color: colors.primaryDark, textAlign: 'center' },
});
