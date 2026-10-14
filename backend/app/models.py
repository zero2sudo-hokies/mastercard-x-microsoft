"""Pydantic models for every type in CONTRACTS.md. P3 imports these; keep names stable."""
from typing import Literal, Optional

from pydantic import BaseModel, Field

Topic = Literal["fees", "fraud_scams", "transfers", "account_closed", "customer_service", "distrust"]
TOPICS: tuple[str, ...] = ("fees", "fraud_scams", "transfers", "account_closed", "customer_service", "distrust")
Level = Literal["state", "county"]
IssuerType = Literal["community", "large_bank"]
AudienceBasis = Literal["underserved", "unbanked", "interested_unbanked"]
FrustrationStatus = Literal["ok", "low_data", "no_data"]
TopicMap = dict[str, float]


# ---- data layer ----
class Area(BaseModel):
    fips: str
    name: str
    level: Level
    state_fips: str
    state_abbr: str
    population: int
    households: int
    median_income: Optional[int] = None
    poverty_rate: Optional[float] = None
    no_internet_rate: Optional[float] = None
    branches: Optional[int] = None
    branches_per_10k_hh: Optional[float] = None
    unbanked_rate: Optional[float] = None
    underbanked_rate: Optional[float] = None
    underserved_rate: Optional[float] = None
    est_underserved_hh: int
    exclusion_index: float
    exclusion_rank: int
    centroid: Optional[list[float]] = None


class Excerpt(BaseModel):
    topic: Topic
    intensity: int
    text: str


class FrustrationArea(BaseModel):
    fips: str
    level: Level
    complaints: int
    complaints_per_100k: Optional[float] = None
    narratives_classified: int = 0
    mean_intensity: Optional[float] = None
    intensity_source: Optional[Literal["area", "state", "national"]] = None
    topic_counts: Optional[dict[str, int]] = None
    topic_shares: Optional[TopicMap] = None
    pain_scores: Optional[TopicMap] = None
    top_topic: Optional[Topic] = None
    second_topic: Optional[Topic] = None
    top_topic_lead: Optional[float] = None
    clear_lead: Optional[bool] = None
    frustration_score: Optional[float] = None
    status: FrustrationStatus
    excerpts: list[Excerpt] = []


class Benefit(BaseModel):
    id: str
    topic: Topic
    title: str
    description: str
    pain_measure: str


# ---- API responses ----
class AreaSummary(BaseModel):
    fips: str
    name: str
    level: Level
    state_fips: str
    state_abbr: str
    exclusion_index: float
    frustration_score: Optional[float] = None
    frustration_status: FrustrationStatus
    top_topic: Optional[Topic] = None
    top_benefit_id: Optional[str] = None
    pain_scores: Optional[TopicMap] = None
    est_underserved_hh: int
    priority_score: Optional[float] = None


class Lookalike(BaseModel):
    fips: str
    name: str
    state_abbr: str
    distance_km: int
    similarity: float
    exclusion_index: float
    frustration_score: Optional[float] = None
    top_topic: Optional[Topic] = None


class AreaProfile(BaseModel):
    area: Area
    frustration: Optional[FrustrationArea] = None
    benefit: Optional[Benefit] = None
    lookalikes: list[Lookalike]
    labels: list[str]


class Recommendation(BaseModel):
    rank: int
    fips: str
    name: str
    state_abbr: str
    level: Level
    priority_score: float
    exclusion_index: float
    frustration_score: Optional[float] = None
    top_topic: Optional[Topic] = None
    benefit_id: Optional[str] = None
    clear_lead: Optional[bool] = None
    est_underserved_hh: int
    reasons: list[str]


class DataSource(BaseModel):
    areas: Literal["pipeline", "fixtures"]
    frustration: Literal["pipeline", "fixtures"]


class Health(BaseModel):
    status: Literal["ok"] = "ok"
    data_source: DataSource
    ai_configured: bool


# ---- ROI ----
class RoiRequest(BaseModel):
    fips: str
    issuer_type: IssuerType = "community"
    adoption_rate: Optional[float] = Field(None, gt=0, le=1)
    churn: Optional[float] = Field(None, gt=0, le=1)
    cac: Optional[float] = Field(None, ge=0)
    fixed_program_cost: Optional[float] = Field(None, ge=0)
    network_yield: Optional[float] = Field(None, ge=0)
    # who adoption applies to; data/p3: the interest share applies to unbanked households only
    audience_basis: AudienceBasis = "underserved"


class RoiArea(BaseModel):
    fips: str
    name: str
    state_abbr: str
    est_underserved_hh: int


class RoiInputs(BaseModel):
    issuer_type: IssuerType
    adoption_rate: float
    churn: float
    cac: float
    fixed_program_cost: float
    network_yield: float
    audience_basis: AudienceBasis = "underserved"


class RoiAudience(BaseModel):
    basis: AudienceBasis
    area_households: int
    label: str


class RoiUnit(BaseModel):
    annual_spend: int
    swipe_revenue: int
    deposit_earnings: int
    fraud_loss: int
    servicing: int
    annual_margin: int
    ltv: int
    net_per_account: int
    breakeven_churn: Optional[float] = None


class RoiProgram(BaseModel):
    accounts: int
    issuer_net_lifetime: int
    network_volume_y1: int
    network_revenue_y1_est: int


class LtvPoint(BaseModel):
    churn: float
    ltv: int


class ScaleRow(BaseModel):
    level: str
    base: int
    unit: Literal["households", "adults"]
    accounts: int
    network_volume_y1: int


class RoiResult(BaseModel):
    area: RoiArea
    inputs: RoiInputs
    unit: RoiUnit
    program: RoiProgram
    ltv_curve: list[LtvPoint]
    scale: list[ScaleRow]
    labels: list[str]
    audience: Optional[RoiAudience] = None


class StateAudience(BaseModel):
    state_abbr: str
    survey_year: int
    households: int
    unbanked_households: int
    unbanked_rate: float
    underbanked_households: int
    underbanked_rate: float
    interested_share_of_unbanked: Optional[float] = None
    interested_unbanked_households: Optional[int] = None
    very_interested_households: Optional[int] = None
    interested_and_once_banked_households: Optional[int] = None
    n_unbanked_surveyed: int
    small_sample: bool


class BankBenchmark(BaseModel):
    id: str
    label: str
    banks: int
    net_interest_income_per_1000_deposits: float
    deposit_account_fees_per_1000_deposits: float
    all_operating_costs_per_1000_deposits: float
    median_efficiency_ratio_pct: Optional[float] = None


class RoiContext(BaseModel):
    fips: str
    state: Optional[StateAudience] = None
    area_audience: dict[str, int]  # basis -> households for this area (county values are modeled)
    banks: list[BankBenchmark]
    bank_quarter: Optional[str] = None
    labels: list[str]


# ---- bank partners (FDIC Summary of Deposits) ----
class BankEntry(BaseModel):
    rank: int
    cert: str
    name: str
    deposits: int
    deposit_share: float
    branches: int
    total_assets: int
    issuer_type: IssuerType
    fdic_community_bank: bool
    holding_company: Optional[str] = None
    hq_city: Optional[str] = None
    hq_state: Optional[str] = None
    specialization: Optional[str] = None
    net_interest_margin: Optional[float] = None  # whole-bank call-report ratios: context, not per-account economics
    efficiency_ratio: Optional[float] = None
    return_on_assets: Optional[float] = None


class BankLeaderboard(BaseModel):
    fips: str
    as_of: Optional[str] = None
    total_deposits: int = 0
    banks_present: int = 0
    banks: list[BankEntry] = []
    labels: list[str] = []


class BranchPin(BaseModel):
    cert: str
    bank: Optional[str] = None  # null for banks outside the area's top 10
    branch: str
    lat: float
    lon: float
    rank: Optional[int] = None  # leaderboard rank in this area, if top 10


class BranchPins(BaseModel):
    fips: str
    as_of: Optional[str] = None
    branches: list[BranchPin] = []


class BankCompareRequest(BaseModel):
    fips: str
    certs: list[str] = Field(min_length=2, max_length=5)
    adoption_rate: Optional[float] = Field(None, gt=0, le=1)
    churn: Optional[float] = Field(None, gt=0, le=1)
    cac: Optional[float] = Field(None, ge=0)
    fixed_program_cost: Optional[float] = Field(None, ge=0)
    audience_basis: AudienceBasis = "underserved"


class BankCompareRow(BaseModel):
    bank: BankEntry
    underserved_households_per_branch: Optional[int] = None
    roi: RoiResult


class BankCompare(BaseModel):
    fips: str
    area_name: str
    rows: list[BankCompareRow]
    labels: list[str]


# ---- chat + plan (P3 implements the routes) ----
class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatContext(BaseModel):
    layer: Literal["underserved", "frustration"] = "underserved"
    state_fips: Optional[str] = None
    selected_fips: Optional[str] = None


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    context: ChatContext = ChatContext()


class ToolCall(BaseModel):
    name: str
    args: dict = {}


class ChatResponse(BaseModel):
    reply: str
    recommendations: list[Recommendation] = []
    focus_fips: list[str] = []
    tool_calls: list[ToolCall] = []
    mode: Literal["foundry", "rules"]
    warnings: list[str] = []


class PlanRequest(BaseModel):
    fips: str
    roi: Optional[RoiRequest] = None
    bank_cert: Optional[str] = None  # target issuer from the bank leaderboard; tailors the pitch and sets its pricing tier
    partner_name: str = "Community credit union (TBD)"
    notes: str = ""


class PilotPlan(BaseModel):
    id: str
    fips: str
    area_name: str
    status: Literal["draft", "approved"]
    markdown: str
    model: str
    mode: Literal["foundry", "rules"]
    generated_at: str
    warnings: list[str] = []
    facts_used: dict = {}
    approved_by: Optional[str] = None
    approved_at: Optional[str] = None


class Checklist(BaseModel):
    compliance_review: bool = False
    community_partner: bool = False
    no_protected_attributes: bool = False


class ApproveRequest(BaseModel):
    reviewer: str
    markdown: str
    checklist: Checklist
