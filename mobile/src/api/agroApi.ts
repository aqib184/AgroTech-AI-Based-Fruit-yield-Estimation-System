import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { Mutex } from 'async-mutex';
import type { AuthState } from '@/store/authSlice';
import { setCredentials, setAccessToken } from '@/store/authSlice';
import { deleteToken, getToken, setToken } from '@/utils/secureTokens';
import type {
  DashboardResponse,
  EstimationDetail,
  EstimationListItem,
  FarmProfile,
  HealthResponse,
  OrchardAnalyticsResponse,
  OrchardCreateRequest,
  OrchardDetail,
  OrchardListItem,
  Paginated,
  PredictYieldFormInput,
  RegisterRequest,
  RegisterResponse,
  TaskCreateRequest,
  TaskDetail,
  TaskListItem,
  TaskRule,
  TaskRuleListItem,
  TaskSummary,
  TokenPair,
  YieldPredictResponse,
} from '@/api/types';

const extra = Constants.expoConfig?.extra as {
  apiBaseUrl?: string;
} | null;

function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.replace(/\/$/, '');
  if (Platform.OS === 'web') {
    const isLanLike = /^http:\/\/(?:10\.0\.2\.2|192\.168\.|172\.(?:1[6-9]|2\d|3[0-1])\.)/i.test(trimmed);
    const isLocalhostBrowser =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    // If web is running on this same machine via localhost, prefer localhost API.
    if (isLanLike && isLocalhostBrowser) {
      return 'http://127.0.0.1:8000';
    }
  }
  if (Platform.OS === 'android') {
    return trimmed.replace('127.0.0.1', '10.0.2.2').replace('localhost', '10.0.2.2');
  }
  return trimmed;
}

const baseUrl = normalizeBaseUrl(extra?.apiBaseUrl ?? '');

function normalizeList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }
  if (
    payload &&
    typeof payload === 'object' &&
    'results' in payload &&
    Array.isArray((payload as { results?: unknown }).results)
  ) {
    return (payload as { results: T[] }).results;
  }
  return [];
}

type Rootish = { auth: AuthState };

const rawBaseQuery = fetchBaseQuery({
  baseUrl,
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as Rootish).auth.accessToken;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

const mutex = new Mutex();

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  const isRefreshCall =
    typeof args === 'object' &&
    args.url === '/api/token/refresh/' &&
    (args as FetchArgs).method === 'POST';

  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status === 401 && !isRefreshCall) {
    if (!mutex.isLocked()) {
      const release = await mutex.acquire();
      try {
        const refresh = await getToken('refresh_token');
        if (!refresh) {
          await deleteToken('access_token');
          api.dispatch(setCredentials(null));
          return result;
        }
        const refreshResult = await rawBaseQuery(
          {
            url: '/api/token/refresh/',
            method: 'POST',
            body: { refresh },
          },
          api,
          extraOptions
        );
        if (
          refreshResult.data &&
          typeof refreshResult.data === 'object' &&
          'access' in refreshResult.data
        ) {
          const access = (refreshResult.data as TokenPair).access;
          await setToken('access_token', access);
          api.dispatch(setAccessToken(access));
          result = await rawBaseQuery(args, api, extraOptions);
        } else {
          await deleteToken('access_token');
          await deleteToken('refresh_token');
          api.dispatch(setCredentials(null));
        }
      } finally {
        release();
      }
    } else {
      await mutex.waitForUnlock();
      result = await rawBaseQuery(args, api, extraOptions);
    }
  }
  return result;
};

function buildPredictFormData(input: PredictYieldFormInput): FormData {
  const fd = new FormData();
  fd.append('variety', input.variety);
  fd.append('tree_maturity', input.tree_maturity);
  fd.append('planting_density', input.planting_density);
  if (input.orchard_id != null) fd.append('orchard_id', String(input.orchard_id));
  fd.append('include_visuals', input.include_visuals ? 'true' : 'false');
  if (input.total_trees != null && input.total_trees > 0) {
    fd.append('total_trees', String(input.total_trees));
  }
  if (input.orchard_area != null && input.orchard_area > 0) {
    fd.append('orchard_area', String(input.orchard_area));
    fd.append('area_unit', input.area_unit ?? 'acres');
  }
  for (const img of input.images) {
    if (img.file) {
      fd.append('images', img.file);
      continue;
    }
    fd.append('images', { uri: img.uri, name: img.name, type: img.type } as unknown as Blob);
  }
  return fd;
}

export const agroApi = createApi({
  reducerPath: 'agroApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Profile', 'Orchard', 'Estimation', 'Task', 'TaskRule', 'Dashboard', 'Analytics'],
  endpoints: (builder) => ({
    health: builder.query<HealthResponse, void>({
      query: () => ({ url: '/api/health/' }),
    }),

    register: builder.mutation<RegisterResponse, RegisterRequest>({
      query: (body) => ({
        url: '/api/users/register/',
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      }),
    }),

    login: builder.mutation<TokenPair, { username: string; password: string }>({
      query: (body) => ({
        url: '/api/token/',
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      }),
    }),

    profile: builder.query<FarmProfile, void>({
      query: () => '/api/users/profile/',
      providesTags: ['Profile'],
    }),

    updateProfile: builder.mutation<FarmProfile, Partial<FarmProfile>>({
      query: (body) => ({
        url: '/api/users/profile/',
        method: 'PATCH',
        body,
        headers: { 'Content-Type': 'application/json' },
      }),
      invalidatesTags: ['Profile'],
    }),

    orchards: builder.query<OrchardListItem[], void>({
      query: () => '/api/orchards/',
      transformResponse: (response: unknown) => normalizeList<OrchardListItem>(response),
      providesTags: (res) =>
        res
          ? [...res.map(({ id }) => ({ type: 'Orchard' as const, id })), { type: 'Orchard', id: 'LIST' }]
          : [{ type: 'Orchard', id: 'LIST' }],
    }),

    orchard: builder.query<OrchardDetail, number>({
      query: (id) => `/api/orchards/${id}/`,
      providesTags: (_r, _e, id) => [{ type: 'Orchard', id }],
    }),

    createOrchard: builder.mutation<OrchardListItem, OrchardCreateRequest>({
      query: (body) => ({
        url: '/api/orchards/',
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      }),
      invalidatesTags: [{ type: 'Orchard', id: 'LIST' }],
    }),

    updateOrchard: builder.mutation<OrchardDetail, { id: number; body: Partial<OrchardCreateRequest> }>({
      query: ({ id, body }) => ({
        url: `/api/orchards/${id}/`,
        method: 'PATCH',
        body,
        headers: { 'Content-Type': 'application/json' },
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Orchard', id },
        { type: 'Orchard', id: 'LIST' },
      ],
    }),

    deleteOrchard: builder.mutation<void, number>({
      query: (id) => ({ url: `/api/orchards/${id}/`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Orchard', id },
        { type: 'Orchard', id: 'LIST' },
      ],
    }),

    estimations: builder.query<
      Paginated<EstimationListItem>,
      { page?: number; orchard_id?: number; days?: number }
    >({
      query: ({ page = 1, orchard_id, days }) => ({
        url: '/api/estimations/',
        params: {
          page,
          ...(orchard_id != null ? { orchard_id } : {}),
          ...(days != null ? { days } : {}),
          ordering: '-estimation_date',
        },
      }),
      providesTags: (res) =>
        res?.results
          ? [
              ...res.results.map((e) => ({ type: 'Estimation' as const, id: e.id })),
              { type: 'Estimation', id: 'LIST' },
            ]
          : [{ type: 'Estimation', id: 'LIST' }],
    }),

    estimation: builder.query<EstimationDetail, number>({
      query: (id) => `/api/estimations/${id}/`,
      providesTags: (_r, _e, id) => [{ type: 'Estimation', id }],
    }),

    patchEstimation: builder.mutation<EstimationDetail, { id: number; notes: string }>({
      query: ({ id, notes }) => ({
        url: `/api/estimations/${id}/`,
        method: 'PATCH',
        body: { notes },
        headers: { 'Content-Type': 'application/json' },
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Estimation', id },
        { type: 'Estimation', id: 'LIST' },
      ],
    }),

    deleteEstimation: builder.mutation<void, number>({
      query: (id) => ({ url: `/api/estimations/${id}/`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Estimation', id },
        { type: 'Estimation', id: 'LIST' },
        { type: 'Dashboard', id: 'ROOT' },
      ],
    }),

    predictYield: builder.mutation<YieldPredictResponse, PredictYieldFormInput>({
      query: (input) => ({
        url: '/api/predict/yield/',
        method: 'POST',
        body: buildPredictFormData(input),
      }),
      invalidatesTags: [
        { type: 'Estimation', id: 'LIST' },
        { type: 'Orchard', id: 'LIST' },
        { type: 'Task', id: 'LIST' },
        { type: 'Dashboard', id: 'ROOT' },
      ],
    }),

    taskRules: builder.query<TaskRuleListItem[] | TaskRule[], void>({
      query: () => '/api/task-rules/',
      transformResponse: (response: unknown) => normalizeList<TaskRuleListItem | TaskRule>(response),
      providesTags: [{ type: 'TaskRule', id: 'LIST' }],
    }),

    taskRule: builder.query<TaskRule, number>({
      query: (id) => `/api/task-rules/${id}/`,
      providesTags: (_r, _e, id) => [{ type: 'TaskRule', id }],
    }),

    createTaskRule: builder.mutation<TaskRule, Record<string, unknown>>({
      query: (body) => ({
        url: '/api/task-rules/',
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      }),
      invalidatesTags: [{ type: 'TaskRule', id: 'LIST' }],
    }),

    updateTaskRule: builder.mutation<TaskRule, { id: number; body: Partial<TaskRule> }>({
      query: ({ id, body }) => ({
        url: `/api/task-rules/${id}/`,
        method: 'PATCH',
        body,
        headers: { 'Content-Type': 'application/json' },
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'TaskRule', id },
        { type: 'TaskRule', id: 'LIST' },
      ],
    }),

    deleteTaskRule: builder.mutation<void, number>({
      query: (id) => ({ url: `/api/task-rules/${id}/`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'TaskRule', id: 'LIST' }],
    }),

    tasks: builder.query<
      Paginated<TaskListItem>,
      {
        page?: number;
        status?: string;
        priority?: string;
        orchard_id?: number;
        due_date_before?: string;
      }
    >({
      query: ({ page = 1, status, priority, orchard_id, due_date_before }) => ({
        url: '/api/tasks/',
        params: {
          page,
          ...(status ? { status } : {}),
          ...(priority ? { priority } : {}),
          ...(orchard_id != null ? { orchard_id } : {}),
          ...(due_date_before ? { due_date_before } : {}),
          ordering: '-created_at',
        },
      }),
      providesTags: (res) =>
        res?.results
          ? [...res.results.map((t) => ({ type: 'Task' as const, id: t.id })), { type: 'Task', id: 'LIST' }]
          : [{ type: 'Task', id: 'LIST' }],
    }),

    taskSummary: builder.query<TaskSummary, void>({
      query: () => '/api/tasks/summary/',
      providesTags: [{ type: 'Task', id: 'SUMMARY' }],
    }),

    task: builder.query<TaskDetail, number>({
      query: (id) => `/api/tasks/${id}/`,
      providesTags: (_r, _e, id) => [{ type: 'Task', id }],
    }),

    createTask: builder.mutation<TaskListItem, TaskCreateRequest>({
      query: (body) => ({
        url: '/api/tasks/',
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      }),
      invalidatesTags: [
        { type: 'Task', id: 'LIST' },
        { type: 'Task', id: 'SUMMARY' },
        { type: 'Dashboard', id: 'ROOT' },
      ],
    }),

    updateTask: builder.mutation<TaskDetail, { id: number; status: string }>({
      query: ({ id, status }) => ({
        url: `/api/tasks/${id}/`,
        method: 'PATCH',
        body: { status },
        headers: { 'Content-Type': 'application/json' },
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Task', id },
        { type: 'Task', id: 'LIST' },
        { type: 'Task', id: 'SUMMARY' },
        { type: 'Dashboard', id: 'ROOT' },
      ],
    }),

    deleteTask: builder.mutation<void, number>({
      query: (id) => ({ url: `/api/tasks/${id}/`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Task', id },
        { type: 'Task', id: 'LIST' },
        { type: 'Task', id: 'SUMMARY' },
      ],
    }),

    dashboard: builder.query<DashboardResponse, { days: 7 | 30 }>({
      query: ({ days }) => ({
        url: '/api/analytics/dashboard/',
        params: { days },
      }),
      providesTags: [{ type: 'Dashboard', id: 'ROOT' }],
    }),

    orchardAnalytics: builder.query<OrchardAnalyticsResponse, { id: number; days: number }>({
      query: ({ id, days }) => ({
        url: `/api/analytics/orchard/${id}/`,
        params: { days },
      }),
      providesTags: (_r, _e, { id }) => [{ type: 'Analytics', id }],
    }),
  }),
});

export const {
  useHealthQuery,
  useLazyHealthQuery,
  useRegisterMutation,
  useLoginMutation,
  useProfileQuery,
  useUpdateProfileMutation,
  useOrchardsQuery,
  useOrchardQuery,
  useCreateOrchardMutation,
  useUpdateOrchardMutation,
  useDeleteOrchardMutation,
  useEstimationsQuery,
  useEstimationQuery,
  usePatchEstimationMutation,
  useDeleteEstimationMutation,
  usePredictYieldMutation,
  useTaskRulesQuery,
  useTaskRuleQuery,
  useCreateTaskRuleMutation,
  useUpdateTaskRuleMutation,
  useDeleteTaskRuleMutation,
  useTasksQuery,
  useTaskSummaryQuery,
  useTaskQuery,
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
  useDashboardQuery,
  useOrchardAnalyticsQuery,
} = agroApi;
