/** Matches backend serializers / views exactly where possible */

export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type HealthResponse = {
  status: string;
  fruit_detection_model: string;
  ripeness_classifier_model: string;
  leaf_segmentation_model: string;
};

export type TokenPair = {
  access: string;
  refresh: string;
};

export type RegisterRequest = {
  username: string;
  email?: string;
  password: string;
  password2: string;
  first_name?: string;
  last_name?: string;
};

export type RegisterResponse = Record<string, unknown>;

export type FarmProfile = {
  id: number;
  user_name: string;
  email: string;
  farm_name: string;
  region: string | null;
  total_area_hectares: number | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  preferred_unit: 'kg' | 'tonnes';
  created_at: string;
  updated_at: string;
};

export type OrchardListItem = {
  id: number;
  name: string;
  variety: string;
  area_hectares: number;
  total_trees: number;
  trees_per_hectare: number;
  last_estimation_date: string | null;
  last_estimation_yield_kg: number | null;
  estimations_count?: number;
  created_at?: string;
};

export type LatestEstimationSummary = {
  id: number;
  estimation_date: string;
  orchard_yield_kg: number;
  ripe_percentage: number;
  canopy_score?: number;
} | null;

export type OrchardDetail = {
  id: number;
  name: string;
  variety: string;
  area_hectares: number;
  total_trees: number;
  planting_density: string;
  tree_maturity: string;
  section: string;
  trees_per_hectare: number;
  estimation_count: number;
  avg_yield_kg: number | null;
  latest_estimation: LatestEstimationSummary;
  created_at: string;
  updated_at: string;
};

export type OrchardCreateRequest = {
  name: string;
  variety: string;
  area_hectares: number;
  total_trees: number;
  planting_density: string;
  tree_maturity: string;
  section?: string;
};

export type EstimationListItem = {
  id: number;
  orchard_id: number;
  orchard_name: string;
  estimation_date: string;
  num_images: number;
  adjusted_fruit_count: number;
  ripe_percentage: number;
  canopy_completeness_score: number;
  rgb_vvi_score: number;
  orchard_yield_kg: number;
  orchard_yield_tonnes: number;
  yield_uncertainty_kg: number;
};

export type EstimationOrchardNested = {
  id: number;
  name: string;
  variety: string;
  total_trees: number;
  area_hectares?: number;
  trees_per_hectare?: number;
  last_estimation_date?: string | null;
  last_estimation_yield_kg?: number | null;
  estimations_count?: number;
  created_at?: string;
};

export type EstimationDetail = {
  id: number;
  orchard: EstimationOrchardNested;
  estimation_date: string;
  num_images: number;
  raw_fruit_count: number;
  adjusted_fruit_count: number;
  overlap_ratio: number;
  ripeness: {
    ripe_pct: number;
    midripe_pct: number;
    unripe_pct: number;
    flower_filtered: number;
  };
  canopy: {
    canopy_density: number;
    canopy_completeness: number;
    canopy_coverage_bbox: number | null;
  };
  vegetation_vigor: {
    rgb_vvi_score: number;
    vvi_reliability: number;
    vvi_components: { vari: number | null; exg: number | null; ngrdi: number | null };
  };
  yield_estimate: {
    orchard_yield_kg: number;
    orchard_yield_tonnes: number;
    yield_uncertainty_kg: number;
    uncertainty_pct: number | null;
    factors: Record<string, number>;
  };
  feature_vector: Record<string, number | string | null>;
  visualizations: YieldPredictVisualization[];
  harvest_recommendation: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type TaskRule = {
  id: number;
  name: string;
  trigger_type: string;
  ripeness_threshold?: number | null;
  canopy_completeness_threshold?: number | null;
  vvi_threshold?: number | null;
  task_title: string;
  task_description: string;
  priority: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type TaskRuleListItem = {
  id: number;
  name: string;
  trigger_type: string;
  task_title: string;
  priority: string;
  is_active: boolean;
  created_at: string;
};

export type TaskListItem = {
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

export type TaskDetail = {
  id: number;
  farm_profile: number;
  orchard_id: number | null;
  title: string;
  description: string;
  priority: string;
  status: string;
  triggered_by_rule_id: number | null;
  triggered_by_estimation_id: number | null;
  due_date: string | null;
  created_at: string;
  completed_at: string | null;
};

export type TaskCreateRequest = {
  orchard_id: number;
  title: string;
  description?: string;
  priority: string;
  due_date?: string;
};

export type TaskSummary = {
  pending: number;
  in_progress: number;
  completed: number;
  overdue: number;
};

export type DashboardSummary = {
  period?: string;
  total_estimations: number;
  total_estimations_kg: number;
  avg_yield_per_estimation_kg: number;
  orchards_with_estimations: number;
  ripe_average_pct: number;
  avg_canopy_pct: number;
  avg_vigor_pct: number;
};

export type DashboardTimePoint = {
  date: string;
  estimations: number;
  total_yield_kg: number;
  avg_ripe_pct: number;
  avg_canopy_pct?: number;
  avg_vigor_pct?: number;
};

export type DashboardVarietyRow = {
  variety: string;
  estimations: number;
  avg_yield_kg: number;
  max_yield_kg: number;
};

export type DashboardResponse = {
  period: string;
  summary: DashboardSummary;
  time_series: DashboardTimePoint[];
  by_variety: DashboardVarietyRow[];
  task_summary: TaskSummary;
};

export type OrchardAnalyticsResponse = {
  orchard_id: number;
  orchard_name: string;
  variety: string;
  period: string;
  summary: {
    estimations: number;
    avg_yield_kg: number | null;
    max_yield_kg: number | null;
    min_yield_kg: number | null;
    avg_ripeness_pct: number | null;
    avg_canopy_score: number | null;
    avg_vvi_score: number | null;
    avg_uncertainty_kg: number | null;
    avg_overlap_ratio: number | null;
  };
  estimations_trend: {
    date: string;
    fruit_count: number;
    yield_kg: number;
    ripe_pct: number;
    canopy_score: number;
    vigor_score: number;
    uncertainty_kg: number;
    overlap_ratio: number;
  }[];
  yield_factors_avg: Record<string, number>;
};

/** POST /api/predict/yield/ — YieldEstimateSerializer + inference payload */
export type PredictYieldFormInput = {
  variety:
    | 'golden_delicious'
    | 'fuji'
    | 'gala'
    | 'granny_smith'
    | 'honeycrisp'
    | 'other';
  tree_maturity: 'young' | 'mature' | 'old';
  planting_density: 'traditional' | 'semi_dwarf' | 'high_density';
  total_trees?: number | null;
  orchard_area?: number | null;
  area_unit?: 'acres' | 'hectares';
  orchard_id?: number | null;
  include_visuals: boolean;
  images: { uri: string; name: string; type: string; file?: File | Blob }[];
};

export type YieldPredictVisualization = {
  image_index: number;
  detected_count: number;
  leaf_method: string;
  bbox_overlay_base64: string;
  leaf_overlay_base64: string;
};

export type YieldPredictResponse = {
  fruit_count: {
    raw_count: number;
    adjusted_count: number;
    per_image_counts: number[];
    overlap_ratio: number;
    overlap_estimator: Record<string, unknown>;
  };
  ripeness: {
    ripe_percentage: number;
    midripe_percentage: number;
    unripe_percentage: number;
    flower_count_ignored: number;
  };
  leaf_area: Record<string, unknown>;
  detections: Record<string, unknown>;
  yield_estimate: {
    per_tree_yield_kg: number;
    orchard_yield_kg: number;
    orchard_yield_tonnes: number;
    confidence_interval: { lower_kg: number; upper_kg: number };
    uncertainty_ratio: number;
    factors: Record<string, number>;
  };
  harvest_recommendation: string;
  history: {
    saved: boolean;
    estimation_id: number | null;
    generated_task_ids: number[];
    error?: string;
  };
  visualizations?: YieldPredictVisualization[];
  [key: string]: unknown;
};
