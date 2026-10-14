// Mirrors CONTRACTS.md. snake_case like the API. Rates are decimals 0-1, missing values are null.

export type TopicId = "fees" | "fraud_scams" | "transfers" | "account_closed" | "customer_service" | "distrust";
export type Level = "state" | "county";
export type IssuerType = "community" | "large_bank";
export type AudienceBasis = "underserved" | "unbanked" | "interested_unbanked";
export type FrustrationStatus = "ok" | "low_data" | "no_data";
export type Layer = "underserved" | "frustration";
export type TopicMap = Record<TopicId, number>;

export interface Area {
  fips: string;
  name: string;
  level: Level;
  state_fips: string;
  state_abbr: string;
  population: number;
  households: number;
  median_income: number | null;
  poverty_rate: number | null;
  no_internet_rate: number | null;
  branches: number | null;
  branches_per_10k_hh: number | null;
  unbanked_rate: number | null;
  underbanked_rate: number | null;
  underserved_rate: number | null;
  est_underserved_hh: number;
  exclusion_index: number;
  exclusion_rank: number;
  centroid: [number, number] | null;
}

export interface Excerpt {
  topic: TopicId;
  intensity: number;
  text: string;
}

export interface FrustrationArea {
  fips: string;
  level: Level;
  complaints: number;
  complaints_per_100k: number | null;
  narratives_classified: number;
  mean_intensity: number | null;
  intensity_source: "area" | "state" | "national" | null;
  topic_counts: Record<TopicId, number> | null;
  topic_shares: TopicMap | null;
  pain_scores: TopicMap | null;
  top_topic: TopicId | null;
  second_topic: TopicId | null;
  top_topic_lead: number | null;
  clear_lead: boolean | null;
  frustration_score: number | null;
  status: FrustrationStatus;
  excerpts: Excerpt[];
}

export interface Benefit {
  id: string;
  topic: TopicId;
  title: string;
  description: string;
  pain_measure: string;
}

export interface AreaSummary {
  fips: string;
  name: string;
  level: Level;
  state_fips: string;
  state_abbr: string;
  exclusion_index: number;
  frustration_score: number | null;
  frustration_status: FrustrationStatus;
  top_topic: TopicId | null;
  top_benefit_id: string | null;
  pain_scores: TopicMap | null;
  est_underserved_hh: number;
  priority_score: number | null;
}

export interface Lookalike {
  fips: string;
  name: string;
  state_abbr: string;
  distance_km: number;
  similarity: number;
  exclusion_index: number;
  frustration_score: number | null;
  top_topic: TopicId | null;
}

export interface AreaProfile {
  area: Area;
  frustration: FrustrationArea | null;
  benefit: Benefit | null;
  lookalikes: Lookalike[];
  labels: string[];
}

export interface Recommendation {
  rank: number;
  fips: string;
  name: string;
  state_abbr: string;
  level: Level;
  priority_score: number;
  exclusion_index: number;
  frustration_score: number | null;
  top_topic: TopicId | null;
  benefit_id: string | null;
  clear_lead: boolean | null;
  est_underserved_hh: number;
  reasons: string[];
}

export interface RecommendationParams {
  level?: Level;
  state?: string;
  topic?: TopicId;
  limit?: number;
}

export interface Benchmarks {
  transactions_per_month: number;
  avg_ticket: number;
  interchange_per_tx: Record<IssuerType, number>;
  avg_balance: number;
  deposit_margin: number;
  fraud_rate: number;
  issuer_fraud_share: number;
  servicing: Record<IssuerType, number>;
  cac: Record<IssuerType, number>;
  churn_observed: Record<IssuerType, number>;
  network_yield_placeholder: number;
  us_underserved_hh: number;
  global_unbanked_adults: number;
  roi_defaults: { issuer_type: IssuerType; adoption_rate: number; fixed_program_cost: number };
  notes: Record<string, string>;
  sources?: Record<string, string>;
}

export interface Health {
  status: "ok";
  data_source: { areas: "pipeline" | "fixtures"; frustration: "pipeline" | "fixtures" };
  ai_configured: boolean;
}

export interface RoiRequest {
  fips: string;
  issuer_type: IssuerType;
  adoption_rate: number | null;
  churn: number | null;
  cac: number | null;
  fixed_program_cost: number | null;
  network_yield: number | null;
  audience_basis?: AudienceBasis;
}

export interface RoiResult {
  area: { fips: string; name: string; state_abbr: string; est_underserved_hh: number };
  inputs: {
    issuer_type: IssuerType;
    adoption_rate: number;
    churn: number;
    cac: number;
    fixed_program_cost: number;
    network_yield: number;
    audience_basis?: AudienceBasis;
  };
  unit: {
    annual_spend: number;
    swipe_revenue: number;
    deposit_earnings: number;
    fraud_loss: number;
    servicing: number;
    annual_margin: number;
    ltv: number;
    net_per_account: number;
    breakeven_churn: number | null;
  };
  program: { accounts: number; issuer_net_lifetime: number; network_volume_y1: number; network_revenue_y1_est: number };
  ltv_curve: { churn: number; ltv: number }[];
  scale: { level: string; base: number; unit: "households" | "adults"; accounts: number; network_volume_y1: number }[];
  labels: string[];
  audience?: { basis: AudienceBasis; area_households: number; label: string } | null;
}

export interface StateAudience {
  state_abbr: string;
  survey_year: number;
  households: number;
  unbanked_households: number;
  unbanked_rate: number;
  underbanked_households: number;
  underbanked_rate: number;
  interested_share_of_unbanked: number | null;
  interested_unbanked_households: number | null;
  very_interested_households: number | null;
  interested_and_once_banked_households: number | null;
  n_unbanked_surveyed: number;
  small_sample: boolean;
}

export interface BankBenchmark {
  id: string;
  label: string;
  banks: number;
  net_interest_income_per_1000_deposits: number;
  deposit_account_fees_per_1000_deposits: number;
  all_operating_costs_per_1000_deposits: number;
  median_efficiency_ratio_pct: number | null;
}

export interface RoiContext {
  fips: string;
  state: StateAudience | null;
  area_audience: Partial<Record<AudienceBasis, number>>;
  banks: BankBenchmark[];
  bank_quarter: string | null;
  labels: string[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatContext {
  layer: Layer;
  state_fips: string | null;
  selected_fips: string | null;
}

export interface ChatRequest {
  messages: ChatMessage[];
  context: ChatContext;
}

export interface ChatResponse {
  reply: string;
  recommendations: Recommendation[];
  focus_fips: string[];
  tool_calls: { name: string; args: Record<string, unknown> }[];
  mode: "foundry" | "rules";
  warnings: string[];
}

export interface BankEntry {
  rank: number;
  cert: string;
  name: string;
  website?: string | null;
  deposits: number;
  deposit_share: number;
  branches: number;
  total_assets: number;
  issuer_type: IssuerType;
  fdic_community_bank: boolean;
  holding_company: string | null;
  hq_city: string | null;
  hq_state: string | null;
  specialization: string | null;
  net_interest_margin: number | null;
  efficiency_ratio: number | null;
  return_on_assets: number | null;
}

export interface BankLeaderboard {
  fips: string;
  as_of: string | null;
  total_deposits: number;
  banks_present: number;
  banks: BankEntry[];
  labels: string[];
}

export interface BranchPin {
  cert: string;
  bank: string | null;
  website?: string | null;
  branch: string;
  lat: number;
  lon: number;
  rank: number | null;
}

export interface BranchPins {
  fips: string;
  as_of: string | null;
  branches: BranchPin[];
}

export interface BankCompareRequest {
  fips: string;
  certs: string[];
  adoption_rate?: number | null;
  churn?: number | null;
  cac?: number | null;
  fixed_program_cost?: number | null;
  audience_basis?: AudienceBasis;
}

export interface BankCompare {
  fips: string;
  area_name: string;
  rows: { bank: BankEntry; underserved_households_per_branch: number | null; roi: RoiResult }[];
  labels: string[];
}

export interface PlanRequest {
  fips: string;
  roi: RoiRequest | null;
  bank_cert?: string | null;
  partner_name: string;
  notes: string;
}

export interface PilotPlan {
  id: string;
  fips: string;
  area_name: string;
  status: "draft" | "approved";
  markdown: string;
  model: string;
  mode: "foundry" | "rules";
  generated_at: string;
  warnings: string[];
  facts_used: Record<string, unknown>;
  approved_by: string | null;
  approved_at: string | null;
}

export interface ApproveRequest {
  reviewer: string;
  markdown: string;
  checklist: { compliance_review: boolean; community_partner: boolean; no_protected_attributes: boolean };
}
